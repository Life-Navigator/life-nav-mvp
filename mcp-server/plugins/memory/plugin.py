"""Memory Plugin - 4-Tier Memory Management System"""

import time
from typing import Dict, List, Any, Optional
import structlog

from ..base import BasePlugin, PluginMetadata, PluginStatus
from ...utils.database import DatabaseManager
from .memory_manager import (
    ShortTermMemory,
    WorkingMemory,
    LongTermMemory,
    EpisodicMemory,
    MemoryConsolidation,
)

logger = structlog.get_logger(__name__)


class MemoryPlugin(BasePlugin):
    """
    4-Tier Memory System for Life Navigator

    Memory Hierarchy:
    1. Short-Term Memory (Redis, 1 hour TTL)
       - Recent conversation turns
       - Temporary context
       - Fast access, volatile

    2. Working Memory (Redis, session-based)
       - Active conversation state
       - Current task context
       - Session entities and facts
       - Cleared on session end

    3. Long-Term Memory (PostgreSQL)
       - User profiles
       - Preferences and settings
       - Historical conversations
       - Persistent facts
       - Durable storage

    4. Episodic & Semantic Memory (Neo4j)
       - Episodic: Autobiographical events with temporal context
       - Semantic: Abstract facts and knowledge
       - Connected to knowledge graph
       - Rich relational context

    Features:
    - Automatic memory consolidation (short → long term)
    - Intelligent forgetting (relevance-based decay)
    - Memory search and retrieval
    - Context-aware memory activation
    - Multi-user isolation with RLS

    Tools provided:
    - store_memory: Store information in memory
    - recall_memory: Retrieve relevant memories
    - forget_memory: Explicitly forget information
    - get_conversation_summary: Summarize conversation
    - get_user_profile: Get user context
    - update_user_profile: Update user information
    """

    def __init__(self, db_manager: DatabaseManager):
        super().__init__(
            metadata=PluginMetadata(
                name="memory",
                version="1.0.0",
                description="4-tier memory system with automatic consolidation",
                author="Life Navigator",
                priority=90,  # High priority, after GraphRAG
                tags=["memory", "context", "conversation", "user-profile"]
            )
        )
        self.db = db_manager
        self.short_term: Optional[ShortTermMemory] = None
        self.working: Optional[WorkingMemory] = None
        self.long_term: Optional[LongTermMemory] = None
        self.episodic: Optional[EpisodicMemory] = None
        self.consolidation: Optional[MemoryConsolidation] = None

    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize memory system"""
        logger.info("initializing_memory_plugin", config=config)

        self.config = config

        try:
            # Initialize memory tiers
            self.short_term = ShortTermMemory(
                redis_pool=self.db.redis,
                ttl=config.get("short_term_ttl", 3600)  # 1 hour
            )

            self.working = WorkingMemory(
                redis_pool=self.db.redis,
                max_size=config.get("working_memory_size", 50)
            )

            self.long_term = LongTermMemory(
                postgres_pool=self.db.postgres
            )
            await self.long_term.initialize()

            self.episodic = EpisodicMemory(
                neo4j_driver=self.db.neo4j
            )
            await self.episodic.initialize()

            # Initialize memory consolidation
            self.consolidation = MemoryConsolidation(
                short_term=self.short_term,
                working=self.working,
                long_term=self.long_term,
                episodic=self.episodic
            )

            self.set_status(PluginStatus.READY)
            logger.info("memory_plugin_initialized")

        except Exception as e:
            self.set_status(PluginStatus.ERROR, str(e))
            logger.error(
                "memory_initialization_failed",
                error=str(e),
                exc_info=True
            )
            raise

    async def get_context(
        self,
        query: str,
        user_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get memory context for a query.

        Retrieves relevant memories from all tiers:
        - Recent conversation (short-term)
        - Active session context (working)
        - User profile and history (long-term)
        - Related episodes (episodic)

        Args:
            query: User query
            user_id: User identifier
            **kwargs: Additional parameters

        Returns:
            Memory context including conversation history, user profile, episodes
        """
        start_time = time.time()

        try:
            conversation_id = kwargs.get("conversation_id")

            # Get memories from all tiers in parallel
            import asyncio

            short_term_task = self.short_term.get_recent(
                user_id=user_id,
                conversation_id=conversation_id,
                limit=10
            )

            working_task = self.working.get_active_context(
                user_id=user_id,
                conversation_id=conversation_id
            )

            long_term_task = self.long_term.get_user_profile(user_id)

            episodic_task = self.episodic.search_episodes(
                user_id=user_id,
                query=query,
                limit=5
            )

            results = await asyncio.gather(
                short_term_task,
                working_task,
                long_term_task,
                episodic_task,
                return_exceptions=True
            )

            short_term_mem, working_mem, user_profile, episodes = results

            # Handle errors gracefully
            if isinstance(short_term_mem, Exception):
                logger.error("short_term_memory_failed", error=str(short_term_mem))
                short_term_mem = []

            if isinstance(working_mem, Exception):
                logger.error("working_memory_failed", error=str(working_mem))
                working_mem = {}

            if isinstance(user_profile, Exception):
                logger.error("user_profile_failed", error=str(user_profile))
                user_profile = {}

            if isinstance(episodes, Exception):
                logger.error("episodic_memory_failed", error=str(episodes))
                episodes = []

            # Build context
            context = {
                "conversation_history": short_term_mem,
                "active_context": working_mem,
                "user_profile": user_profile,
                "related_episodes": episodes,
            }

            # Calculate relevance
            relevance_score = self._calculate_relevance(context)

            # Estimate tokens
            tokens = self._estimate_tokens(context)

            latency_ms = (time.time() - start_time) * 1000

            return {
                "data": context,
                "metadata": {
                    "source": "memory",
                    "relevance_score": relevance_score,
                    "tokens": tokens,
                    "latency_ms": latency_ms,
                    "memory_tiers": {
                        "short_term": len(short_term_mem),
                        "working": len(working_mem),
                        "long_term": 1 if user_profile else 0,
                        "episodic": len(episodes)
                    }
                }
            }

        except Exception as e:
            logger.error(
                "memory_context_failed",
                query=query[:100],
                error=str(e),
                exc_info=True
            )
            raise

    def get_tools(self) -> List[Any]:
        """Register memory tools"""
        from ...tools.base import Tool

        return [
            Tool(
                name="store_memory",
                description="Store information in memory system. Automatically selects appropriate memory tier.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": "string",
                            "description": "Information to store"
                        },
                        "memory_type": {
                            "type": "string",
                            "enum": ["short_term", "working", "long_term", "episodic"],
                            "description": "Memory tier (auto-selected if not specified)"
                        },
                        "metadata": {
                            "type": "object",
                            "description": "Additional metadata"
                        },
                        "conversation_id": {
                            "type": "string",
                            "description": "Conversation identifier"
                        }
                    },
                    "required": ["content"]
                },
                handler=self._tool_store_memory
            ),
            Tool(
                name="recall_memory",
                description="Retrieve relevant memories based on query.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "What to recall"
                        },
                        "memory_types": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Memory tiers to search (default: all)"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum results",
                            "default": 10
                        }
                    },
                    "required": ["query"]
                },
                handler=self._tool_recall_memory
            ),
            Tool(
                name="forget_memory",
                description="Explicitly forget information from memory.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "memory_id": {
                            "type": "string",
                            "description": "Memory identifier to forget"
                        },
                        "memory_type": {
                            "type": "string",
                            "description": "Memory tier"
                        }
                    },
                    "required": ["memory_id", "memory_type"]
                },
                handler=self._tool_forget_memory
            ),
            Tool(
                name="get_conversation_summary",
                description="Get summary of conversation history.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "conversation_id": {
                            "type": "string",
                            "description": "Conversation identifier"
                        },
                        "max_turns": {
                            "type": "integer",
                            "description": "Maximum turns to summarize",
                            "default": 50
                        }
                    },
                    "required": ["conversation_id"]
                },
                handler=self._tool_get_conversation_summary
            ),
            Tool(
                name="get_user_profile",
                description="Get user profile and preferences.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "include_history": {
                            "type": "boolean",
                            "description": "Include conversation history",
                            "default": False
                        }
                    }
                },
                handler=self._tool_get_user_profile
            ),
            Tool(
                name="update_user_profile",
                description="Update user profile information.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "profile_updates": {
                            "type": "object",
                            "description": "Profile fields to update"
                        }
                    },
                    "required": ["profile_updates"]
                },
                handler=self._tool_update_user_profile
            ),
            Tool(
                name="consolidate_memory",
                description="Manually trigger memory consolidation (short → long term).",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "conversation_id": {
                            "type": "string",
                            "description": "Conversation to consolidate"
                        }
                    }
                },
                handler=self._tool_consolidate_memory
            ),
        ]

    async def on_tool_invocation(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        user_id: str
    ) -> Any:
        """Handle tool invocation"""
        tools = {tool.name: tool for tool in self.get_tools()}

        if tool_name not in tools:
            raise ValueError(f"Tool '{tool_name}' not found")

        tool = tools[tool_name]
        parameters["user_id"] = user_id

        return await tool.handler(**parameters)

    # Tool handlers
    async def _tool_store_memory(
        self,
        content: str,
        memory_type: Optional[str] = None,
        metadata: Optional[Dict] = None,
        conversation_id: Optional[str] = None,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Store memory"""
        # Auto-select memory tier if not specified
        if not memory_type:
            memory_type = self._select_memory_tier(content, metadata)

        if memory_type == "short_term":
            await self.short_term.store(
                user_id=user_id,
                conversation_id=conversation_id,
                content=content,
                metadata=metadata or {}
            )
        elif memory_type == "working":
            await self.working.store(
                user_id=user_id,
                conversation_id=conversation_id,
                key=metadata.get("key", "context") if metadata else "context",
                value=content
            )
        elif memory_type == "long_term":
            await self.long_term.store(
                user_id=user_id,
                content=content,
                metadata=metadata or {}
            )
        elif memory_type == "episodic":
            await self.episodic.store_episode(
                user_id=user_id,
                content=content,
                metadata=metadata or {}
            )

        return {
            "success": True,
            "memory_type": memory_type,
            "message": f"Stored in {memory_type} memory"
        }

    async def _tool_recall_memory(
        self,
        query: str,
        memory_types: Optional[List[str]] = None,
        limit: int = 10,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Recall memories"""
        if not memory_types:
            memory_types = ["short_term", "working", "long_term", "episodic"]

        memories = {}

        if "short_term" in memory_types:
            memories["short_term"] = await self.short_term.search(
                user_id=user_id,
                query=query,
                limit=limit
            )

        if "working" in memory_types:
            memories["working"] = await self.working.get_all(user_id=user_id)

        if "long_term" in memory_types:
            memories["long_term"] = await self.long_term.search(
                user_id=user_id,
                query=query,
                limit=limit
            )

        if "episodic" in memory_types:
            memories["episodic"] = await self.episodic.search_episodes(
                user_id=user_id,
                query=query,
                limit=limit
            )

        return memories

    async def _tool_forget_memory(
        self,
        memory_id: str,
        memory_type: str,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Forget memory"""
        if memory_type == "short_term":
            await self.short_term.delete(user_id=user_id, memory_id=memory_id)
        elif memory_type == "long_term":
            await self.long_term.delete(user_id=user_id, memory_id=memory_id)
        elif memory_type == "episodic":
            await self.episodic.delete_episode(user_id=user_id, episode_id=memory_id)

        return {"success": True, "message": "Memory forgotten"}

    async def _tool_get_conversation_summary(
        self,
        conversation_id: str,
        max_turns: int = 50,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Get conversation summary"""
        # Get conversation history
        history = await self.short_term.get_recent(
            user_id=user_id,
            conversation_id=conversation_id,
            limit=max_turns
        )

        # TODO: Generate summary using Maverick
        # For now, return history
        return {
            "conversation_id": conversation_id,
            "turns": len(history),
            "history": history,
            "summary": "Conversation summary (to be generated)"
        }

    async def _tool_get_user_profile(
        self,
        include_history: bool = False,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Get user profile"""
        profile = await self.long_term.get_user_profile(user_id)

        if include_history:
            profile["conversation_history"] = await self.long_term.get_conversation_history(
                user_id=user_id,
                limit=10
            )

        return profile

    async def _tool_update_user_profile(
        self,
        profile_updates: Dict[str, Any],
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Update user profile"""
        await self.long_term.update_user_profile(
            user_id=user_id,
            updates=profile_updates
        )

        return {"success": True, "message": "Profile updated"}

    async def _tool_consolidate_memory(
        self,
        conversation_id: Optional[str] = None,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Consolidate memory"""
        result = await self.consolidation.consolidate(
            user_id=user_id,
            conversation_id=conversation_id
        )

        return result

    async def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("cleaning_up_memory_plugin")

    def _calculate_relevance(self, context: Dict) -> float:
        """Calculate relevance score"""
        score = 0.0

        if context.get("conversation_history"):
            score += 0.3

        if context.get("active_context"):
            score += 0.3

        if context.get("user_profile"):
            score += 0.2

        if context.get("related_episodes"):
            score += 0.2

        return score

    def _estimate_tokens(self, context: Dict) -> int:
        """Estimate token count"""
        import json
        context_str = json.dumps(context)
        return len(context_str) // 4

    def _select_memory_tier(
        self,
        content: str,
        metadata: Optional[Dict]
    ) -> str:
        """Auto-select appropriate memory tier"""
        # Simple heuristic
        # TODO: More sophisticated selection based on content analysis

        if metadata and metadata.get("importance") == "high":
            return "long_term"

        if metadata and metadata.get("type") == "episode":
            return "episodic"

        if len(content) < 100:
            return "short_term"

        return "working"
