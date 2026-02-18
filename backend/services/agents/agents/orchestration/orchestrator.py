"""
Orchestrator: L0 Top-Level Agent

Provides LLM-powered intent analysis, task decomposition, domain routing,
and result synthesis. The root of the agent hierarchy.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
import asyncio
import json

from agents.core.base_agent import BaseAgent
from models.agent_models import (
    AgentTask,
    AgentType,
    AgentCapability,
)
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class Orchestrator(BaseAgent):
    """
    L0 Orchestrator - Root agent for intent analysis and domain routing.

    Responsibilities:
    - Analyze user intent using LLM
    - Decompose complex tasks into subtasks
    - Route tasks to appropriate domain managers (Finance, Career, etc.)
    - Synthesize results into natural language responses
    - Coordinate multi-domain workflows

    Intent Categories:
    Finance:
    - budget_analysis: Budget and spending analysis
    - savings_planning: Savings goals and emergency funds
    - investment_advice: Investment and portfolio management
    - tax_planning: Tax estimation and optimization
    - debt_management: Debt payoff and refinancing

    Career:
    - job_search: Career opportunities and job searching
    - resume_optimization: Resume review and ATS optimization
    - interview_prep: Interview preparation and practice

    General:
    - general_inquiry: General questions and information
    """

    # Domain routing table
    DOMAIN_ROUTING = {
        # Finance intents
        "budget_analysis": "finance",
        "spending_analysis": "finance",
        "cashflow_forecast": "finance",
        "savings_planning": "finance",
        "goal_tracking": "finance",
        "emergency_fund": "finance",
        "investment_advice": "finance",
        "portfolio_analysis": "finance",
        "rebalancing": "finance",
        "tax_planning": "finance",
        "tax_optimization": "finance",
        "tax_estimation": "finance",
        "debt_management": "finance",
        "debt_payoff": "finance",
        "refinancing": "finance",

        # Career intents
        "job_search": "career",
        "job_matching": "career",
        "application_tracking": "career",
        "resume_optimization": "career",
        "resume_review": "career",
        "ats_scoring": "career",
        "interview_prep": "career",

        # General
        "general_inquiry": "general",
    }

    # Intent patterns for rule-based fallback
    INTENT_PATTERNS = {
        # Finance patterns
        "budget_analysis": ["budget", "spend", "expense", "money", "cost"],
        "savings_planning": ["saving", "save", "goal", "emergency fund", "rainy day"],
        "investment_advice": ["invest", "stock", "portfolio", "dividend", "bonds", "asset", "rebalance"],
        "tax_planning": ["tax", "deduction", "irs", "filing", "refund", "bracket"],
        "debt_management": ["debt", "loan", "credit", "payoff", "refinanc", "consolidat"],

        # Career patterns
        "job_search": ["job", "career", "work", "employment", "hiring", "position", "opportunity"],
        "resume_optimization": ["resume", "cv", "ats", "application", "cover letter"],
        "interview_prep": ["interview", "preparation", "practice", "questions"],
    }

    def __init__(
        self,
        agent_id: str = "orchestrator",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize Orchestrator agent."""

        capabilities = [
            AgentCapability(
                name="intent_analysis",
                description="Analyze user intent using LLM",
                confidence=0.95,
            ),
            AgentCapability(
                name="task_decomposition",
                description="Decompose complex tasks into subtasks",
                confidence=0.90,
            ),
            AgentCapability(
                name="domain_routing",
                description="Route tasks to appropriate domain managers",
                confidence=0.95,
            ),
            AgentCapability(
                name="result_synthesis",
                description="Synthesize results into natural language",
                confidence=0.90,
            ),
        ]

        super().__init__(
            agent_id=agent_id,
            agent_type=AgentType.ORCHESTRATOR,
            capabilities=capabilities,
            message_bus=message_bus,
            graphrag_client=graphrag_client,
            vllm_client=vllm_client,
            config=config or {},
        )

        self.logger = get_logger(f"agent.{agent_id}")
        self._pending_tasks: Dict[str, asyncio.Future] = {}

    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """
        Handle user request by analyzing intent and routing to domain.

        Process:
        1. Analyze intent using LLM
        2. Determine target domain
        3. Create subtask for domain manager
        4. Route and wait for result
        5. Synthesize final response

        Args:
            task: AgentTask with user query in payload

        Returns:
            Dict with synthesized response and routing metadata

        Raises:
            TaskExecutionError: If orchestration fails
        """
        try:
            user_id = task.metadata.user_id
            user_query = task.payload.get("query", task.payload.get("description", ""))

            self.logger.info(f"Orchestrating request for user {user_id}: {user_query[:100]}")

            # Step 1: Analyze intent
            intent = await self._analyze_intent(user_query)
            self.logger.info(f"Detected intent: {intent}")

            # Step 2: Map intent to domain and specialist
            domain = self.DOMAIN_ROUTING.get(intent, "finance")
            specialist = self._map_intent_to_specialist(intent)

            # Step 3: Create subtask
            subtask_type = self._intent_to_task_type(intent)

            # Step 4: Route to domain manager
            result = await self._route_to_domain(
                domain=domain,
                task_type=subtask_type,
                user_id=user_id,
                payload=task.payload,
                original_task=task,
            )

            # Step 5: Synthesize natural language response
            synthesis = await self._synthesize_response(
                intent=intent,
                result=result,
                original_query=user_query,
            )

            return {
                "status": "success",
                "intent": intent,
                "domain": domain,
                "specialist": specialist,
                "data": result,
                "synthesis": synthesis,
                "orchestrator_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Orchestration failed: {e}", error=e)
            raise TaskExecutionError(f"Orchestration failed: {str(e)}")

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle orchestrator-level queries.

        Supported queries:
        - get_available_domains: List available domains
        - get_domain_routing: Get domain routing table

        Args:
            query: Query dict with query_type and parameters

        Returns:
            Dict with query results
        """
        try:
            query_type = query.get("query_type")

            if query_type == "get_available_domains":
                return {
                    "domains": list(set(self.DOMAIN_ROUTING.values())),
                    "intents": list(self.DOMAIN_ROUTING.keys()),
                }
            elif query_type == "get_domain_routing":
                return {
                    "routing_table": self.DOMAIN_ROUTING,
                }
            else:
                return {"status": "error", "message": f"Unknown query type: {query_type}"}

        except Exception as e:
            self.logger.error(f"Query execution failed: {e}", error=e)
            return {"status": "error", "message": str(e)}

    # ========== Intent Analysis ==========

    async def _analyze_intent(self, user_query: str) -> str:
        """
        Analyze user intent using LLM with rule-based fallback.

        Args:
            user_query: User's natural language query

        Returns:
            Intent classification (e.g., 'budget_analysis', 'job_search')
        """
        # Try LLM-based intent classification
        if self.vllm:
            try:
                intent = await self._analyze_intent_llm(user_query)
                if intent in self.DOMAIN_ROUTING:
                    return intent
                self.logger.warning(f"LLM returned invalid intent: {intent}, falling back to rules")
            except Exception as e:
                self.logger.warning(f"LLM intent analysis failed: {e}, falling back to rules")

        # Fallback to rule-based intent detection
        return self._analyze_intent_rules(user_query)

    async def _analyze_intent_llm(self, user_query: str) -> str:
        """
        Use LLM to classify user intent.

        Args:
            user_query: User's query

        Returns:
            Intent classification
        """
        system_prompt = """You are an intent classification expert for a personal life assistant.
Analyze the user query and classify it into ONE of these intents:

FINANCE:
- budget_analysis: Budgeting, spending tracking, expense analysis
- savings_planning: Savings goals, emergency fund, savings strategy
- investment_advice: Investing, stocks, portfolios, asset allocation, rebalancing
- tax_planning: Tax estimation, deductions, tax optimization, filing
- debt_management: Debt payoff, loan refinancing, credit optimization

CAREER:
- job_search: Job hunting, application tracking, market analysis
- resume_optimization: Resume review, ATS scoring, keyword optimization
- interview_prep: Interview preparation, practice questions

GENERAL:
- general_inquiry: General questions, information requests

Respond with ONLY the intent name, nothing else."""

        user_prompt = f"""User query: "{user_query}"

Intent:"""

        try:
            response = await self.vllm.chat(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.1,  # Low temperature for classification
                max_tokens=20,
            )

            # Extract intent from response
            intent = response.strip().lower().replace("-", "_")

            # Validate intent
            valid_intents = list(self.DOMAIN_ROUTING.keys())
            if intent not in valid_intents:
                # Try to find best match
                for valid_intent in valid_intents:
                    if valid_intent in intent or intent in valid_intent:
                        return valid_intent

            return intent

        except Exception as e:
            self.logger.error(f"LLM intent analysis error: {e}", error=e)
            raise

    def _analyze_intent_rules(self, user_query: str) -> str:
        """
        Rule-based intent classification fallback.

        Args:
            user_query: User's query

        Returns:
            Intent classification
        """
        query_lower = user_query.lower()

        # Check each intent pattern
        for intent, patterns in self.INTENT_PATTERNS.items():
            if any(pattern in query_lower for pattern in patterns):
                return intent

        # Default to general inquiry
        return "general_inquiry"

    # ========== Domain Routing ==========

    def _map_intent_to_specialist(self, intent: str) -> str:
        """
        Map intent to specific specialist.

        Args:
            intent: Classified intent

        Returns:
            Specialist ID
        """
        specialist_mapping = {
            # Finance specialists
            "budget_analysis": "budget_specialist",
            "spending_analysis": "budget_specialist",
            "cashflow_forecast": "budget_specialist",
            "savings_planning": "savings_specialist",
            "goal_tracking": "savings_specialist",
            "emergency_fund": "savings_specialist",
            "investment_advice": "investment_specialist",
            "portfolio_analysis": "investment_specialist",
            "rebalancing": "investment_specialist",
            "tax_planning": "tax_specialist",
            "tax_optimization": "tax_specialist",
            "tax_estimation": "tax_specialist",
            "debt_management": "debt_specialist",
            "debt_payoff": "debt_specialist",
            "refinancing": "debt_specialist",

            # Career specialists
            "job_search": "job_search_specialist",
            "job_matching": "job_search_specialist",
            "application_tracking": "job_search_specialist",
            "resume_optimization": "resume_specialist",
            "resume_review": "resume_specialist",
            "ats_scoring": "resume_specialist",
            "interview_prep": "job_search_specialist",
        }

        return specialist_mapping.get(intent, "budget_specialist")

    def _intent_to_task_type(self, intent: str) -> str:
        """
        Convert intent to task type for specialist.

        Args:
            intent: Classified intent

        Returns:
            Task type for specialist
        """
        task_type_mapping = {
            # Budget specialist task types
            "budget_analysis": "spending_analysis",
            "spending_analysis": "spending_analysis",
            "cashflow_forecast": "cashflow_forecast",

            # Savings specialist task types
            "savings_planning": "savings_planning",
            "goal_tracking": "goal_tracking",
            "emergency_fund": "emergency_fund",

            # Investment specialist task types
            "investment_advice": "portfolio_analysis",
            "portfolio_analysis": "portfolio_analysis",
            "rebalancing": "rebalancing",

            # Tax specialist task types
            "tax_planning": "tax_planning",
            "tax_optimization": "tax_optimization",
            "tax_estimation": "tax_estimation",

            # Debt specialist task types
            "debt_management": "debt_analysis",
            "debt_payoff": "payoff_strategy",
            "refinancing": "refinancing_analysis",

            # Job search specialist task types
            "job_search": "job_recommendations",
            "job_matching": "job_matching",
            "application_tracking": "application_tracking",
            "interview_prep": "interview_preparation",

            # Resume specialist task types
            "resume_optimization": "resume_analysis",
            "resume_review": "resume_analysis",
            "ats_scoring": "ats_scoring",
        }

        return task_type_mapping.get(intent, intent)

    async def _route_to_domain(
        self,
        domain: str,
        task_type: str,
        user_id: str,
        payload: Dict[str, Any],
        original_task: AgentTask,
    ) -> Dict[str, Any]:
        """
        Route task to domain manager.

        Args:
            domain: Target domain (finance, career, etc.)
            task_type: Specific task type for specialist
            user_id: User ID
            payload: Task payload
            original_task: Original orchestrator task

        Returns:
            Result from domain manager

        Raises:
            TaskExecutionError: If routing fails
        """
        if domain == "general":
            # Handle general inquiries directly
            return await self._handle_general_inquiry(payload)

        # Determine domain manager
        manager_id = f"{domain}_manager"

        if not self.message_bus:
            # No message bus - return mock result
            self.logger.warning("No message bus available, returning mock result")
            return {
                "status": "success",
                "message": f"Task would be routed to {manager_id}",
                "mock": True,
            }

        try:
            # Create subtask for domain manager
            subtask_id = str(uuid4())

            # Prepare task message
            task_message = {
                "task_id": subtask_id,
                "parent_task_id": str(original_task.metadata.task_id),
                "user_id": user_id,
                "task_type": task_type,
                "payload": payload,
                "context": original_task.context,
                "assigned_agent_id": manager_id,
                "priority": original_task.metadata.priority.value,
            }

            # Create future to await result
            result_future = asyncio.Future()
            self._pending_tasks[subtask_id] = result_future

            # Publish to domain manager
            await self.message_bus.publish(
                topic=f"agent.{manager_id}.tasks",
                payload=task_message,
                reliable=True,
            )

            self.logger.info(f"Routed task {subtask_id} to {manager_id}")

            # Wait for result with timeout
            try:
                result = await asyncio.wait_for(result_future, timeout=60.0)
                return result
            except asyncio.TimeoutError:
                raise TaskExecutionError(f"Domain manager {manager_id} timed out")

        except Exception as e:
            self.logger.error(f"Routing to {manager_id} failed: {e}", error=e)
            raise TaskExecutionError(f"Failed to route to domain: {str(e)}")
        finally:
            # Clean up pending task
            self._pending_tasks.pop(subtask_id, None)

    async def _handle_general_inquiry(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle general inquiries that don't need specialist routing.

        Args:
            payload: Query payload

        Returns:
            Response to general inquiry
        """
        query = payload.get("query", "")

        if self.vllm:
            try:
                # Use LLM to answer general questions
                response = await self.vllm.chat(
                    prompt=query,
                    system_prompt="You are a helpful personal assistant. Provide clear, concise answers.",
                    temperature=0.7,
                    max_tokens=300,
                )

                return {
                    "status": "success",
                    "response": response,
                    "query": query,
                }
            except Exception as e:
                self.logger.error(f"LLM general inquiry failed: {e}")

        # Fallback response
        return {
            "status": "success",
            "response": "I can help with financial planning, career guidance, and more. Please ask a specific question.",
            "query": query,
        }

    # ========== Result Synthesis ==========

    async def _synthesize_response(
        self, intent: str, result: Dict[str, Any], original_query: str
    ) -> str:
        """
        Synthesize specialist results into natural language response.

        Args:
            intent: Detected intent
            result: Results from specialist
            original_query: Original user query

        Returns:
            Natural language response
        """
        # If result already has synthesis, return it
        if "synthesis" in result.get("data", {}):
            return result["data"]["synthesis"]

        # Use LLM to synthesize response
        if self.vllm:
            try:
                return await self._synthesize_response_llm(intent, result, original_query)
            except Exception as e:
                self.logger.warning(f"LLM synthesis failed: {e}")

        # Fallback to template-based synthesis
        return self._synthesize_response_template(intent, result)

    async def _synthesize_response_llm(
        self, intent: str, result: Dict[str, Any], original_query: str
    ) -> str:
        """
        Use LLM to synthesize natural language response.

        Args:
            intent: Intent classification
            result: Specialist results
            original_query: Original user query

        Returns:
            Natural language response
        """
        system_prompt = """You are a friendly personal assistant synthesizing analysis results.
Create a natural, conversational response that:
1. Directly answers the user's question
2. Highlights key insights from the analysis
3. Provides actionable recommendations
4. Uses simple, clear language (avoid jargon)
Keep it concise (3-4 sentences)."""

        user_prompt = f"""Original question: "{original_query}"

Intent: {intent}

Analysis results:
{json.dumps(result, indent=2)[:1500]}

Synthesize a friendly, helpful response:"""

        response = await self.vllm.chat(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=300,
        )

        return response.strip()

    def _synthesize_response_template(self, intent: str, result: Dict[str, Any]) -> str:
        """
        Template-based response synthesis fallback.

        Args:
            intent: Intent classification
            result: Specialist results

        Returns:
            Templated response
        """
        # Extract key data
        data = result.get("data", {})

        if intent == "budget_analysis":
            total_spending = data.get("total_spending", 0)
            savings_rate = data.get("savings_rate", 0)
            return f"Your spending analysis is complete. Total spending: ${total_spending:.2f}, Savings rate: {savings_rate*100:.1f}%"

        elif intent == "financial_planning":
            recommendations = data.get("recommendations", [])
            return f"I've generated {len(recommendations)} personalized recommendations for your financial plan."

        else:
            return f"Your {intent.replace('_', ' ')} request has been processed successfully."


# ========== Helper Functions ==========


async def create_agent_hierarchy(
    message_bus=None,
    graphrag_client=None,
    vllm_client=None,
) -> Dict[str, BaseAgent]:
    """
    Factory function to create the full agent hierarchy.

    Returns:
        Dict mapping agent_id to agent instance
    """
    # Import specialists here to avoid circular imports
    from agents.specialists.finance.budget_agent import BudgetSpecialist
    from agents.domain.finance_manager import FinanceManager

    # Create agents
    orchestrator = Orchestrator(
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
    )

    finance_manager = FinanceManager(
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
    )

    budget_specialist = BudgetSpecialist(
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
    )

    agents = {
        "orchestrator": orchestrator,
        "finance_manager": finance_manager,
        "budget_specialist": budget_specialist,
    }

    # Start all agents
    for agent in agents.values():
        await agent.startup()

    return agents


async def shutdown_agent_hierarchy(agents: Dict[str, BaseAgent]) -> None:
    """
    Gracefully shutdown all agents in the hierarchy.

    Args:
        agents: Dict of agents from create_agent_hierarchy()
    """
    for agent in agents.values():
        await agent.shutdown()
