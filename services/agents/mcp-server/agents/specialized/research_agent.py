"""Research Agent - Information Gathering Specialist"""

from typing import Dict, Any
import structlog

from ..base.agent import BaseAgent, AgentConfig, AgentCapability
from ..base.message import TaskRequest, TaskResponse

logger = structlog.get_logger(__name__)


class ResearchAgent(BaseAgent):
    """
    Specialized agent for information gathering and research.

    Capabilities:
    - Search knowledge graph for relevant entities
    - Perform semantic search across vector store
    - Hybrid search combining graph + vector
    - Retrieve related memories
    - Gather entity context and relationships

    Usage:
        agent = ResearchAgent(config, message_bus, plugin_manager)
        await agent.start()

        # Agent will handle research tasks automatically via message bus
    """

    def __init__(self, message_bus, plugin_manager):
        config = AgentConfig(
            name="Research Agent",
            description="Gathers information from knowledge graph, vector store, and memory",
            capabilities=[
                AgentCapability.RESEARCH,
                AgentCapability.SEARCH,
                AgentCapability.MEMORY,
            ],
            max_concurrent_tasks=10,
        )

        super().__init__(
            config=config,
            message_bus=message_bus,
            plugin_manager=plugin_manager
        )

    async def initialize(self) -> None:
        """Initialize the research agent"""
        await super().initialize()

        logger.info(
            "research_agent_initialized",
            agent_id=self.agent_id,
            capabilities=[c.value for c in self.config.capabilities]
        )

    async def handle_task(self, task: TaskRequest) -> TaskResponse:
        """
        Handle research tasks.

        Supported task types:
        - search: Search for information
        - research: Deep research on a topic
        - gather_context: Gather context about an entity
        - find_related: Find related information
        """
        logger.info(
            "research_task_received",
            task_id=task.task_id,
            task_type=task.task_type,
            query=task.parameters.get("query", "")[:100]
        )

        try:
            if task.task_type == "search":
                result = await self._handle_search(task)
            elif task.task_type == "research":
                result = await self._handle_research(task)
            elif task.task_type == "gather_context":
                result = await self._handle_gather_context(task)
            elif task.task_type == "find_related":
                result = await self._handle_find_related(task)
            else:
                return TaskResponse(
                    task_id=task.task_id,
                    status="failed",
                    error=f"Unknown task type: {task.task_type}"
                )

            return TaskResponse(
                task_id=task.task_id,
                status="success",
                result=result
            )

        except Exception as e:
            logger.error(
                "research_task_failed",
                task_id=task.task_id,
                error=str(e),
                exc_info=True
            )

            return TaskResponse(
                task_id=task.task_id,
                status="failed",
                error=str(e)
            )

    async def _handle_search(self, task: TaskRequest) -> Dict[str, Any]:
        """Handle search task"""
        query = task.parameters.get("query")
        search_type = task.parameters.get("type", "hybrid")  # graph, semantic, hybrid
        user_id = task.context.get("user_id")

        if not query:
            raise ValueError("Query is required for search task")

        # Perform search based on type
        if search_type == "graph":
            results = await self.use_tool(
                tool_name="query_knowledge_graph",
                parameters={"query": query, "limit": 10},
                user_id=user_id
            )
        elif search_type == "semantic":
            results = await self.use_tool(
                tool_name="search_semantic",
                parameters={"query": query, "limit": 10},
                user_id=user_id
            )
        else:  # hybrid
            results = await self.use_tool(
                tool_name="hybrid_search",
                parameters={"query": query, "max_results": 10},
                user_id=user_id
            )

        return {
            "query": query,
            "search_type": search_type,
            "results": results,
            "count": len(results) if isinstance(results, list) else 1
        }

    async def _handle_research(self, task: TaskRequest) -> Dict[str, Any]:
        """Handle deep research task"""
        topic = task.parameters.get("topic") or task.parameters.get("query")
        user_id = task.context.get("user_id")

        if not topic:
            raise ValueError("Topic is required for research task")

        logger.info("conducting_research", topic=topic[:100])

        # Step 1: Hybrid search for initial information
        search_results = await self.use_tool(
            tool_name="hybrid_search",
            parameters={"query": topic, "max_results": 15},
            user_id=user_id
        )

        # Step 2: Recall relevant memories
        memory_results = await self.recall_memory(
            query=topic,
            user_id=user_id,
            memory_types=["long_term", "episodic"]
        )

        # Step 3: Extract entities from search results and get their context
        entities = []
        if isinstance(search_results, list):
            for result in search_results[:5]:  # Top 5 results
                entity_name = result.get("entity", {}).get("name") if isinstance(result.get("entity"), dict) else None
                if entity_name:
                    entity_context = await self.use_tool(
                        tool_name="get_entity_context",
                        parameters={"entity_name": entity_name, "depth": 2},
                        user_id=user_id
                    )
                    entities.append(entity_context)

        # Step 4: Get recommendations for further research
        recommendations = await self.use_tool(
            tool_name="get_recommendations",
            parameters={"entity_name": topic, "limit": 5},
            user_id=user_id
        )

        # Compile research results
        research_data = {
            "topic": topic,
            "search_results": search_results,
            "memories": memory_results,
            "entity_context": entities,
            "recommendations": recommendations,
            "summary": self._summarize_research(
                search_results,
                memory_results,
                entities
            )
        }

        # Store research in memory for future reference
        await self.store_memory(
            content=f"Conducted research on: {topic}",
            memory_type="episodic",
            user_id=user_id,
            metadata={
                "type": "research",
                "topic": topic,
                "timestamp": task.context.get("timestamp"),
            }
        )

        return research_data

    async def _handle_gather_context(self, task: TaskRequest) -> Dict[str, Any]:
        """Gather comprehensive context about an entity"""
        entity_name = task.parameters.get("entity_name")
        depth = task.parameters.get("depth", 2)
        user_id = task.context.get("user_id")

        if not entity_name:
            raise ValueError("Entity name is required")

        # Get entity context with relationships
        context = await self.use_tool(
            tool_name="get_entity_context",
            parameters={"entity_name": entity_name, "depth": depth},
            user_id=user_id
        )

        # Get related memories about this entity
        memories = await self.recall_memory(
            query=entity_name,
            user_id=user_id
        )

        return {
            "entity": entity_name,
            "context": context,
            "memories": memories,
        }

    async def _handle_find_related(self, task: TaskRequest) -> Dict[str, Any]:
        """Find information related to a topic or entity"""
        query = task.parameters.get("query")
        entity_name = task.parameters.get("entity_name")
        user_id = task.context.get("user_id")

        target = entity_name or query
        if not target:
            raise ValueError("Query or entity_name is required")

        # Find recommendations
        recommendations = await self.use_tool(
            tool_name="get_recommendations",
            parameters={"entity_name": target, "limit": 10},
            user_id=user_id
        )

        # Search for related content
        related_search = await self.use_tool(
            tool_name="hybrid_search",
            parameters={"query": target, "max_results": 10},
            user_id=user_id
        )

        return {
            "target": target,
            "recommendations": recommendations,
            "related_content": related_search,
        }

    def _summarize_research(
        self,
        search_results: Any,
        memories: Any,
        entities: list
    ) -> str:
        """Create a brief summary of research findings"""
        summary_parts = []

        if isinstance(search_results, list) and search_results:
            summary_parts.append(f"Found {len(search_results)} relevant results")

        if isinstance(memories, dict):
            total_memories = sum(
                len(v) if isinstance(v, list) else 0
                for v in memories.values()
            )
            if total_memories > 0:
                summary_parts.append(f"Retrieved {total_memories} related memories")

        if entities:
            summary_parts.append(f"Gathered context for {len(entities)} entities")

        if summary_parts:
            return ". ".join(summary_parts) + "."
        else:
            return "Research completed with limited results."
