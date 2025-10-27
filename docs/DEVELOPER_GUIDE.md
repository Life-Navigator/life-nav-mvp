# Developer Guide: Extending the Agent System

This guide helps developers add new functionality to the Life Navigator Agent System.

## Table of Contents
1. [Adding a New Specialist](#adding-a-new-specialist)
2. [Adding a New Domain](#adding-a-new-domain)
3. [Adding MCP Tools](#adding-mcp-tools)
4. [Testing Patterns](#testing-patterns)
5. [Best Practices](#best-practices)

---

## Adding a New Specialist

### Example: Creating a HealthSpecialist

**Step 1: Create Specialist Class**

```python
# agents/specialists/health/health_agent.py

from typing import Dict, Any, Optional
from datetime import datetime, timezone

from agents.core.base_agent import BaseAgent
from models.agent_models import AgentTask, AgentType, AgentCapability
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class HealthSpecialist(BaseAgent):
    """
    L2 Specialist Agent for health and wellness management.

    Capabilities:
    - fitness_tracking: Track workouts and activity
    - nutrition_analysis: Analyze diet and nutrition
    - health_insights: Provide health recommendations
    """

    def __init__(
        self,
        agent_id: str = "health_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize HealthSpecialist agent."""

        capabilities = [
            AgentCapability(
                name="fitness_tracking",
                description="Track workouts and physical activity",
                confidence=0.90,
            ),
            AgentCapability(
                name="nutrition_analysis",
                description="Analyze diet and provide nutrition insights",
                confidence=0.88,
            ),
            AgentCapability(
                name="health_insights",
                description="Generate personalized health recommendations",
                confidence=0.85,
            ),
        ]

        super().__init__(
            agent_id=agent_id,
            agent_type=AgentType.SPECIALIST,
            capabilities=capabilities,
            message_bus=message_bus,
            graphrag_client=graphrag_client,
            vllm_client=vllm_client,
            mcp_client=mcp_client,
            config=config or {},
        )

        self.logger = get_logger(f"agent.{agent_id}")

    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """
        Handle health-related tasks.

        Args:
            task: AgentTask with task_type and payload

        Returns:
            Dict with status, data, and optional synthesis
        """
        try:
            task_type = task.task_type
            user_id = task.metadata.user_id

            self.logger.info(f"Handling task: {task_type} for user {user_id}")

            # Route to appropriate handler
            if task_type == "fitness_tracking":
                result = await self._track_fitness(user_id, task.payload)
            elif task_type == "nutrition_analysis":
                result = await self._analyze_nutrition(user_id, task.payload)
            elif task_type == "health_insights":
                result = await self._generate_insights(user_id, task.payload)
            else:
                raise TaskExecutionError(f"Unknown task type: {task_type}")

            return {
                "status": "success",
                "data": result,
                "agent_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Task execution failed: {e}", error=e)
            raise TaskExecutionError(f"Health specialist task failed: {str(e)}")

    # ========== Task Handlers ==========

    async def _track_fitness(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Track fitness activities."""
        # Fetch data via MCP if available
        if self.mcp and not payload.get("activities"):
            context = await self._fetch_health_context_via_mcp(user_id, payload)
            payload = {**payload, **context}

        activities = payload.get("activities", [])

        # Calculate metrics
        total_calories = sum(a.get("calories", 0) for a in activities)
        total_minutes = sum(a.get("duration_minutes", 0) for a in activities)

        return {
            "total_activities": len(activities),
            "total_calories_burned": total_calories,
            "total_duration_minutes": total_minutes,
            "activity_types": list(set(a.get("type") for a in activities)),
        }

    async def _analyze_nutrition(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze nutrition and diet."""
        meals = payload.get("meals", [])

        total_calories = sum(m.get("calories", 0) for m in meals)
        total_protein = sum(m.get("protein_g", 0) for m in meals)
        total_carbs = sum(m.get("carbs_g", 0) for m in meals)

        return {
            "total_calories": total_calories,
            "total_protein_g": total_protein,
            "total_carbs_g": total_carbs,
            "meal_count": len(meals),
        }

    async def _generate_insights(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate health insights using LLM."""
        if not self.vllm:
            return {"message": "LLM not available"}

        # Use vLLM to generate personalized insights
        prompt = f"""
        Analyze health data and provide 3 actionable insights:
        - Fitness: {payload.get('fitness_summary', {})}
        - Nutrition: {payload.get('nutrition_summary', {})}
        """

        response = await self.vllm.chat(
            prompt=prompt,
            temperature=0.7,
            max_tokens=300,
        )

        return {"insights": response}

    # ========== MCP Integration ==========

    async def _fetch_health_context_via_mcp(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fetch health data via MCP."""
        if not self.mcp:
            return {}

        try:
            self.logger.info(f"Fetching health context via MCP for user {user_id}")

            session_id = payload.get("session_id", f"session_{user_id[:8]}")

            from uuid import UUID
            mcp_context = await self.mcp.get_health_context(
                user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                session_id=session_id,
            )

            return {
                "activities": mcp_context.get("activities", []),
                "health_summary": mcp_context.get("health_summary", {}),
            }

        except Exception as e:
            self.logger.warning(f"MCP fetch failed: {e}, using payload data")
            return {}
```

**Step 2: Add to Factory**

```python
# agents/orchestration/factory.py

from agents.specialists.health.health_agent import HealthSpecialist

async def create_agent_hierarchy(...):
    # ... existing code ...

    # Add Health Specialist
    health_specialist = HealthSpecialist(
        agent_id="health_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    # Add to appropriate manager or create new HealthManager
    # ...
```

**Step 3: Add Tests**

```python
# tests/unit/test_health_agent.py

import pytest
from uuid import uuid4
from datetime import datetime, timezone

from agents.specialists.health.health_agent import HealthSpecialist
from models.agent_models import AgentTask, TaskMetadata


class TestHealthSpecialist:
    @pytest.mark.asyncio
    async def test_fitness_tracking(self):
        """Test fitness tracking functionality."""
        agent = HealthSpecialist()

        user_id = str(uuid4())
        task = AgentTask(
            task_id="test_fitness_001",
            task_type="fitness_tracking",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "activities": [
                    {"type": "running", "calories": 300, "duration_minutes": 30},
                    {"type": "cycling", "calories": 200, "duration_minutes": 20},
                ]
            }
        )

        result = await agent.handle_task(task)

        assert result["status"] == "success"
        assert result["data"]["total_calories_burned"] == 500
        assert result["data"]["total_duration_minutes"] == 50
```

---

## Adding a New Domain

### Example: Creating Education Domain

**Step 1: Create Domain Manager**

```python
# agents/domain/education_manager.py

from typing import Dict, Any, Optional
from agents.core.base_agent import BaseAgent
from models.agent_models import AgentType, AgentCapability


class EducationManager(BaseAgent):
    """
    L1 Domain Manager for education operations.

    Specialist Routing:
    - course_management → CourseSpecialist
    - assignment_tracking → AssignmentSpecialist
    """

    SPECIALIST_ROUTING = {
        "course_management": "course_specialist",
        "course_recommendations": "course_specialist",
        "assignment_tracking": "assignment_specialist",
        "deadline_reminders": "assignment_specialist",
    }

    def __init__(
        self,
        agent_id: str = "education_manager",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize EducationManager."""

        capabilities = [
            AgentCapability(
                name="task_routing",
                description="Route tasks to education specialists",
                confidence=0.95,
            ),
        ]

        super().__init__(
            agent_id=agent_id,
            agent_type=AgentType.DOMAIN_MANAGER,
            capabilities=capabilities,
            message_bus=message_bus,
            graphrag_client=graphrag_client,
            vllm_client=vllm_client,
            config=config or {},
        )

        self.specialists = {}

    async def handle_task(self, task):
        """Route task to appropriate specialist."""
        specialist_id = self.SPECIALIST_ROUTING.get(task.task_type)

        if not specialist_id or specialist_id not in self.specialists:
            raise ValueError(f"No specialist found for task: {task.task_type}")

        specialist = self.specialists[specialist_id]
        return await specialist.handle_task(task)
```

**Step 2: Create Specialists**

Create `CourseSpecialist` and `AssignmentSpecialist` following the pattern above.

**Step 3: Update Orchestrator**

```python
# agents/orchestration/orchestrator.py

DOMAIN_ROUTING = {
    # ... existing routes ...

    # Education intents
    "course_management": "education",
    "assignment_tracking": "education",
}
```

**Step 4: Update Factory**

```python
# Create specialists
course_specialist = CourseSpecialist(...)
assignment_specialist = AssignmentSpecialist(...)

# Create manager
education_manager = EducationManager(...)
education_manager.specialists = {
    "course_specialist": course_specialist,
    "assignment_specialist": assignment_specialist,
}

# Add to orchestrator
orchestrator.domain_managers["education"] = education_manager
```

---

## Adding MCP Tools

### Example: Adding `get_health_metrics` Tool

**Step 1: Update MCP Schema**

```yaml
# docs/mcp_tools_schema.yaml

health_tools:
  - name: get_health_metrics
    category: health
    description: "Retrieve user's health metrics from fitness tracker"
    rls_enforced: true
    pii_redaction: false

    parameters:
      user_id:
        type: UUID
        required: true
        description: "User ID for RLS"

      session_id:
        type: string
        required: true
        description: "Session ID for tracking"

      start_date:
        type: string
        format: ISO8601
        required: false
        description: "Start date for metrics period"

      end_date:
        type: string
        format: ISO8601
        required: false
        description: "End date for metrics period"

      metric_types:
        type: array
        items:
          type: string
          enum: ["steps", "heart_rate", "sleep", "calories"]
        required: false
        description: "Types of metrics to retrieve"

    returns:
      type: array
      items:
        properties:
          date:
            type: string
            format: ISO8601

          metric_type:
            type: string

          value:
            type: number

          unit:
            type: string
```

**Step 2: Add to MCP Contract**

```markdown
# docs/MCP_TOOLS_CONTRACT.md

### get_health_metrics

Retrieve health metrics from fitness tracker integrations.

**Request**:
```json
{
  "tool_name": "get_health_metrics",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "sess_abc123",
  "arguments": {
    "start_date": "2025-10-01",
    "end_date": "2025-10-26",
    "metric_types": ["steps", "heart_rate"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-10-26",
      "metric_type": "steps",
      "value": 8542,
      "unit": "steps"
    },
    {
      "date": "2025-10-26",
      "metric_type": "heart_rate",
      "value": 72,
      "unit": "bpm"
    }
  ]
}
```
```

**Step 3: Add Test Fixture**

```json
// tests/fixtures/mcp_responses/health_metrics.json
{
  "tool": "get_health_metrics",
  "description": "Sample health metrics data",
  "response": {
    "success": true,
    "data": [
      {
        "date": "2025-10-26",
        "metric_type": "steps",
        "value": 8542,
        "unit": "steps"
      },
      {
        "date": "2025-10-26",
        "metric_type": "heart_rate",
        "value": 72,
        "unit": "bpm"
      }
    ]
  }
}
```

**Step 4: Add to MockMCPClient**

```python
# tests/mocks/mock_mcp_client.py

# Update tool_fixture_map in call_tool()
tool_fixture_map = {
    # ... existing mappings ...
    "get_health_metrics": "health_metrics",
}
```

**Step 5: (Optional) Add Convenience Method**

```python
# agents/tools/mcp_client.py

async def get_health_context(
    self,
    user_id: UUID,
    session_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch health metrics and summary."""
    metrics, summary = await asyncio.gather(
        self.call_tool(
            tool_name="get_health_metrics",
            user_id=user_id,
            session_id=session_id,
            start_date=start_date,
            end_date=end_date,
        ),
        self.call_tool(
            tool_name="get_health_summary",
            user_id=user_id,
            session_id=session_id,
        ),
    )

    return {
        "metrics": metrics,
        "summary": summary,
    }
```

---

## Testing Patterns

### Unit Tests (Isolated Agent)

```python
@pytest.mark.asyncio
async def test_budget_specialist_isolated():
    """Test specialist without dependencies."""
    agent = BudgetSpecialist()  # No MCP, vLLM, GraphRAG

    task = AgentTask(
        task_id="test_001",
        task_type="spending_analysis",
        user_id="user_123",
        payload={
            "transactions": [{"amount": -100}],
            "income": [{"amount": 5000}],
        }
    )

    result = await agent.handle_task(task)

    assert result["status"] == "success"
    assert result["data"]["total_spending"] == 100
```

### Integration Tests (With MockMCP)

```python
@pytest.mark.asyncio
async def test_budget_specialist_with_mcp():
    """Test specialist with MCP data fetching."""
    mock_mcp = MockMCPClient()
    agent = BudgetSpecialist(mcp_client=mock_mcp)

    task = AgentTask(
        task_id="test_002",
        task_type="spending_analysis",
        user_id=str(uuid4()),
        payload={"session_id": "test_session"}  # Minimal payload
    )

    result = await agent.handle_task(task)

    # Verify MCP was called
    assert mock_mcp.call_counts["get_financial_context"] == 1

    # Verify result
    assert result["status"] == "success"
```

### E2E Tests (Full Hierarchy)

```python
@pytest.mark.asyncio
async def test_full_hierarchy_routing():
    """Test request routes through entire hierarchy."""
    mock_mcp = MockMCPClient()
    orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)

    task = AgentTask(
        task_id="e2e_001",
        task_type="spending_analysis",
        user_id=str(uuid4()),
        payload={"session_id": "test"}
    )

    result = await orchestrator.handle_task(task)

    assert result["status"] == "success"
    # Verify routing: Orchestrator → FinanceManager → BudgetSpecialist
```

---

## Best Practices

### 1. Always Support Dual Mode (MCP + Payload)

```python
async def execute_task(self, task):
    # Try MCP first
    if self.mcp and not task.payload.get("data"):
        context = await self._fetch_via_mcp(task)
    else:
        # Fallback to payload
        context = task.payload

    return await self._analyze(context)
```

### 2. Use Structured Logging

```python
self.logger.info(
    "Task completed",
    extra={
        "task_id": task.task_id,
        "task_type": task.task_type,
        "duration_ms": duration,
        "user_id": task.metadata.user_id,
    }
)
```

### 3. Handle Errors Gracefully

```python
try:
    result = await self.mcp.get_financial_context(...)
except MCPTimeoutError:
    self.logger.warning("MCP timeout, using cached data")
    result = await self._get_cached_data(user_id)
except MCPError as e:
    self.logger.error(f"MCP error: {e}")
    raise TaskExecutionError("Data fetch failed")
```

### 4. Add Type Hints

```python
async def handle_task(
    self, task: AgentTask
) -> Dict[str, Any]:
    ...
```

### 5. Document Public Methods

```python
async def analyze_budget(
    self,
    transactions: List[Dict[str, Any]],
    time_period: int = 90
) -> BudgetAnalysis:
    """
    Analyze budget and spending patterns.

    Args:
        transactions: List of transaction dicts
        time_period: Analysis period in days

    Returns:
        BudgetAnalysis with insights and recommendations

    Raises:
        TaskExecutionError: If analysis fails
    """
```

### 6. Use GraphRAG for Semantic Memory

```python
# Store insights for future context
await self.graphrag.store_memory(
    user_id=user_id,
    agent_id=self.agent_id,
    content=f"Budget analysis: savings rate {savings_rate:.1%}",
    embedding=embedding_vector,
    metadata={"timestamp": datetime.now(timezone.utc)}
)

# Query past insights
past_analyses = await self.graphrag.query_memory(
    user_id=user_id,
    query="What was last month's savings rate?",
    limit=5
)
```

### 7. Use vLLM for Natural Language

```python
# Generate personalized insights
prompt = f"""
You are a financial advisor. Analyze this data and provide 3 actionable insights:

Spending: ${total_spending:,.2f}
Income: ${total_income:,.2f}
Savings Rate: {savings_rate:.1%}

Provide specific, actionable recommendations.
"""

response = await self.vllm.chat(
    prompt=prompt,
    temperature=0.7,
    max_tokens=300
)
```

---

## Code Review Checklist

Before submitting PR:

- [ ] All new agents inherit from `BaseAgent`
- [ ] MCP support added (`mcp_client` parameter)
- [ ] Dual mode supported (MCP + payload fallback)
- [ ] Unit tests added (isolated)
- [ ] Integration tests added (with MockMCP)
- [ ] Docstrings added (all public methods)
- [ ] Type hints added
- [ ] Logging added (structured)
- [ ] Error handling added
- [ ] Factory updated (if new specialist/domain)
- [ ] Documentation updated (`docs/ARCHITECTURE.md`)

---

## Resources

- **Architecture**: `docs/ARCHITECTURE.md`
- **MCP Contract**: `docs/MCP_TOOLS_CONTRACT.md`
- **MCP Schema**: `docs/mcp_tools_schema.yaml`
- **Test Fixtures**: `tests/fixtures/mcp_responses/`
- **Example Agents**: `agents/specialists/`

## Questions?

Check the documentation or reach out to the team!
