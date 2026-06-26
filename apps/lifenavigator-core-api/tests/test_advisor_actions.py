"""Advisor Action Loop — the five approval-gated actions. Detection is deterministic; writes happen ONLY
via IngestionService.submit_life_fact and ONLY on apply() (never on detect/proposal)."""
import pytest

from app.models.common import UserContext
from app.services import advisor_actions as A

CTX = UserContext(user_id="u-1")


class FakeIngestion:
    """Captures submit_life_fact calls so we can prove the action writes ONLY through this path."""
    def __init__(self):
        self.calls = []

    async def submit_life_fact(self, ctx, payload):
        self.calls.append((ctx.user_id, payload))
        return {"ok": True, "table": "life.facts", "id": f"id-{len(self.calls)}", "action": "upserted"}


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
    assert out["refresh"] == ["dashboard", "readiness", "recommendations"]


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
