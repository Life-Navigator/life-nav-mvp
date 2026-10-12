"""Deterministic tool platform router (`/v1/tools`)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_tool_runner
from ..models.common import UserContext
from ..services.tools import ToolInputError, ToolRunner

router = APIRouter(prefix="/v1/tools", tags=["tools"])


@router.get("")
async def catalog(user: AuthenticatedUser = Depends(authenticated)):
    return {"tools": ToolRunner.catalog()}


@router.post("/{name}/run")
async def run(name: str, user: AuthenticatedUser = Depends(authenticated),
              runner: ToolRunner = Depends(get_tool_runner),
              inputs: dict = Body(default={}, embed=True),
              scenario_id: str = Body(default="", embed=True), objective_id: str = Body(default="", embed=True)):
    try:
        return await runner.run(UserContext(user_id=user.user_id), name, inputs, scenario_id=scenario_id, objective_id=objective_id)
    # ORDER MATTERS: ToolInputError subclasses ValueError (via CalculatorError), so it must be caught
    # first. Before Phase A every input defaulted to 0.0 and nothing raised; now that a missing
    # required input raises, falling through to the ValueError branch would report "unknown tool" and
    # a 404 for what is actually a complete, valid request missing one field.
    except ToolInputError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
