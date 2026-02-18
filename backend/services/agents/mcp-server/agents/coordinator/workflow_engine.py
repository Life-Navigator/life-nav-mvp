"""Workflow Engine - Multi-Step Task Orchestration"""

import asyncio
from typing import Dict, List, Any, Optional
from enum import Enum
from datetime import datetime
import uuid
import structlog
from pydantic import BaseModel, Field

from ..base.message import TaskRequest, MessagePriority
from .agent_coordinator import AgentCoordinator

logger = structlog.get_logger(__name__)


class WorkflowStepType(str, Enum):
    """Types of workflow steps"""
    TASK = "task"  # Execute a task
    PARALLEL = "parallel"  # Execute multiple steps in parallel
    CONDITION = "condition"  # Conditional branching
    LOOP = "loop"  # Repeat a step
    AGGREGATE = "aggregate"  # Aggregate results from previous steps


class WorkflowStepStatus(str, Enum):
    """Status of a workflow step"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowStep(BaseModel):
    """A single step in a workflow"""
    step_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: WorkflowStepType
    description: Optional[str] = None

    # For TASK steps
    task_type: Optional[str] = None
    requirements: List[str] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)

    # For PARALLEL steps
    parallel_steps: List["WorkflowStep"] = Field(default_factory=list)

    # For CONDITION steps
    condition: Optional[str] = None  # Python expression
    if_true: Optional["WorkflowStep"] = None
    if_false: Optional["WorkflowStep"] = None

    # For LOOP steps
    loop_condition: Optional[str] = None
    loop_step: Optional["WorkflowStep"] = None
    max_iterations: int = 10

    # Retry configuration
    max_retries: int = 3
    retry_delay_seconds: float = 1.0

    # Dependencies
    depends_on: List[str] = Field(default_factory=list)  # step_ids

    # Execution state
    status: WorkflowStepStatus = WorkflowStepStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    attempts: int = 0


class Workflow(BaseModel):
    """A workflow definition"""
    workflow_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    steps: List[WorkflowStep]

    # Workflow configuration
    priority: MessagePriority = MessagePriority.NORMAL
    timeout_seconds: int = 600
    continue_on_error: bool = False

    # Execution context
    context: Dict[str, Any] = Field(default_factory=dict)

    # Execution state
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "pending"  # pending, running, completed, failed


class WorkflowEngine:
    """
    Orchestrates multi-step workflows across agents.

    Features:
    - Sequential and parallel step execution
    - Conditional branching
    - Loops and iterations
    - Error handling and retries
    - Result aggregation
    - Workflow templates
    - Context passing between steps

    Usage:
        engine = WorkflowEngine(coordinator)

        # Define workflow
        workflow = Workflow(
            name="research_and_analyze",
            steps=[
                WorkflowStep(
                    name="gather_data",
                    type=WorkflowStepType.TASK,
                    task_type="research",
                    requirements=["research"]
                ),
                WorkflowStep(
                    name="analyze_data",
                    type=WorkflowStepType.TASK,
                    task_type="analysis",
                    requirements=["analysis"],
                    depends_on=["gather_data"]
                )
            ]
        )

        # Execute workflow
        result = await engine.execute(workflow, user_id="user123")
    """

    def __init__(self, coordinator: AgentCoordinator):
        self.coordinator = coordinator

        # Active workflows: workflow_id -> workflow
        self._active_workflows: Dict[str, Workflow] = {}

        # Statistics
        self._stats = {
            "workflows_executed": 0,
            "workflows_completed": 0,
            "workflows_failed": 0,
            "steps_executed": 0,
        }

    async def execute(
        self,
        workflow: Workflow,
        user_id: str,
        initial_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a workflow.

        Args:
            workflow: Workflow to execute
            user_id: User identifier for context
            initial_context: Initial workflow context

        Returns:
            Workflow execution result
        """
        self._stats["workflows_executed"] += 1

        # Initialize workflow
        workflow.started_at = datetime.utcnow()
        workflow.status = "running"
        workflow.context = initial_context or {}
        workflow.context["user_id"] = user_id

        self._active_workflows[workflow.workflow_id] = workflow

        logger.info(
            "workflow_started",
            workflow_id=workflow.workflow_id,
            name=workflow.name,
            steps=len(workflow.steps)
        )

        try:
            # Execute workflow with timeout
            result = await asyncio.wait_for(
                self._execute_workflow(workflow),
                timeout=workflow.timeout_seconds
            )

            workflow.status = "completed"
            workflow.completed_at = datetime.utcnow()
            self._stats["workflows_completed"] += 1

            logger.info(
                "workflow_completed",
                workflow_id=workflow.workflow_id,
                duration=(workflow.completed_at - workflow.started_at).total_seconds()
            )

            return result

        except asyncio.TimeoutError:
            workflow.status = "failed"
            workflow.completed_at = datetime.utcnow()
            self._stats["workflows_failed"] += 1

            logger.error(
                "workflow_timeout",
                workflow_id=workflow.workflow_id,
                timeout=workflow.timeout_seconds
            )

            raise

        except Exception as e:
            workflow.status = "failed"
            workflow.completed_at = datetime.utcnow()
            self._stats["workflows_failed"] += 1

            logger.error(
                "workflow_failed",
                workflow_id=workflow.workflow_id,
                error=str(e),
                exc_info=True
            )

            raise

        finally:
            # Remove from active workflows
            self._active_workflows.pop(workflow.workflow_id, None)

    async def _execute_workflow(self, workflow: Workflow) -> Dict[str, Any]:
        """Execute all workflow steps"""
        # Build dependency graph
        self._build_dependency_graph(workflow.steps)

        # Execute steps in order
        completed_steps = set()
        results = {}

        while len(completed_steps) < len(workflow.steps):
            # Find steps ready to execute
            ready_steps = [
                step
                for step in workflow.steps
                if step.step_id not in completed_steps
                and all(dep in completed_steps for dep in step.depends_on)
            ]

            if not ready_steps:
                # No steps ready - check for circular dependencies
                if len(completed_steps) < len(workflow.steps):
                    raise ValueError("Circular dependency detected in workflow")
                break

            # Execute ready steps in parallel
            step_tasks = [
                self._execute_step(step, workflow, results)
                for step in ready_steps
            ]

            step_results = await asyncio.gather(*step_tasks, return_exceptions=True)

            # Process results
            for step, result in zip(ready_steps, step_results):
                if isinstance(result, Exception):
                    step.status = WorkflowStepStatus.FAILED
                    step.error = str(result)

                    if not workflow.continue_on_error:
                        raise result
                else:
                    step.status = WorkflowStepStatus.COMPLETED
                    step.result = result
                    results[step.step_id] = result

                completed_steps.add(step.step_id)

        # Return final results
        return {
            "workflow_id": workflow.workflow_id,
            "status": "completed",
            "results": results,
            "context": workflow.context,
        }

    async def _execute_step(
        self,
        step: WorkflowStep,
        workflow: Workflow,
        previous_results: Dict[str, Any]
    ) -> Any:
        """Execute a single workflow step"""
        self._stats["steps_executed"] += 1

        step.status = WorkflowStepStatus.RUNNING
        logger.info(
            "step_executing",
            workflow_id=workflow.workflow_id,
            step_id=step.step_id,
            name=step.name,
            type=step.type
        )

        try:
            if step.type == WorkflowStepType.TASK:
                return await self._execute_task_step(step, workflow, previous_results)

            elif step.type == WorkflowStepType.PARALLEL:
                return await self._execute_parallel_step(step, workflow, previous_results)

            elif step.type == WorkflowStepType.CONDITION:
                return await self._execute_condition_step(step, workflow, previous_results)

            elif step.type == WorkflowStepType.LOOP:
                return await self._execute_loop_step(step, workflow, previous_results)

            elif step.type == WorkflowStepType.AGGREGATE:
                return await self._execute_aggregate_step(step, previous_results)

            else:
                raise ValueError(f"Unknown step type: {step.type}")

        except Exception as e:
            logger.error(
                "step_failed",
                workflow_id=workflow.workflow_id,
                step_id=step.step_id,
                error=str(e),
                exc_info=True
            )
            raise

    async def _execute_task_step(
        self,
        step: WorkflowStep,
        workflow: Workflow,
        previous_results: Dict[str, Any]
    ) -> Any:
        """Execute a task step with retry logic"""
        # Build task parameters from template and previous results
        parameters = self._resolve_parameters(
            step.parameters,
            workflow.context,
            previous_results
        )

        # Create task request
        task = TaskRequest(
            task_type=step.task_type,
            description=step.description or step.name,
            parameters=parameters,
            requirements=step.requirements,
            priority=workflow.priority,
            context=workflow.context,
        )

        # Execute with retry
        last_error = None
        for attempt in range(step.max_retries + 1):
            step.attempts = attempt + 1

            try:
                response = await self.coordinator.delegate_task(
                    task=task,
                    timeout=30.0
                )

                if response and response.status == "success":
                    return response.result

                last_error = response.error if response else "No response"

            except Exception as e:
                last_error = str(e)

            # Wait before retry
            if attempt < step.max_retries:
                await asyncio.sleep(step.retry_delay_seconds * (2 ** attempt))

        # All retries failed
        raise Exception(f"Task failed after {step.attempts} attempts: {last_error}")

    async def _execute_parallel_step(
        self,
        step: WorkflowStep,
        workflow: Workflow,
        previous_results: Dict[str, Any]
    ) -> List[Any]:
        """Execute multiple steps in parallel"""
        tasks = [
            self._execute_step(substep, workflow, previous_results)
            for substep in step.parallel_steps
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Check for errors
        errors = [r for r in results if isinstance(r, Exception)]
        if errors and not workflow.continue_on_error:
            raise errors[0]

        return results

    async def _execute_condition_step(
        self,
        step: WorkflowStep,
        workflow: Workflow,
        previous_results: Dict[str, Any]
    ) -> Any:
        """Execute conditional branching"""
        # Evaluate condition
        condition_result = self._evaluate_condition(
            step.condition,
            workflow.context,
            previous_results
        )

        # Execute appropriate branch
        if condition_result and step.if_true:
            return await self._execute_step(step.if_true, workflow, previous_results)
        elif not condition_result and step.if_false:
            return await self._execute_step(step.if_false, workflow, previous_results)

        return None

    async def _execute_loop_step(
        self,
        step: WorkflowStep,
        workflow: Workflow,
        previous_results: Dict[str, Any]
    ) -> List[Any]:
        """Execute a step in a loop"""
        results = []
        iteration = 0

        while iteration < step.max_iterations:
            # Check loop condition
            if step.loop_condition:
                should_continue = self._evaluate_condition(
                    step.loop_condition,
                    workflow.context,
                    previous_results
                )
                if not should_continue:
                    break

            # Execute loop step
            result = await self._execute_step(
                step.loop_step,
                workflow,
                previous_results
            )
            results.append(result)

            # Update context with iteration result
            workflow.context[f"{step.name}_iteration_{iteration}"] = result

            iteration += 1

        return results

    async def _execute_aggregate_step(
        self,
        step: WorkflowStep,
        previous_results: Dict[str, Any]
    ) -> Any:
        """Aggregate results from previous steps"""
        # Gather results from dependencies
        results = [
            previous_results.get(dep_id)
            for dep_id in step.depends_on
        ]

        # Apply aggregation function
        aggregation = step.parameters.get("aggregation", "list")

        if aggregation == "list":
            return results
        elif aggregation == "merge":
            # Merge dictionaries
            merged = {}
            for result in results:
                if isinstance(result, dict):
                    merged.update(result)
            return merged
        elif aggregation == "vote":
            # Take most common result
            from collections import Counter
            return Counter(results).most_common(1)[0][0]
        else:
            return results

    def _build_dependency_graph(
        self,
        steps: List[WorkflowStep]
    ) -> Dict[str, List[str]]:
        """Build step dependency graph"""
        graph = {}
        for step in steps:
            graph[step.step_id] = step.depends_on
        return graph

    def _resolve_parameters(
        self,
        parameters: Dict[str, Any],
        context: Dict[str, Any],
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve parameter templates"""
        resolved = {}

        for key, value in parameters.items():
            if isinstance(value, str) and value.startswith("{{") and value.endswith("}}"):
                # Template variable
                var_name = value[2:-2].strip()

                # Check context first
                if var_name in context:
                    resolved[key] = context[var_name]
                # Check previous results
                elif var_name in previous_results:
                    resolved[key] = previous_results[var_name]
                else:
                    resolved[key] = value
            else:
                resolved[key] = value

        return resolved

    def _evaluate_condition(
        self,
        condition: str,
        context: Dict[str, Any],
        previous_results: Dict[str, Any]
    ) -> bool:
        """Evaluate a condition expression"""
        # Simple condition evaluation
        # For production, use a safe expression evaluator

        try:
            # Combine context and results
            scope = {**context, **previous_results}

            # Evaluate condition
            return eval(condition, {"__builtins__": {}}, scope)

        except Exception as e:
            logger.error(
                "condition_evaluation_failed",
                condition=condition,
                error=str(e)
            )
            return False

    def get_workflow_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get status of an active workflow"""
        workflow = self._active_workflows.get(workflow_id)
        if not workflow:
            return None

        return {
            "workflow_id": workflow.workflow_id,
            "name": workflow.name,
            "status": workflow.status,
            "started_at": workflow.started_at.isoformat() if workflow.started_at else None,
            "steps": [
                {
                    "step_id": step.step_id,
                    "name": step.name,
                    "status": step.status.value,
                    "attempts": step.attempts,
                }
                for step in workflow.steps
            ],
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get workflow engine statistics"""
        return {
            **self._stats,
            "active_workflows": len(self._active_workflows),
        }
