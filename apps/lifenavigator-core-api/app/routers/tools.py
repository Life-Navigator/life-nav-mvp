"""Deterministic tool platform router (`/v1/tools`)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_tool_runner
from ..models.common import UserContext
from ..services.tools import ToolRunner

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
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
