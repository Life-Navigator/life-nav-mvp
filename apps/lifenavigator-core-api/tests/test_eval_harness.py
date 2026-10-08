"""Tests OF the evaluation harness.

An eval nobody tests is a number nobody should trust. The properties below are the ones that decide
whether its output means anything:

  * UNMEASURED never looks like a pass. ("nothing ran" vs "everything passed")
  * trust and quality rates are never combined, and never contaminate each other.
  * a refusal to score is not counted as a failure.
  * a baseline from a different fixture version is refused, not silently compared.
  * the probes call the PRODUCTION code, so the harness cannot drift from what ships.
"""
import json

import pytest

from eval import probe_gate, probe_routing
from eval.model import CaseResult, GateCase, RoutingCase
from eval.scorecard import ProbeScore, compare, render, score


# ── UNMEASURED is never a pass ───────────────────────────────────────────────────────────────────
def test_a_probe_with_no_cases_reports_unmeasured_not_success():
    s = score("empty", "1", [])
    assert s.status == "UNMEASURED"
    assert s.measured is False
    assert s.over_block_rate is None and s.under_block_rate is None
    assert "UNMEASURED" in render([s], [compare(s)])


def test_refused_cases_do_not_become_failures():
    """A retrieval case with no relevance labels is unscoreable. Counting it as a quality failure is
    exactly what this harness reported before `refused` existed — four unlabelled stubs read as
    'over-block 100%', which would have been a damning and entirely fictional number."""
    s = score("p", "1", [
        CaseResult("a", "must_pass", "labelled", "UNLABELLED", ok=False, refused=True),
        CaseResult("b", "must_pass", "labelled", "UNLABELLED", ok=False, refused=True),
    ])
    assert s.refused == 2
    assert s.must_pass_total == 0
    assert s.over_block_rate is None
    assert s.status == "UNMEASURED"


# ── The two rates stay separate ──────────────────────────────────────────────────────────────────
def test_trust_and_quality_rates_are_computed_independently():
    """A trust failure must not be dilutable by quality passes, or vice versa. There is deliberately
    no overall score — averaging would let a gate trade a fabrication for a quality win."""
    s = score("p", "1", [
        CaseResult("q1", "must_pass", "passed", "blocked", ok=False),   # 1 of 2 over-blocked
        CaseResult("q2", "must_pass", "passed", "passed", ok=True),
        CaseResult("t1", "must_block", "blocked", "blocked", ok=True),  # 0 of 4 under-blocked
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t3", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t4", "must_block", "blocked", "blocked", ok=True),
    ])
    assert s.over_block_rate == 50.0
    assert s.under_block_rate == 0.0
    assert not hasattr(s, "overall_score")


def test_render_never_prints_a_combined_score():
    s = score("p", "1", [
        CaseResult("q", "must_pass", "passed", "blocked", ok=False),
        CaseResult("t", "must_block", "blocked", "passed", ok=False),
    ])
    out = render([s], [compare(s)])
    assert "TRUST" in out and "QUALITY" in out
    assert "overall" not in out.lower()


# ── Baselines ────────────────────────────────────────────────────────────────────────────────────
def test_a_baseline_from_a_different_fixture_version_is_refused(tmp_path, monkeypatch):
    """Scoring against a baseline built from another case set reports an easier question as
    progress. Refused rather than warned, because a warning in CI output is a warning nobody reads."""
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    s_old = score("p", "1", [CaseResult("t", "must_block", "blocked", "blocked", ok=True)])
    sc.save_baseline(s_old)
    s_new = score("p", "2", [CaseResult("t", "must_block", "blocked", "blocked", ok=True)])
    v = sc.compare(s_new)
    assert v.ok is False
    assert "REFUSING to compare" in " ".join(v.lines)


def test_a_worsened_rate_fails_and_an_improved_one_does_not(tmp_path, monkeypatch):
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    base = score("p", "1", [
        CaseResult("t1", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
    ])
    sc.save_baseline(base)

    worse = score("p", "1", [
        CaseResult("t1", "must_block", "blocked", "passed", ok=False),   # a fabrication got through
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
    ])
    assert sc.compare(worse).ok is False

    better = score("p", "1", [
        CaseResult("t1", "must_block", "blocked", "blocked", ok=True),
        CaseResult("t2", "must_block", "blocked", "blocked", ok=True),
    ])
    assert sc.compare(better).ok is True


def test_a_baseline_is_never_written_for_an_unmeasured_probe(tmp_path, monkeypatch):
    """A baseline that asserts nothing looks like a gate while being one. Worse than none."""
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    from eval.run import main
    rc = main(["--probe", "retrieval", "--save-baseline"])
    assert rc == 0
    assert not (tmp_path / "retrieval.json").exists()


# ── Known divergences are counted, not hidden ────────────────────────────────────────────────────
def test_known_divergences_are_counted_but_do_not_fail_ci():
    s = score("p", "1", [
        CaseResult("k", "must_pass", "passed", "blocked", ok=False,
                   known_divergence="documented over-block"),
    ])
    assert s.known_divergences == 1
    assert s.over_block_rate == 100.0, "still counted in the rate — a known failure is still a failure"
    assert compare(s).ok is True, "but not a CI regression on its own"


# ── The probes measure the REAL production code ──────────────────────────────────────────────────
def test_gate_probe_calls_the_production_validator():
    """A harness that reimplemented the gate would drift from the thing that ships — the failure the
    ontology manifest and the cross-language parity fixture exist to prevent elsewhere here."""
    import inspect
    import eval.probe_gate as pg
    assert "advisor_validator" in inspect.getsource(pg)

    blocked = pg.evaluate_case(GateCase(
        id="x", text="Your net worth is $1,284,500 right now.", direction="must_block"))
    assert blocked.ok and blocked.actual == "blocked"

    grounded = pg.evaluate_case(GateCase(
        id="y", text="Your cash position leaves $6,800 a month.", direction="must_pass",
        allowed=("6800",)))
    assert grounded.ok and grounded.actual == "passed"


def test_routing_probe_calls_the_production_classifiers():
    import inspect
    import eval.probe_routing as pr
    assert "model_router" in inspect.getsource(pr)

    r = pr.evaluate_case(RoutingCase(
        id="x", message="I cannot breathe", expect_domain="health",
        expect_urgent="trouble breathing"))
    assert r.ok, r.actual


def test_a_safety_case_is_scored_only_on_the_safety_net():
    """Mixing a domain assertion into a safety case would let a domain mismatch mask a missed
    emergency inside the same number."""
    r = probe_routing.evaluate_case(RoutingCase(
        id="x", message="my face is drooping", expect_domain="WRONG_ON_PURPOSE",
        expect_urgent="stroke symptoms"))
    assert r.ok is True
    assert r.direction == "must_block"


# ── The shipped fixture sets ─────────────────────────────────────────────────────────────────────
def test_shipped_gate_fixtures_are_two_sided():
    """A one-sided set produces a meaningless rate: all-must_block makes any gate look perfect on
    trust, all-must_pass makes it look perfect on quality."""
    s = probe_gate.run()
    assert s.must_pass_total >= 3 and s.must_block_total >= 3


def test_shipped_routing_fixtures_cover_the_safety_net_both_ways():
    cases = probe_routing.load_routing_cases()
    assert any(c.expect_urgent for c in cases), "no must-fire safety case"
    assert any("safety_false_positive" in c.tags for c in cases), "no must-NOT-fire safety case"


def test_the_safety_net_is_currently_perfect_and_must_stay_that_way():
    """The one metric in this harness with a medical consequence. Not a baseline comparison — an
    absolute: a missed emergency is never an acceptable regression."""
    s = probe_routing.run()
    assert s.must_block_total > 0
    assert s.must_block_passed == 0, (
        f"{s.must_block_passed} urgent-care case(s) were missed — this must always be zero"
    )


def test_every_fixture_case_explains_itself():
    """A case with no `why` is unmaintainable: the next person cannot tell whether a failure means
    the code broke or the expectation was wrong — which happened three times while authoring these."""
    for c in probe_gate.load_gate_cases():
        assert c.why.strip(), f"gate case {c.id} has no rationale"
    for c in probe_routing.load_routing_cases():
        assert c.why.strip(), f"routing case {c.id} has no rationale"


def test_fixtures_are_versioned():
    from eval.model import fixture_version
    for f in ("gate_cases.json", "routing_cases.json"):
        assert fixture_version(f) not in ("absent", "unversioned"), f


# ── The CLI ──────────────────────────────────────────────────────────────────────────────────────
def test_cli_runs_the_offline_probes_and_exits_zero(capsys, tmp_path, monkeypatch):
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    from eval.run import main
    assert main([]) == 0
    out = capsys.readouterr().out
    assert "gate" in out and "routing" in out


def test_cli_json_output_is_machine_readable(tmp_path, monkeypatch):
    import eval.scorecard as sc
    monkeypatch.setattr(sc, "BASELINES", tmp_path)
    from eval.run import main
    out = tmp_path / "scorecard.json"
    assert main(["--probe", "gate", "--json", str(out)]) == 0
    doc = json.loads(out.read_text())
    probe = doc["probes"][0]
    assert probe["probe"] == "gate"
    assert "over_block_rate_pct" in probe and "under_block_rate_pct" in probe
    assert "refused_unscoreable" in probe


def test_the_offline_set_needs_no_credentials_model_or_network():
    """The property that lets this run on every PR. If an offline probe ever needed a key, it would
    quietly stop running and the gate would silently disappear."""
    from eval.run import OFFLINE
    assert set(OFFLINE) == {"gate", "routing"}
    import eval.probe_gate as pg, eval.probe_routing as pr
    import inspect
    for mod in (pg, pr):
        src = inspect.getsource(mod)
        for forbidden in ("httpx", "os.environ", "requests", "supabase"):
            assert forbidden not in src, f"{mod.__name__} reaches for {forbidden}"
