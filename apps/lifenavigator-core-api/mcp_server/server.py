"""LifeNavigator MCP server (stdio).

Exposes seven schema-enforced, provenance-stamped submission tools. Each tool forwards to
IngestionService, which validates against a strict Pydantic schema, scopes the write to the
resolved user/tenant, stamps provenance, and upserts idempotently to the canonical `life` table the
TOOL chooses (never the caller). Invalid input returns a structured error and writes nothing.

Run:  LIFENAV_USER_JWT=<supabase access token> \
      SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_JWT_SECRET=... \
      python -m mcp_server.server
"""
from __future__ import annotations

import logging
from typing import Any

from mcp.server.fastmcp import FastMCP

from app.clients.supabase import SupabaseClient
from app.config import get_settings
from app.services.ingestion import (
    ConstraintIn, GoalIn, IngestionService, LifeFactIn, NarrativeIn,
    OpportunityIn, RelationshipIn, RiskIn,
)
from .auth import resolve_user

log = logging.getLogger("lifenav.mcp")

mcp = FastMCP("lifenavigator")
_settings = get_settings()
_sb = SupabaseClient.from_settings(_settings)
_svc = IngestionService(_sb)


async def _run(tool: str, model_data: Any) -> dict[str, Any]:
    """Resolve the user (verified token), call the ingestion method, log the outcome."""
    ctx = resolve_user()  # raises AuthError if no verified user — fail closed
    payload = model_data.model_dump(mode="json") if hasattr(model_data, "model_dump") else dict(model_data)
    result = await getattr(_svc, tool)(ctx, payload)
    log.info("mcp tool=%s user=%s ok=%s", tool, ctx.user_id, result.get("ok"))
    return result


@mcp.tool()
async def submit_life_fact(data: LifeFactIn) -> dict[str, Any]:
    """Persist a discrete life fact (e.g. has children, works at NVIDIA, getting married, considering a
    master's). Requires fact_type, value, domain, confidence, confirmation_status, and provenance."""
    return await _run("submit_life_fact", data)


@mcp.tool()
async def submit_goal(data: GoalIn) -> dict[str, Any]:
    """Persist a goal (buy a house, pay off debt, get promoted, start a family, complete a master's,
    improve fitness). Candidate/inferred goals are NEVER auto-promoted to confirmed."""
    return await _run("submit_goal", data)


@mcp.tool()
async def submit_constraint(data: ConstraintIn) -> dict[str, Any]:
    """Persist a constraint (limited time, limited cash flow, health limitation, debt burden, family
    obligation)."""
    return await _run("submit_constraint", data)


@mcp.tool()
async def submit_risk(data: RiskIn) -> dict[str, Any]:
    """Persist a risk (overcommitment, income loss, high debt, health deterioration, missed deadline)."""
    return await _run("submit_risk", data)


@mcp.tool()
async def submit_opportunity(data: OpportunityIn) -> dict[str, Any]:
    """Persist an opportunity (promotion accelerates housing goal, degree improves career path, debt
    payoff improves mortgage readiness)."""
    return await _run("submit_opportunity", data)


@mcp.tool()
async def submit_narrative(data: NarrativeIn) -> dict[str, Any]:
    """Persist a CANDIDATE dominant-narrative signal (family_foundation, career_acceleration,
    financial_stabilization, health_life_balance, legacy_entrepreneurship). The canonical dominant
    narrative remains DERIVED from the goal set — this never overwrites it."""
    return await _run("submit_narrative", data)


@mcp.tool()
async def submit_relationship(data: RelationshipIn) -> dict[str, Any]:
    """Persist a life-graph relationship (goal supports/conflicts/blocks/accelerates/depends_on another
    node). Self-edges are rejected."""
    return await _run("submit_relationship", data)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    mcp.run()  # stdio transport


if __name__ == "__main__":
    main()
