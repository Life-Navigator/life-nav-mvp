"""Advisor Action Loop — the five approval-gated actions. Detection is deterministic; writes happen ONLY
via IngestionService.submit_life_fact and ONLY on apply() (never on detect/proposal)."""
import pytest

from app.models.common import UserContext
from app.services import advisor_actions as A

CTX = UserContext(user_id="u-1")


class FakeIngestion:
    """Captures submit_life_fact / submit_goal calls so we can prove the action writes ONLY via this path."""
    def __init__(self):
        self.calls = []
        self.goals = []

    async def submit_life_fact(self, ctx, payload):
        self.calls.append((ctx.user_id, payload))
        return {"ok": True, "table": "life.facts", "id": f"id-{len(self.calls)}", "action": "upserted"}

    async def submit_goal(self, ctx, payload):
        self.goals.append((ctx.user_id, payload))
        return {"ok": True, "table": "life.candidate_goals", "id": f"g-{len(self.goals)}", "action": "upserted"}


class FakeSupabaseUpsert:
    """Captures finance.financial_planning_goals upserts for the set_goal finance path."""
    def __init__(self):
        self.upserts = []

    async def upsert(self, table, row, *, schema=None, on_conflict=None):
        self.upserts.append((schema, table, row))
        return [row]


def test_detect_all_five_intents():
    assert A.detect("I just got promoted!") == "promotion"
    assert A.detect("We're having a baby in June") == "new_child"
    assert A.detect("We bought a house last week") == "home_purchase"
    assert A.detect("I enrolled in the UT AI master's") == "degree_enrollment"
    assert A.detect("I want to lose 30 pounds before the wedding") == "health_goal"


def test_detect_returns_none_for_unrelated():
    assert A.detect("what should I focus on?") is None
    assert A.detect("how is my retirement looking") is None


def test_proposal_has_impact_and_fields_and_no_write():
    p = A.proposal("promotion")
    assert p["action"] == "promotion"
    assert "Compensation" in p["impact"] and "Taxes" in p["impact"]
    assert {f["key"] for f in p["fields"]} == {"title", "salary", "bonus", "equity"}
    # proposal is pure data — it cannot write (no ingestion is even passed to it).


@pytest.mark.asyncio
async def test_apply_writes_only_via_ingestion_with_provenance():
    ing = FakeIngestion()
    out = await A.apply(ing, CTX, "promotion",
                        {"title": "Staff Engineer", "salary": "220000", "bonus": "30000", "equity": ""})
    assert out["ok"] is True
    # equity was empty → skipped; the other three written
    assert {c[1]["fact_type"] for c in ing.calls} == {
        "promotion.title", "promotion.base_salary", "promotion.annual_bonus"}
    # every write is user-scoped, confirmed (user approved), career-domain, provenance-stamped
    for _uid, payload in ing.calls:
        assert _uid == "u-1"
        assert payload["confirmation_status"] == "confirmed"
        assert payload["domain"] == "career"
        assert payload["provenance"]["submitted_by"] == "arcana-action-loop"
    assert "Compensation" in out["impact"]
    assert out["refresh"] == ["dashboard", "readiness", "recommendations", "coverage"]


@pytest.mark.asyncio
async def test_apply_requires_at_least_one_value_no_blank_writes():
    ing = FakeIngestion()
    out = await A.apply(ing, CTX, "home_purchase", {"price": "", "down_payment": "", "mortgage": ""})
    assert out["ok"] is False and out["code"] == "no_values"
    assert ing.calls == []  # nothing written when there's nothing to write


@pytest.mark.asyncio
async def test_apply_unknown_action_writes_nothing():
    ing = FakeIngestion()
    out = await A.apply(ing, CTX, "buy_a_yacht", {"x": "1"})
    assert out["ok"] is False and out["code"] == "unknown_action"
    assert ing.calls == []


@pytest.mark.asyncio
async def test_apply_is_idempotent_keyed():
    # Same action+fact → same idempotency key, so re-approval is a safe no-op upsert (not a duplicate).
    ing = FakeIngestion()
    await A.apply(ing, CTX, "health_goal", {"goal": "lose 30 lbs"})
    keys = [p["idempotency_key"] for _u, p in ing.calls]
    assert keys == ["action:health_goal:health.goal"]


def test_promotion_prefills_title_and_salary_optional():
    """Dead-button fix: title prefills from the captured message; comp is optional so submit enables."""
    from app.services import advisor_actions as A
    p = A.proposal("promotion", "I'm a Senior Architect. The next promotion is Principal Architect. Big pay increase.")
    assert p["prefill"].get("title") == "Principal Architect"
    fmap = {f["key"]: f for f in p["fields"]}
    assert fmap["salary"]["optional"] is True          # was required → caused the dead button
    assert fmap["title"]["optional"] is False
    # only the (prefilled) title is required → the approve button is enabled on arrival
    required = [f["key"] for f in p["fields"] if not f["optional"]]
    assert required == ["title"]


@pytest.mark.asyncio
async def test_promotion_apply_persists_title_without_salary():
    """A promotion goal can be saved with just the title (no comp numbers yet) — no dead end on missing comp."""
    ing = FakeIngestion()
    out = await A.apply(ing, CTX, "promotion", {"title": "Principal Architect"})
    types = [payload.get("fact_type") for _uid, payload in ing.calls]
    assert "promotion.title" in types
    assert out["ok"] is True


# ── set_goal action: goal-setting that persists a TRACKED goal (and advances coverage) ─────────────

def test_detect_set_goal_and_specific_life_changes_still_win():
    # generic goal-setting language → set_goal
    assert A.detect("Help me set a short-term goal") == "set_goal"
    assert A.detect("I want to set an emergency fund target") == "set_goal"
    assert A.detect("let's save up for a down payment") == "set_goal"
    # but a concrete life-change still beats the generic goal-setter (order matters)
    assert A.detect("we bought a house and want to set a goal") == "home_purchase"


def test_set_goal_proposal_prefills_area_from_message():
    p = A.proposal("set_goal", "I want to set an emergency fund target")
    assert p["action"] == "set_goal"
    assert p["prefill"].get("area") == "finance"
    assert {f["key"] for f in p["fields"]} == {"goal", "area", "target_amount", "target_date", "toward"}
    # only goal + area are required so the approve button enables with the prefilled area
    required = [f["key"] for f in p["fields"] if not f["optional"]]
    assert set(required) == {"goal", "area"}


@pytest.mark.asyncio
async def test_set_goal_apply_persists_tracked_candidate_goal():
    ing = FakeIngestion()
    out = await A.apply(ing, CTX, "set_goal",
                        {"goal": "Run a half marathon", "area": "health", "target_date": "2026-10-01",
                         "toward": "Get in the best shape of my life"})
    assert out["ok"] is True
    assert ing.calls == []  # set_goal writes a GOAL, not a life.fact
    assert len(ing.goals) == 1
    _uid, g = ing.goals[0]
    assert _uid == "u-1"
    assert g["goal_title"] == "Run a half marathon"
    assert g["domain"] == "health"
    assert g["confirmation_status"] == "confirmed"  # user approved
    assert g["timeframe"] == "2026-10-01"
    assert g["provenance"]["submitted_by"] == "arcana-action-loop"
    assert out["goals"][0]["domain"] == "health"
    assert "coverage" in out["refresh"]  # goal-setting must refresh coverage


@pytest.mark.asyncio
async def test_set_goal_finance_also_writes_planning_goal():
    ing = FakeIngestion()
    sb = FakeSupabaseUpsert()
    out = await A.apply(ing, CTX, "set_goal",
                        {"goal": "Build a $25,000 emergency fund", "area": "money", "target_amount": "$25,000"},
                        supabase=sb)
    assert out["ok"] is True
    # money → normalized to finance; candidate goal written
    assert ing.goals[0][1]["domain"] == "finance"
    # AND a finance.financial_planning_goals row upserted with the parsed amount
    assert len(sb.upserts) == 1
    schema, table, row = sb.upserts[0]
    assert schema == "finance" and table == "financial_planning_goals"
    assert row["target_amount"] == 25000.0 and row["label"] == "Build a $25,000 emergency fund"
    assert out["goals"][0]["finance_planning_ok"] is True


@pytest.mark.asyncio
async def test_set_goal_blank_goal_writes_nothing():
    ing = FakeIngestion()
    out = await A.apply(ing, CTX, "set_goal", {"goal": "", "area": "finance"})
    assert out["ok"] is False and out["code"] == "no_values"
    assert ing.goals == [] and ing.calls == []
