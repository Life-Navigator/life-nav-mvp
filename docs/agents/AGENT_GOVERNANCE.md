# Agent Governance & Safety Framework

**Status**: Pre-Production Implementation Required
**Priority**: P0 BLOCKER (30% → 100% Required for Launch)
**Owner**: AI Systems Architecture Team
**Last Updated**: 2026-01-09

---

## Executive Summary

This document defines the governance framework for Life Navigator's multi-agent system, ensuring agents operate within strict permission, data access, and audit boundaries. The framework addresses:

1. **Tool Permission Controls** - Explicit allowlists preventing unauthorized actions
2. **Data Boundary Enforcement** - Tenant-aware retrieval with HIPAA/PCI partitioning
3. **Audit Logging** - Deterministic, tamper-evident logs with PHI/PCI redaction
4. **Cost & Rate Controls** - Per-user and per-tenant limits
5. **Human-in-the-Loop Gates** - Required approvals for sensitive actions

**Current Status**: 30% complete (design only, no enforcement)
**Target**: 100% complete (all controls enforced in production)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agent Tool Permissions](#agent-tool-permissions)
3. [Data Retrieval Boundaries](#data-retrieval-boundaries)
4. [Audit Logging Framework](#audit-logging-framework)
5. [Rate Limits & Cost Controls](#rate-limits--cost-controls)
6. [Human-in-the-Loop Gates](#human-in-the-loop-gates)
7. [Multi-Agent Orchestration](#multi-agent-orchestration)
8. [Security Testing](#security-testing)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

### Agent System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Interface (Web/Mobile)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │  Agent Orchestrator  │
                    │  - Route requests    │
                    │  - Check permissions │
                    │  - Audit logging     │
                    └───────────┬──────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐    ┌────────▼─────────┐    ┌───────▼────────┐
│ Financial      │    │ Health Coach     │    │ Career Advisor │
│ Advisor Agent  │    │ Agent            │    │ Agent          │
│                │    │                  │    │                │
│ Tools:         │    │ Tools:           │    │ Tools:         │
│ - Plaid        │    │ - GraphRAG       │    │ - GraphRAG     │
│ - GraphRAG     │    │ - Calendar       │    │ - LinkedIn     │
│ - Calculator   │    │ - Fitbit         │    │ - Email        │
└───────┬────────┘    └────────┬─────────┘    └───────┬────────┘
        │                      │                       │
        │         ┌────────────▼────────────┐         │
        │         │  Tool Permission Check  │         │
        └────────►│  - Agent allowlist      │◄────────┘
                  │  - Data sensitivity     │
                  │  - HITL gate check      │
                  └────────────┬────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐    ┌────────▼─────────┐    ┌─────▼──────────┐
│ GraphRAG       │    │ External APIs    │    │ Internal Tools │
│ (Tenant-aware) │    │ (Plaid, Fitbit)  │    │ (Calculator)   │
│                │    │                  │    │                │
│ Sensitivity:   │    │ HITL Required:   │    │ Always Safe:   │
│ - HIPAA        │    │ - Email.send     │    │ - Math         │
│ - Financial    │    │ - Calendar.add   │    │ - Date/Time    │
│ - Goals        │    │ - Plaid.link     │    │                │
└────────────────┘    └──────────────────┘    └────────────────┘
```

### Key Design Principles

1. **Least Privilege**: Agents only have access to tools explicitly required for their domain
2. **Defense in Depth**: Multiple layers of permission checks (orchestrator → tool → data)
3. **Fail-Safe Defaults**: Unknown tools/agents → denied by default
4. **Auditability**: Every agent interaction logged with tamper-evident signatures
5. **Cost Awareness**: Real-time tracking of API costs with automatic circuit breakers

---

## Agent Tool Permissions

### Permission Model

Each agent has an **explicit allowlist** of tools it can invoke. Tool permissions are enforced at three levels:

1. **Agent-Level Allowlist**: Which tools this agent can access
2. **Tool-Level Data Sensitivity**: What data domains this tool can retrieve
3. **Action-Level HITL Gates**: Which tool actions require human approval

### Agent Permission Registry

**Location**: `backend/app/agents/permissions.py`

```python
from enum import Enum
from typing import Dict, List, Set
from pydantic import BaseModel

class ToolName(str, Enum):
    """Enumeration of all available agent tools."""
    # GraphRAG retrieval
    GRAPHRAG_QUERY_HEALTH = "graphrag.query_health"
    GRAPHRAG_QUERY_FINANCIAL = "graphrag.query_financial"
    GRAPHRAG_QUERY_GOALS = "graphrag.query_goals"
    GRAPHRAG_QUERY_EDUCATION = "graphrag.query_education"

    # External integrations
    PLAID_GET_TRANSACTIONS = "plaid.get_transactions"
    PLAID_GET_BALANCES = "plaid.get_balances"
    PLAID_LINK_ACCOUNT = "plaid.link_account"  # HITL required

    FITBIT_GET_STEPS = "fitbit.get_steps"
    FITBIT_GET_HEART_RATE = "fitbit.get_heart_rate"

    CALENDAR_GET_EVENTS = "calendar.get_events"
    CALENDAR_CREATE_EVENT = "calendar.create_event"  # HITL required

    EMAIL_SEND = "email.send"  # HITL required

    # Internal utilities
    CALCULATOR_COMPUTE = "calculator.compute"
    DATETIME_GET_CURRENT = "datetime.get_current"
    SEARCH_WEB = "search.web"

class DataSensitivity(str, Enum):
    """Data sensitivity classification for tools."""
    PUBLIC = "public"               # No restrictions
    INTERNAL = "internal"           # User data, non-regulated
    FINANCIAL = "financial"         # PCI-DSS regulated
    HIPAA = "hipaa"                 # HIPAA PHI
    CROSS_DOMAIN = "cross_domain"   # Multiple sensitivity levels

class AgentName(str, Enum):
    """Enumeration of all agent types."""
    FINANCIAL_ADVISOR = "financial_advisor"
    HEALTH_COACH = "health_coach"
    CAREER_ADVISOR = "career_advisor"
    EDUCATION_PLANNER = "education_planner"
    GENERAL_ASSISTANT = "general_assistant"

class ToolPermission(BaseModel):
    """Permission metadata for a tool."""
    tool: ToolName
    sensitivity: DataSensitivity
    requires_hitl: bool = False
    cost_per_invocation: float = 0.0  # USD
    rate_limit_per_minute: int = 60
    description: str

# Tool registry with metadata
TOOL_REGISTRY: Dict[ToolName, ToolPermission] = {
    ToolName.GRAPHRAG_QUERY_HEALTH: ToolPermission(
        tool=ToolName.GRAPHRAG_QUERY_HEALTH,
        sensitivity=DataSensitivity.HIPAA,
        requires_hitl=False,
        cost_per_invocation=0.01,
        rate_limit_per_minute=30,
        description="Query health-related knowledge graph (HIPAA data)",
    ),
    ToolName.GRAPHRAG_QUERY_FINANCIAL: ToolPermission(
        tool=ToolName.GRAPHRAG_QUERY_FINANCIAL,
        sensitivity=DataSensitivity.FINANCIAL,
        requires_hitl=False,
        cost_per_invocation=0.01,
        rate_limit_per_minute=30,
        description="Query financial knowledge graph (PCI data)",
    ),
    ToolName.PLAID_LINK_ACCOUNT: ToolPermission(
        tool=ToolName.PLAID_LINK_ACCOUNT,
        sensitivity=DataSensitivity.FINANCIAL,
        requires_hitl=True,  # ✅ Human approval required
        cost_per_invocation=0.00,
        rate_limit_per_minute=5,
        description="Link new financial account via Plaid",
    ),
    ToolName.EMAIL_SEND: ToolPermission(
        tool=ToolName.EMAIL_SEND,
        sensitivity=DataSensitivity.INTERNAL,
        requires_hitl=True,  # ✅ Human approval required
        cost_per_invocation=0.001,
        rate_limit_per_minute=10,
        description="Send email on behalf of user",
    ),
    ToolName.CALCULATOR_COMPUTE: ToolPermission(
        tool=ToolName.CALCULATOR_COMPUTE,
        sensitivity=DataSensitivity.PUBLIC,
        requires_hitl=False,
        cost_per_invocation=0.0,
        rate_limit_per_minute=1000,
        description="Perform mathematical calculations",
    ),
    # ... (additional tools omitted for brevity)
}

# Agent-specific allowlists
AGENT_TOOL_PERMISSIONS: Dict[AgentName, Set[ToolName]] = {
    AgentName.FINANCIAL_ADVISOR: {
        ToolName.GRAPHRAG_QUERY_FINANCIAL,
        ToolName.GRAPHRAG_QUERY_GOALS,
        ToolName.PLAID_GET_TRANSACTIONS,
        ToolName.PLAID_GET_BALANCES,
        ToolName.PLAID_LINK_ACCOUNT,  # HITL gated
        ToolName.CALCULATOR_COMPUTE,
        ToolName.DATETIME_GET_CURRENT,
        # ❌ DENIED: graphrag.query_health (data boundary violation)
        # ❌ DENIED: email.send (not required for financial advice)
    },

    AgentName.HEALTH_COACH: {
        ToolName.GRAPHRAG_QUERY_HEALTH,
        ToolName.GRAPHRAG_QUERY_GOALS,
        ToolName.FITBIT_GET_STEPS,
        ToolName.FITBIT_GET_HEART_RATE,
        ToolName.CALENDAR_GET_EVENTS,
        ToolName.CALENDAR_CREATE_EVENT,  # HITL gated
        ToolName.CALCULATOR_COMPUTE,
        ToolName.DATETIME_GET_CURRENT,
        # ❌ DENIED: graphrag.query_financial (data boundary violation)
        # ❌ DENIED: plaid.* (not health-related)
    },

    AgentName.CAREER_ADVISOR: {
        ToolName.GRAPHRAG_QUERY_GOALS,
        ToolName.GRAPHRAG_QUERY_EDUCATION,
        ToolName.SEARCH_WEB,
        ToolName.CALCULATOR_COMPUTE,
        ToolName.DATETIME_GET_CURRENT,
        # ❌ DENIED: HIPAA tools (no health access)
        # ❌ DENIED: Financial tools (no finance access)
    },

    AgentName.GENERAL_ASSISTANT: {
        # Minimal permissions - primarily routing to specialized agents
        ToolName.GRAPHRAG_QUERY_GOALS,
        ToolName.GRAPHRAG_QUERY_EDUCATION,
        ToolName.CALCULATOR_COMPUTE,
        ToolName.DATETIME_GET_CURRENT,
        ToolName.SEARCH_WEB,
    },
}

def check_tool_permission(agent: AgentName, tool: ToolName) -> bool:
    """
    Check if agent has permission to invoke tool.

    Returns:
        True if allowed, False otherwise.
    """
    allowed_tools = AGENT_TOOL_PERMISSIONS.get(agent, set())
    return tool in allowed_tools

def get_tool_metadata(tool: ToolName) -> ToolPermission:
    """Get metadata for a tool."""
    if tool not in TOOL_REGISTRY:
        raise ValueError(f"Unknown tool: {tool}")
    return TOOL_REGISTRY[tool]
```

### Permission Enforcement Middleware

**Location**: `backend/app/agents/middleware.py`

```python
from typing import Any, Dict
from fastapi import HTTPException, status
from app.agents.permissions import (
    AgentName,
    ToolName,
    check_tool_permission,
    get_tool_metadata,
)
from app.core.logging import logger

class AgentPermissionValidator:
    """Validates agent tool invocations against permission policies."""

    def __init__(self):
        self.violation_count = 0

    async def validate_tool_call(
        self,
        agent: AgentName,
        tool: ToolName,
        user_id: str,
        tenant_id: str,
        params: Dict[str, Any],
    ) -> None:
        """
        Validate a tool invocation.

        Raises:
            HTTPException: If permission denied.
        """
        # Check 1: Agent allowlist
        if not check_tool_permission(agent, tool):
            self.violation_count += 1
            logger.error(
                "agent_permission_violation",
                extra={
                    "agent": agent,
                    "tool": tool,
                    "user_id": user_id,
                    "tenant_id": tenant_id,
                    "reason": "tool_not_in_allowlist",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "permission_denied",
                    "message": f"Agent '{agent}' is not authorized to use tool '{tool}'",
                    "agent": agent,
                    "tool": tool,
                },
            )

        # Check 2: HITL gate
        tool_metadata = get_tool_metadata(tool)
        if tool_metadata.requires_hitl:
            # Check if approval exists in database
            approval = await self._check_hitl_approval(
                user_id=user_id,
                tenant_id=tenant_id,
                tool=tool,
                params=params,
            )
            if not approval:
                logger.warning(
                    "hitl_approval_required",
                    extra={
                        "agent": agent,
                        "tool": tool,
                        "user_id": user_id,
                        "tenant_id": tenant_id,
                    },
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "hitl_approval_required",
                        "message": f"Tool '{tool}' requires human approval",
                        "approval_request_id": await self._create_approval_request(
                            user_id=user_id,
                            tenant_id=tenant_id,
                            agent=agent,
                            tool=tool,
                            params=params,
                        ),
                    },
                )

        # Check 3: Data sensitivity boundaries (cross-check with user's data access)
        await self._validate_data_sensitivity(
            agent=agent,
            tool=tool,
            user_id=user_id,
            tenant_id=tenant_id,
            sensitivity=tool_metadata.sensitivity,
        )

        logger.info(
            "agent_tool_authorized",
            extra={
                "agent": agent,
                "tool": tool,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "sensitivity": tool_metadata.sensitivity,
                "requires_hitl": tool_metadata.requires_hitl,
            },
        )

    async def _check_hitl_approval(
        self,
        user_id: str,
        tenant_id: str,
        tool: ToolName,
        params: Dict[str, Any],
    ) -> bool:
        """Check if HITL approval exists for this action."""
        # Query approvals table
        from app.db.supabase import supabase_client

        result = await supabase_client.table("agent_approvals").select("*").match({
            "user_id": user_id,
            "tenant_id": tenant_id,
            "tool": tool,
            "status": "approved",
            "expires_at": f"gt.{datetime.utcnow().isoformat()}",
        }).execute()

        return len(result.data) > 0

    async def _create_approval_request(
        self,
        user_id: str,
        tenant_id: str,
        agent: AgentName,
        tool: ToolName,
        params: Dict[str, Any],
    ) -> str:
        """Create a pending approval request."""
        from app.db.supabase import supabase_client
        import uuid

        request_id = str(uuid.uuid4())

        await supabase_client.table("agent_approvals").insert({
            "id": request_id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "agent": agent,
            "tool": tool,
            "params": params,  # Redacted for PHI/PCI
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
        }).execute()

        return request_id

    async def _validate_data_sensitivity(
        self,
        agent: AgentName,
        tool: ToolName,
        user_id: str,
        tenant_id: str,
        sensitivity: DataSensitivity,
    ) -> None:
        """Validate agent has access to data sensitivity level."""
        # Example: Check if user has consented to HIPAA data access
        if sensitivity == DataSensitivity.HIPAA:
            # Verify HIPAA consent exists
            from app.db.cloudsql_hipaa import get_hipaa_consent
            consent = await get_hipaa_consent(user_id, tenant_id)
            if not consent:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "consent_required",
                        "message": "User has not consented to HIPAA data access",
                    },
                )
```

---

## Data Retrieval Boundaries

### Tenant-Aware GraphRAG

All GraphRAG queries are tenant-scoped and sensitivity-partitioned to prevent cross-tenant and cross-domain data leakage.

**Location**: `backend/app/clients/graphrag_client.py`

```python
from typing import List, Optional
from pydantic import BaseModel
from app.agents.permissions import DataSensitivity

class GraphRAGQuery(BaseModel):
    """GraphRAG query with tenant and sensitivity boundaries."""
    query: str
    user_id: str
    tenant_id: str
    sensitivity: DataSensitivity
    domains: List[str]  # e.g., ["health", "goals"]
    max_results: int = 10

class GraphRAGClient:
    """Client for tenant-aware GraphRAG queries."""

    def __init__(self, grpc_host: str):
        self.grpc_host = grpc_host

    async def query(self, request: GraphRAGQuery) -> List[Dict[str, Any]]:
        """
        Execute tenant-scoped, sensitivity-partitioned query.

        Enforcement:
        1. Tenant ID embedded in gRPC metadata (RLS enforced at DB layer)
        2. Sensitivity filter applied (HIPAA data only if sensitivity=HIPAA)
        3. Domain filter (health data isolated from financial)
        """
        # Build gRPC request
        grpc_request = {
            "query": request.query,
            "filters": {
                "tenant_id": request.tenant_id,  # ✅ RLS enforcement
                "user_id": request.user_id,
                "sensitivity": request.sensitivity,  # ✅ HIPAA/Financial partition
                "domains": request.domains,  # ✅ Domain isolation
            },
            "max_results": request.max_results,
        }

        # Add tenant context to gRPC metadata
        metadata = [
            ("tenant-id", request.tenant_id),
            ("user-id", request.user_id),
        ]

        # Execute query (actual gRPC call)
        response = await self._execute_grpc(grpc_request, metadata)

        # Validate response doesn't leak cross-domain data
        await self._validate_response_boundaries(response, request)

        return response

    async def _validate_response_boundaries(
        self,
        response: List[Dict[str, Any]],
        request: GraphRAGQuery,
    ) -> None:
        """Validate response doesn't contain cross-domain data."""
        for item in response:
            # Check domain tags
            item_domains = item.get("domains", [])
            allowed_domains = set(request.domains)

            if not set(item_domains).issubset(allowed_domains):
                logger.error(
                    "graphrag_domain_leak_detected",
                    extra={
                        "requested_domains": request.domains,
                        "response_domains": item_domains,
                        "user_id": request.user_id,
                        "tenant_id": request.tenant_id,
                    },
                )
                raise ValueError(
                    f"GraphRAG returned data outside requested domains: {item_domains}"
                )

            # Check sensitivity level
            item_sensitivity = item.get("sensitivity")
            if item_sensitivity != request.sensitivity:
                logger.error(
                    "graphrag_sensitivity_leak_detected",
                    extra={
                        "requested_sensitivity": request.sensitivity,
                        "response_sensitivity": item_sensitivity,
                        "user_id": request.user_id,
                        "tenant_id": request.tenant_id,
                    },
                )
                raise ValueError(
                    f"GraphRAG returned data with wrong sensitivity: {item_sensitivity}"
                )
```

### Sensitivity Partitioning Example

```python
# Financial Advisor Agent - ONLY financial data
financial_agent_query = GraphRAGQuery(
    query="What are my investment goals?",
    user_id="user_123",
    tenant_id="tenant_abc",
    sensitivity=DataSensitivity.FINANCIAL,  # ✅ PCI data allowed
    domains=["financial", "goals"],
)

# Health Coach Agent - ONLY health data
health_agent_query = GraphRAGQuery(
    query="What are my fitness goals?",
    user_id="user_123",
    tenant_id="tenant_abc",
    sensitivity=DataSensitivity.HIPAA,  # ✅ HIPAA data allowed
    domains=["health", "goals"],
)

# ❌ FORBIDDEN: Health agent trying to access financial data
invalid_query = GraphRAGQuery(
    query="How much money do I have?",
    user_id="user_123",
    tenant_id="tenant_abc",
    sensitivity=DataSensitivity.FINANCIAL,  # ❌ Agent not authorized
    domains=["financial"],
)
# → Blocked by AgentPermissionValidator (health_coach not in GRAPHRAG_QUERY_FINANCIAL allowlist)
```

---

## Audit Logging Framework

### Audit Log Schema

**Database Table**: `agent_audit_logs` (Supabase, 7-year retention)

```sql
CREATE TABLE agent_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Agent context
    agent_id TEXT NOT NULL,  -- e.g., "financial_advisor"
    session_id UUID NOT NULL,

    -- User context
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Request details (REDACTED for PHI/PCI)
    prompt_hash TEXT NOT NULL,  -- SHA-256 of prompt (not stored plaintext)
    prompt_redacted TEXT,  -- PHI/PCI scrubbed version for debugging

    -- Tool calls
    tool_calls JSONB NOT NULL,  -- [{tool, params, timestamp, duration_ms}]

    -- Response (REDACTED)
    output_hash TEXT NOT NULL,
    output_redacted TEXT,

    -- Metadata
    cost_usd DECIMAL(10, 4) NOT NULL,
    latency_ms INTEGER NOT NULL,
    tokens_used INTEGER,

    -- Security
    signature TEXT NOT NULL,  -- HMAC-SHA256 for tamper detection

    -- Indexes
    INDEX idx_agent_audit_user_time (user_id, timestamp DESC),
    INDEX idx_agent_audit_tenant_time (tenant_id, timestamp DESC),
    INDEX idx_agent_audit_session (session_id)
);

-- Row-Level Security
ALTER TABLE agent_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own audit logs"
ON agent_audit_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tenant audit logs"
ON agent_audit_logs FOR SELECT
USING (
    auth.jwt() ->> 'tenant_id' = tenant_id::text
    AND auth.jwt() ->> 'role' = 'admin'
);
```

### Audit Logger Implementation

**Location**: `backend/app/agents/audit.py`

```python
import hashlib
import hmac
import json
from typing import Any, Dict, List
from datetime import datetime
from pydantic import BaseModel

class ToolCall(BaseModel):
    """Single tool invocation."""
    tool: str
    params: Dict[str, Any]
    timestamp: datetime
    duration_ms: int
    result_hash: str  # SHA-256 of result

class AgentAuditLog(BaseModel):
    """Audit log entry for agent interaction."""
    agent_id: str
    session_id: str
    user_id: str
    tenant_id: str
    prompt_hash: str
    prompt_redacted: str
    tool_calls: List[ToolCall]
    output_hash: str
    output_redacted: str
    cost_usd: float
    latency_ms: int
    tokens_used: int
    signature: str

class AgentAuditor:
    """Deterministic audit logger for agent interactions."""

    def __init__(self, signing_key: str):
        self.signing_key = signing_key

    async def log_interaction(
        self,
        agent_id: str,
        session_id: str,
        user_id: str,
        tenant_id: str,
        prompt: str,
        tool_calls: List[ToolCall],
        output: str,
        cost_usd: float,
        latency_ms: int,
        tokens_used: int,
    ) -> None:
        """
        Log agent interaction with PHI/PCI redaction.

        Steps:
        1. Redact PHI/PCI from prompt and output
        2. Hash original content
        3. Sign log entry for tamper detection
        4. Store in Supabase
        """
        # Redact sensitive data
        prompt_redacted = self._redact_sensitive_data(prompt)
        output_redacted = self._redact_sensitive_data(output)

        # Hash original content (for integrity verification without storing plaintext)
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        output_hash = hashlib.sha256(output.encode()).hexdigest()

        # Create log entry
        log_entry = AgentAuditLog(
            agent_id=agent_id,
            session_id=session_id,
            user_id=user_id,
            tenant_id=tenant_id,
            prompt_hash=prompt_hash,
            prompt_redacted=prompt_redacted,
            tool_calls=tool_calls,
            output_hash=output_hash,
            output_redacted=output_redacted,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            tokens_used=tokens_used,
            signature="",  # Will be set below
        )

        # Sign log entry (tamper-evident)
        log_entry.signature = self._sign_log_entry(log_entry)

        # Store in database
        await self._store_log(log_entry)

        # Emit metric
        from app.core.telemetry import metrics
        metrics.counter(
            "agent.interactions.total",
            tags={
                "agent": agent_id,
                "tenant": tenant_id,
            },
        ).inc()
        metrics.histogram(
            "agent.cost.usd",
            tags={"agent": agent_id},
        ).observe(cost_usd)

    def _redact_sensitive_data(self, text: str) -> str:
        """
        Redact PHI/PCI from text.

        Patterns:
        - SSN: XXX-XX-1234 (show last 4)
        - Credit card: XXXX-XXXX-XXXX-1234
        - Diagnosis: [DIAGNOSIS_REDACTED]
        - Medication: [MEDICATION_REDACTED]
        """
        import re

        # SSN
        text = re.sub(r"\b\d{3}-\d{2}-(\d{4})\b", r"XXX-XX-\1", text)

        # Credit card
        text = re.sub(
            r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?(\d{4})\b",
            r"XXXX-XXXX-XXXX-\1",
            text,
        )

        # Account numbers
        text = re.sub(r"\baccount[_ ]?number[:\s]+\d+", "account_number: [REDACTED]", text, flags=re.IGNORECASE)

        # Medical terms (diagnosis, prescription)
        medical_keywords = ["diagnosis", "prescribed", "medication", "prescription", "condition"]
        for keyword in medical_keywords:
            text = re.sub(
                rf"\b{keyword}[:\s]+[^\n.]+",
                f"{keyword}: [REDACTED]",
                text,
                flags=re.IGNORECASE,
            )

        return text

    def _sign_log_entry(self, log_entry: AgentAuditLog) -> str:
        """
        Create HMAC-SHA256 signature for tamper detection.

        Signature covers all fields except signature itself.
        """
        # Serialize log entry (excluding signature field)
        payload = {
            "agent_id": log_entry.agent_id,
            "session_id": log_entry.session_id,
            "user_id": log_entry.user_id,
            "tenant_id": log_entry.tenant_id,
            "prompt_hash": log_entry.prompt_hash,
            "output_hash": log_entry.output_hash,
            "tool_calls": [tc.dict() for tc in log_entry.tool_calls],
            "cost_usd": float(log_entry.cost_usd),
            "latency_ms": log_entry.latency_ms,
        }

        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        signature = hmac.new(
            self.signing_key.encode(),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()

        return signature

    async def _store_log(self, log_entry: AgentAuditLog) -> None:
        """Store audit log in Supabase."""
        from app.db.supabase import supabase_client

        await supabase_client.table("agent_audit_logs").insert({
            "agent_id": log_entry.agent_id,
            "session_id": log_entry.session_id,
            "user_id": log_entry.user_id,
            "tenant_id": log_entry.tenant_id,
            "prompt_hash": log_entry.prompt_hash,
            "prompt_redacted": log_entry.prompt_redacted,
            "tool_calls": [tc.dict() for tc in log_entry.tool_calls],
            "output_hash": log_entry.output_hash,
            "output_redacted": log_entry.output_redacted,
            "cost_usd": log_entry.cost_usd,
            "latency_ms": log_entry.latency_ms,
            "tokens_used": log_entry.tokens_used,
            "signature": log_entry.signature,
        }).execute()

    async def verify_log_integrity(self, log_id: str) -> bool:
        """Verify audit log has not been tampered with."""
        from app.db.supabase import supabase_client

        result = await supabase_client.table("agent_audit_logs").select("*").eq("id", log_id).execute()

        if not result.data:
            return False

        log_data = result.data[0]
        stored_signature = log_data.pop("signature")

        # Recreate log entry and compute signature
        log_entry = AgentAuditLog(**log_data, signature="")
        computed_signature = self._sign_log_entry(log_entry)

        return computed_signature == stored_signature
```

### Example Audit Log Entry

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-01-09T15:30:00Z",
  "agent_id": "financial_advisor",
  "session_id": "sess_xyz789",
  "user_id": "user_123",
  "tenant_id": "tenant_abc",

  "prompt_hash": "8f3b2c1d9e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0",
  "prompt_redacted": "What is my account balance for account ending in 1234?",

  "tool_calls": [
    {
      "tool": "plaid.get_balances",
      "params": {
        "account_id": "***1234"
      },
      "timestamp": "2026-01-09T15:30:01Z",
      "duration_ms": 350,
      "result_hash": "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b"
    },
    {
      "tool": "graphrag.query_financial",
      "params": {
        "query": "[REDACTED]",
        "sensitivity": "financial",
        "domains": ["financial", "goals"]
      },
      "timestamp": "2026-01-09T15:30:02Z",
      "duration_ms": 1200,
      "result_hash": "6f7e8d9c0b1a2f3e4d5c6b7a8e9d0c1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b"
    }
  ],

  "output_hash": "5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f",
  "output_redacted": "Your checking account ending in 1234 has a balance of $X,XXX.XX as of today.",

  "cost_usd": 0.025,
  "latency_ms": 1250,
  "tokens_used": 450,

  "signature": "3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e"
}
```

---

## Rate Limits & Cost Controls

### Rate Limiting Strategy

**Levels**:
1. **Per-User Limits**: Prevent individual user abuse
2. **Per-Tenant Limits**: Prevent tenant-level cost overruns
3. **Per-Tool Limits**: Prevent expensive tool abuse

**Location**: `backend/app/agents/rate_limiter.py`

```python
from typing import Optional
from datetime import datetime, timedelta
from redis import asyncio as aioredis
from fastapi import HTTPException

class AgentRateLimiter:
    """Multi-level rate limiting for agent interactions."""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    async def check_user_rate_limit(
        self,
        user_id: str,
        agent_id: str,
    ) -> None:
        """
        Check per-user rate limits.

        Limits:
        - 10 requests/minute
        - 100 requests/hour
        - $5 daily cost limit
        """
        now = datetime.utcnow()

        # Check requests per minute
        minute_key = f"rate:user:{user_id}:minute:{now.strftime('%Y%m%d%H%M')}"
        minute_count = await self.redis.incr(minute_key)
        await self.redis.expire(minute_key, 60)

        if minute_count > 10:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "limit": "10 requests/minute",
                    "retry_after": 60,
                },
            )

        # Check requests per hour
        hour_key = f"rate:user:{user_id}:hour:{now.strftime('%Y%m%d%H')}"
        hour_count = await self.redis.incr(hour_key)
        await self.redis.expire(hour_key, 3600)

        if hour_count > 100:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "limit": "100 requests/hour",
                    "retry_after": 3600,
                },
            )

        # Check daily cost limit
        day_key = f"cost:user:{user_id}:day:{now.strftime('%Y%m%d')}"
        daily_cost = await self.redis.get(day_key)
        daily_cost = float(daily_cost) if daily_cost else 0.0

        if daily_cost > 5.0:  # $5/day limit
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "cost_limit_exceeded",
                    "limit": "$5.00/day",
                    "current_cost": daily_cost,
                    "retry_after": (
                        datetime.utcnow().replace(hour=0, minute=0, second=0) + timedelta(days=1)
                        - datetime.utcnow()
                    ).seconds,
                },
            )

    async def track_cost(
        self,
        user_id: str,
        tenant_id: str,
        cost_usd: float,
    ) -> None:
        """Track cost for rate limiting."""
        now = datetime.utcnow()

        # Update user daily cost
        user_day_key = f"cost:user:{user_id}:day:{now.strftime('%Y%m%d')}"
        await self.redis.incrbyfloat(user_day_key, cost_usd)
        await self.redis.expire(user_day_key, 86400)

        # Update tenant monthly cost
        tenant_month_key = f"cost:tenant:{tenant_id}:month:{now.strftime('%Y%m')}"
        await self.redis.incrbyfloat(tenant_month_key, cost_usd)
        await self.redis.expire(tenant_month_key, 2592000)  # 30 days

        # Check tenant monthly limit
        tenant_monthly_cost = await self.redis.get(tenant_month_key)
        tenant_monthly_cost = float(tenant_monthly_cost) if tenant_monthly_cost else 0.0

        if tenant_monthly_cost > 1000.0:  # $1,000/month limit
            # Alert tenant admin
            await self._send_cost_alert(
                tenant_id=tenant_id,
                current_cost=tenant_monthly_cost,
                limit=1000.0,
            )

        if tenant_monthly_cost > 1200.0:  # Hard cutoff at 120%
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "tenant_cost_limit_exceeded",
                    "limit": "$1,000/month",
                    "current_cost": tenant_monthly_cost,
                },
            )

    async def _send_cost_alert(
        self,
        tenant_id: str,
        current_cost: float,
        limit: float,
    ) -> None:
        """Send cost alert to tenant admin."""
        # Send email/Slack notification
        pass
```

### Cost Tracking Dashboard

**Metrics to Track**:
- Total cost per user (daily/monthly)
- Total cost per tenant (monthly)
- Cost per agent type
- Cost per tool
- Most expensive queries (audit logs)

**Prometheus Metrics**:
```python
# backend/app/core/metrics.py
from prometheus_client import Counter, Histogram, Gauge

agent_cost_total = Counter(
    "agent_cost_usd_total",
    "Total cost of agent interactions in USD",
    ["agent", "tenant", "tool"],
)

agent_requests_total = Counter(
    "agent_requests_total",
    "Total number of agent requests",
    ["agent", "tenant", "status"],
)

agent_latency_seconds = Histogram(
    "agent_latency_seconds",
    "Agent request latency in seconds",
    ["agent", "tool"],
)

agent_daily_cost_gauge = Gauge(
    "agent_daily_cost_usd",
    "Current daily cost per user",
    ["user_id", "tenant_id"],
)
```

---

## Human-in-the-Loop Gates

### HITL-Required Tools

Tools that require explicit human approval before execution:

1. **External Communication**:
   - `email.send`
   - `sms.send`
   - `slack.post_message`

2. **Financial Actions**:
   - `plaid.link_account` (link new bank account)
   - `stripe.create_payment_intent` (initiate payment)

3. **Data Export**:
   - `documents.export_to_pdf`
   - `data.export_to_csv`

4. **Calendar Integration**:
   - `calendar.create_event`
   - `calendar.send_invite`

### Approval Request Flow

```
Agent requests tool → Permission check → HITL required?
                                              ├─ No → Execute tool
                                              └─ Yes → Create approval request
                                                       ↓
                                              Store in database (pending)
                                                       ↓
                                              Send notification to user
                                                       ↓
                                              User approves/rejects via UI
                                                       ↓
                                              ├─ Approved → Execute tool + log
                                              └─ Rejected → Log rejection
```

### Approval Request Schema

**Database Table**: `agent_approvals`

```sql
CREATE TABLE agent_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    agent TEXT NOT NULL,
    tool TEXT NOT NULL,
    params JSONB NOT NULL,  -- Redacted

    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,  -- 24 hours
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,

    INDEX idx_approvals_user_status (user_id, status),
    INDEX idx_approvals_expires (expires_at)
);
```

### Approval UI Component

**Location**: `apps/web/src/components/agents/ApprovalRequest.tsx`

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ApprovalRequestProps {
  requestId: string;
  agent: string;
  tool: string;
  params: Record<string, any>;
  createdAt: string;
  expiresAt: string;
}

export function ApprovalRequest({
  requestId,
  agent,
  tool,
  params,
  createdAt,
  expiresAt,
}: ApprovalRequestProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const handleApprove = async () => {
    const response = await fetch(`/api/v1/agent-approvals/${requestId}/approve`, {
      method: 'POST',
    });

    if (response.ok) {
      setStatus('approved');
    }
  };

  const handleReject = async () => {
    const response = await fetch(`/api/v1/agent-approvals/${requestId}/reject`, {
      method: 'POST',
    });

    if (response.ok) {
      setStatus('rejected');
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold">Agent Approval Request</h3>
      <p className="text-sm text-muted-foreground">
        The <strong>{agent}</strong> agent wants to use <strong>{tool}</strong>
      </p>

      <div className="mt-4 space-y-2">
        <div className="text-sm">
          <strong>Parameters:</strong>
          <pre className="mt-1 bg-muted p-2 rounded text-xs">
            {JSON.stringify(params, null, 2)}
          </pre>
        </div>

        <div className="text-xs text-muted-foreground">
          Requested: {new Date(createdAt).toLocaleString()}
          <br />
          Expires: {new Date(expiresAt).toLocaleString()}
        </div>
      </div>

      {status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <Button onClick={handleApprove} variant="default">
            Approve
          </Button>
          <Button onClick={handleReject} variant="destructive">
            Reject
          </Button>
        </div>
      )}

      {status === 'approved' && (
        <p className="mt-4 text-sm text-green-600">✅ Approved - Action executed</p>
      )}

      {status === 'rejected' && (
        <p className="mt-4 text-sm text-red-600">❌ Rejected</p>
      )}
    </Card>
  );
}
```

---

## Multi-Agent Orchestration

### Agent Routing & Coordination

**Location**: `backend/app/agents/orchestrator.py`

```python
from typing import List, Optional
from app.agents.permissions import AgentName

class AgentOrchestrator:
    """Routes user requests to appropriate agents."""

    async def route_request(
        self,
        user_message: str,
        user_id: str,
        tenant_id: str,
        session_id: str,
    ) -> AgentName:
        """
        Determine which agent should handle the request.

        Uses intent classification (simple keyword matching for now,
        can be replaced with LLM classifier).
        """
        message_lower = user_message.lower()

        # Financial keywords
        if any(kw in message_lower for kw in ["money", "investment", "budget", "account", "plaid", "transaction"]):
            return AgentName.FINANCIAL_ADVISOR

        # Health keywords
        if any(kw in message_lower for kw in ["health", "fitness", "exercise", "diet", "medication", "doctor"]):
            return AgentName.HEALTH_COACH

        # Career keywords
        if any(kw in message_lower for kw in ["job", "career", "resume", "interview", "salary", "promotion"]):
            return AgentName.CAREER_ADVISOR

        # Education keywords
        if any(kw in message_lower for kw in ["course", "degree", "learning", "skill", "certification"]):
            return AgentName.EDUCATION_PLANNER

        # Default to general assistant
        return AgentName.GENERAL_ASSISTANT

    async def execute_agent(
        self,
        agent: AgentName,
        user_message: str,
        user_id: str,
        tenant_id: str,
        session_id: str,
    ) -> str:
        """Execute agent with full permission + audit enforcement."""
        from app.agents.middleware import AgentPermissionValidator
        from app.agents.audit import AgentAuditor
        from app.agents.rate_limiter import AgentRateLimiter

        # Initialize enforcement layers
        permission_validator = AgentPermissionValidator()
        auditor = AgentAuditor(signing_key=settings.AUDIT_SIGNING_KEY)
        rate_limiter = AgentRateLimiter(redis_client=redis)

        # Check rate limits
        await rate_limiter.check_user_rate_limit(user_id, agent)

        # Execute agent (simplified - actual LLM call)
        start_time = datetime.utcnow()

        tool_calls = []
        total_cost = 0.0

        # Simulate agent making tool calls
        # (In production, this would be LangChain/LlamaIndex agent execution)

        # Example: Agent wants to call graphrag.query_financial
        tool = ToolName.GRAPHRAG_QUERY_FINANCIAL

        # Validate permission
        await permission_validator.validate_tool_call(
            agent=agent,
            tool=tool,
            user_id=user_id,
            tenant_id=tenant_id,
            params={"query": user_message},
        )

        # Execute tool
        tool_result = await self._execute_tool(tool, {"query": user_message})

        tool_calls.append(ToolCall(
            tool=tool,
            params={"query": "[REDACTED]"},
            timestamp=datetime.utcnow(),
            duration_ms=500,
            result_hash=hashlib.sha256(str(tool_result).encode()).hexdigest(),
        ))

        total_cost += get_tool_metadata(tool).cost_per_invocation

        # Generate response
        response = f"Based on your financial data: {tool_result}"

        # Calculate latency
        latency_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        # Audit log
        await auditor.log_interaction(
            agent_id=agent,
            session_id=session_id,
            user_id=user_id,
            tenant_id=tenant_id,
            prompt=user_message,
            tool_calls=tool_calls,
            output=response,
            cost_usd=total_cost,
            latency_ms=latency_ms,
            tokens_used=450,
        )

        # Track cost
        await rate_limiter.track_cost(user_id, tenant_id, total_cost)

        return response
```

---

## Security Testing

### Agent Boundary Tests

**Location**: `backend/tests/agents/test_agent_boundaries.py`

```python
import pytest
from app.agents.permissions import AgentName, ToolName
from app.agents.middleware import AgentPermissionValidator
from fastapi import HTTPException

@pytest.mark.asyncio
async def test_financial_agent_cannot_access_health_data():
    """Financial agent should be blocked from health GraphRAG."""
    validator = AgentPermissionValidator()

    with pytest.raises(HTTPException) as exc_info:
        await validator.validate_tool_call(
            agent=AgentName.FINANCIAL_ADVISOR,
            tool=ToolName.GRAPHRAG_QUERY_HEALTH,  # ❌ Not in allowlist
            user_id="user_123",
            tenant_id="tenant_abc",
            params={"query": "What are my health conditions?"},
        )

    assert exc_info.value.status_code == 403
    assert "not authorized" in exc_info.value.detail["message"]

@pytest.mark.asyncio
async def test_health_agent_cannot_access_financial_data():
    """Health agent should be blocked from financial GraphRAG."""
    validator = AgentPermissionValidator()

    with pytest.raises(HTTPException) as exc_info:
        await validator.validate_tool_call(
            agent=AgentName.HEALTH_COACH,
            tool=ToolName.GRAPHRAG_QUERY_FINANCIAL,  # ❌ Not in allowlist
            user_id="user_123",
            tenant_id="tenant_abc",
            params={"query": "How much money do I have?"},
        )

    assert exc_info.value.status_code == 403

@pytest.mark.asyncio
async def test_hitl_gate_blocks_email_without_approval():
    """Email tool should require HITL approval."""
    validator = AgentPermissionValidator()

    with pytest.raises(HTTPException) as exc_info:
        await validator.validate_tool_call(
            agent=AgentName.GENERAL_ASSISTANT,
            tool=ToolName.EMAIL_SEND,  # Requires HITL
            user_id="user_123",
            tenant_id="tenant_abc",
            params={"to": "user@example.com", "subject": "Test"},
        )

    assert exc_info.value.status_code == 403
    assert "hitl_approval_required" in exc_info.value.detail["error"]
    assert "approval_request_id" in exc_info.value.detail

@pytest.mark.asyncio
async def test_audit_log_redacts_phi():
    """Audit logs should redact PHI/PCI."""
    from app.agents.audit import AgentAuditor

    auditor = AgentAuditor(signing_key="test-key")

    prompt = "My SSN is 123-45-6789 and I take metformin for diabetes."
    redacted = auditor._redact_sensitive_data(prompt)

    assert "XXX-XX-6789" in redacted  # SSN last 4 shown
    assert "123-45-6789" not in redacted
    assert "[MEDICATION_REDACTED]" in redacted or "medication" in redacted.lower()

@pytest.mark.asyncio
async def test_rate_limit_enforced():
    """User should be blocked after exceeding rate limit."""
    from app.agents.rate_limiter import AgentRateLimiter
    import fakeredis.aioredis

    redis_client = await fakeredis.aioredis.FakeRedis()
    rate_limiter = AgentRateLimiter(redis_client)

    # Simulate 11 requests in 1 minute (limit is 10)
    for i in range(11):
        if i < 10:
            await rate_limiter.check_user_rate_limit("user_123", "financial_advisor")
        else:
            with pytest.raises(HTTPException) as exc_info:
                await rate_limiter.check_user_rate_limit("user_123", "financial_advisor")

            assert exc_info.value.status_code == 429
            assert "rate_limit_exceeded" in exc_info.value.detail["error"]
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Permission Violations**:
   - Counter: `agent_permission_violations_total{agent, tool}`
   - Alert if > 5/hour

2. **HITL Request Volume**:
   - Counter: `agent_hitl_requests_total{agent, tool, status}`
   - Alert if pending requests > 10

3. **Cost Overruns**:
   - Gauge: `agent_daily_cost_usd{user_id, tenant_id}`
   - Alert if user approaching $5 limit, tenant approaching $1,000 limit

4. **Audit Log Failures**:
   - Counter: `agent_audit_log_failures_total`
   - Alert if > 0 (audit logging must never fail)

5. **Response Latency**:
   - Histogram: `agent_latency_seconds{agent, tool}`
   - Alert if p99 > 5 seconds

### Alerting Rules (Prometheus)

**Location**: `infrastructure/monitoring/agent-alerts.yml`

```yaml
groups:
  - name: agent_governance
    interval: 1m
    rules:
      - alert: AgentPermissionViolations
        expr: rate(agent_permission_violations_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of agent permission violations"
          description: "Agent {{ $labels.agent }} attempting unauthorized tool access"

      - alert: AgentCostLimitApproaching
        expr: agent_daily_cost_usd > 4.5
        labels:
          severity: warning
        annotations:
          summary: "User approaching daily cost limit"
          description: "User {{ $labels.user_id }} at ${{ $value }}/day (limit: $5.00)"

      - alert: TenantCostLimitExceeded
        expr: agent_monthly_cost_usd > 1000
        labels:
          severity: critical
        annotations:
          summary: "Tenant exceeded monthly cost limit"
          description: "Tenant {{ $labels.tenant_id }} at ${{ $value }}/month (limit: $1,000)"

      - alert: AuditLogFailure
        expr: rate(agent_audit_log_failures_total[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "Agent audit logging failing"
          description: "Audit logs not being written - compliance risk"

      - alert: HITLRequestBacklog
        expr: count(agent_approval_status{status="pending"}) > 10
        labels:
          severity: warning
        annotations:
          summary: "High number of pending HITL approvals"
          description: "{{ $value }} pending approval requests"
```

---

## Implementation Checklist

### Phase 1: Core Permissions (Week 1)

- [ ] Create `backend/app/agents/permissions.py`
  - [ ] Define `ToolName`, `AgentName`, `DataSensitivity` enums
  - [ ] Create `TOOL_REGISTRY` with metadata
  - [ ] Create `AGENT_TOOL_PERMISSIONS` allowlists
  - [ ] Implement `check_tool_permission()` function

- [ ] Create `backend/app/agents/middleware.py`
  - [ ] Implement `AgentPermissionValidator` class
  - [ ] Add `validate_tool_call()` with 3-layer checks
  - [ ] Add HITL approval checking
  - [ ] Create `agent_approvals` table in Supabase

- [ ] Write tests (`backend/tests/agents/test_agent_boundaries.py`)
  - [ ] Test cross-domain blocking (financial ↔ health)
  - [ ] Test HITL gate enforcement
  - [ ] Test unknown tool rejection

### Phase 2: Audit Logging (Week 1-2)

- [ ] Create `backend/app/agents/audit.py`
  - [ ] Implement `AgentAuditor` class
  - [ ] Add PHI/PCI redaction patterns
  - [ ] Implement HMAC signing for tamper detection
  - [ ] Create `agent_audit_logs` table in Supabase

- [ ] Integrate audit logging into agent orchestrator
  - [ ] Log every agent interaction
  - [ ] Log tool calls with redacted params
  - [ ] Track cost and latency

- [ ] Add audit log verification
  - [ ] Implement `verify_log_integrity()` function
  - [ ] Create admin UI for audit log review

### Phase 3: Rate Limiting & Cost Controls (Week 2)

- [ ] Create `backend/app/agents/rate_limiter.py`
  - [ ] Implement per-user rate limits (10/min, 100/hour)
  - [ ] Implement per-user cost limits ($5/day)
  - [ ] Implement per-tenant cost limits ($1,000/month)
  - [ ] Add cost tracking to Redis

- [ ] Add Prometheus metrics
  - [ ] `agent_cost_usd_total`
  - [ ] `agent_requests_total`
  - [ ] `agent_latency_seconds`

- [ ] Create cost dashboard (Grafana)
  - [ ] User daily cost
  - [ ] Tenant monthly cost
  - [ ] Cost by agent type
  - [ ] Most expensive queries

### Phase 4: HITL Gates (Week 2)

- [ ] Implement approval request flow
  - [ ] Create approval request on HITL tool invocation
  - [ ] Send notification to user (email + in-app)
  - [ ] Create approval UI component (`ApprovalRequest.tsx`)

- [ ] Add approval endpoints
  - [ ] `POST /api/v1/agent-approvals/:id/approve`
  - [ ] `POST /api/v1/agent-approvals/:id/reject`
  - [ ] `GET /api/v1/agent-approvals` (list pending)

- [ ] Add expiration handling
  - [ ] Cron job to expire requests after 24 hours
  - [ ] Notify user of expired requests

### Phase 5: Integration & Testing (Week 3)

- [ ] Integrate into agent orchestrator
  - [ ] Add permission checks before tool calls
  - [ ] Add audit logging after tool calls
  - [ ] Add rate limiting before agent execution

- [ ] End-to-end testing
  - [ ] Test full agent flow with all enforcement layers
  - [ ] Test HITL approval flow
  - [ ] Test rate limit enforcement
  - [ ] Test cost tracking

- [ ] Load testing
  - [ ] 100 concurrent agent requests
  - [ ] Verify rate limits hold
  - [ ] Verify audit logs written correctly

### Phase 6: Monitoring & Docs (Week 3-4)

- [ ] Deploy Prometheus alerts
  - [ ] Permission violation alerts
  - [ ] Cost limit alerts
  - [ ] Audit log failure alerts

- [ ] Create runbooks
  - [ ] Agent permission violation response
  - [ ] Cost overrun response
  - [ ] Audit log failure response

- [ ] Update architecture docs
  - [ ] Add agent governance diagrams
  - [ ] Document tool permission matrix
  - [ ] Document HITL approval process

---

## Rollback Plan

If agent governance causes production issues:

1. **Disable Permission Enforcement** (Emergency):
   ```python
   # backend/app/core/config.py
   AGENT_PERMISSIONS_ENABLED = os.getenv("AGENT_PERMISSIONS_ENABLED", "true") == "true"

   # In middleware
   if not settings.AGENT_PERMISSIONS_ENABLED:
       logger.warning("Agent permissions DISABLED - allow all")
       return  # Skip validation
   ```

2. **Disable HITL Gates**:
   ```python
   HITL_GATES_ENABLED = os.getenv("HITL_GATES_ENABLED", "true") == "true"
   ```

3. **Disable Rate Limiting**:
   ```python
   RATE_LIMITING_ENABLED = os.getenv("RATE_LIMITING_ENABLED", "true") == "true"
   ```

4. **Audit Logging is NEVER Disabled** (compliance requirement)

---

## Related Documentation

- [Data Boundaries](../04-security/DATA_BOUNDARIES.md) - PHI/PCI protection
- [Secrets Management](../04-security/SECRETS_AND_CONFIG.md) - API key security
- [Production Launch Summary](../runbooks/PRODUCTION_LAUNCH_SUMMARY.md) - Overall readiness

---

**Last Updated**: 2026-01-09
**Status**: Implementation required (P0 blocker for production launch)
**Estimated Effort**: 3 weeks (with testing)
**Owner**: AI Systems Architecture Team
