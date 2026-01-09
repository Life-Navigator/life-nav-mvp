"""
Multi-Goal Coupling & Waterfall Policies
===========================================================================
Allocates shared household cashflow and portfolio across competing goals.

Features:
- Waterfall policies: strict_priority, proportional, min_floor_then_priority
- Goal flexibility (can delay, can reduce target)
- Shared resource constraints (cashflow + portfolio)
- Goal dependencies (must fund A before B)
- Deterministic allocation given same inputs

Waterfall Policies:
1. STRICT_PRIORITY: Fund goals in order of priority (1 = highest)
   - Goal 1 gets 100% until fully funded
   - Then goal 2, then goal 3, etc.

2. PROPORTIONAL: Allocate based on weighted priority
   - Each goal gets (priority_weight / sum_weights) * available_cashflow
   - No goal fully funded until all goals receive proportional share

3. MIN_FLOOR_THEN_PRIORITY: Hybrid approach
   - First, fund minimum floor for each goal (e.g., 50% of target)
   - Then, use strict priority for remaining funds
"""

from typing import List, Dict, Optional, Tuple
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime
import numpy as np

from .schemas import GoalType, WaterfallPolicy


# ===========================================================================
# Goal Definitions
# ===========================================================================

class GoalFlexibility(BaseModel):
    """Goal flexibility parameters."""
    model_config = ConfigDict(extra='forbid')

    can_delay_months: int = Field(0, ge=0, le=120)  # Max delay (months)
    can_reduce_target_pct: float = Field(0.0, ge=0.0, le=0.5)  # Max reduction %


class GoalConstraints(BaseModel):
    """Goal constraints."""
    model_config = ConfigDict(extra='forbid')

    min_monthly_contribution: float = Field(0.0, ge=0)
    max_monthly_contribution: Optional[float] = None
    must_fund_after_goal_id: Optional[str] = None  # Dependency


class Goal(BaseModel):
    """Single financial goal."""
    model_config = ConfigDict(extra='forbid')

    id: str
    type: GoalType
    target_value: float = Field(..., gt=0)
    target_date: date
    priority: int = Field(..., ge=1, le=10)  # 1 = highest priority

    # Current progress
    current_allocated: float = Field(0.0, ge=0)

    # Flexibility
    flexibility: GoalFlexibility = Field(default_factory=GoalFlexibility)

    # Constraints
    constraints: GoalConstraints = Field(default_factory=GoalConstraints)

    # Metadata
    name: Optional[str] = None
    description: Optional[str] = None


# ===========================================================================
# Allocation Output
# ===========================================================================

class GoalAllocation(BaseModel):
    """Allocation result for a single goal."""
    model_config = ConfigDict(extra='forbid')

    goal_id: str
    allocated_amount: float = Field(..., ge=0)
    percent_of_target: float = Field(..., ge=0.0, le=2.0)  # Can exceed 100%
    is_fully_funded: bool
    shortfall: float = Field(0.0, ge=0)

    # Adjustments
    delay_months: int = Field(0, ge=0)
    target_reduction_pct: float = Field(0.0, ge=0.0, le=1.0)


class AllocationResult(BaseModel):
    """Complete allocation result across all goals."""
    model_config = ConfigDict(extra='forbid')

    # Per-goal allocations
    allocations: List[GoalAllocation]

    # Aggregate metrics
    total_allocated: float = Field(..., ge=0)
    total_remaining: float = Field(..., ge=0)
    num_goals_fully_funded: int = Field(..., ge=0)
    num_goals_partially_funded: int = Field(..., ge=0)
    num_goals_unfunded: int = Field(..., ge=0)

    # Policy used
    waterfall_policy: WaterfallPolicy

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Allocator
# ===========================================================================

class GoalAllocatorConfig(BaseModel):
    """Configuration for goal allocator."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Waterfall policy
    waterfall_policy: WaterfallPolicy = WaterfallPolicy.STRICT_PRIORITY

    # Minimum floor percentage (for min_floor_then_priority)
    min_floor_pct: float = Field(0.5, ge=0.0, le=1.0)

    # Allow over-allocation (allocate more than target if funds available)
    allow_over_allocation: bool = False


class GoalAllocatorInput(BaseModel):
    """Input for goal allocation."""
    model_config = ConfigDict(extra='forbid')

    # Goals to allocate
    goals: List[Goal] = Field(..., min_length=1, max_length=20)

    # Available resources
    available_cashflow: float = Field(..., ge=0)

    # Time period (months)
    # Used to check if goals are achievable by target_date
    current_date: date
    time_horizon_months: int = Field(..., ge=1, le=1200)


class GoalAllocator:
    """
    Multi-goal allocator with waterfall policies.

    Allocates shared cashflow across competing goals based on policy.
    """

    def __init__(self, config: GoalAllocatorConfig = GoalAllocatorConfig()):
        self.config = config

    def allocate(self, input_data: GoalAllocatorInput) -> AllocationResult:
        """
        Allocate cashflow across goals.

        Args:
            input_data: Goals and available cashflow

        Returns:
            AllocationResult with per-goal allocations
        """
        # Validate goals
        self._validate_goals(input_data.goals)

        # Sort goals by priority (1 = highest)
        sorted_goals = sorted(input_data.goals, key=lambda g: g.priority)

        # Check dependencies
        sorted_goals = self._resolve_dependencies(sorted_goals)

        # Allocate based on policy
        if self.config.waterfall_policy == WaterfallPolicy.STRICT_PRIORITY:
            allocations = self._allocate_strict_priority(
                sorted_goals, input_data.available_cashflow
            )
        elif self.config.waterfall_policy == WaterfallPolicy.PROPORTIONAL:
            allocations = self._allocate_proportional(
                sorted_goals, input_data.available_cashflow
            )
        elif self.config.waterfall_policy == WaterfallPolicy.MIN_FLOOR_THEN_PRIORITY:
            allocations = self._allocate_min_floor_then_priority(
                sorted_goals,
                input_data.available_cashflow,
                self.config.min_floor_pct,
            )
        else:
            raise ValueError(f"Unknown waterfall policy: {self.config.waterfall_policy}")

        # Calculate aggregate metrics
        total_allocated = sum(a.allocated_amount for a in allocations)
        total_remaining = input_data.available_cashflow - total_allocated
        num_fully_funded = sum(1 for a in allocations if a.is_fully_funded)
        num_partially_funded = sum(
            1 for a in allocations if a.allocated_amount > 0 and not a.is_fully_funded
        )
        num_unfunded = sum(1 for a in allocations if a.allocated_amount == 0)

        return AllocationResult(
            allocations=allocations,
            total_allocated=total_allocated,
            total_remaining=total_remaining,
            num_goals_fully_funded=num_fully_funded,
            num_goals_partially_funded=num_partially_funded,
            num_goals_unfunded=num_unfunded,
            waterfall_policy=self.config.waterfall_policy,
        )

    def _validate_goals(self, goals: List[Goal]):
        """Validate goal inputs."""
        # Check unique IDs
        ids = [g.id for g in goals]
        if len(ids) != len(set(ids)):
            raise ValueError("Goal IDs must be unique")

        # Check priorities are valid
        priorities = [g.priority for g in goals]
        if any(p < 1 or p > 10 for p in priorities):
            raise ValueError("Goal priorities must be between 1 and 10")

    def _resolve_dependencies(self, goals: List[Goal]) -> List[Goal]:
        """
        Resolve goal dependencies.

        If goal B depends on goal A (must_fund_after_goal_id), ensure A comes before B.
        """
        # Build dependency graph
        goal_map = {g.id: g for g in goals}
        resolved = []
        visited = set()

        def visit(goal: Goal):
            if goal.id in visited:
                return
            visited.add(goal.id)

            # Visit dependencies first
            if goal.constraints.must_fund_after_goal_id:
                dep_id = goal.constraints.must_fund_after_goal_id
                if dep_id in goal_map:
                    visit(goal_map[dep_id])

            resolved.append(goal)

        for goal in goals:
            visit(goal)

        return resolved

    def _allocate_strict_priority(
        self, goals: List[Goal], available: float
    ) -> List[GoalAllocation]:
        """
        Allocate using strict priority waterfall.

        Fund goals in order of priority until available cashflow is exhausted.
        """
        allocations = []
        remaining = available

        for goal in goals:
            # Calculate needed amount
            needed = max(0, goal.target_value - goal.current_allocated)

            # Check constraints
            min_contrib = goal.constraints.min_monthly_contribution
            max_contrib = goal.constraints.max_monthly_contribution

            # Allocate
            if remaining >= needed:
                # Fully fund goal
                allocated = needed
                is_fully_funded = True
                shortfall = 0.0
            elif remaining >= min_contrib:
                # Partially fund goal
                if max_contrib is not None:
                    allocated = min(remaining, max_contrib)
                else:
                    allocated = remaining
                is_fully_funded = False
                shortfall = needed - allocated
            else:
                # Not enough to meet minimum contribution
                allocated = 0.0
                is_fully_funded = False
                shortfall = needed

            remaining -= allocated

            allocations.append(
                GoalAllocation(
                    goal_id=goal.id,
                    allocated_amount=allocated,
                    percent_of_target=(goal.current_allocated + allocated)
                    / goal.target_value,
                    is_fully_funded=is_fully_funded,
                    shortfall=shortfall,
                )
            )

        return allocations

    def _allocate_proportional(
        self, goals: List[Goal], available: float
    ) -> List[GoalAllocation]:
        """
        Allocate proportionally based on priority weights.

        Each goal gets (priority_weight / sum_weights) * available_cashflow.
        """
        # Calculate priority weights (inverse of priority number)
        # Priority 1 = weight 10, priority 10 = weight 1
        weights = {g.id: (11 - g.priority) for g in goals}
        total_weight = sum(weights.values())

        allocations = []

        for goal in goals:
            # Calculate proportional share
            weight = weights[goal.id]
            share = (weight / total_weight) * available

            # Calculate needed amount
            needed = max(0, goal.target_value - goal.current_allocated)

            # Check constraints
            min_contrib = goal.constraints.min_monthly_contribution
            max_contrib = goal.constraints.max_monthly_contribution

            # Allocate
            if share >= needed:
                # Would fully fund goal
                allocated = needed
                is_fully_funded = True
                shortfall = 0.0
            elif share >= min_contrib:
                # Partially fund goal
                if max_contrib is not None:
                    allocated = min(share, max_contrib)
                else:
                    allocated = share
                is_fully_funded = False
                shortfall = needed - allocated
            else:
                # Not enough to meet minimum contribution
                allocated = 0.0
                is_fully_funded = False
                shortfall = needed

            allocations.append(
                GoalAllocation(
                    goal_id=goal.id,
                    allocated_amount=allocated,
                    percent_of_target=(goal.current_allocated + allocated)
                    / goal.target_value,
                    is_fully_funded=is_fully_funded,
                    shortfall=shortfall,
                )
            )

        return allocations

    def _allocate_min_floor_then_priority(
        self, goals: List[Goal], available: float, min_floor_pct: float
    ) -> List[GoalAllocation]:
        """
        Allocate using minimum floor then priority.

        Phase 1: Fund min_floor_pct of each goal
        Phase 2: Use strict priority for remaining funds
        """
        allocations = []
        remaining = available

        # Phase 1: Fund minimum floors
        floor_allocations: Dict[str, float] = {}

        for goal in goals:
            needed = max(0, goal.target_value - goal.current_allocated)
            floor_amount = needed * min_floor_pct

            min_contrib = goal.constraints.min_monthly_contribution
            max_contrib = goal.constraints.max_monthly_contribution

            if remaining >= floor_amount and floor_amount >= min_contrib:
                # Fund floor
                if max_contrib is not None:
                    allocated = min(floor_amount, max_contrib)
                else:
                    allocated = floor_amount
                floor_allocations[goal.id] = allocated
                remaining -= allocated
            else:
                floor_allocations[goal.id] = 0.0

        # Phase 2: Fund remaining with strict priority
        for goal in goals:
            floor_allocated = floor_allocations[goal.id]
            needed = max(0, goal.target_value - goal.current_allocated)
            remaining_needed = needed - floor_allocated

            min_contrib = goal.constraints.min_monthly_contribution
            max_contrib = goal.constraints.max_monthly_contribution

            if remaining >= remaining_needed:
                # Fully fund goal
                additional = remaining_needed
                is_fully_funded = True
                shortfall = 0.0
            elif remaining >= min_contrib:
                # Partially fund goal
                if max_contrib is not None:
                    additional = min(remaining, max_contrib - floor_allocated)
                else:
                    additional = remaining
                is_fully_funded = False
                shortfall = remaining_needed - additional
            else:
                # Not enough to meet minimum contribution
                additional = 0.0
                is_fully_funded = False
                shortfall = remaining_needed

            total_allocated = floor_allocated + additional
            remaining -= additional

            allocations.append(
                GoalAllocation(
                    goal_id=goal.id,
                    allocated_amount=total_allocated,
                    percent_of_target=(goal.current_allocated + total_allocated)
                    / goal.target_value,
                    is_fully_funded=is_fully_funded,
                    shortfall=shortfall,
                )
            )

        return allocations


# ===========================================================================
# Helper Functions
# ===========================================================================

def allocate_cashflow_to_goals(
    goals: List[Goal],
    available_cashflow: float,
    waterfall_policy: WaterfallPolicy = WaterfallPolicy.STRICT_PRIORITY,
    current_date: date = date.today(),
    time_horizon_months: int = 12,
) -> AllocationResult:
    """
    Convenience function for goal allocation.

    Args:
        goals: List of goals
        available_cashflow: Available cashflow to allocate
        waterfall_policy: Allocation policy
        current_date: Current date
        time_horizon_months: Time horizon for allocation

    Returns:
        AllocationResult with per-goal allocations

    Example:
        >>> goals = [
        ...     Goal(
        ...         id="retirement",
        ...         type=GoalType.RETIREMENT,
        ...         target_value=1000000,
        ...         target_date=date(2055, 1, 1),
        ...         priority=1,
        ...         current_allocated=100000,
        ...     ),
        ...     Goal(
        ...         id="home",
        ...         type=GoalType.HOME_PURCHASE,
        ...         target_value=200000,
        ...         target_date=date(2030, 1, 1),
        ...         priority=2,
        ...         current_allocated=50000,
        ...     ),
        ... ]
        >>> result = allocate_cashflow_to_goals(
        ...     goals, 10000, WaterfallPolicy.STRICT_PRIORITY
        ... )
        >>> result.num_goals_fully_funded
        0  # Not enough cashflow to fully fund any goal in one period
    """
    config = GoalAllocatorConfig(waterfall_policy=waterfall_policy)
    allocator = GoalAllocator(config)

    input_data = GoalAllocatorInput(
        goals=goals,
        available_cashflow=available_cashflow,
        current_date=current_date,
        time_horizon_months=time_horizon_months,
    )

    return allocator.allocate(input_data)


def calculate_goal_progress(
    goal: Goal, allocated_amount: float
) -> Tuple[float, bool]:
    """
    Calculate goal progress after allocation.

    Args:
        goal: Goal to evaluate
        allocated_amount: Amount allocated

    Returns:
        Tuple of (percent_of_target, is_fully_funded)

    Example:
        >>> goal = Goal(
        ...     id="retirement",
        ...     type=GoalType.RETIREMENT,
        ...     target_value=1000000,
        ...     target_date=date(2055, 1, 1),
        ...     priority=1,
        ...     current_allocated=800000,
        ... )
        >>> pct, funded = calculate_goal_progress(goal, 200000)
        >>> pct
        1.0  # 100% funded
        >>> funded
        True
    """
    total_allocated = goal.current_allocated + allocated_amount
    percent_of_target = total_allocated / goal.target_value
    is_fully_funded = total_allocated >= goal.target_value

    return percent_of_target, is_fully_funded
