"""Elite Sprint 22 — module registry, military gating, admin access control."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services import module_registry as reg
from app.services.platform_access import PlatformAccess

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


# ---- registry ----
def test_civilian_cannot_see_military():
    r = reg.resolve(military_status="civilian", has_military_doc=False, is_admin=False)
    assert r["modules"]["military"]["visible"] is False
    assert r["is_military"] is False


def test_veteran_sees_military():
    r = reg.resolve(military_status="veteran", has_military_doc=False, is_admin=False)
    assert r["modules"]["military"]["visible"] is True and r["is_military"] is True


def test_military_document_enables_module_even_if_civilian_status():
    r = reg.resolve(military_status="civilian", has_military_doc=True, is_admin=False)
    assert r["modules"]["military"]["visible"] is True  # doc auto-enable


def test_metrics_requires_admin():
    assert reg.resolve(is_admin=False)["modules"]["metrics"]["visible"] is False
    assert reg.resolve(is_admin=True)["modules"]["metrics"]["visible"] is True


def test_experimental_hidden_by_default():
    r = reg.resolve(military_status="civilian")
    assert r["modules"]["scenarios"]["visible"] is False and r["modules"]["scenarios"]["status"] == "experimental"


def test_beta_modules_carry_badge():
    r = reg.resolve()
    assert r["modules"]["financial_plan"]["badge"] == "BETA"
    assert r["modules"]["readiness"]["badge"] is None  # production -> no badge


# ---- platform access (server-side authority) ----
def _access(rows=None, admins=None) -> PlatformAccess:
    return PlatformAccess(FakeSupabase(rows or {}), admins or {"owner@lifenavigator.tech"})


def test_admin_allow_list():
    a = _access(admins={"admin@x.com"})
    assert a.is_admin("admin@x.com") is True and a.is_admin("ADMIN@X.com") is True
    assert a.is_admin("user@x.com") is False and a.is_admin(None) is False


@pytest.mark.asyncio
async def test_unknown_user_is_asked_one_question():
    c = await _access().context(CTX, "u@x.com")
    assert c["military_status"] == "unknown" and c["ask_military_question"] is True


@pytest.mark.asyncio
async def test_set_military_status_persists_and_stops_asking():
    a = _access()
    await a.set_military_status(CTX, "veteran")
    c = await a.context(CTX, "u@x.com")
    assert c["military_status"] == "veteran" and c["ask_military_question"] is False
    assert await a.require_military(CTX, "u@x.com") is True


@pytest.mark.asyncio
async def test_military_document_auto_enables_and_gates_pass():
    rows = {"documents": [{"id": "d1", "user_id": CTX.user_id, "doc_type": "dd214", "extracted_json": {}}]}
    a = _access(rows)
    c = await a.context(CTX, "u@x.com")
    assert c["has_military_doc"] is True and c["auto_enabled"] is True
    assert await a.require_military(CTX, "u@x.com") is True
    assert c["ask_military_question"] is False  # don't pester a verified military user


@pytest.mark.asyncio
async def test_civilian_no_docs_is_gated_out():
    a = _access()
    await a.set_military_status(CTX, "civilian")
    assert await a.require_military(CTX, "u@x.com") is False
    vis = await a.visibility(CTX, "u@x.com")
    assert vis["modules"]["military"]["visible"] is False


@pytest.mark.asyncio
async def test_invalid_status_rejected():
    with pytest.raises(ValueError):
        await _access().set_military_status(CTX, "general")
