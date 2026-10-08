"""Live readiness runner — one command, one honest table.

    # what the credentials allow, with no calls and no spend
    python scripts/live/readiness.py --creds ~/.ln-live-creds.env --plan

    # the decisive model probes first (~$1-3)
    python scripts/live/readiness.py --creds ~/.ln-live-creds.env --only model

    # everything read-only
    python scripts/live/readiness.py --creds ~/.ln-live-creds.env --user-id <uuid>

    # include the Plaid sandbox item (the only write)
    python scripts/live/readiness.py --creds ~/.ln-live-creds.env --allow-writes

DESIGN NOTES
    * READ-ONLY by default. `--allow-writes` is required for the single write (a Plaid sandbox item).
    * Credentials come from a file or the environment, never argv — argv is visible in `ps`.
    * Checks are INDEPENDENT and results print as they land. A one-day credential window must not be
      lost to one unhandled exception, and findings already made have to survive an interruption.
    * Model probes run in increasing order of risk and cost, so a rejection names the exact field
      rather than condemning the whole request shape.
    * `--budget` stops model spend at a ceiling. The registry's $/turn estimate for Opus is $0.15
      against a documented $4/day cap, so an unbounded run is a real risk rather than a theoretical
      one. Spend is computed from the provider's REPORTED usage, not estimated.
    * UNMEASURED on a required check counts AGAINST readiness. "We could not verify it" is never a
      pass.
"""
from __future__ import annotations

import argparse
import asyncio
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
# The checks import the application's own clients on purpose — they must exercise the code paths
# production uses, not a re-implementation of the same HTTP calls.
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "apps/lifenavigator-core-api"))

import checks_model as M          # noqa: E402
import checks_platform as P       # noqa: E402
import checks_stores as S         # noqa: E402
from _creds import HIGH_PRIVILEGE, load  # noqa: E402
from _report import UNMEASURED, Report, Result  # noqa: E402

GROUPS = ("model", "stores", "platform", "plaid")


def _plan(creds) -> None:
    print("\nCREDENTIALS (fingerprints only — values are never printed)")
    for line in creds.summary():
        print(line)
    print(f"\n  source: {creds.source}")

    print("\nWHAT THESE CREDENTIALS ALLOW")
    rows = [
        ("model",    "Vertex Opus: reachability, thinking, cache_control, effort, throughput",
         creds.has("GCP_PROJECT")),
        ("stores",   "Qdrant dim + payload domains; Neo4j generated-Cypher; alignment",
         creds.has("QDRANT_URL", "QDRANT_API_KEY") or creds.has("NEO4J_URI", "NEO4J_PASSWORD")),
        ("platform", "Supabase RLS + ledger migration; deployed health + SHA; web headers",
         creds.has("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")),
        ("plaid",    "Plaid sandbox accounts (WRITES a sandbox item)",
         creds.has("PLAID_CLIENT_ID", "PLAID_SECRET")),
    ]
    for name, what, ok in rows:
        print(f"  [{'x' if ok else ' '}] {name:9} {what}")

    high = [k for k in HIGH_PRIVILEGE if creds.values.get(k)]
    if high:
        print(f"\n  ! HIGH-PRIVILEGE credentials present: {', '.join(high)}")
        print("    SUPABASE_SERVICE_ROLE_KEY bypasses every RLS policy. Rotate when the window closes.")
    print("\n  No calls were made and nothing was spent. Drop --plan to run.\n")


async def _run(args) -> int:
    creds = load(args.creds)
    if args.plan:
        _plan(creds)
        return 0

    groups = set(args.only or GROUPS)
    report = Report()
    print("\nRunning live readiness checks (read-only"
          f"{', WRITES ENABLED' if args.allow_writes else ''})\n")

    def budget_left() -> bool:
        if args.budget is None:
            return True
        if report.cost_usd >= args.budget:
            return False
        return True

    def over_budget(name: str) -> Result:
        return Result(check=name, status=UNMEASURED, required=False,
                      detail=f"skipped: ${report.cost_usd:.4f} spent, budget ${args.budget:.2f}")

    # ── model: cheapest decisive probe first, then by risk ────────────────────────────────────────
    if "model" in groups:
        print("── model (Vertex / Claude Opus) — THIS SPENDS MONEY")
        for fn in (M.vertex_reachable, M.vertex_accepts_thinking,
                   M.vertex_accepts_prompt_cache, M.vertex_accepts_effort, M.vertex_throughput):
            if not budget_left():
                report.add(over_budget(fn.__name__))
                continue
            r = report.add(await fn(creds))
            # A hard stop: if the endpoint will not answer at all, the remaining model probes would
            # blame the wrong field and spend money doing it.
            if fn is M.vertex_reachable and r.status != "PASS":
                report.add(Result(check="model.remaining_probes", status="BLOCKED",
                                  detail="vertex.reachable failed — auth, project, region or model "
                                         "availability must be fixed before field-level probes mean "
                                         "anything"))
                break
        print()

    if "stores" in groups:
        print("── stores (Qdrant / Neo4j) — read-only")
        report.add(await S.qdrant_reachable(creds))
        report.add(await S.qdrant_dimension(creds))
        report.add(await S.qdrant_payload_domains(creds))
        report.add(await S.neo4j_reachable(creds))
        report.add(await S.neo4j_generated_cypher_runs(creds, args.user_id))
        report.add(await S.ontology_manifest_matches_live_types(creds))
        report.add(await S.neo4j_edge_provenance(creds))
        report.add(await S.three_store_alignment(creds, args.user_id))
        print()

    if "platform" in groups:
        print("── platform (Supabase / Fly / Vercel) — read-only")
        report.add(await P.supabase_reachable(creds))
        report.add(await P.supabase_ledger_migration_applied(creds))
        report.add(await P.supabase_rls_denies_anon(creds))
        report.add(await P.deployed_api_health(creds))
        report.add(await P.deployed_sha_is_provable(creds, args.expect_sha))
        report.add(await P.web_version_endpoint(creds))
        report.add(await P.web_security_headers(creds))
        print()

    if "plaid" in groups:
        print("── plaid (sandbox)")
        report.add(await P.plaid_sandbox_accounts(creds, args.allow_writes))
        print()

    print(report.render())
    if args.json:
        report.write_json(args.json)
        print(f"  json written: {args.json}")

    # Reminders the operator will want at the end of a one-day window.
    print("\n  AFTER THIS RUN")
    print("    - rotate every credential issued for this window")
    print("    - delete the credentials file and /tmp/sweep_creds.txt if the advisor eval ran")
    print("    - the operational gates remain: production error tracking, branch protection on")
    print("      main, HA/redundancy, load behaviour, and the R-6 owner sign-off\n")

    return 0 if report.verdict()[0] else 1


def main() -> int:
    ap = argparse.ArgumentParser(prog="readiness", description="Live deploy-readiness runner")
    ap.add_argument("--creds", help="path to a KEY=value credentials file (recommended)")
    ap.add_argument("--plan", action="store_true",
                    help="show what the credentials allow; make no calls and spend nothing")
    ap.add_argument("--only", action="append", choices=list(GROUPS),
                    help="run only these groups (repeatable)")
    ap.add_argument("--user-id", help="a real user uuid, for graph/alignment checks")
    ap.add_argument("--expect-sha", help="the 40-char SHA the deployment should report")
    ap.add_argument("--budget", type=float, default=5.0,
                    help="USD ceiling for model spend (default 5.00; 0 disables model calls)")
    ap.add_argument("--allow-writes", action="store_true",
                    help="permit the one write: a Plaid SANDBOX item")
    ap.add_argument("--json", help="write the full report as JSON")
    args = ap.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    sys.exit(main())
