"""Context Builder - Aggregates context from multiple sources"""

import time
from typing import Dict, List, Optional, Any
import structlog

from .plugin_manager import PluginManager
from ..utils.database import DatabaseManager

logger = structlog.get_logger(__name__)


class ContextBuilder:
    """
    Builds optimal context for LLM prompts by aggregating from multiple sources.

    Context sources:
    1. Conversational: Recent chat history
    2. Semantic: Vector search results from documents
    3. Graph: Knowledge graph traversal
    4. Temporal: Time-based events and patterns
    5. User Profile: User preferences and history

    The context builder:
    - Queries all relevant plugins
    - Ranks results by relevance
    - Manages token budget
    - Formats context for LLM consumption
    """

    def __init__(
        self,
        plugin_manager: PluginManager,
        db_manager: DatabaseManager
    ):
        self.plugin_manager = plugin_manager
        self.db = db_manager

    async def build_context(
        self,
        query: str,
        user_id: str,
        conversation_id: Optional[str] = None,
        context_types: Optional[List[str]] = None,
        max_tokens: int = 4000,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Build aggregated context for a query.

        Args:
            query: User query or prompt
            user_id: User identifier
            conversation_id: Conversation identifier
            context_types: Types of context to include (None = all)
            max_tokens: Maximum tokens for context
            filters: Additional filters

        Returns:
            Dictionary with aggregated context:
            {
                "context": {...},  # Context data by type
                "sources": [...],  # Source plugins
                "tokens_used": int,
                "latency_ms": float
            }
        """
        start_time = time.time()

        logger.info(
            "building_context",
            user_id=user_id,
            query_length=len(query),
            context_types=context_types,
            max_tokens=max_tokens
        )

        try:
            # Get aggregated context from plugins
            plugin_context = await self.plugin_manager.get_aggregated_context(
                query=query,
                user_id=user_id,
                context_types=context_types,
                conversation_id=conversation_id,
                **(filters or {})
            )

            # Rank and filter context
            ranked_context = await self._rank_and_filter(
                plugin_context["context"],
                max_tokens=max_tokens
            )

            # Calculate tokens
            tokens_used = self._estimate_tokens(ranked_context)

            latency_ms = (time.time() - start_time) * 1000

            result = {
                "context": ranked_context,
                "sources": plugin_context["metadata"]["sources"],
                "tokens_used": tokens_used,
                "latency_ms": latency_ms,
            }

            logger.info(
                "context_built",
                sources_count=len(result["sources"]),
                tokens_used=tokens_used,
                latency_ms=latency_ms
            )

            return result

        except Exception as e:
            logger.error(
                "context_building_failed",
                error=str(e),
                exc_info=True
            )
            raise

    async def _rank_and_filter(
        self,
        context: Dict[str, Any],
        max_tokens: int
    ) -> Dict[str, Any]:
        """
        Rank and filter context items by relevance.

        Args:
            context: Raw context from plugins
            max_tokens: Maximum tokens

        Returns:
            Filtered and ranked context
        """
        # For now, just return as-is
        # TODO: Implement relevance ranking
        # - Score each context item
        # - Sort by relevance
        # - Truncate to fit token budget
        return context

    def _estimate_tokens(self, context: Dict[str, Any]) -> int:
        """
        Estimate token count for context.

        Simple heuristic: 1 token ≈ 4 characters

        Args:
            context: Context data

        Returns:
            Estimated token count
        """
        import json
        context_str = json.dumps(context)
        return len(context_str) // 4

    async def add_context_enrichment(
        self,
        context: Dict[str, Any],
        enrichment_type: str,
        data: Any
    ) -> Dict[str, Any]:
        """
        Add additional enrichment to context.

        Args:
            context: Existing context
            enrichment_type: Type of enrichment
            data: Enrichment data

        Returns:
            Enriched context
        """
        if "enrichments" not in context:
            context["enrichments"] = {}

        context["enrichments"][enrichment_type] = data
        return context

    async def merge_contexts(
        self,
        contexts: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Merge multiple context dictionaries.

        Args:
            contexts: List of context dictionaries

        Returns:
            Merged context
        """
        merged = {}

        for context in contexts:
            for key, value in context.items():
                if key not in merged:
                    merged[key] = value
                elif isinstance(value, list):
                    merged[key].extend(value)
                elif isinstance(value, dict):
                    merged[key].update(value)

        return merged

    def format_for_llm(
        self,
        context: Dict[str, Any],
        template: Optional[str] = None
    ) -> str:
        """
        Format context for LLM consumption.

        Args:
            context: Context data
            template: Optional formatting template

        Returns:
            Formatted context string
        """
        # Default formatting
        if not template:
            return self._default_format(context)

        # TODO: Implement template-based formatting
        return template.format(**context)

    def _default_format(self, context: Dict[str, Any]) -> str:
        """Default context formatting"""
        import json
        return json.dumps(context, indent=2)
