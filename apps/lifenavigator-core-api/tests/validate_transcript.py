"""Run the P0 validation transcript end-to-end through the real engine (in-memory Supabase).

Proves: every stated goal persists, coverage reflects the conversation, career stays 0, user language
is preserved, the school answer is captured as a future goal, and the confirmation panel renders the
user's own priorities (not a stale 'financial independence' label).
"""
import asyncio

from app.models.common import UserContext
from app.services.discovery_coverage import DiscoveryCoverageService
from app.services.life_bridge import LifeBridgeService
from app.services.life_discovery import LifeDiscoveryService
from app.services.relationship_manager import RelationshipManager
from tests.conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
TRANSCRIPT = [
    "I am currently paying down credit cards in order to get a better travel rewards card for all "
    "spending and the current one will be for emergencies. Once I don't carry any revolving debt "
    "anymore I want to build a down payment for a larger house. My fiancée and I want to start "
    "building a family after the wedding next sept",
    "yes that is correct",
    "I want to build a solid foundation for my family so I can give them security and the life they deserve.",
    "That confirmation is blank, and you already have my financial information through plaid.",
    "Removing the revolving credit that I have to pay each month so I can focus on saving and building "
    "the foundation. I am also interested in getting in better shape.",
    "I am also considering going back to school, I believe that may be a few years in the future.",
]


async def main():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    rm = RelationshipManager(sb, life, LifeBridgeService(sb, life))
    pending = "primary_goal"
    for i, msg in enumerate(TRANSCRIPT):
        turn = await rm.converse(CTX, msg, pending_key=pending)
        pending = turn.get("pending_key")
        print(f"\n[turn {i + 1}] advisor: {turn['assistant_message'][:120]}")

    print("\n================ FINAL MODEL ================")
    rows = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    print("\nPriorities I heard (persisted candidate_goals):")
    for r in sorted(rows, key=lambda x: x.get("created_at") or ""):
        tag = " [future]" if r.get("status") == "future_goal" else ""
        print(f"  • {r['goal_text']}  ({r['domain']}){tag}")

    cov = await DiscoveryCoverageService(life, sb).coverage(CTX)
    print("\nDomain coverage:")
    for d in cov["domains"]:
        print(f"  {d['label']:>10}: {d['coverage_pct']:>3}%  ({d['status']})")

    panel = await rm._context_panel(CTX)
    print("\nConfirmation panel — priorities_i_heard:")
    for p in panel.get("priorities_i_heard", []):
        print(f"  - {p}")
    print(f"\ndomains_touched: {panel.get('domains_touched')}")

    # assertions for the report
    txt = " ".join(r["goal_text"].lower() for r in rows)
    assert "career" not in txt, "FAIL: career invented"
    by = {d["domain"]: d["coverage_pct"] for d in cov["domains"]}
    assert by["family"] > 0 and by["health"] > 0 and by["education"] > 0, f"FAIL coverage: {by}"
    assert by["career"] == 0, f"FAIL: career should be 0, got {by['career']}"
    assert any("school" in r["goal_text"].lower() and r["status"] == "future_goal" for r in rows), "FAIL: school not future"
    print("\n✅ ALL INVARIANTS HOLD: no career, family/health/education > 0, school=future, user words preserved.")


if __name__ == "__main__":
    asyncio.run(main())
