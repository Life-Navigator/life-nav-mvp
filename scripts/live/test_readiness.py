"""Tests for the live readiness runner — the parts that must be right BEFORE credentials exist.

A runner you debug during a one-day credential window is a runner that wastes the window. These
cover the three things that would silently ruin a run:

  * a credential value getting printed,
  * UNMEASURED being treated as a pass,
  * a crashing check taking the rest of the run down with it.

Run: python -m pytest scripts/live/test_readiness.py
"""
from __future__ import annotations

import asyncio
import pathlib
import sys

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from _creds import HIGH_PRIVILEGE, Creds, load  # noqa: E402
from _report import (BLOCKED, FAIL, PASS, UNMEASURED, Report,  # noqa: E402
                     Result, skip, timed)

# A distinctive sentinel, deliberately NOT shaped like a credential and not assigned to a
# credential-named variable. The first version of this line was
# `SECRET = "sk-live-..."`, which gitleaks correctly blocked — a key-shaped literal in a test
# fixture is exactly what LN-SEC-2026-0729-02 was. The test only needs a string it can prove never
# reaches output, so it does not need to look real.
CANARY = "canary-value-must-not-appear-in-output-0000"


# ── Credentials never leak ───────────────────────────────────────────────────────────────────────
def test_fingerprint_never_contains_the_value():
    c = Creds(values={"SUPABASE_SERVICE_ROLE_KEY": CANARY})
    fp = c.fingerprint("SUPABASE_SERVICE_ROLE_KEY")
    assert CANARY not in fp
    assert "len=" in fp and "sha256=" in fp


def test_summary_never_contains_any_value():
    """The summary is printed at the top of every run, so this is the line most likely to leak."""
    c = Creds(values={k: CANARY for k in HIGH_PRIVILEGE})
    blob = "\n".join(c.summary())
    assert CANARY not in blob
    for k in HIGH_PRIVILEGE:
        assert k in blob, f"{k} missing from the summary"
        assert "HIGH-PRIV" in blob


def test_high_privilege_credentials_are_flagged():
    c = Creds(values={"SUPABASE_SERVICE_ROLE_KEY": CANARY, "WEB_URL": "https://x"})
    lines = {ln.split()[-3] if len(ln.split()) > 3 else "": ln for ln in c.summary()}
    flagged = [ln for ln in c.summary() if "SUPABASE_SERVICE_ROLE_KEY" in ln]
    unflagged = [ln for ln in c.summary() if "WEB_URL" in ln]
    assert "HIGH-PRIV" in flagged[0]
    assert "HIGH-PRIV" not in unflagged[0]


def test_an_empty_credential_counts_as_absent():
    """An unset env var expands to an empty string, and an empty key produces a confusing auth
    error several layers down instead of an honest 'not configured'."""
    c = Creds(values={"QDRANT_URL": "https://x", "QDRANT_API_KEY": ""})
    assert c.has("QDRANT_URL") is True
    assert c.has("QDRANT_URL", "QDRANT_API_KEY") is False
    assert c.missing("QDRANT_URL", "QDRANT_API_KEY") == ["QDRANT_API_KEY"]


def test_file_credentials_win_over_a_stale_environment(tmp_path, monkeypatch):
    """Silently preferring an exported variable is how a run measures the wrong project."""
    monkeypatch.setenv("GCP_PROJECT", "stale-from-env")
    f = tmp_path / "creds.env"
    f.write_text("# comment\nGCP_PROJECT=from-file\nQDRANT_API_KEY='quoted'\n\n")
    c = load(str(f))
    assert c.get("GCP_PROJECT") == "from-file"
    assert c.get("QDRANT_API_KEY") == "quoted"


def test_a_missing_credentials_file_fails_fast():
    with pytest.raises(SystemExit):
        load("/nonexistent/path/creds.env")


# ── UNMEASURED is never a pass ───────────────────────────────────────────────────────────────────
def test_unmeasured_required_check_blocks_readiness():
    """The core rule. 'We could not verify the fatal tenant-isolation gate' is not a pass."""
    r = Report()
    r.add(Result(check="a", status=PASS))
    r.add(skip("b.required", ["KEY"]))
    ready, reasons = r.verdict()
    assert ready is False
    assert any("UNMEASURED" in x and "b.required" in x for x in reasons)


def test_unmeasured_optional_check_does_not_block():
    r = Report()
    r.add(Result(check="a", status=PASS))
    r.add(skip("b.optional", ["KEY"], required=False))
    assert r.verdict()[0] is True


def test_blocked_counts_against_readiness():
    r = Report()
    r.add(Result(check="upstream", status=FAIL))
    r.add(Result(check="downstream", status=BLOCKED, detail="upstream failed"))
    ready, reasons = r.verdict()
    assert ready is False
    assert len(reasons) == 2


def test_all_pass_is_ready_but_the_verdict_states_its_limits():
    r = Report()
    r.add(Result(check="a", status=PASS))
    out = r.render()
    assert r.verdict()[0] is True
    # The verdict must not be mistaken for operational readiness.
    for expected in ("technical verdict only", "error tracking", "branch protection", "load"):
        assert expected in out, expected


def test_there_is_no_overall_score():
    """Readiness is a conjunction, not an average — one failed isolation check is not offset by
    nine healthy endpoints."""
    r = Report()
    for i in range(9):
        r.add(Result(check=f"ok{i}", status=PASS))
    r.add(Result(check="isolation", status=FAIL, detail="cross-tenant read"))
    assert r.verdict()[0] is False
    out = r.render().lower()
    assert "%" not in out.split("VERDICT")[0].lower() or "score" not in out


# ── A crashing check must not end the run ────────────────────────────────────────────────────────
def test_a_raising_check_becomes_a_fail_with_its_own_name():
    """With a one-day window, losing the remaining checks to one exception is the most expensive
    possible failure. The name must match the one the check reports when it works, or a crash shows
    up under a different label than the success path."""
    @timed("group.the_check")
    async def boom(_creds):
        raise RuntimeError("store exploded")

    res = asyncio.run(boom(Creds()))
    assert res.status == FAIL
    assert res.check == "group.the_check"
    assert "RuntimeError" in res.detail


def test_cost_is_summed_across_checks():
    r = Report()
    r.add(Result(check="a", status=PASS, cost_usd=0.0123))
    r.add(Result(check="b", status=PASS, cost_usd=0.0077))
    assert round(r.cost_usd, 4) == 0.02


def test_json_report_round_trips(tmp_path):
    import json
    r = Report()
    r.add(Result(check="a", status=PASS, metrics={"tok_s": 41.2}, cost_usd=0.01))
    r.add(skip("b", ["KEY"]))
    p = tmp_path / "out.json"
    r.write_json(str(p))
    doc = json.loads(p.read_text())
    assert doc["ready"] is False
    assert doc["results"][0]["metrics"]["tok_s"] == 41.2
    assert doc["cost_usd"] == 0.01


# ── The runner's own wiring ──────────────────────────────────────────────────────────────────────
def test_every_check_is_decorated_with_a_dotted_name():
    """A check whose decorator name differs from the name it reports would appear under two labels
    depending on whether it crashed."""
    import checks_model as M
    import checks_platform as P
    import checks_stores as S

    found = 0
    for mod in (M, P, S):
        for attr in dir(mod):
            fn = getattr(mod, attr)
            name = getattr(fn, "check_name", None)
            if name:
                found += 1
                assert "." in name, f"{attr} has a non-dotted check name {name!r}"
    assert found >= 18, f"expected the full check set, found {found}"


def test_plaid_refuses_to_run_outside_sandbox():
    """The only write in the runner. It must never touch a non-sandbox Plaid environment."""
    import checks_platform as P
    c = Creds(values={"PLAID_CLIENT_ID": "x", "PLAID_SECRET": "y", "PLAID_ENV": "production"})
    res = asyncio.run(P.plaid_sandbox_accounts(c, True))
    assert res.status == UNMEASURED
    assert "refusing" in res.detail.lower()


def test_plaid_requires_allow_writes_even_in_sandbox():
    import checks_platform as P
    c = Creds(values={"PLAID_CLIENT_ID": "x", "PLAID_SECRET": "y", "PLAID_ENV": "sandbox"})
    res = asyncio.run(P.plaid_sandbox_accounts(c, False))
    assert res.status == UNMEASURED
    assert "allow-writes" in res.detail


def test_graph_checks_refuse_to_query_unscoped():
    """Without a user_id these must report UNMEASURED rather than issue an unscoped query — which
    the Neo4j client would refuse anyway, but the runner should not rely on that."""
    import checks_stores as S
    c = Creds(values={"NEO4J_URI": "neo4j+s://x", "NEO4J_PASSWORD": "p"})
    res = asyncio.run(S.neo4j_generated_cypher_runs(c, None))
    assert res.status == UNMEASURED
    assert "unscoped" in res.detail
