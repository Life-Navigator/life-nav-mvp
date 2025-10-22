"""Error recovery framework with graceful degradation strategies.

This module implements intelligent error recovery:
- Strategy-based recovery attempts
- Graceful degradation
- Fallback mechanisms
- Integration with reasoning chains

Example usage:
    >>> manager = ErrorRecoveryManager(reasoning_engine)
    >>> success, result = await manager.attempt_recovery(error, chain_id, context)
"""

import uuid
from typing import Any

from pydantic import BaseModel, Field

from agents.core.reasoning import ReasoningEngine
from models.agent_models import AgentType
from utils.errors import LifeNavigatorError
from utils.logging import get_logger

logger = get_logger(__name__)


class RecoveryStrategy(BaseModel):
    """Definition of an error recovery strategy.

    Attributes:
        strategy_id: Unique strategy identifier.
        name: Strategy name.
        description: Strategy description.
        applicable_errors: Error codes this applies to.
        priority: Priority (higher = try first).
        max_retries: Maximum retry attempts.
        requires_user_input: Whether user input needed.
        requires_data_refresh: Whether data refresh needed.
        fallback_agent_type: Fallback agent type.
        fallback_data_source: Fallback data source.
        degraded_output_acceptable: Accept degraded output.
    """

    strategy_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., description="Strategy name")
    description: str = Field(..., description="Strategy description")
    applicable_errors: list[str] = Field(..., description="Applicable error codes")
    priority: int = Field(..., ge=1, le=10, description="Priority level")

    # Conditions
    max_retries: int = Field(default=3, ge=0, le=10, description="Max retries")
    requires_user_input: bool = Field(default=False, description="Requires user input")
    requires_data_refresh: bool = Field(
        default=False, description="Requires data refresh"
    )

    # Fallback action
    fallback_agent_type: AgentType | None = Field(
        default=None, description="Fallback agent type"
    )
    fallback_data_source: str | None = Field(
        default=None, description="Fallback data source"
    )
    degraded_output_acceptable: bool = Field(
        default=True, description="Accept degraded output"
    )

    async def execute(
        self,
        context: dict[str, Any],
        reasoning_engine: ReasoningEngine,
        chain_id: str,
    ) -> tuple[bool, dict[str, Any]]:
        """Execute recovery strategy.

        Args:
            context: Execution context.
            reasoning_engine: Reasoning engine.
            chain_id: Chain identifier.

        Returns:
            Tuple of (success, result).
        """
        reasoning_engine.add_correction(
            chain_id,
            f"Attempting recovery: {self.name}",
            fallback_strategy=self.description,
        )

        # Strategy implementation - this is a template
        # Actual logic depends on strategy type
        logger.info(f"Executing recovery strategy: {self.name}")

        return (True, {"recovery_applied": self.name})


class RecoveryStrategyRegistry:
    """Registry of available recovery strategies."""

    def __init__(self) -> None:
        """Initialize strategy registry."""
        self._strategies: dict[str, RecoveryStrategy] = {}
        self._register_default_strategies()
        logger.info("RecoveryStrategyRegistry initialized")

    def _register_default_strategies(self) -> None:
        """Register common recovery strategies."""
        # Strategy 1: Use cached data
        self.register(
            RecoveryStrategy(
                name="use_cached_data",
                description="Fall back to cached data from last successful query",
                applicable_errors=["GRAPHRAG_100", "GRAPHRAG_101", "GRAPHRAG_102"],
                priority=8,
                requires_data_refresh=False,
                degraded_output_acceptable=True,
            )
        )

        # Strategy 2: Use alternative data source
        self.register(
            RecoveryStrategy(
                name="alternative_data_source",
                description="Switch to backup database or API",
                applicable_errors=["GRAPHRAG_100", "TOOL_400"],
                priority=7,
                fallback_data_source="backup",
            )
        )

        # Strategy 3: Reduce scope
        self.register(
            RecoveryStrategy(
                name="reduce_scope",
                description="Return partial results instead of complete analysis",
                applicable_errors=["AGENT_004", "LLM_301"],
                priority=6,
                degraded_output_acceptable=True,
            )
        )

        # Strategy 4: Request user input
        self.register(
            RecoveryStrategy(
                name="request_user_input",
                description="Ask user for missing information",
                applicable_errors=["GRAPHRAG_105", "AGENT_004"],
                priority=5,
                requires_user_input=True,
            )
        )

        # Strategy 5: Use industry averages
        self.register(
            RecoveryStrategy(
                name="use_industry_averages",
                description="Substitute missing user data with statistical averages",
                applicable_errors=["GRAPHRAG_105"],
                priority=4,
                degraded_output_acceptable=True,
            )
        )

        # Strategy 6: Delegate to simpler agent
        self.register(
            RecoveryStrategy(
                name="delegate_simpler_agent",
                description="Fall back to less sophisticated agent with lower requirements",
                applicable_errors=["AGENT_004", "LLM_301"],
                priority=3,
                fallback_agent_type=AgentType.SPECIALIST,
            )
        )

    def register(self, strategy: RecoveryStrategy) -> None:
        """Register a recovery strategy.

        Args:
            strategy: Strategy to register.
        """
        self._strategies[strategy.name] = strategy
        logger.debug(f"Registered recovery strategy: {strategy.name}")

    def get_strategies_for_error(self, error_code: str) -> list[RecoveryStrategy]:
        """Get applicable strategies sorted by priority.

        Args:
            error_code: Error code to match.

        Returns:
            List of applicable strategies.
        """
        applicable = [
            s for s in self._strategies.values() if error_code in s.applicable_errors
        ]
        return sorted(applicable, key=lambda s: s.priority, reverse=True)


class ErrorRecoveryManager:
    """Manages error recovery execution.

    This manager coordinates error recovery attempts using
    registered strategies, integrating with the reasoning engine.
    """

    def __init__(self, reasoning_engine: ReasoningEngine) -> None:
        """Initialize error recovery manager.

        Args:
            reasoning_engine: Reasoning engine instance.
        """
        self.reasoning_engine = reasoning_engine
        self.strategy_registry = RecoveryStrategyRegistry()
        logger.info("ErrorRecoveryManager initialized")

    async def attempt_recovery(
        self,
        error: LifeNavigatorError,
        chain_id: str,
        context: dict[str, Any],
        max_strategies: int = 3,
    ) -> tuple[bool, dict[str, Any] | None]:
        """Attempt to recover from error using registered strategies.

        Args:
            error: Error to recover from.
            chain_id: Reasoning chain ID.
            context: Execution context.
            max_strategies: Max strategies to try.

        Returns:
            Tuple of (success, result).
        """
        # Log error in reasoning chain
        self.reasoning_engine.add_result(
            chain_id,
            f"Error encountered: {error.message}",
            success=False,
            result_data=error.to_dict(),
        )

        # Reflect on error
        self.reasoning_engine.add_reflection(
            chain_id,
            f"Error {error.error_code} occurred. Checking recovery strategies.",
            should_retry=True,
        )

        # Get applicable strategies
        strategies = self.strategy_registry.get_strategies_for_error(error.error_code)

        if not strategies:
            logger.warning(
                f"No recovery strategies for error {error.error_code}",
                metadata={"error_code": error.error_code},
            )
            return (False, None)

        logger.info(
            f"Found {len(strategies)} recovery strategies for {error.error_code}",
            metadata={
                "error_code": error.error_code,
                "strategy_count": len(strategies),
            },
        )

        # Try strategies in priority order
        for strategy in strategies[:max_strategies]:
            try:
                logger.info(f"Attempting recovery: {strategy.name}")

                success, result = await strategy.execute(
                    context, self.reasoning_engine, chain_id
                )

                if success:
                    logger.info(f"Recovery successful: {strategy.name}")
                    self.reasoning_engine.add_result(
                        chain_id,
                        f"Recovery succeeded using {strategy.name}",
                        success=True,
                        result_data=result,
                    )
                    return (True, result)

            except Exception as e:
                logger.error(
                    f"Recovery strategy {strategy.name} failed: {e}",
                    error=e,
                )
                continue

        # All strategies failed
        logger.error(f"All recovery strategies exhausted for {error.error_code}")
        self.reasoning_engine.add_result(
            chain_id,
            "All recovery attempts failed. Task cannot be completed.",
            success=False,
            result_data={
                "attempted_strategies": [s.name for s in strategies[:max_strategies]]
            },
        )

        return (False, None)

    async def recover_or_fail(
        self, error: LifeNavigatorError, chain_id: str, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Attempt recovery or return error response.

        Args:
            error: Error to recover from.
            chain_id: Reasoning chain ID.
            context: Execution context.

        Returns:
            Recovery result dictionary.
        """
        success, result = await self.attempt_recovery(error, chain_id, context)

        if success:
            return {
                "status": "recovered",
                "result": result,
                "warning": "Task completed with degraded output due to error recovery",
            }
        else:
            return {
                "status": "failed",
                "error": error.to_dict(),
                "message": "Task failed and all recovery attempts exhausted",
            }
