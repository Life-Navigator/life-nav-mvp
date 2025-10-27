# Life Navigator MCP Tools Contract

**Version:** 1.0
**Last Updated:** October 27, 2025
**Status:** CANONICAL SPECIFICATION
**Audience:** App Team & Agent Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Request/Response Format](#requestresponse-format)
4. [Tool Catalog](#tool-catalog)
5. [Implementation Guidelines](#implementation-guidelines)
6. [Security & Compliance](#security--compliance)
7. [Testing](#testing)
8. [Examples](#examples)

---

## Overview

This document defines the **canonical contract** between Life Navigator's application layer and agent system using the Model Context Protocol (MCP).

### Key Principles

**✅ DO:**
- App layer owns all external integrations (Plaid, Coinbase, ADP, etc.)
- App layer stores all secrets (OAuth tokens, API keys) in AWS KMS
- App layer implements MCP server exposing data via tools
- Agent layer requests data via MCP client (zero external API access)
- All responses are sanitized (no full account numbers, SSNs, etc.)

**❌ DON'T:**
- Agents never handle OAuth flows or store credentials
- Agents never make direct calls to external APIs
- App never forwards raw PII to agents
- Either layer doesn't bypass RLS (Row-Level Security)

### Communication Flow

```
┌─────────────┐           ┌─────────────┐           ┌─────────────┐
│   External  │  OAuth2   │     App     │    MCP    │    Agent    │
│   Services  │ ─────────>│    Layer    │ <────────>│    Layer    │
│  (Plaid,    │           │             │           │             │
│  Coinbase)  │           │  - Tokens   │           │  - Zero     │
│             │           │  - MCP Srv  │           │    secrets  │
│             │           │  - RLS      │           │  - Analysis │
└─────────────┘           └─────────────┘           └─────────────┘
```

---

## Architecture

### System Boundaries

#### Application Layer Responsibilities
- **Authentication**: User login, session management
- **External Integrations**: Plaid, Coinbase, ADP, FHIR, LTI
- **Data Storage**: PostgreSQL (relational), MongoDB (raw JSON)
- **Secret Management**: AWS KMS for encrypted tokens
- **MCP Server**: HTTP/gRPC endpoint exposing tools
- **Data Sanitization**: Strip PII before sending to agents
- **Audit Logging**: Record all MCP requests for compliance

#### Agent Layer Responsibilities
- **Intent Analysis**: Classify user requests
- **Task Routing**: Direct to appropriate specialist
- **LLM Analysis**: Generate insights and recommendations
- **MCP Client**: Request data from app's MCP server
- **Result Synthesis**: Format responses for users

### MCP Server Endpoint

**Base URL:** `http://app:8000` (internal network)
**Endpoint:** `POST /mcp/execute`
**Protocol:** HTTP JSON-RPC style

---

## Request/Response Format

### Standard MCP Request

```json
{
  "tool_name": "get_user_transactions",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "sess_abc123def456",
  "arguments": {
    "start_date": "2025-09-01",
    "end_date": "2025-10-27",
    "categories": ["Food and Drink", "Transportation"]
  },
  "request_id": "mcp_a1b2c3d4e5f6"
}
```

### Standard MCP Response

**Success:**
```json
{
  "request_id": "mcp_a1b2c3d4e5f6",
  "success": true,
  "data": [
    {
      "transaction_id": "txn_123",
      "date": "2025-10-15",
      "amount": -45.20,
      "merchant_name": "Whole Foods",
      "category": "Food and Drink"
    }
  ],
  "metadata": {
    "tool": "get_user_transactions",
    "execution_time_ms": 42,
    "cached": false
  }
}
```

**Error:**
```json
{
  "request_id": "mcp_a1b2c3d4e5f6",
  "success": false,
  "error": "INVALID_ARGUMENTS",
  "error_message": "start_date must be before end_date",
  "metadata": {
    "tool": "get_user_transactions"
  }
}
```

---

## Tool Catalog

### Financial Tools (11 tools)

#### 1. `get_user_accounts`
Fetch user's bank and investment accounts from Plaid.

**Parameters:**
- `user_id` (UUID, required)
- `include_closed` (boolean, optional, default: false)

**Returns:**
Array of accounts with sanitized data (last 4 digits only).

**Example:**
```json
{
  "tool_name": "get_user_accounts",
  "user_id": "...",
  "session_id": "...",
  "arguments": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "account_id": "acc_123",
      "institution_name": "Chase",
      "account_type": "checking",
      "mask": "1234",
      "current_balance": 5420.50,
      "currency_code": "USD"
    }
  ]
}
```

#### 2. `get_user_transactions`
Fetch transactions with filters.

**Parameters:**
- `user_id` (UUID, required)
- `start_date` (date, required, format: YYYY-MM-DD)
- `end_date` (date, required)
- `account_ids` (array of UUID, optional)
- `min_amount` (float, optional)
- `categories` (array of string, optional)
- `limit` (integer, optional, default: 1000, max: 5000)

**Returns:**
Array of transactions sorted by date descending.

#### 3. `get_spending_by_category`
Aggregated spending analysis.

**Parameters:**
- `user_id` (UUID, required)
- `start_date` (date, required)
- `end_date` (date, required)
- `category_level` (integer, optional, 1-3, default: 1)

**Returns:**
```json
[
  {
    "category": "Food and Drink",
    "transaction_count": 45,
    "total_spent": -1250.80,
    "avg_transaction": -27.80,
    "largest_transaction": -180.50,
    "percentage_of_total": 23.5
  }
]
```

#### 4. `get_recurring_transactions`
Identify subscriptions and recurring bills.

**Parameters:**
- `user_id` (UUID, required)
- `lookback_days` (integer, optional, default: 90, range: 30-365)

**Returns:**
```json
[
  {
    "merchant_name": "Netflix",
    "recurring_pattern": "monthly",
    "avg_amount": -15.99,
    "occurrence_count": 6,
    "last_occurrence_date": "2025-10-15",
    "next_expected_date": "2025-11-15",
    "confidence_score": 0.95
  }
]
```

#### 5. `get_investment_portfolio`
Portfolio holdings and performance.

**Parameters:**
- `user_id` (UUID, required)
- `include_historical` (boolean, optional, default: false)

**Returns:**
```json
{
  "total_value": 125000.00,
  "total_cost_basis": 100000.00,
  "total_gain_loss": 25000.00,
  "total_gain_loss_pct": 25.0,
  "holdings": [
    {
      "security_id": "sec_abc",
      "ticker_symbol": "AAPL",
      "security_name": "Apple Inc.",
      "security_type": "equity",
      "quantity": 100.0,
      "price": 175.50,
      "value": 17550.00,
      "cost_basis": 15000.00,
      "gain_loss": 2550.00,
      "gain_loss_pct": 17.0
    }
  ]
}
```

#### 6. `get_crypto_holdings`
Cryptocurrency balances from Coinbase.

**Parameters:**
- `user_id` (UUID, required)

**Returns:**
```json
[
  {
    "currency": "BTC",
    "balance": 0.5,
    "balance_usd": 35000.00,
    "cost_basis_usd": 30000.00,
    "unrealized_gain_loss_usd": 5000.00
  }
]
```

#### 7. `get_crypto_transactions`
Crypto transaction history.

**Parameters:**
- `user_id` (UUID, required)
- `start_date` (date, required)
- `end_date` (date, required)

#### 8. `get_paystubs`
Pay stubs from ADP/Paychex.

**Parameters:**
- `user_id` (UUID, required)
- `start_date` (date, required)
- `end_date` (date, required)

**Returns:**
```json
[
  {
    "paystub_id": "pay_123",
    "pay_date": "2025-10-15",
    "pay_period_start": "2025-10-01",
    "pay_period_end": "2025-10-15",
    "gross_pay": 3500.00,
    "net_pay": 2450.00,
    "deductions": [
      {"type": "401k", "amount": 350.00},
      {"type": "health_insurance", "amount": 250.00}
    ],
    "taxes": [
      {"type": "federal", "amount": 350.00},
      {"type": "state", "amount": 75.00},
      {"type": "social_security", "amount": 25.00}
    ],
    "year_to_date": {
      "gross": 70000.00,
      "taxes": 15000.00,
      "net": 49000.00
    }
  }
]
```

### Career Tools (2 tools)

#### 9. `get_user_resume`
Fetch user's resume data.

**Parameters:**
- `user_id` (UUID, required)
- `version` (string, optional, default: latest)

**Returns:**
```json
{
  "resume_id": "res_123",
  "version": "v2",
  "last_updated": "2025-10-20T14:30:00Z",
  "resume_text": "Full resume text here...",
  "parsed_data": {
    "contact_info": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234"
    },
    "work_experience": [
      {
        "company": "Tech Corp",
        "title": "Senior Engineer",
        "start_date": "2020-01",
        "end_date": null,
        "description": "Led team of 5..."
      }
    ],
    "education": [...],
    "skills": ["Python", "AWS", "Docker"]
  }
}
```

#### 10. `get_job_search_history`
Job applications and interviews.

**Parameters:**
- `user_id` (UUID, required)
- `status_filter` (array of string, optional)
  - Values: applied, screening, interview, offer, rejected, withdrawn
- `start_date` (date, optional)

**Returns:**
```json
[
  {
    "application_id": "app_123",
    "job_title": "Senior Software Engineer",
    "company": "Acme Corp",
    "applied_date": "2025-10-15",
    "status": "interview",
    "last_updated": "2025-10-25T10:00:00Z",
    "interviews": [
      {
        "interview_date": "2025-10-30T14:00:00Z",
        "interview_type": "technical",
        "notes": "System design round"
      }
    ]
  }
]
```

### Health Tools (2 tools - HIPAA Compliant)

#### 11. `get_health_summary`
High-level health status from EHR via SMART on FHIR.

**⚠️ HIPAA NOTICE:** Returns aggregated counts only, NO direct PHI.

**Parameters:**
- `user_id` (UUID, required)

**Returns:**
```json
{
  "has_active_medications": true,
  "medication_count": 3,
  "has_chronic_conditions": true,
  "condition_count": 2,
  "last_visit_date": "2025-09-15",
  "upcoming_appointments_count": 1,
  "next_appointment_date": "2025-11-05"
}
```

#### 12. `get_insurance_coverage`
Active insurance policies.

**Parameters:**
- `user_id` (UUID, required)

**Returns:**
```json
[
  {
    "coverage_type": "medical",
    "status": "active",
    "payor": "Blue Cross Blue Shield",
    "period_start": "2025-01-01",
    "period_end": "2025-12-31",
    "subscriber_id_masked": "****5678"
  }
]
```

### Education Tools (2 tools)

#### 13. `get_courses`
Fetch courses from LMS (Canvas/Blackboard).

**Parameters:**
- `user_id` (UUID, required)
- `active_only` (boolean, optional, default: true)

**Returns:**
```json
[
  {
    "course_id": "course_123",
    "name": "Machine Learning Fundamentals",
    "course_code": "CS401",
    "term": "Fall 2025",
    "start_date": "2025-08-25",
    "end_date": "2025-12-15",
    "current_grade": 92.5,
    "instructor": "Dr. Smith"
  }
]
```

#### 14. `get_assignments`
Upcoming assignments from LMS.

**Parameters:**
- `user_id` (UUID, required)
- `days_ahead` (integer, optional, default: 14, range: 1-90)

**Returns:**
```json
[
  {
    "assignment_id": "asn_123",
    "course_name": "Machine Learning Fundamentals",
    "assignment_name": "Final Project",
    "due_date": "2025-12-10T23:59:00Z",
    "points_possible": 100,
    "submission_status": "not_submitted",
    "grade": null
  }
]
```

### Automotive Tools (1 tool)

#### 15. `get_vehicle_status`
Vehicle telemetry from Smartcar.

**Parameters:**
- `user_id` (UUID, required)

**Returns:**
```json
[
  {
    "vehicle_id": "veh_123",
    "make": "Tesla",
    "model": "Model 3",
    "year": 2023,
    "vin_masked": "***ABC123",
    "odometer_miles": 12450.5,
    "fuel_percent": null,
    "fuel_range_miles": null,
    "battery_percent": 78.0,
    "battery_range_miles": 210.0,
    "location": {
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "last_updated": "2025-10-27T08:30:00Z"
  }
]
```

---

## Implementation Guidelines

### For App Team (MCP Server)

#### 1. Database Queries Must Enforce RLS

```python
# ✅ CORRECT - Uses RLS
@mcp_server.register_tool("get_user_accounts")
async def get_user_accounts(user_id: UUID, include_closed: bool = False):
    query = """
        SELECT * FROM accounts
        WHERE user_id = $1  -- RLS enforcement
        AND (is_closed = FALSE OR $2 = TRUE)
    """
    return await db.fetch_all(query, user_id, include_closed)

# ❌ WRONG - No RLS check
async def get_user_accounts_BAD():
    query = "SELECT * FROM accounts"  # Returns ALL users' data!
    return await db.fetch_all(query)
```

#### 2. Sanitize Responses

```python
# ✅ CORRECT - Masked account number
{
    "account_id": "acc_123",
    "mask": "1234",  # Last 4 digits only
    "current_balance": 5420.50
}

# ❌ WRONG - Full account number exposed
{
    "account_id": "acc_123",
    "account_number": "123456789012",  # ⚠️ PCI violation
    "routing_number": "021000021"     # ⚠️ PCI violation
}
```

#### 3. Audit Every Request

```python
@app.post("/mcp/execute")
async def mcp_endpoint(request: MCPRequest):
    # Log to audit table
    await db.execute(
        """
        INSERT INTO mcp_audit_log
        (request_id, user_id, tool_name, timestamp)
        VALUES ($1, $2, $3, NOW())
        """,
        request.request_id,
        request.user_id,
        request.tool_name
    )

    # Execute tool
    result = await mcp_server.execute(request)
    return result
```

#### 4. Implement Caching

```python
from functools import wraps
import redis

@mcp_cache(ttl_seconds=300)  # 5 minute cache
async def get_user_accounts(user_id: UUID):
    # Cache key: "mcp:get_user_accounts:{user_id}"
    # Invalidate on: plaid_sync_complete event
    ...
```

#### 5. Set Timeouts

```python
@mcp_server.register_tool("get_user_transactions")
async def get_user_transactions(...):
    async with asyncio.timeout(30.0):  # 30 second timeout
        return await _fetch_transactions(...)
```

### For Agent Team (MCP Client)

#### 1. Always Provide user_id and session_id

```python
# ✅ CORRECT
result = await mcp_client.call_tool(
    tool_name="get_user_accounts",
    user_id=task.metadata.user_id,  # From task context
    session_id=task.metadata.session_id,
    include_closed=False
)

# ❌ WRONG - Missing required context
result = await mcp_client.call_tool("get_user_accounts")  # Error!
```

#### 2. Handle Errors Gracefully

```python
try:
    accounts = await mcp_client.call_tool(
        "get_user_accounts",
        user_id=user_id,
        session_id=session_id
    )
except MCPError as e:
    if e.error_code == "UNAUTHORIZED":
        logger.error(f"RLS violation: {e}")
        return {"error": "Access denied"}
    elif e.error_code == "TIMEOUT":
        logger.warning(f"MCP timeout: {e}")
        return {"error": "Data temporarily unavailable"}
    else:
        raise
```

#### 3. Use Convenience Methods

```python
# ✅ GOOD - Use high-level methods
context = await mcp_client.get_financial_context(
    user_id=user_id,
    session_id=session_id,
    days=90
)
# Returns: accounts, transactions, spending, recurring (all in one call)

# ❌ LESS EFFICIENT - Multiple individual calls
accounts = await mcp_client.call_tool("get_user_accounts", ...)
transactions = await mcp_client.call_tool("get_user_transactions", ...)
spending = await mcp_client.call_tool("get_spending_by_category", ...)
# (3 network roundtrips instead of 1)
```

#### 4. Support Mock Mode for Testing

```python
class BudgetSpecialist:
    async def handle_task(self, task: AgentTask):
        # Check if data already in payload (testing mode)
        if "transactions" in task.payload:
            context = task.payload  # Use mock data
        else:
            context = await self.mcp.get_financial_context(...)

        # Analyze...
```

---

## Security & Compliance

### Data Flow Security

```
External API → App Layer → MCP Server → Agent Layer
    ↓             ↓            ↓             ↓
OAuth Token   KMS Vault   Sanitized    Zero Secrets
   (raw)      (encrypted)    Data      (analysis only)
```

### PII Redaction Rules

| Field Type | App Storage | MCP Response |
|------------|-------------|--------------|
| Account Number | Full (encrypted) | Last 4 digits only |
| SSN | Full (encrypted) | Never sent to agents |
| Routing Number | Full (encrypted) | Never sent to agents |
| Credit Card | Full (encrypted) | Last 4 digits only |
| VIN | Full | Last 6 chars only |
| Member ID | Full | Last 4 digits only |
| PHI (diagnoses) | Full (HIPAA-encrypted) | Count only, no names |

### Audit Requirements

All MCP requests must be logged for **7 years** (financial compliance).

**Audit Log Schema:**
```sql
CREATE TABLE mcp_audit_log (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    request_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments_hash TEXT NOT NULL,  -- Hash only
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER,
    error_code TEXT,
    ip_address INET
);
```

### Rate Limiting

**Default:** 60 requests/minute per user

**Overrides:**
- `get_user_transactions`: 30/min (expensive query)
- `get_investment_portfolio`: 20/min
- `get_health_summary`: 10/min (HIPAA sensitivity)

**Implementation:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/mcp/execute")
@limiter.limit("60/minute")
async def mcp_endpoint(request: MCPRequest):
    ...
```

---

## Testing

### App Layer Testing

```python
# app/tests/test_mcp_tools.py
import pytest
from app.mcp.server import mcp_server, MCPRequest

@pytest.mark.asyncio
async def test_get_user_accounts_enforces_rls():
    """Verify Row-Level Security prevents cross-user access"""

    # Setup: Create two users
    user_a = await create_test_user()
    user_b = await create_test_user()

    # User A has 3 accounts
    await mock_plaid_data(user_a, accounts=3)

    # User B has 2 accounts
    await mock_plaid_data(user_b, accounts=2)

    # Request user_a's accounts as user_b (should fail/return empty)
    request = MCPRequest(
        tool_name="get_user_accounts",
        user_id=user_b,  # ⚠️ Wrong user
        session_id="test",
        arguments={},
        request_id="test_123"
    )

    response = await mcp_server.execute(request)

    # Should return empty (RLS enforcement)
    assert response.success is True
    assert len(response.data) == 2  # Only user_b's accounts


@pytest.mark.asyncio
async def test_mcp_response_sanitization():
    """Verify PII is redacted from responses"""

    user_id = await create_test_user()
    await mock_account(
        user_id=user_id,
        account_number="123456789012",  # Full number in DB
        routing_number="021000021"
    )

    request = MCPRequest(
        tool_name="get_user_accounts",
        user_id=user_id,
        session_id="test",
        arguments={}
    )

    response = await mcp_server.execute(request)
    account = response.data[0]

    # Verify sanitization
    assert "account_number" not in account
    assert "routing_number" not in account
    assert account["mask"] == "9012"  # Last 4 only
```

### Agent Layer Testing

```python
# agents/tests/test_mcp_integration.py
import pytest
from agents.specialists.finance.budget_agent import BudgetSpecialist
from tests.mocks import MockMCPClient

@pytest.fixture
def mock_mcp():
    """Mock MCP client with fixture data"""
    mock = MockMCPClient()

    # Load fixture responses
    mock.set_response(
        "get_user_accounts",
        [
            {"account_id": "acc_1", "current_balance": 5000.00},
            {"account_id": "acc_2", "current_balance": 12000.00}
        ]
    )

    mock.set_response(
        "get_user_transactions",
        load_fixture("tests/fixtures/transactions.json")
    )

    return mock

@pytest.mark.asyncio
async def test_budget_specialist_uses_mcp(mock_mcp):
    """Test specialist fetches data via MCP"""

    specialist = BudgetSpecialist(mcp_client=mock_mcp)

    task = AgentTask(
        task_id="task_123",
        task_type="spending_analysis",
        user_id=UUID("..."),
        metadata=TaskMetadata(
            user_id=UUID("..."),
            session_id="test"
        )
    )

    result = await specialist.handle_task(task)

    # Verify MCP was called
    assert mock_mcp.call_count("get_user_accounts") == 1
    assert mock_mcp.call_count("get_user_transactions") == 1

    # Verify result
    assert result["success"] is True
    assert "spending_analysis" in result
```

---

## Examples

### Example 1: Budget Analysis Flow

**1. User asks:** "How much did I spend on groceries last month?"

**2. Orchestrator classifies intent:** `budget_analysis`

**3. Routes to:** `BudgetSpecialist`

**4. BudgetSpecialist requests data:**
```python
# Fetch last 30 days of transactions
transactions = await mcp_client.call_tool(
    tool_name="get_user_transactions",
    user_id=user_id,
    session_id=session_id,
    start_date=(date.today() - timedelta(days=30)),
    end_date=date.today(),
    categories=["Food and Drink"]
)

spending = await mcp_client.call_tool(
    tool_name="get_spending_by_category",
    user_id=user_id,
    session_id=session_id,
    start_date=(date.today() - timedelta(days=30)),
    end_date=date.today()
)
```

**5. MCP Server:**
- Validates `user_id` matches session
- Queries Postgres with RLS
- Returns sanitized transactions

**6. BudgetSpecialist analyzes:**
```python
grocery_total = sum(
    txn["amount"] for txn in transactions
    if "grocery" in txn["merchant_name"].lower()
)

# Generate LLM insights
insights = await llm.complete(
    f"User spent ${abs(grocery_total):.2f} on groceries last month. "
    f"Analyze this spending pattern: {transactions}"
)
```

**7. Returns to user:** "You spent $487.50 on groceries last month, which is 15% above your average. Consider meal planning to reduce costs."

### Example 2: Investment Portfolio Rebalancing

**1. User asks:** "Should I rebalance my portfolio?"

**2. Orchestrator:** `investment_advice` → `InvestmentSpecialist`

**3. Specialist requests:**
```python
portfolio = await mcp_client.call_tool(
    tool_name="get_investment_portfolio",
    user_id=user_id,
    session_id=session_id,
    include_historical=True
)
```

**4. Analyzes allocation:**
```python
# Current allocation
current_allocation = {
    "stocks": 75%,
    "bonds": 15%,
    "cash": 10%
}

# Target allocation (from user profile)
target_allocation = {
    "stocks": 60%,
    "bonds": 30%,
    "cash": 10%
}

# Calculate rebalancing needed
rebalance_actions = calculate_rebalancing(current, target)
```

**5. Returns:** "Your portfolio is 15% overweight in stocks. Sell $12,500 in equities and buy bonds to rebalance to your target 60/30/10 allocation."

---

## Error Handling

### Standard Error Codes

| Code | Name | Description | Agent Action |
|------|------|-------------|--------------|
| E001 | TOOL_NOT_FOUND | Tool doesn't exist | Log and fail gracefully |
| E002 | UNAUTHORIZED | RLS violation | Return access denied error |
| E003 | INVALID_ARGUMENTS | Bad parameters | Fix arguments and retry |
| E004 | EXTERNAL_API_ERROR | Plaid/Coinbase failed | Return "data unavailable" |
| E005 | RATE_LIMIT_EXCEEDED | Too many requests | Implement exponential backoff |
| E006 | TIMEOUT | Execution timeout | Retry once, then fail |

### Error Response Format

```json
{
  "request_id": "mcp_abc123",
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "error_message": "Rate limit of 60 requests/minute exceeded",
  "metadata": {
    "tool": "get_user_transactions",
    "retry_after_seconds": 30
  }
}
```

---

## Observability

### Metrics to Expose

**Prometheus Format:**

```python
# MCP Server (App Layer)
mcp_requests_total{tool="get_user_accounts", status="success"} 1523
mcp_requests_total{tool="get_user_accounts", status="error"} 12
mcp_request_duration_seconds{tool="get_user_accounts", quantile="0.95"} 0.042
mcp_cache_hits_total{tool="get_user_accounts"} 1205

# MCP Client (Agent Layer)
mcp_client_requests_total{tool="get_user_accounts", status="success"} 1520
mcp_client_request_duration_seconds{tool="get_user_accounts", quantile="0.95"} 0.045
```

### Distributed Tracing

Use request_id to trace end-to-end:

```
Request ID: mcp_a1b2c3d4e5f6

┌─────────────────────────────────────────────────────────────┐
│ User Query → Orchestrator → BudgetSpecialist               │
│    ↓                                                         │
│ MCP Client: get_user_transactions                           │
│    request_id=mcp_a1b2c3d4e5f6                             │
│    ↓                                                         │
│ MCP Server: Execute tool                                    │
│    request_id=mcp_a1b2c3d4e5f6                             │
│    user_id=550e8400-...                                    │
│    ↓                                                         │
│ PostgreSQL: SELECT * FROM transactions WHERE user_id = ... │
│    duration: 35ms                                           │
│    ↓                                                         │
│ MCP Server: Return 142 transactions                        │
│    ↓                                                         │
│ MCP Client: Receive data                                   │
│    ↓                                                         │
│ BudgetSpecialist: Analyze spending                         │
│    ↓                                                         │
│ Return insights to user                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Changelog

### Version 1.0 (2025-10-27)
- Initial specification
- 15 tools across 6 domains
- Financial, Career, Health, Education, Automotive
- Security & compliance guidelines
- Testing strategies

### Planned for Version 1.1
- Home automation tools (SmartThings)
- Family calendar tools (Google Calendar)
- Social tools (contacts, relationships)

---

## References

- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io/)
- [Anthropic MCP Documentation](https://docs.anthropic.com/mcp)
- [Plaid API Reference](https://plaid.com/docs/api/)
- [SMART on FHIR Spec](https://www.hl7.org/fhir/smart-app-launch/)
- [Life Navigator Architecture Document](./ARCHITECTURE.md)

---

**Questions or Issues?**

- App Team Lead: [Email]
- Agent Team Lead: [Email]
- Slack: #life-navigator-mcp
- GitHub Issues: [Repository]

---

**Last Updated:** October 27, 2025
**Next Review:** November 10, 2025 (after initial MCP server deployment)
