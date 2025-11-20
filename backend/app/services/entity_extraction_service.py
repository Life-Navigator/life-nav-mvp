"""
Entity Extraction Service.

Extracts entities from PostgreSQL tables for knowledge graph indexing.

Supports extraction from:
- Goals
- Transactions (financial)
- Health records
- Education courses/certifications
- Career/job information
- Documents
- Custom entities
"""

from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class EntityExtractionService:
    """
    Service for extracting entities from PostgreSQL.

    Converts database records into knowledge graph entity format:
    {
        "type": "ln:Goal",
        "id": UUID,
        "properties": {...},
        "relationships": [...]
    }
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def extract_all_entities(self, tenant_id: UUID) -> list[dict[str, Any]]:
        """
        Extract all entities for a tenant from all tables.

        Args:
            tenant_id: Tenant ID

        Returns:
            List of entities in knowledge graph format
        """
        entities = []

        # Extract from each table
        entities.extend(await self.extract_goals(tenant_id))
        entities.extend(await self.extract_transactions(tenant_id))
        entities.extend(await self.extract_health_records(tenant_id))
        entities.extend(await self.extract_education_records(tenant_id))
        entities.extend(await self.extract_career_records(tenant_id))
        # Add more as needed

        logger.info(
            "entities_extracted",
            tenant_id=str(tenant_id),
            total_entities=len(entities),
        )

        return entities

    async def extract_goals(self, tenant_id: UUID) -> list[dict[str, Any]]:
        """Extract Goal entities."""
        try:
            # Import here to avoid circular dependencies
            from app.models.goal import Goal

            query = select(Goal).where(
                Goal.tenant_id == tenant_id,
                Goal.deleted_at.is_(None),  # Exclude soft-deleted
            )

            result = await self.db.execute(query)
            goals = result.scalars().all()

            entities = []
            for goal in goals:
                entity = {
                    "type": "ln:Goal",
                    "id": goal.id,
                    "properties": {
                        "name": goal.name or "",
                        "description": goal.description or "",
                        "category": goal.category.value if hasattr(goal, "category") else "",
                        "status": goal.status.value if hasattr(goal, "status") else "",
                        "target_date": goal.target_date.isoformat() if goal.target_date else None,
                        "created_at": goal.created_at.isoformat(),
                        "updated_at": goal.updated_at.isoformat(),
                    },
                    "relationships": [
                        {
                            "type": "OWNED_BY",
                            "target_type": "User",
                            "target_id": goal.user_id,
                        }
                    ],
                }
                entities.append(entity)

            logger.info("goals_extracted", tenant_id=str(tenant_id), count=len(entities))
            return entities

        except Exception as e:
            logger.error("goal_extraction_failed", error=str(e), tenant_id=str(tenant_id))
            return []

    async def extract_transactions(self, tenant_id: UUID) -> list[dict[str, Any]]:
        """Extract Transaction entities."""
        try:
            # Check if Transaction model exists
            try:
                from app.models.transaction import Transaction
            except ImportError:
                logger.warning("transaction_model_not_found", tenant_id=str(tenant_id))
                return []

            query = select(Transaction).where(
                Transaction.tenant_id == tenant_id,
                Transaction.deleted_at.is_(None),
            ).limit(1000)  # Limit for large datasets

            result = await self.db.execute(query)
            transactions = result.scalars().all()

            entities = []
            for txn in transactions:
                entity = {
                    "type": "ln:Transaction",
                    "id": txn.id,
                    "properties": {
                        "description": txn.description or "",
                        "amount": float(txn.amount) if hasattr(txn, "amount") else 0.0,
                        "category": txn.category if hasattr(txn, "category") else "",
                        "date": txn.date.isoformat() if hasattr(txn, "date") else "",
                        "created_at": txn.created_at.isoformat(),
                    },
                    "relationships": [
                        {
                            "type": "BELONGS_TO_USER",
                            "target_type": "User",
                            "target_id": txn.user_id,
                        }
                    ],
                }
                entities.append(entity)

            logger.info("transactions_extracted", tenant_id=str(tenant_id), count=len(entities))
            return entities

        except Exception as e:
            logger.error("transaction_extraction_failed", error=str(e))
            return []

    async def extract_health_records(self, tenant_id: UUID) -> list[dict[str, Any]]:
        """Extract Health Record entities."""
        try:
            try:
                from app.models.health import HealthRecord
            except ImportError:
                logger.warning("health_record_model_not_found")
                return []

            query = select(HealthRecord).where(
                HealthRecord.tenant_id == tenant_id,
                HealthRecord.deleted_at.is_(None),
            ).limit(500)

            result = await self.db.execute(query)
            records = result.scalars().all()

            entities = []
            for record in records:
                entity = {
                    "type": "ln:HealthRecord",
                    "id": record.id,
                    "properties": {
                        "title": record.title or "" if hasattr(record, "title") else "",
                        "record_type": record.record_type if hasattr(record, "record_type") else "",
                        "date": record.date.isoformat() if hasattr(record, "date") else "",
                        "created_at": record.created_at.isoformat(),
                    },
                    "relationships": [
                        {
                            "type": "BELONGS_TO_USER",
                            "target_type": "User",
                            "target_id": record.user_id,
                        }
                    ],
                }
                entities.append(entity)

            logger.info("health_records_extracted", count=len(entities))
            return entities

        except Exception as e:
            logger.error("health_record_extraction_failed", error=str(e))
            return []

    async def extract_education_records(self, tenant_id: UUID) -> list[dict[str, Any]]:
        """Extract Education/Course entities."""
        try:
            try:
                from app.models.education import Course, Certification
            except ImportError:
                logger.warning("education_models_not_found")
                return []

            entities = []

            # Extract courses
            course_query = select(Course).where(
                Course.tenant_id == tenant_id,
                Course.deleted_at.is_(None),
            ).limit(500)

            result = await self.db.execute(course_query)
            courses = result.scalars().all()

            for course in courses:
                entity = {
                    "type": "ln:Course",
                    "id": course.id,
                    "properties": {
                        "title": course.title or "",
                        "platform": course.platform if hasattr(course, "platform") else "",
                        "status": course.status if hasattr(course, "status") else "",
                        "progress": course.progress if hasattr(course, "progress") else 0,
                        "created_at": course.created_at.isoformat(),
                    },
                    "relationships": [
                        {
                            "type": "ENROLLED_BY",
                            "target_type": "User",
                            "target_id": course.user_id,
                        }
                    ],
                }
                entities.append(entity)

            logger.info("education_records_extracted", count=len(entities))
            return entities

        except Exception as e:
            logger.error("education_extraction_failed", error=str(e))
            return []

    async def extract_career_records(self, tenant_id: UUID) -> list[dict[str, Any]]:
        """Extract Career/Job entities."""
        try:
            try:
                from app.models.career import JobApplication, WorkExperience
            except ImportError:
                logger.warning("career_models_not_found")
                return []

            entities = []

            # Extract job applications
            query = select(JobApplication).where(
                JobApplication.tenant_id == tenant_id,
                JobApplication.deleted_at.is_(None),
            ).limit(200)

            result = await self.db.execute(query)
            applications = result.scalars().all()

            for app in applications:
                entity = {
                    "type": "ln:JobApplication",
                    "id": app.id,
                    "properties": {
                        "job_title": app.job_title or "" if hasattr(app, "job_title") else "",
                        "company": app.company or "" if hasattr(app, "company") else "",
                        "status": app.status if hasattr(app, "status") else "",
                        "applied_date": app.applied_date.isoformat()
                        if hasattr(app, "applied_date")
                        else "",
                        "created_at": app.created_at.isoformat(),
                    },
                    "relationships": [
                        {
                            "type": "APPLIED_BY",
                            "target_type": "User",
                            "target_id": app.user_id,
                        }
                    ],
                }
                entities.append(entity)

            logger.info("career_records_extracted", count=len(entities))
            return entities

        except Exception as e:
            logger.error("career_extraction_failed", error=str(e))
            return []

    async def extract_modified_entities(
        self, tenant_id: UUID, since: datetime
    ) -> list[dict[str, Any]]:
        """
        Extract only entities modified since a given timestamp.

        Args:
            tenant_id: Tenant ID
            since: Extract entities modified after this time

        Returns:
            List of modified entities
        """
        entities = []

        # Extract from each table with updated_at filter
        entities.extend(await self._extract_modified_goals(tenant_id, since))
        entities.extend(await self._extract_modified_transactions(tenant_id, since))
        # Add more tables as needed

        logger.info(
            "modified_entities_extracted",
            tenant_id=str(tenant_id),
            since=since.isoformat(),
            count=len(entities),
        )

        return entities

    async def _extract_modified_goals(
        self, tenant_id: UUID, since: datetime
    ) -> list[dict[str, Any]]:
        """Extract goals modified since timestamp."""
        try:
            from app.models.goal import Goal

            query = select(Goal).where(
                Goal.tenant_id == tenant_id,
                Goal.updated_at >= since,
                Goal.deleted_at.is_(None),
            )

            result = await self.db.execute(query)
            goals = result.scalars().all()

            return await self._goals_to_entities(goals)

        except Exception as e:
            logger.error("modified_goals_extraction_failed", error=str(e))
            return []

    async def _extract_modified_transactions(
        self, tenant_id: UUID, since: datetime
    ) -> list[dict[str, Any]]:
        """Extract transactions modified since timestamp."""
        try:
            from app.models.transaction import Transaction

            query = select(Transaction).where(
                Transaction.tenant_id == tenant_id,
                Transaction.updated_at >= since,
                Transaction.deleted_at.is_(None),
            )

            result = await self.db.execute(query)
            transactions = result.scalars().all()

            return await self._transactions_to_entities(transactions)

        except Exception as e:
            logger.error("modified_transactions_extraction_failed", error=str(e))
            return []

    async def _goals_to_entities(self, goals) -> list[dict[str, Any]]:
        """Convert Goal models to entity dicts."""
        entities = []
        for goal in goals:
            entity = {
                "type": "ln:Goal",
                "id": goal.id,
                "properties": {
                    "name": goal.name or "",
                    "description": goal.description or "",
                    "created_at": goal.created_at.isoformat(),
                },
                "relationships": [
                    {"type": "OWNED_BY", "target_type": "User", "target_id": goal.user_id}
                ],
            }
            entities.append(entity)
        return entities

    async def _transactions_to_entities(self, transactions) -> list[dict[str, Any]]:
        """Convert Transaction models to entity dicts."""
        entities = []
        for txn in transactions:
            entity = {
                "type": "ln:Transaction",
                "id": txn.id,
                "properties": {
                    "description": txn.description or "",
                    "created_at": txn.created_at.isoformat(),
                },
                "relationships": [
                    {"type": "BELONGS_TO_USER", "target_type": "User", "target_id": txn.user_id}
                ],
            }
            entities.append(entity)
        return entities
