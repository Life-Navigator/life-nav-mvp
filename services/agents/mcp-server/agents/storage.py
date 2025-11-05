"""Agent Storage and Management

Provides database persistence for agent configurations with no-code management.
"""

import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import uuid
import asyncpg
import structlog

from .base.agent import AgentCapability

logger = structlog.get_logger(__name__)


class AgentTemplate:
    """Predefined agent templates for common use cases"""

    @staticmethod
    def get_templates() -> List[Dict[str, Any]]:
        """Get all available agent templates"""
        return [
            {
                "id": "research",
                "name": "Research Agent",
                "description": "Gathers information from knowledge graph, vector store, and memory",
                "icon": "🔍",
                "capabilities": ["research", "search", "memory"],
                "system_prompt": """You are a research specialist. Your role is to:
- Search the knowledge graph for relevant entities and relationships
- Perform semantic searches across the vector store
- Retrieve relevant memories and context
- Synthesize information from multiple sources
- Provide comprehensive, well-sourced answers""",
                "tools": ["query_knowledge_graph", "search_semantic", "hybrid_search", "recall_memory", "get_entity_context"],
                "max_concurrent_tasks": 10,
                "task_timeout_seconds": 300
            },
            {
                "id": "analyst",
                "name": "Analyst Agent",
                "description": "Analyzes data, identifies patterns, and generates insights",
                "icon": "📊",
                "capabilities": ["analysis", "research"],
                "system_prompt": """You are a data analyst. Your role is to:
- Analyze data from various sources
- Identify patterns and trends
- Generate insights and recommendations
- Create visualizations of findings
- Provide evidence-based conclusions""",
                "tools": ["query_knowledge_graph", "search_semantic", "get_entity_context"],
                "max_concurrent_tasks": 5,
                "task_timeout_seconds": 600
            },
            {
                "id": "writer",
                "name": "Writer Agent",
                "description": "Creates and edits content based on research and requirements",
                "icon": "✍️",
                "capabilities": ["writing", "research"],
                "system_prompt": """You are a professional writer. Your role is to:
- Create clear, engaging content
- Adapt writing style to requirements
- Incorporate research and data
- Edit and refine existing content
- Maintain consistent tone and voice""",
                "tools": ["recall_memory", "search_semantic"],
                "max_concurrent_tasks": 3,
                "task_timeout_seconds": 900
            },
            {
                "id": "planner",
                "name": "Planning Agent",
                "description": "Plans tasks, creates workflows, and coordinates execution",
                "icon": "📋",
                "capabilities": ["planning", "coordination"],
                "system_prompt": """You are a strategic planner. Your role is to:
- Break down complex tasks into steps
- Create execution workflows
- Identify required resources
- Coordinate multi-agent collaboration
- Monitor progress and adjust plans""",
                "tools": ["query_knowledge_graph", "recall_memory"],
                "max_concurrent_tasks": 8,
                "task_timeout_seconds": 300
            },
            {
                "id": "executor",
                "name": "Executor Agent",
                "description": "Executes actions, manages tasks, and delivers results",
                "icon": "⚡",
                "capabilities": ["execution", "memory"],
                "system_prompt": """You are an executor. Your role is to:
- Execute assigned tasks efficiently
- Use available tools to complete work
- Handle errors and edge cases
- Report results and status
- Maintain task state and progress""",
                "tools": ["add_entity", "add_relationship", "store_memory"],
                "max_concurrent_tasks": 15,
                "task_timeout_seconds": 180
            },
            {
                "id": "custom",
                "name": "Custom Agent",
                "description": "Create a fully custom agent from scratch",
                "icon": "🛠️",
                "capabilities": [],
                "system_prompt": """You are a helpful AI assistant.""",
                "tools": [],
                "max_concurrent_tasks": 5,
                "task_timeout_seconds": 300
            }
        ]


class AgentStorage:
    """
    Manages agent configuration storage in PostgreSQL.

    Schema:
        agents (
            id UUID PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            agent_type TEXT,  -- Template ID or 'custom'
            capabilities TEXT[],
            system_prompt TEXT,
            tools TEXT[],
            max_concurrent_tasks INTEGER,
            task_timeout_seconds INTEGER,
            custom_config JSONB,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            last_used_at TIMESTAMP
        )
    """

    def __init__(self, db_pool: asyncpg.Pool):
        """
        Initialize agent storage.

        Args:
            db_pool: AsyncPG connection pool
        """
        self.pool = db_pool

    async def initialize(self) -> None:
        """Create agents table if it doesn't exist"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS agents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    agent_type TEXT NOT NULL,
                    capabilities TEXT[],
                    system_prompt TEXT NOT NULL,
                    tools TEXT[],
                    max_concurrent_tasks INTEGER DEFAULT 5,
                    task_timeout_seconds INTEGER DEFAULT 300,
                    custom_config JSONB DEFAULT '{}',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    last_used_at TIMESTAMP,
                    CONSTRAINT agents_user_name_unique UNIQUE(user_id, name)
                )
            """)

            # Create index for faster lookups
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active) WHERE is_active = TRUE
            """)

            logger.info("agent_storage_initialized")

    async def create_agent(
        self,
        user_id: str,
        name: str,
        description: str,
        agent_type: str,
        capabilities: List[str],
        system_prompt: str,
        tools: List[str],
        max_concurrent_tasks: int = 5,
        task_timeout_seconds: int = 300,
        custom_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new agent configuration.

        Args:
            user_id: User who owns the agent
            name: Agent name
            description: Agent description
            agent_type: Template ID or 'custom'
            capabilities: List of capabilities
            system_prompt: System prompt for the agent
            tools: List of tool names the agent can use
            max_concurrent_tasks: Max concurrent tasks
            task_timeout_seconds: Task timeout
            custom_config: Additional configuration

        Returns:
            Created agent record
        """
        async with self.pool.acquire() as conn:
            agent_id = str(uuid.uuid4())

            record = await conn.fetchrow("""
                INSERT INTO agents (
                    id, user_id, name, description, agent_type,
                    capabilities, system_prompt, tools,
                    max_concurrent_tasks, task_timeout_seconds, custom_config
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            """, agent_id, user_id, name, description, agent_type,
                capabilities, system_prompt, tools,
                max_concurrent_tasks, task_timeout_seconds,
                json.dumps(custom_config or {})
            )

            logger.info(
                "agent_created",
                agent_id=agent_id,
                name=name,
                agent_type=agent_type,
                user_id=user_id
            )

            return dict(record)

    async def get_agent(self, agent_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get agent by ID and user"""
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow("""
                SELECT * FROM agents
                WHERE id = $1 AND user_id = $2
            """, agent_id, user_id)

            return dict(record) if record else None

    async def list_agents(
        self,
        user_id: str,
        include_inactive: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List all agents for a user.

        Args:
            user_id: User ID
            include_inactive: Include inactive agents

        Returns:
            List of agent records
        """
        async with self.pool.acquire() as conn:
            query = """
                SELECT * FROM agents
                WHERE user_id = $1
            """

            if not include_inactive:
                query += " AND is_active = TRUE"

            query += " ORDER BY created_at DESC"

            records = await conn.fetch(query, user_id)
            return [dict(r) for r in records]

    async def update_agent(
        self,
        agent_id: str,
        user_id: str,
        **updates
    ) -> Optional[Dict[str, Any]]:
        """
        Update agent configuration.

        Args:
            agent_id: Agent ID
            user_id: User ID (for authorization)
            **updates: Fields to update

        Returns:
            Updated agent record or None
        """
        # Build update query dynamically
        allowed_fields = {
            'name', 'description', 'capabilities', 'system_prompt',
            'tools', 'max_concurrent_tasks', 'task_timeout_seconds',
            'custom_config', 'is_active'
        }

        update_fields = {k: v for k, v in updates.items() if k in allowed_fields}

        if not update_fields:
            return await self.get_agent(agent_id, user_id)

        set_clauses = []
        values = [agent_id, user_id]
        param_idx = 3

        for field, value in update_fields.items():
            if field == 'custom_config':
                set_clauses.append(f"{field} = ${param_idx}::jsonb")
                values.append(json.dumps(value))
            else:
                set_clauses.append(f"{field} = ${param_idx}")
                values.append(value)
            param_idx += 1

        set_clauses.append("updated_at = NOW()")

        query = f"""
            UPDATE agents
            SET {', '.join(set_clauses)}
            WHERE id = $1 AND user_id = $2
            RETURNING *
        """

        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(query, *values)

            if record:
                logger.info(
                    "agent_updated",
                    agent_id=agent_id,
                    updates=list(update_fields.keys())
                )

            return dict(record) if record else None

    async def delete_agent(self, agent_id: str, user_id: str) -> bool:
        """
        Delete an agent (soft delete - sets is_active=False).

        Args:
            agent_id: Agent ID
            user_id: User ID (for authorization)

        Returns:
            True if deleted, False if not found
        """
        async with self.pool.acquire() as conn:
            result = await conn.execute("""
                UPDATE agents
                SET is_active = FALSE, updated_at = NOW()
                WHERE id = $1 AND user_id = $2
            """, agent_id, user_id)

            deleted = result.split()[-1] == "1"

            if deleted:
                logger.info("agent_deleted", agent_id=agent_id)

            return deleted

    async def record_agent_usage(self, agent_id: str, user_id: str) -> None:
        """Record that an agent was used"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE agents
                SET last_used_at = NOW()
                WHERE id = $1 AND user_id = $2
            """, agent_id, user_id)

    async def get_agent_stats(self, user_id: str) -> Dict[str, Any]:
        """Get agent statistics for a user"""
        async with self.pool.acquire() as conn:
            stats = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total_agents,
                    COUNT(*) FILTER (WHERE is_active) as active_agents,
                    COUNT(DISTINCT agent_type) as unique_types,
                    COUNT(*) FILTER (WHERE last_used_at IS NOT NULL) as used_agents
                FROM agents
                WHERE user_id = $1
            """, user_id)

            return dict(stats) if stats else {
                "total_agents": 0,
                "active_agents": 0,
                "unique_types": 0,
                "used_agents": 0
            }
