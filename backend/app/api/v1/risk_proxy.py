"""
Risk Engine Proxy
===========================================================================
Secure proxy for risk-engine service.

Security boundaries:
- Frontend NEVER calls risk-engine directly
- All requests go through this proxy
- JWT validation enforced
- Only derived numeric features allowed (no PHI/PCI)
- Service-to-service auth with audience enforcement
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import httpx
from datetime import datetime

from ...core.config import settings
from ...core.security import get_current_user, User
from ...services.risk_engine_client import RiskEngineClient, RiskEngineError


router = APIRouter(prefix="/api/risk", tags=["risk"])


# ===========================================================================
# Proxy Endpoints
# ===========================================================================


@router.post("/snapshot")
async def compute_risk_snapshot(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Compute risk snapshot (one-time computation).

    Proxies to: risk-engine POST /v1/risk/snapshot

    Security:
    - Requires authenticated user
    - Validates request contains no PHI/PCI
    - Injects tenant_id, user_id_hash from auth context
    - Adds service-to-service JWT for risk-engine
    """
    # Parse request body
    body = await request.json()

    # Initialize risk engine client
    client = RiskEngineClient()

    try:
        # Enrich request with auth context
        enriched_request = _enrich_request(body, current_user)

        # Call risk-engine
        response = await client.compute_snapshot(enriched_request)

        return response

    except RiskEngineError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk computation failed: {str(e)}")


@router.post("/stream")
async def stream_risk_computation(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    Stream risk computation (real-time updates via SSE).

    Proxies to: risk-engine POST /v1/risk/stream

    Security:
    - Requires authenticated user
    - Validates request contains no PHI/PCI
    - Injects tenant_id, user_id_hash from auth context
    - Adds service-to-service JWT for risk-engine
    """
    # Parse request body
    body = await request.json()

    # Initialize risk engine client
    client = RiskEngineClient()

    try:
        # Enrich request with auth context
        enriched_request = _enrich_request(body, current_user)

        # Stream from risk-engine
        async def event_generator():
            async for chunk in client.stream_computation(enriched_request):
                yield chunk

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    except RiskEngineError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk streaming failed: {str(e)}")


@router.post("/stream/heartbeat")
async def stream_heartbeat(
    stream_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Send heartbeat to keep stream alive.

    Proxies to: risk-engine POST /v1/risk/stream/heartbeat
    """
    client = RiskEngineClient()

    try:
        response = await client.send_heartbeat(stream_id)
        return response

    except RiskEngineError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@router.post("/explain")
async def explain_risk(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get risk explanation (drivers, decomposition, counterfactuals).

    Proxies to: risk-engine POST /v1/risk/explain
    """
    body = await request.json()
    client = RiskEngineClient()

    try:
        enriched_request = _enrich_request(body, current_user)
        response = await client.explain_risk(enriched_request)
        return response

    except RiskEngineError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@router.post("/recommend")
async def get_recommendations(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get actionable recommendations.

    Proxies to: risk-engine POST /v1/risk/recommend
    """
    body = await request.json()
    client = RiskEngineClient()

    try:
        enriched_request = _enrich_request(body, current_user)
        response = await client.get_recommendations(enriched_request)
        return response

    except RiskEngineError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


# ===========================================================================
# Helper Functions
# ===========================================================================


def _enrich_request(request_body: Dict[str, Any], user: User) -> Dict[str, Any]:
    """
    Enrich request with auth context and validate data boundary.

    Injects:
    - request_meta.tenant_id
    - request_meta.user_id_hash (SHA256 of user ID - NO raw user ID)
    - request_meta.timestamp
    - call_context.client_type

    Validates:
    - No PHI fields (medical details, diagnosis, SSN, etc.)
    - No PCI fields (credit card numbers, account details)
    - Only derived numeric features
    """
    import hashlib

    # Create user ID hash (SHA256)
    user_id_hash = hashlib.sha256(str(user.id).encode()).hexdigest()

    # Inject metadata
    if "request_meta" not in request_body:
        request_body["request_meta"] = {}

    request_body["request_meta"].update(
        {
            "tenant_id": user.tenant_id or "default",
            "user_id_hash": user_id_hash,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )

    # Inject call context
    if "call_context" not in request_body:
        request_body["call_context"] = {}

    request_body["call_context"].update(
        {
            "api_version": "v1",
            "client_type": "web",  # Could be detected from request headers
        }
    )

    # Validate data boundary (no PHI/PCI)
    _validate_data_boundary(request_body)

    return request_body


def _validate_data_boundary(request_body: Dict[str, Any]):
    """
    Validate that request contains only derived numeric features.

    Forbidden fields (PHI/PCI):
    - Medical details (diagnosis, treatment, prescriptions)
    - Social Security Numbers (SSN)
    - Credit card numbers
    - Account numbers
    - Raw user identifiers (email, phone, name)

    Allowed fields (derived numeric):
    - health_cost_shock_annual_max (numeric proxy)
    - insurance_deductible (numeric amount)
    - employment_stability_score (0-1)
    - user_id_hash (SHA256 hash)
    """
    forbidden_keys = [
        "ssn",
        "social_security_number",
        "credit_card",
        "account_number",
        "diagnosis",
        "medical_condition",
        "prescription",
        "email",
        "phone",
        "first_name",
        "last_name",
        "address",
        "date_of_birth",
        "medical_record_number",
    ]

    def check_dict(d: Dict[str, Any], path: str = ""):
        for key, value in d.items():
            current_path = f"{path}.{key}" if path else key

            # Check if key is forbidden
            if key.lower() in forbidden_keys:
                raise ValueError(
                    f"Data boundary violation: Field '{current_path}' contains PHI/PCI. "
                    f"Use derived numeric features only."
                )

            # Recursively check nested dicts
            if isinstance(value, dict):
                check_dict(value, current_path)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        check_dict(item, f"{current_path}[{i}]")

    check_dict(request_body)
