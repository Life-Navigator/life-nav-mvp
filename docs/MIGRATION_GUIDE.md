# Migration Guide: Adopting MCP Integration

This guide helps you migrate from the previous payload-based agent system to the new MCP-integrated architecture.

## What Changed?

### Before (Mock Payload Mode)
```python
# Old way: Agents received all data in task payload
task = AgentTask(
    task_id="budget_001",
    task_type="spending_analysis",
    user_id="user_123",
    payload={
        "transactions": [...],  # Frontend passed all data
        "accounts": [...],
        "income": [...]
    }
)

result = await budget_agent.handle_task(task)
```

**Problems**:
- Frontend had to fetch Plaid data itself
- No server-side RLS enforcement
- PII exposed in transit
- Difficult to add new data sources

### After (MCP Integration)
```python
# New way: Agents fetch data via MCP
task = AgentTask(
    task_id="budget_001",
    task_type="spending_analysis",
    user_id="user_123",
    payload={
        "session_id": "sess_abc123",  # Just metadata
        "days": 90
    }
)

# Agent automatically fetches from MCP server
result = await budget_agent.handle_task(task)
```

**Benefits**:
- App layer handles all external integrations
- RLS enforced server-side
- PII redacted before reaching agents
- Easy to add new data sources

## Migration Checklist

### ✅ Phase 1: Update Agent Instantiation (COMPLETED)
All specialists now accept `mcp_client` parameter:

```python
from agents.tools.mcp_client import mcp_client

# Old
budget_agent = BudgetSpecialist(
    vllm_client=vllm_client,
    graphrag_client=graphrag_client
)

# New
budget_agent = BudgetSpecialist(
    vllm_client=vllm_client,
    graphrag_client=graphrag_client,
    mcp_client=mcp_client  # ← Added
)
```

**Status**: ✅ All 7 specialists updated
- Budget Specialist
- Investment Specialist
- Tax Specialist
- Debt Specialist
- Savings Specialist
- Job Search Specialist
- Resume Specialist

### ✅ Phase 2: Use Factory for Hierarchy Creation (COMPLETED)
Instead of manually instantiating agents, use the factory:

```python
# Old way: Manual instantiation
budget = BudgetSpecialist(...)
investment = InvestmentSpecialist(...)
tax = TaxSpecialist(...)
# ... repeat for all 7 specialists
finance_manager.specialists = {...}  # Manual wiring

# New way: Factory
from agents.orchestration.factory import create_agent_hierarchy

orchestrator = await create_agent_hierarchy(
    mcp_client=mcp_client,
    vllm_client=vllm_client,
    graphrag_client=graphrag_client,
    message_bus=message_bus
)

# All 9 agents created and wired automatically
```

**Benefits**:
- All agents properly wired
- MCP client passed to all specialists
- Consistent initialization
- Easy health checking

### 📋 Phase 3: Update Frontend Integration (App Team)
**Timeline**: 2-3 weeks (app team sprint)

#### Current State (Before MCP)
```typescript
// Frontend directly calls Plaid, passes data to agent
const transactions = await plaid.getTransactions(...)
const accounts = await plaid.getAccounts(...)

const result = await fetch('/api/agents/analyze', {
  method: 'POST',
  body: JSON.stringify({
    task_type: 'spending_analysis',
    payload: {
      transactions,  // ← Frontend provides data
      accounts
    }
  })
})
```

#### Target State (With MCP)
```typescript
// Frontend just triggers analysis, app fetches data
const result = await fetch('/api/agents/analyze', {
  method: 'POST',
  body: JSON.stringify({
    task_type: 'spending_analysis',
    payload: {
      session_id: session.id,  // ← Just metadata
      days: 90
    }
  })
})

// App layer:
// 1. Validates session
// 2. Fetches Plaid data (using stored OAuth tokens)
// 3. Agent requests data via MCP
// 4. MCP server enforces RLS, returns sanitized data
// 5. Agent analyzes and returns result
```

**App Team Tasks**:
1. Build MCP server (FastAPI)
2. Implement 15 MCP tools (see `docs/mcp_tools_schema.yaml`)
3. Add RLS policies (Supabase)
4. Add PII redaction middleware
5. Update frontend to not pass data payloads

### 📋 Phase 4: Environment Configuration (DevOps)
**Timeline**: 1 day

Add environment variable:
```bash
# .env
MCP_SERVER_URL=http://app:8000

# Production
MCP_SERVER_URL=https://api.lifenavigator.com
```

Update Docker Compose:
```yaml
services:
  agents:
    environment:
      - MCP_SERVER_URL=http://app:8000
```

### 📋 Phase 5: Testing Strategy
**Timeline**: 1 week (parallel with app development)

#### Unit Tests (Existing - No Changes Needed)
```python
# Tests still work with MockMCPClient
from tests.mocks.mock_mcp_client import MockMCPClient

mock_mcp = MockMCPClient()
agent = BudgetSpecialist(mcp_client=mock_mcp)

result = await agent.handle_task(task)

assert mock_mcp.call_counts["get_financial_context"] == 1
```

#### Integration Tests (New)
```python
# Test with real MCP server (staging)
orchestrator = await create_agent_hierarchy(
    mcp_client=mcp_client  # Real client
)

result = await orchestrator.handle_task(task)
# Verifies entire flow including MCP server
```

#### E2E Tests (Frontend → MCP → Agents)
```typescript
describe('Budget Analysis E2E', () => {
  it('fetches real data via MCP', async () => {
    const response = await request(app)
      .post('/api/agents/analyze')
      .send({
        task_type: 'spending_analysis',
        payload: { session_id: testSession.id }
      })

    expect(response.body.data.savings_rate).toBeGreaterThan(0)
  })
})
```

## Backwards Compatibility

### Dual Mode Support
All specialists support BOTH modes:

```python
# Mode 1: MCP enabled (production)
agent = BudgetSpecialist(mcp_client=mcp_client)
task = AgentTask(payload={"session_id": "..."})
result = await agent.handle_task(task)  # ← Fetches via MCP

# Mode 2: Payload mode (testing/legacy)
agent = BudgetSpecialist()  # No MCP client
task = AgentTask(payload={"transactions": [...], "accounts": [...]})
result = await agent.handle_task(task)  # ← Uses payload data
```

**Priority**:
1. If `mcp_client` exists AND payload is empty → Fetch via MCP
2. If payload has data → Use payload (backwards compatible)
3. If neither → Return empty/error

### No Breaking Changes
```python
# Old code still works (no MCP client)
agent = BudgetSpecialist()
result = await agent.handle_task(task_with_full_payload)  # ✅ Works

# New code (with MCP)
agent = BudgetSpecialist(mcp_client=mcp_client)
result = await agent.handle_task(task_with_minimal_payload)  # ✅ Works
```

## Rollout Plan

### Week 1-2: Agent System (COMPLETED ✅)
- [x] Update all specialists with MCP support
- [x] Create factory for hierarchy instantiation
- [x] Add MockMCPClient for testing
- [x] Write integration tests
- [x] Update documentation

### Week 3-4: App Layer MCP Server (App Team)
- [ ] Implement MCP server (FastAPI)
- [ ] Add 15 MCP tools from schema
- [ ] Enforce RLS policies
- [ ] Add PII redaction middleware
- [ ] Write MCP server tests

### Week 5: Integration & Testing
- [ ] Connect agent system to MCP server
- [ ] Run E2E tests
- [ ] Performance testing (load tests)
- [ ] Security audit (RLS, PII redaction)

### Week 6: Production Deployment
- [ ] Deploy MCP server to staging
- [ ] Deploy agent system to staging
- [ ] Canary deployment (10% traffic)
- [ ] Full rollout (100% traffic)

## Troubleshooting

### MCP Connection Errors
```python
# Error: "Connection refused"
# Fix: Ensure MCP_SERVER_URL is correct
import os
print(os.getenv("MCP_SERVER_URL"))  # Should be http://app:8000
```

### RLS Violations
```python
# Error: "UNAUTHORIZED" from MCP server
# Fix: Ensure user_id in task matches session user_id
task = AgentTask(
    user_id=session.user_id,  # ← Must match
    metadata=TaskMetadata(user_id=session.user_id)
)
```

### Missing Data
```python
# Error: Agent returns empty results
# Diagnosis: Check if MCP tool exists
tools = await mcp_client.list_tools()
print(tools.keys())  # Should include 'get_user_transactions'
```

### Performance Issues
```python
# Symptom: Slow response times
# Fix 1: Enable Redis caching
# Fix 2: Reduce lookback period
context = await mcp_client.get_financial_context(
    user_id=user_id,
    session_id=session_id,
    days=30  # ← Reduce from 90
)
```

## FAQ

### Q: Do I need to update all specialists at once?
**A**: No. Specialists are backwards compatible. You can migrate one at a time.

### Q: Can I test without the MCP server running?
**A**: Yes. Use `MockMCPClient` for testing:
```python
from tests.mocks.mock_mcp_client import MockMCPClient
agent = BudgetSpecialist(mcp_client=MockMCPClient())
```

### Q: What if the MCP server is down?
**A**: Agents will timeout after 30 seconds and raise `MCPTimeoutError`. Implement retry logic or circuit breaker.

### Q: How do I add a new MCP tool?
**A**:
1. Add spec to `docs/mcp_tools_schema.yaml`
2. App team implements tool in MCP server
3. (Optional) Add convenience method to `MCPClient`

### Q: Can I use MCP in local development?
**A**: Yes. Run app layer locally on port 8000, set `MCP_SERVER_URL=http://localhost:8000`.

## Next Steps

1. **For Agent Developers**: Start using `create_agent_hierarchy()` from factory
2. **For App Developers**: Build MCP server using `docs/MCP_TOOLS_CONTRACT.md`
3. **For Frontend Developers**: Remove data fetching logic, pass minimal payloads
4. **For DevOps**: Configure `MCP_SERVER_URL` environment variable

## Resources

- **MCP Tools Schema**: `docs/mcp_tools_schema.yaml`
- **MCP Contract**: `docs/MCP_TOOLS_CONTRACT.md`
- **Architecture Overview**: `docs/ARCHITECTURE.md`
- **Deployment Guide**: `docs/DEPLOYMENT_GUIDE.md`
- **Developer Guide**: `docs/DEVELOPER_GUIDE.md`

## Support

Questions? Check the documentation or reach out to the team.
