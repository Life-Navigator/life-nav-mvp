"""Add agent system tables

Revision ID: 002
Revises: 001
Create Date: 2025-01-05 01:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create agents table
    op.create_table(
        "agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column(
            "agent_type",
            sa.Enum(
                "ORCHESTRATOR",
                "DOMAIN_MANAGER",
                "SPECIALIST",
                "TOOL_USER",
                name="agenttype",
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("capabilities", postgresql.JSONB(), nullable=True),
        sa.Column(
            "max_concurrent_tasks", sa.Integer(), nullable=True, server_default="5"
        ),
        sa.Column("timeout_seconds", sa.Float(), nullable=True, server_default="30.0"),
        sa.Column("retry_attempts", sa.Integer(), nullable=True, server_default="3"),
        sa.Column(
            "current_state",
            sa.Enum(
                "IDLE",
                "PROCESSING",
                "COMPLETED",
                "ERROR",
                "SHUTDOWN",
                name="agentstate",
            ),
            nullable=True,
            server_default="IDLE",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column(
            "model_name",
            sa.String(length=100),
            nullable=True,
            server_default="maverick",
        ),
        sa.Column("temperature", sa.Float(), nullable=True, server_default="0.7"),
        sa.Column("max_tokens", sa.Integer(), nullable=True, server_default="500"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("last_active_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agents_user_id"), "agents", ["user_id"], unique=False)
    op.create_index(op.f("ix_agents_tenant_id"), "agents", ["tenant_id"], unique=False)

    # Create agent_tasks table
    op.create_table(
        "agent_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_type", sa.String(length=100), nullable=False),
        sa.Column("input_text", sa.Text(), nullable=False),
        sa.Column("context", postgresql.JSONB(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "RUNNING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                name="taskstatus",
            ),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("retries", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("reasoning_steps", postgresql.JSONB(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("sources", postgresql.JSONB(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_tasks_user_id"), "agent_tasks", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_agent_tasks_tenant_id"), "agent_tasks", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_agent_tasks_agent_id"), "agent_tasks", ["agent_id"], unique=False
    )
    op.create_index(
        op.f("ix_agent_tasks_status"), "agent_tasks", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_agent_tasks_created_at"), "agent_tasks", ["created_at"], unique=False
    )

    # Create conversations table
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("message_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_conversations_user_id"), "conversations", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_conversations_tenant_id"), "conversations", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_conversations_agent_id"), "conversations", ["agent_id"], unique=False
    )
    op.create_index(
        op.f("ix_conversations_created_at"),
        "conversations",
        ["created_at"],
        unique=False,
    )

    # Create conversation_messages table
    op.create_table(
        "conversation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("reasoning_steps", postgresql.JSONB(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_conversation_messages_conversation_id"),
        "conversation_messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conversation_messages_user_id"),
        "conversation_messages",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conversation_messages_tenant_id"),
        "conversation_messages",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conversation_messages_created_at"),
        "conversation_messages",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("conversation_messages")
    op.drop_table("conversations")
    op.drop_table("agent_tasks")
    op.drop_table("agents")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS agenttype")
    op.execute("DROP TYPE IF EXISTS agentstate")
    op.execute("DROP TYPE IF EXISTS taskstatus")
