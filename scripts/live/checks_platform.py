"""Live platform checks — Supabase, the deployed Fly API, Vercel, and Plaid sandbox.

READ-ONLY unless `--allow-writes`. The only write any of this performs is the Plaid sandbox link,
and that is gated behind the flag and marked explicitly.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from _creds import Creds
from _report import FAIL, PASS, UNMEASURED, Result, skip, timed


def _sb_headers(creds: Creds, schema: Optional[str] = None) -> dict[str, str]:
    key = creds.get("SUPABASE_SERVICE_ROLE_KEY")
    h = {"apikey": key, "authorization": f"Bearer {key}"}
    if schema:
        h["accept-profile"] = schema
    return h


# ── Supabase ──────────────────────────────────────────────────────────────────────────────────────
@timed("supabase.reachable")
async def supabase_reachable(creds: Creds) -> Result:
    if not creds.has("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        return skip("supabase.reachable", creds.missing("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"))
    import httpx
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(f"{creds.get('SUPABASE_URL').rstrip('/')}/rest/v1/",
                        headers=_sb_headers(creds))
    return Result(check="supabase.reachable", status=PASS if r.status_code < 400 else FAIL,
                  detail=f"PostgREST HTTP {r.status_code}")


@timed("supabase.ledger_migration")
async def supabase_ledger_migration_applied(creds: Creds) -> Result:
    """Is `analytics.llm_call_usage` present?

    Until it is, `CALL_USAGE_LEDGER_ENABLED` must stay off — the orchestrator would POST to a
    missing table on every turn and log a warning each time. This check is what tells you the flag
    is safe to flip, which is the gate on getting any real cost data at all.
    """
    if not creds.has("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        return skip("supabase.ledger_migration",
                    creds.missing("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"), required=False)
    import httpx
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(f"{creds.get('SUPABASE_URL').rstrip('/')}/rest/v1/llm_call_usage",
                        headers={**_sb_headers(creds, "analytics"), "range": "0-0"},
                        params={"select": "id"})
    applied = r.status_code < 400
    return Result(
        check="supabase.ledger_migration", status=PASS if applied else UNMEASURED, required=False,
        detail=("analytics.llm_call_usage exists — CALL_USAGE_LEDGER_ENABLED is safe to flip"
                if applied else
                f"table absent (HTTP {r.status_code}) — apply 20261007000000_llm_call_usage.sql "
                f"before enabling the ledger flag"))


@timed("supabase.rls_denies_anon")
async def supabase_rls_denies_anon(creds: Creds) -> Result:
    """Can an ANON key read a user-scoped table?

    The service-role key bypasses every policy by design, so a service-role read proves nothing
    about RLS. This asks the question that matters: what can an unauthenticated client see? A
    non-empty result here is a data-exposure finding, not a configuration nit.
    """
    needed = ("SUPABASE_URL", "SUPABASE_ANON_KEY")
    if not creds.has(*needed):
        return skip("supabase.rls_denies_anon", creds.missing(*needed))
    import httpx
    url = creds.get("SUPABASE_URL").rstrip("/")
    anon = creds.get("SUPABASE_ANON_KEY")
    leaks: list[str] = []
    checked: dict[str, Any] = {}
    async with httpx.AsyncClient(timeout=20.0) as c:
        for schema, table in (("life", "facts"), ("analytics", "advisor_turns"),
                              ("finance", "financial_accounts")):
            r = await c.get(f"{url}/rest/v1/{table}",
                            headers={"apikey": anon, "authorization": f"Bearer {anon}",
                                     "accept-profile": schema},
                            params={"select": "*", "limit": "1"})
            rows = r.json() if r.status_code == 200 and r.text.startswith("[") else []
            checked[f"{schema}.{table}"] = f"HTTP {r.status_code}, {len(rows)} row(s)"
            if rows:
                leaks.append(f"{schema}.{table}")
    return Result(check="supabase.rls_denies_anon", status=FAIL if leaks else PASS,
                  detail=(f"ANON KEY CAN READ: {', '.join(leaks)} — data exposure" if leaks
                          else "anon key reads nothing from the probed user-scoped tables"),
                  metrics=checked)


# ── Deployed API ──────────────────────────────────────────────────────────────────────────────────
@timed("deployed.health")
async def deployed_api_health(creds: Creds) -> Result:
    base = creds.get("CORE_API_URL", "https://lifenavigator-core-api-candidate.fly.dev").rstrip("/")
    import httpx
    out: dict[str, Any] = {}
    async with httpx.AsyncClient(timeout=25.0) as c:
        for path in ("/healthz", "/readyz"):
            try:
                r = await c.get(base + path)
                out[path] = f"{r.status_code} {r.text[:120]}"
            except Exception as exc:  # noqa: BLE001
                out[path] = f"unreachable: {type(exc).__name__}"
    ready_ok = "200" in str(out.get("/readyz", ""))
    return Result(check="deployed.health", status=PASS if ready_ok else FAIL,
                  detail=f"{base}", metrics=out)


@timed("deployed.sha_provable")
async def deployed_sha_is_provable(creds: Creds, expected_sha: Optional[str]) -> Result:
    """R-5: is the running commit provable, and is it the one that was reviewed?

    `/version` returning 404 means the release-identity work is not deployed, so the SHA cannot be
    proven from outside — which is the state the gate table records as blocking R-5.
    """
    base = creds.get("CORE_API_URL", "https://lifenavigator-core-api-candidate.fly.dev").rstrip("/")
    import httpx
    async with httpx.AsyncClient(timeout=25.0) as c:
        r = await c.get(base + "/version")
    if r.status_code == 404:
        return Result(check="deployed.sha_provable", status=FAIL,
                      detail="/version is 404 — this image predates the release-identity work, so "
                             "the deployed SHA cannot be proven (R-5 stays blocked)")
    if r.status_code != 200:
        return Result(check="deployed.sha_provable", status=FAIL,
                      detail=f"/version HTTP {r.status_code}: {r.text[:140]}")
    body = r.json()
    sha = str(body.get("commit_sha", ""))
    if expected_sha and sha != expected_sha:
        return Result(check="deployed.sha_provable", status=FAIL,
                      detail=f"deployed {sha[:12]} != expected {expected_sha[:12]}",
                      metrics=body)
    return Result(check="deployed.sha_provable", status=PASS,
                  detail=f"deployed SHA {sha[:12]}", metrics=body)


@timed("web.version_endpoint")
async def web_version_endpoint(creds: Creds) -> Result:
    """The web half of R-5. A 401 here is the bug found earlier: middleware gates a route the
    SHA-proof harness requires to be publicly readable, so R-5 fails even once deployed."""
    base = creds.get("WEB_URL", "https://lifenavigator.tech").rstrip("/")
    import httpx
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=False) as c:
        r = await c.get(base + "/api/version")
    if r.status_code == 401:
        return Result(check="web.version_endpoint", status=FAIL, required=False,
                      detail="/api/version returns 401 — middleware is gating a route R-5 needs "
                             "public; the SHA proof cannot pass on the web tier")
    return Result(check="web.version_endpoint", status=PASS if r.status_code == 200 else FAIL,
                  required=False, detail=f"HTTP {r.status_code}: {r.text[:140]}")


@timed("web.security_headers")
async def web_security_headers(creds: Creds) -> Result:
    base = creds.get("WEB_URL", "https://lifenavigator.tech").rstrip("/")
    import httpx
    want = ("strict-transport-security", "content-security-policy", "x-frame-options",
            "x-content-type-options", "referrer-policy")
    async with httpx.AsyncClient(timeout=25.0) as c:
        r = await c.get(base)
    missing = [h for h in want if h not in {k.lower() for k in r.headers}]
    return Result(check="web.security_headers", status=FAIL if missing else PASS, required=False,
                  detail=f"missing: {missing}" if missing else "all expected headers present")


# ── Plaid sandbox ─────────────────────────────────────────────────────────────────────────────────
@timed("plaid.sandbox_accounts")
async def plaid_sandbox_accounts(creds: Creds, allow_writes: bool) -> Result:
    """Create a sandbox item and read its accounts — the end-to-end test of the Phase 3 input path.

    Why this matters beyond "Plaid works": the calculators only fire when
    `FinancialInputResolver` reports inputs as PRESENT, and until now that has only been exercised
    with fakes. Real sandbox accounts are the first chance to see whether the STRICT tier actually
    fires on real data, or whether every figure the advisor gets remains a scenario.

    WRITES (a sandbox item), so it is gated. Sandbox only — refuses to run against any other
    PLAID_ENV.
    """
    needed = ("PLAID_CLIENT_ID", "PLAID_SECRET")
    if not creds.has(*needed):
        return skip("plaid.sandbox_accounts", creds.missing(*needed), required=False)
    env = creds.get("PLAID_ENV", "sandbox").lower()
    if env != "sandbox":
        return Result(check="plaid.sandbox_accounts", status=UNMEASURED, required=False,
                      detail=f"PLAID_ENV={env!r} — refusing to create an item outside sandbox")
    if not allow_writes:
        return Result(check="plaid.sandbox_accounts", status=UNMEASURED, required=False,
                      detail="creates a sandbox item; re-run with --allow-writes")

    import httpx
    base = "https://sandbox.plaid.com"
    auth = {"client_id": creds.get("PLAID_CLIENT_ID"), "secret": creds.get("PLAID_SECRET")}
    async with httpx.AsyncClient(timeout=40.0) as c:
        pt = await c.post(f"{base}/sandbox/public_token/create",
                          json={**auth, "institution_id": "ins_109508",
                                "initial_products": ["transactions"]})
        if pt.status_code != 200:
            return Result(check="plaid.sandbox_accounts", status=FAIL, required=False,
                          detail=f"public_token/create HTTP {pt.status_code}: {pt.text[:160]}")
        ex = await c.post(f"{base}/item/public_token/exchange",
                          json={**auth, "public_token": pt.json()["public_token"]})
        if ex.status_code != 200:
            return Result(check="plaid.sandbox_accounts", status=FAIL, required=False,
                          detail=f"token exchange HTTP {ex.status_code}: {ex.text[:160]}")
        acc = await c.post(f"{base}/accounts/balance/get",
                           json={**auth, "access_token": ex.json()["access_token"]})
    if acc.status_code != 200:
        return Result(check="plaid.sandbox_accounts", status=FAIL, required=False,
                      detail=f"balance/get HTTP {acc.status_code}: {acc.text[:160]}")
    accounts = acc.json().get("accounts") or []
    kinds = sorted({a.get("subtype") or a.get("type") or "?" for a in accounts})
    return Result(check="plaid.sandbox_accounts", status=PASS if accounts else FAIL, required=False,
                  detail=f"{len(accounts)} sandbox account(s) retrieved",
                  metrics={"subtypes": kinds})
