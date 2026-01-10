# Data Boundaries - PHI/PCI Protection

**Status**: Production Security Standard - CRITICAL
**Last Updated**: 2026-01-09
**Owner**: Security Engineering
**Priority**: P0 BLOCKER

---

## Overview

Life Navigator enforces **strict data boundaries** to ensure Protected Health Information (PHI) and Payment Card Industry (PCI) data **NEVER** cross service boundaries inappropriately.

### Core Principle

**Raw PHI/PCI data MUST NEVER leave the isolated databases.**

Only **derived, anonymized numeric features** may be passed to downstream services (risk-engine, agents).

---

## Architecture

### Data Flow with Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ HIPAA DATABASE (CloudSQL)                                   │
│ ✅ PHI Allowed: SSN, diagnosis, medications, health records │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │ AGGREGATOR SERVICE      │
         │ (Backend API)           │
         │                         │
         │ ✅ Derives features:    │
         │   - age: 45             │
         │   - bmi: 24.5           │
         │   - chronic_conditions: 2│
         │   - medication_count: 3 │
         │                         │
         │ ❌ STRIPS PHI:          │
         │   - SSN                 │
         │   - diagnosis names     │
         │   - medication names    │
         └───────────┬─────────────┘
                     │ Derived Features Only
                     ▼
         ┌─────────────────────────┐
         │ RISK ENGINE             │
         │ (K8s Private)           │
         │                         │
         │ ✅ Receives:            │
         │   - Numeric features    │
         │   - No PHI/PCI          │
         │                         │
         │ ❌ FORBIDDEN:           │
         │   - Raw health data     │
         │   - Financial account # │
         │   - Personal identifiers│
         └─────────────────────────┘
```

---

## 1. Derived Features Contract

### HIPAA Backend → Risk Engine

**Allowed Features** (Numeric, Anonymous):

```python
# backend/app/schemas/risk_features.py
from pydantic import BaseModel, Field

class HealthFeatures(BaseModel):
    """
    Derived health features - NO PHI.

    HIPAA Compliance:
    - All fields are numeric aggregations
    - No personal identifiers
    - No diagnosis names
    - No medication names
    """
    # Demographics (anonymized)
    age: int = Field(..., ge=0, le=120, description="Age in years")
    biological_sex: int = Field(..., ge=0, le=2, description="0=unknown, 1=male, 2=female")

    # Health metrics (aggregated)
    bmi: float | None = Field(None, ge=10, le=60, description="Body Mass Index")
    resting_heart_rate: int | None = Field(None, ge=30, le=200, description="BPM")
    blood_pressure_systolic: int | None = Field(None, ge=60, le=250, description="mmHg")
    blood_pressure_diastolic: int | None = Field(None, ge=40, le=150, description="mmHg")

    # Condition counts (no names)
    chronic_conditions_count: int = Field(0, ge=0, description="Number of chronic conditions")
    active_medications_count: int = Field(0, ge=0, description="Number of active medications")
    recent_hospitalizations_count: int = Field(0, ge=0, description="Last 12 months")

    # Risk scores (derived)
    cardiovascular_risk_score: float | None = Field(None, ge=0, le=100)
    diabetes_risk_score: float | None = Field(None, ge=0, le=100)

    # Behavioral (aggregated)
    exercise_minutes_per_week: int | None = Field(None, ge=0, le=10080)
    sleep_hours_per_night: float | None = Field(None, ge=0, le=24)

    # ❌ FORBIDDEN FIELDS (Would be PHI):
    # ssn: str  # ❌ Personal identifier
    # diagnosis: str  # ❌ Health condition name
    # medications: List[str]  # ❌ Medication names
    # medical_record_number: str  # ❌ Identifier


class FinancialFeatures(BaseModel):
    """
    Derived financial features - NO PCI data.

    PCI-DSS Compliance:
    - No credit card numbers
    - No bank account numbers
    - No routing numbers
    """
    # Income (aggregated)
    annual_income: int | None = Field(None, ge=0, description="USD")
    monthly_income: int | None = Field(None, ge=0, description="USD")

    # Expenses (aggregated)
    monthly_expenses: int | None = Field(None, ge=0, description="USD")
    monthly_debt_payments: int | None = Field(None, ge=0, description="USD")

    # Ratios (derived)
    debt_to_income_ratio: float | None = Field(None, ge=0, le=10)
    savings_rate: float | None = Field(None, ge=-5, le=1, description="Percentage as decimal")

    # Accounts (counts only, no identifiers)
    checking_accounts_count: int = Field(0, ge=0)
    savings_accounts_count: int = Field(0, ge=0)
    credit_cards_count: int = Field(0, ge=0)
    loans_count: int = Field(0, ge=0)

    # Balances (aggregated)
    total_cash: int | None = Field(None, description="USD")
    total_investments: int | None = Field(None, description="USD")
    total_debt: int | None = Field(None, description="USD")

    # Credit (aggregated)
    credit_score: int | None = Field(None, ge=300, le=850)
    credit_utilization: float | None = Field(None, ge=0, le=2, description="Percentage as decimal")

    # ❌ FORBIDDEN FIELDS (Would be PCI data):
    # credit_card_number: str  # ❌ PAN (Primary Account Number)
    # bank_account_number: str  # ❌ Account identifier
    # routing_number: str  # ❌ Financial institution identifier
    # plaid_access_token: str  # ❌ Credential


class RiskEngineRequest(BaseModel):
    """
    Complete request to risk engine - ONLY derived features.

    Required for all risk engine calls:
    - tenant_id: Multi-tenancy isolation
    - user_id_hash: User identification (SHA-256 hashed)
    - health_features: Derived health data
    - financial_features: Derived financial data
    """
    # Identity (hashed, for audit trail)
    tenant_id: str = Field(..., min_length=1, max_length=100, description="Tenant UUID")
    user_id_hash: str = Field(..., min_length=64, max_length=64, description="SHA-256 hash of user_id")

    # Scenario parameters
    scenario_name: str = Field(..., description="Scenario identifier")
    time_horizon_years: int = Field(..., ge=1, le=50, description="Simulation duration")
    monte_carlo_runs: int = Field(10000, ge=1000, le=100000, description="Simulation iterations")

    # Derived features
    health_features: HealthFeatures
    financial_features: FinancialFeatures

    # ❌ FORBIDDEN: Raw PHI/PCI data
```

---

## 2. Gateway Validation Middleware

### Backend API Gateway

**Location**: `backend/app/middleware/data_boundary_validator.py`

```python
"""
Data Boundary Validator Middleware.

Ensures NO PHI/PCI data leaves backend API to internal services.

HIPAA: § 164.308(a)(4)(ii)(B) - Access Establishment
PCI-DSS: Requirement 3.4 - Render PAN unreadable
"""

from typing import Any, Dict
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import hashlib
import re

from app.core.logging import logger


# Forbidden patterns (PHI/PCI indicators)
PHI_PATTERNS = [
    r"\b\d{3}-\d{2}-\d{4}\b",  # SSN (XXX-XX-XXXX)
    r"\b\d{9}\b",  # SSN (XXXXXXXXX)
    r"medical_record_number",
    r"diagnosis",
    r"medication",
    r"prescription",
    r"ssn",
    r"social_security",
]

PCI_PATTERNS = [
    r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b",  # Credit card (16 digits)
    r"\b\d{13,19}\b",  # Credit card (13-19 digits)
    r"credit_card_number",
    r"card_number",
    r"pan",  # Primary Account Number
    r"bank_account_number",
    r"routing_number",
    r"account_number",
]


class DataBoundaryValidator(BaseHTTPMiddleware):
    """
    Middleware to prevent PHI/PCI leakage to internal services.

    Validates:
    1. Outbound requests to risk-engine, agents, market-data
    2. Rejects requests containing forbidden fields
    3. Ensures only derived features are sent
    """

    # Internal services that MUST NOT receive PHI/PCI
    INTERNAL_SERVICES = [
        "risk-engine",
        "agents",
        "market-data",
        "graphrag-rs",
        "finance-api",
    ]

    async def dispatch(self, request: Request, call_next):
        """
        Intercept requests to internal services and validate payloads.
        """
        # Check if request is to internal service
        target_service = self._get_target_service(request)
        if not target_service:
            # Not an internal service call, allow through
            return await call_next(request)

        # Validate request body
        try:
            body = await request.body()
            if body:
                body_str = body.decode("utf-8")

                # Check for PHI patterns
                for pattern in PHI_PATTERNS:
                    if re.search(pattern, body_str, re.IGNORECASE):
                        logger.error(
                            "data_boundary_violation",
                            service=target_service,
                            pattern=pattern,
                            tenant_id=request.headers.get("X-Tenant-ID"),
                        )
                        raise HTTPException(
                            status_code=403,
                            detail=f"Data boundary violation: PHI detected in request to {target_service}. "
                                   f"Only derived features are allowed."
                        )

                # Check for PCI patterns
                for pattern in PCI_PATTERNS:
                    if re.search(pattern, body_str, re.IGNORECASE):
                        logger.error(
                            "data_boundary_violation",
                            service=target_service,
                            pattern=pattern,
                            tenant_id=request.headers.get("X-Tenant-ID"),
                        )
                        raise HTTPException(
                            status_code=403,
                            detail=f"Data boundary violation: PCI data detected in request to {target_service}. "
                                   f"Only derived features are allowed."
                        )

                logger.info(
                    "data_boundary_validated",
                    service=target_service,
                    tenant_id=request.headers.get("X-Tenant-ID"),
                )

        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            logger.error("data_boundary_validation_error", error=str(e))

        return await call_next(request)

    def _get_target_service(self, request: Request) -> str | None:
        """
        Determine if request is targeting an internal service.
        """
        path = request.url.path

        # Check for internal service proxy paths
        for service in self.INTERNAL_SERVICES:
            if f"/api/v1/internal/{service}" in path:
                return service
            if f"/api/v1/proxy/{service}" in path:
                return service

        return None


def validate_risk_engine_request(request: Dict[str, Any]) -> None:
    """
    Explicit validation for risk engine requests.

    Raises ValueError if PHI/PCI data detected.
    """
    # Convert to string for pattern matching
    import json
    request_str = json.dumps(request)

    # Check for forbidden patterns
    for pattern in PHI_PATTERNS + PCI_PATTERNS:
        if re.search(pattern, request_str, re.IGNORECASE):
            raise ValueError(
                f"Risk engine request contains forbidden data pattern: {pattern}. "
                f"Only derived features are allowed."
            )

    # Validate required fields
    required_fields = ["tenant_id", "user_id_hash", "health_features", "financial_features"]
    for field in required_fields:
        if field not in request:
            raise ValueError(f"Missing required field: {field}")

    # Validate user_id_hash is actually hashed (SHA-256 = 64 hex chars)
    user_id_hash = request.get("user_id_hash", "")
    if not re.match(r"^[a-f0-9]{64}$", user_id_hash):
        raise ValueError(
            f"user_id_hash must be SHA-256 hash (64 hex chars), got: {user_id_hash[:20]}..."
        )

    logger.info(
        "risk_engine_request_validated",
        tenant_id=request.get("tenant_id"),
        user_id_hash=user_id_hash[:16] + "...",  # Log prefix only
    )
```

---

## 3. Service-to-Service Authentication

### S2S JWT with Audience Validation

**Location**: `backend/app/core/s2s_auth.py`

```python
"""
Service-to-Service (S2S) JWT Authentication.

Ensures only authorized services can communicate.

Features:
- Short-lived tokens (5 minutes)
- Audience validation (aud claim)
- Issuer validation (iss claim)
- Rotating signing keys
"""

from datetime import datetime, timedelta
from typing import Literal
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.core.logging import logger


# Service identifiers
ServiceName = Literal[
    "backend",
    "risk-engine",
    "agents",
    "market-data",
    "graphrag-rs",
    "finance-api",
]


# S2S JWT signing key (separate from user JWT key)
S2S_SECRET_KEY = settings.S2S_JWT_SECRET or settings.SECRET_KEY
S2S_ALGORITHM = "HS256"
S2S_TOKEN_TTL = 300  # 5 minutes


security = HTTPBearer()


def create_s2s_token(
    issuer: ServiceName,
    audience: ServiceName,
    scopes: list[str] | None = None
) -> str:
    """
    Create service-to-service JWT token.

    Args:
        issuer: Calling service
        audience: Target service
        scopes: Permissions (e.g., ["read", "write"])

    Returns:
        JWT token (expires in 5 minutes)
    """
    now = datetime.utcnow()
    payload = {
        "iss": issuer,  # ✅ Issuer (calling service)
        "aud": audience,  # ✅ Audience (target service)
        "iat": now,  # Issued at
        "exp": now + timedelta(seconds=S2S_TOKEN_TTL),  # ✅ Short TTL (5 min)
        "scopes": scopes or [],
    }

    token = jwt.encode(payload, S2S_SECRET_KEY, algorithm=S2S_ALGORITHM)

    logger.info(
        "s2s_token_created",
        issuer=issuer,
        audience=audience,
        scopes=scopes,
        expires_in=S2S_TOKEN_TTL,
    )

    return token


def verify_s2s_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
    expected_issuer: ServiceName | None = None,
    expected_audience: ServiceName | None = None,
) -> dict:
    """
    Verify service-to-service JWT token.

    Args:
        credentials: Bearer token from Authorization header
        expected_issuer: Required issuer (calling service)
        expected_audience: Required audience (this service)

    Returns:
        Decoded JWT payload

    Raises:
        HTTPException: If token is invalid or doesn't match expected issuer/audience
    """
    token = credentials.credentials

    try:
        # Decode and verify token
        payload = jwt.decode(
            token,
            S2S_SECRET_KEY,
            algorithms=[S2S_ALGORITHM],
            options={"verify_exp": True},  # ✅ Enforce expiration
        )

        # Validate issuer (calling service)
        if expected_issuer and payload.get("iss") != expected_issuer:
            raise HTTPException(
                status_code=403,
                detail=f"Invalid issuer: expected {expected_issuer}, got {payload.get('iss')}"
            )

        # Validate audience (target service)
        if expected_audience and payload.get("aud") != expected_audience:
            raise HTTPException(
                status_code=403,
                detail=f"Invalid audience: expected {expected_audience}, got {payload.get('aud')}"
            )

        logger.info(
            "s2s_token_verified",
            issuer=payload.get("iss"),
            audience=payload.get("aud"),
            scopes=payload.get("scopes"),
        )

        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("s2s_token_expired", token_prefix=token[:20])
        raise HTTPException(status_code=401, detail="S2S token expired")

    except jwt.InvalidTokenError as e:
        logger.warning("s2s_token_invalid", error=str(e))
        raise HTTPException(status_code=401, detail=f"Invalid S2S token: {str(e)}")


# Dependency for FastAPI routes
async def require_s2s_auth(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    FastAPI dependency to require S2S authentication.

    Usage:
        @app.post("/api/v1/internal/risk-engine/compute")
        async def compute_risk(
            request: RiskEngineRequest,
            s2s_auth: dict = Depends(require_s2s_auth)
        ):
            # Route only accessible with valid S2S token
            ...
    """
    return verify_s2s_token(credentials)
```

### Risk Engine Endpoint with S2S Auth

**Location**: `backend/app/api/v1/internal/risk_engine.py`

```python
"""
Risk Engine Internal API.

CRITICAL SECURITY:
- Only accepts derived features (NO PHI/PCI)
- Requires S2S JWT authentication
- Validates data boundaries
- Logs all requests for audit
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.core.s2s_auth import require_s2s_auth, ServiceName
from app.middleware.data_boundary_validator import validate_risk_engine_request
from app.schemas.risk_features import RiskEngineRequest
from app.clients.risk_engine_client import RiskEngineClient
from app.core.logging import logger


router = APIRouter()


@router.post("/compute")
async def compute_risk(
    request: RiskEngineRequest,
    s2s_auth: dict = Depends(require_s2s_auth),  # ✅ S2S JWT required
):
    """
    Compute risk scenario using Monte Carlo simulation.

    SECURITY:
    - Requires S2S JWT from backend service
    - Validates NO PHI/PCI in request
    - Enforces tenant_id + user_id_hash
    - Logs all requests to audit trail

    Request must contain ONLY derived features:
    - Numeric aggregations
    - No personal identifiers
    - No health condition names
    - No medication names
    - No financial account numbers
    """
    # Validate issuer is backend
    issuer = s2s_auth.get("iss")
    if issuer != "backend":
        raise HTTPException(
            status_code=403,
            detail=f"Risk engine only accepts requests from backend service, got: {issuer}"
        )

    # Validate data boundaries (NO PHI/PCI)
    try:
        validate_risk_engine_request(request.dict())
    except ValueError as e:
        logger.error(
            "data_boundary_violation",
            tenant_id=request.tenant_id,
            user_id_hash=request.user_id_hash[:16],
            error=str(e),
        )
        raise HTTPException(
            status_code=403,
            detail=f"Data boundary violation: {str(e)}"
        )

    # Audit log (HIPAA § 164.312(b))
    logger.info(
        "risk_engine_request",
        tenant_id=request.tenant_id,
        user_id_hash=request.user_id_hash[:16] + "...",
        scenario_name=request.scenario_name,
        time_horizon_years=request.time_horizon_years,
        issuer=issuer,
    )

    # Call risk engine service
    risk_client = RiskEngineClient()
    try:
        result = await risk_client.compute_scenario(request)
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(
            "risk_engine_error",
            tenant_id=request.tenant_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Risk computation failed")
```

---

## 4. Tenant & User Identification

### SHA-256 User ID Hashing

```python
# backend/app/utils/hashing.py
import hashlib

def hash_user_id(user_id: str, tenant_id: str) -> str:
    """
    Hash user_id for downstream services.

    Prevents user identification while maintaining:
    - Uniqueness per tenant
    - Deterministic (same user always gets same hash)
    - One-way (cannot reverse to get user_id)

    Args:
        user_id: User UUID
        tenant_id: Tenant UUID

    Returns:
        SHA-256 hash (64 hex chars)
    """
    combined = f"{tenant_id}:{user_id}"
    return hashlib.sha256(combined.encode()).hexdigest()
```

### Usage in Backend API

```python
# backend/app/api/v1/scenario_lab.py
from app.utils.hashing import hash_user_id
from app.core.s2s_auth import create_s2s_token

@router.post("/scenarios/run")
async def run_scenario(
    scenario: ScenarioRequest,
    user: User = Depends(get_current_user),
):
    """
    Run risk scenario - aggregates PHI/PCI into derived features.
    """
    # Aggregate health data into derived features
    health_features = await aggregate_health_features(user.id)

    # Aggregate financial data into derived features
    financial_features = await aggregate_financial_features(user.id)

    # Hash user_id for downstream service
    user_id_hash = hash_user_id(user.id, user.tenant_id)

    # Create S2S token for risk engine
    s2s_token = create_s2s_token(
        issuer="backend",
        audience="risk-engine",
        scopes=["compute"],
    )

    # Call risk engine (internal service)
    risk_engine_url = f"{settings.RISK_ENGINE_URL}/api/v1/compute"
    response = await httpx.post(
        risk_engine_url,
        json={
            "tenant_id": user.tenant_id,
            "user_id_hash": user_id_hash,  # ✅ Hashed, not raw user_id
            "health_features": health_features.dict(),
            "financial_features": financial_features.dict(),
            "scenario_name": scenario.name,
            "time_horizon_years": scenario.years,
        },
        headers={"Authorization": f"Bearer {s2s_token}"},  # ✅ S2S JWT
        timeout=60.0,
    )

    return response.json()
```

---

## 5. Automated Boundary Tests

**Location**: `backend/tests/compliance/test_data_boundaries.py`

```python
"""
Data Boundary Compliance Tests.

HIPAA: § 164.308(a)(4)(ii)(B) - Access Establishment
PCI-DSS: Requirement 3.4 - Render PAN unreadable

Tests ensure PHI/PCI NEVER crosses service boundaries.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.risk_features import RiskEngineRequest

client = TestClient(app)


@pytest.mark.compliance
@pytest.mark.data_boundaries
class TestDataBoundaries:
    """Test data boundary enforcement."""

    def test_risk_engine_rejects_ssn(self):
        """Risk engine MUST reject requests containing SSN (PHI)."""
        # Attempt to send SSN to risk engine
        request = {
            "tenant_id": "tenant_123",
            "user_id_hash": "a" * 64,
            "ssn": "123-45-6789",  # ❌ PHI - should be rejected
            "health_features": {},
            "financial_features": {},
        }

        response = client.post("/api/v1/internal/risk-engine/compute", json=request)

        # Should be rejected
        assert response.status_code == 403
        assert "boundary violation" in response.json()["detail"].lower()

    def test_risk_engine_rejects_diagnosis(self):
        """Risk engine MUST reject requests containing diagnosis names (PHI)."""
        request = {
            "tenant_id": "tenant_123",
            "user_id_hash": "a" * 64,
            "health_features": {
                "diagnosis": "Type 2 Diabetes",  # ❌ PHI
                "age": 45,
            },
            "financial_features": {},
        }

        response = client.post("/api/v1/internal/risk-engine/compute", json=request)

        assert response.status_code == 403
        assert "boundary violation" in response.json()["detail"].lower()

    def test_risk_engine_rejects_credit_card(self):
        """Risk engine MUST reject requests containing credit card numbers (PCI)."""
        request = {
            "tenant_id": "tenant_123",
            "user_id_hash": "a" * 64,
            "health_features": {},
            "financial_features": {
                "credit_card_number": "4111111111111111",  # ❌ PCI data
                "annual_income": 75000,
            },
        }

        response = client.post("/api/v1/internal/risk-engine/compute", json=request)

        assert response.status_code == 403
        assert "boundary violation" in response.json()["detail"].lower()

    def test_risk_engine_accepts_derived_features(self):
        """Risk engine MUST accept requests with only derived features."""
        request = {
            "tenant_id": "tenant_123",
            "user_id_hash": "a" * 64,
            "scenario_name": "retirement_planning",
            "time_horizon_years": 30,
            "health_features": {
                "age": 45,
                "bmi": 24.5,
                "chronic_conditions_count": 2,
                "active_medications_count": 3,
            },
            "financial_features": {
                "annual_income": 75000,
                "monthly_expenses": 4500,
                "debt_to_income_ratio": 0.35,
                "credit_score": 720,
            },
        }

        # Mock S2S token
        from app.core.s2s_auth import create_s2s_token
        token = create_s2s_token(issuer="backend", audience="risk-engine")

        response = client.post(
            "/api/v1/internal/risk-engine/compute",
            json=request,
            headers={"Authorization": f"Bearer {token}"},
        )

        # Should be accepted
        assert response.status_code == 200

    def test_user_id_must_be_hashed(self):
        """Risk engine MUST reject unhashed user_id."""
        request = {
            "tenant_id": "tenant_123",
            "user_id_hash": "user_12345",  # ❌ Not hashed (not 64 hex chars)
            "health_features": {"age": 45},
            "financial_features": {"annual_income": 75000},
        }

        response = client.post("/api/v1/internal/risk-engine/compute", json=request)

        assert response.status_code == 403
        assert "sha-256" in response.json()["detail"].lower()
```

---

## 6. Multi-Agent Tools Data Restrictions

### GraphRAG Query Boundaries

```python
# backend/app/clients/graphrag_client.py
from app.core.s2s_auth import create_s2s_token

async def query_graphrag(
    query: str,
    user_id: str,
    tenant_id: str,
    domains: list[str],
    sensitivity: Literal["PUBLIC", "HIPAA", "FINANCIAL"]
):
    """
    Query GraphRAG with sensitivity partitioning.

    Args:
        query: Natural language query
        user_id: User UUID
        tenant_id: Tenant UUID
        domains: Allowed domains (e.g., ["health", "goals"])
        sensitivity: Data sensitivity level

    Returns:
        GraphRAG response (RLS-filtered, domain-scoped)

    Security:
    - RLS enforced (tenant_id isolation)
    - Sensitivity partitions (HIPAA data separate from financial)
    - Domain filtering (no cross-domain leakage)
    - S2S JWT authentication
    """
    # Hash user_id
    user_id_hash = hash_user_id(user_id, tenant_id)

    # Create S2S token
    token = create_s2s_token(
        issuer="backend",
        audience="graphrag-rs",
        scopes=["query"],
    )

    # Call GraphRAG service
    response = await httpx.post(
        f"{settings.GRAPHRAG_URL}/query",
        json={
            "query": query,
            "user_id_hash": user_id_hash,  # ✅ Hashed
            "tenant_id": tenant_id,        # ✅ RLS enforced
            "domains": domains,            # ✅ Scope filtering
            "sensitivity": sensitivity,    # ✅ Partition isolation
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    return response.json()
```

---

## Enforcement Checklist

- [ ] **Gateway validation middleware deployed** (`data_boundary_validator.py`)
- [ ] **S2S JWT authentication implemented** (`s2s_auth.py`)
- [ ] **Derived features contract defined** (`risk_features.py`)
- [ ] **Risk engine endpoint secured** (S2S auth + validation)
- [ ] **User ID hashing implemented** (`hash_user_id()`)
- [ ] **Boundary tests passing** (`test_data_boundaries.py`)
- [ ] **Audit logging enabled** (all internal service calls logged)
- [ ] **S2S key rotation scheduled** (90-day cycle)

---

## Related Documentation

- [Secrets & Config Management](./SECRETS_AND_CONFIG.md)
- [Agent Governance](../agents/AGENT_GOVERNANCE.md)
- [Cloud SQL Production](../database/CLOUD_SQL_PRODUCTION.md)

---

**Last Updated**: 2026-01-09
**Next Review**: After implementation of gateway middleware
