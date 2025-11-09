"""Data Ingestion Pipeline - Automated Document Processing"""

import asyncio
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime
import uuid
import structlog

from .parsers import ParserFactory
from .extractors import EntityExtractor, EmbeddingGenerator, ConceptExtractor
from ..utils.database import DatabaseManager

logger = structlog.get_logger(__name__)


class IngestionStatus:
    """Track ingestion job status"""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.status = "pending"  # pending, processing, completed, failed
        self.progress = 0.0
        self.total_steps = 0
        self.completed_steps = 0
        self.errors = []
        self.started_at = None
        self.completed_at = None
        self.result = {}

    def start(self, total_steps: int):
        """Mark job as started"""
        self.status = "processing"
        self.total_steps = total_steps
        self.started_at = datetime.utcnow()

    def update_progress(self, step_description: str):
        """Update progress"""
        self.completed_steps += 1
        self.progress = (self.completed_steps / self.total_steps) * 100
        logger.info(
            "ingestion_progress",
            job_id=self.job_id,
            progress=f"{self.progress:.1f}%",
            step=step_description
        )

    def complete(self, result: Dict[str, Any]):
        """Mark job as completed"""
        self.status = "completed"
        self.completed_at = datetime.utcnow()
        self.result = result
        logger.info("ingestion_completed", job_id=self.job_id)

    def fail(self, error: str):
        """Mark job as failed"""
        self.status = "failed"
        self.completed_at = datetime.utcnow()
        self.errors.append(error)
        logger.error("ingestion_failed", job_id=self.job_id, error=error)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "job_id": self.job_id,
            "status": self.status,
            "progress": self.progress,
            "total_steps": self.total_steps,
            "completed_steps": self.completed_steps,
            "errors": self.errors,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "result": self.result,
        }


class IngestionPipeline:
    """
    Automated Data Ingestion Pipeline.

    Processes documents through the following stages:
    1. Parse document (extract text and metadata)
    2. Extract entities and relationships
    3. Extract concepts and themes
    4. Generate embeddings
    5. Load into Neo4j (knowledge graph)
    6. Load into Qdrant (vector store)
    7. Update metadata in PostgreSQL

    Supports:
    - Centralized GraphRAG (shared knowledge)
    - Row-level security (user-specific data)
    """

    def __init__(self, db_manager: DatabaseManager, config: Optional[Dict] = None):
        self.db = db_manager
        self.config = config or {}

        # Initialize extractors
        self.entity_extractor = EntityExtractor(
            llm_endpoint=self.config.get("llm_endpoint", "http://localhost:8090/v1/chat/completions")
        )
        self.embedding_generator = EmbeddingGenerator(
            use_local=self.config.get("use_local_embeddings", True)
        )
        self.concept_extractor = ConceptExtractor(
            llm_endpoint=self.config.get("llm_endpoint", "http://localhost:8090/v1/chat/completions")
        )

        # Job tracking
        self.jobs: Dict[str, IngestionStatus] = {}

    async def ingest_document(
        self,
        file_path: str,
        user_id: str,
        is_centralized: bool = False,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Ingest a document into the system.

        Args:
            file_path: Path to document
            user_id: User who owns this document
            is_centralized: If True, add to centralized knowledge (no RLS)
            metadata: Additional metadata

        Returns:
            Job ID for tracking progress
        """
        job_id = str(uuid.uuid4())
        status = IngestionStatus(job_id)
        self.jobs[job_id] = status

        # Start processing in background
        asyncio.create_task(
            self._process_document(job_id, file_path, user_id, is_centralized, metadata or {})
        )

        logger.info(
            "ingestion_job_created",
            job_id=job_id,
            file_path=file_path,
            user_id=user_id,
            centralized=is_centralized
        )

        return job_id

    async def _process_document(
        self,
        job_id: str,
        file_path: str,
        user_id: str,
        is_centralized: bool,
        metadata: Dict
    ):
        """Process document through the pipeline"""
        status = self.jobs[job_id]

        try:
            # Total steps: parse, extract entities, extract concepts, embed, load graph, load vector
            status.start(total_steps=6)

            # Step 1: Parse document
            logger.info("step_1_parsing", job_id=job_id, file_path=file_path)
            parsed = ParserFactory.parse_document(file_path)

            if not parsed:
                status.fail(f"Unsupported file type: {Path(file_path).suffix}")
                return

            status.update_progress("Document parsed")

            # Merge metadata
            doc_metadata = {**parsed["metadata"], **metadata}
            doc_id = str(uuid.uuid4())

            # Step 2: Extract entities and relationships
            logger.info("step_2_extracting_entities", job_id=job_id)
            extraction_result = await self.entity_extractor.extract_entities(parsed["text"])
            entities = extraction_result["entities"]
            relationships = extraction_result["relationships"]

            status.update_progress(f"Extracted {len(entities)} entities")

            # Step 3: Extract concepts
            logger.info("step_3_extracting_concepts", job_id=job_id)
            concepts = await self.concept_extractor.extract_concepts(parsed["text"])

            status.update_progress(f"Extracted {len(concepts)} concepts")

            # Step 4: Generate embeddings
            logger.info("step_4_generating_embeddings", job_id=job_id)
            chunks = parsed["chunks"]
            embeddings = await self.embedding_generator.generate_embeddings(chunks)

            status.update_progress(f"Generated {len(embeddings)} embeddings")

            # Step 5: Load into Neo4j (knowledge graph)
            logger.info("step_5_loading_graph", job_id=job_id)
            await self._load_into_neo4j(
                doc_id=doc_id,
                user_id=user_id if not is_centralized else None,
                entities=entities,
                relationships=relationships,
                concepts=concepts,
                metadata=doc_metadata
            )

            status.update_progress("Loaded into knowledge graph")

            # Step 6: Load into Qdrant (vector store)
            logger.info("step_6_loading_vectors", job_id=job_id)
            await self._load_into_qdrant(
                doc_id=doc_id,
                user_id=user_id if not is_centralized else None,
                chunks=chunks,
                embeddings=embeddings,
                metadata=doc_metadata
            )

            status.update_progress("Loaded into vector store")

            # Complete the job
            status.complete({
                "doc_id": doc_id,
                "entities": len(entities),
                "relationships": len(relationships),
                "concepts": len(concepts),
                "chunks": len(chunks),
                "file_path": file_path,
                "metadata": doc_metadata,
            })

        except Exception as e:
            logger.error(
                "ingestion_processing_failed",
                job_id=job_id,
                error=str(e),
                exc_info=True
            )
            status.fail(str(e))

    async def _load_into_neo4j(
        self,
        doc_id: str,
        user_id: Optional[str],
        entities: List[Dict],
        relationships: List[Dict],
        concepts: List[Dict],
        metadata: Dict
    ):
        """Load data into Neo4j knowledge graph"""

        async with self.db.neo4j.session() as session:
            # Create document node
            await session.run(
                """
                CREATE (d:Document {
                    id: $doc_id,
                    user_id: $user_id,
                    title: $title,
                    file_type: $file_type,
                    created_at: datetime(),
                    metadata: $metadata
                })
                """,
                doc_id=doc_id,
                user_id=user_id,
                title=metadata.get("title", "Untitled"),
                file_type=metadata.get("file_type", "unknown"),
                metadata=metadata
            )

            # Create entities
            for entity in entities:
                entity_id = f"{doc_id}_{entity['name']}"

                await session.run(
                    """
                    MERGE (e:Entity {name: $name, user_id: $user_id})
                    ON CREATE SET
                        e.id = $entity_id,
                        e.type = $type,
                        e.description = $description,
                        e.created_at = datetime()
                    ON MATCH SET
                        e.updated_at = datetime()

                    WITH e
                    MATCH (d:Document {id: $doc_id})
                    MERGE (d)-[:MENTIONS]->(e)
                    """,
                    name=entity["name"],
                    user_id=user_id,
                    entity_id=entity_id,
                    type=entity.get("type", "unknown"),
                    description=entity.get("description", ""),
                    doc_id=doc_id
                )

            # Create relationships between entities
            for rel in relationships:
                await session.run(
                    """
                    MATCH (e1:Entity {name: $from, user_id: $user_id})
                    MATCH (e2:Entity {name: $to, user_id: $user_id})
                    MERGE (e1)-[r:RELATED_TO {
                        type: $rel_type,
                        description: $description,
                        doc_id: $doc_id
                    }]->(e2)
                    """,
                    from_name=rel.get("from"),
                    to_name=rel.get("to"),
                    user_id=user_id,
                    rel_type=rel.get("type", "related"),
                    description=rel.get("description", ""),
                    doc_id=doc_id
                )

            # Create concept nodes
            for concept in concepts:
                await session.run(
                    """
                    MERGE (c:Concept {name: $name, user_id: $user_id})
                    ON CREATE SET
                        c.description = $description,
                        c.category = $category,
                        c.created_at = datetime()

                    WITH c
                    MATCH (d:Document {id: $doc_id})
                    MERGE (d)-[:HAS_CONCEPT]->(c)
                    """,
                    name=concept["name"],
                    user_id=user_id,
                    description=concept.get("description", ""),
                    category=concept.get("category", "general"),
                    doc_id=doc_id
                )

        logger.info(
            "neo4j_load_complete",
            doc_id=doc_id,
            entities=len(entities),
            relationships=len(relationships),
            concepts=len(concepts)
        )

    async def _load_into_qdrant(
        self,
        doc_id: str,
        user_id: Optional[str],
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: Dict
    ):
        """Load embeddings into Qdrant vector store"""

        from qdrant_client.models import PointStruct

        # Determine collection name based on user_id
        if user_id:
            collection_name = f"documents_user_{user_id}"
        else:
            collection_name = "documents_centralized"

        # Ensure collection exists
        try:
            await self.db.qdrant.get_collection(collection_name)
        except Exception as e:
            # Specific exception caught for better error handling
            # Create collection if it doesn't exist
            from qdrant_client.models import VectorParams, Distance

            await self.db.qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=len(embeddings[0]),
                    distance=Distance.COSINE
                )
            )

        # Create points for each chunk
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = f"{doc_id}_chunk_{i}"

            payload = {
                "doc_id": doc_id,
                "user_id": user_id,
                "chunk_index": i,
                "text": chunk,
                "file_type": metadata.get("file_type"),
                "title": metadata.get("title"),
            }

            points.append(
                PointStruct(
                    id=hash(point_id) % (2**63),  # Convert to int
                    vector=embedding,
                    payload=payload
                )
            )

        # Upload in batches
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            await self.db.qdrant.upsert(
                collection_name=collection_name,
                points=batch
            )

        logger.info(
            "qdrant_load_complete",
            doc_id=doc_id,
            collection=collection_name,
            points=len(points)
        )

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of an ingestion job"""
        status = self.jobs.get(job_id)
        if status:
            return status.to_dict()
        return None

    def list_jobs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List recent ingestion jobs"""
        jobs = list(self.jobs.values())
        jobs.sort(key=lambda x: x.started_at or datetime.min, reverse=True)
        return [job.to_dict() for job in jobs[:limit]]

    async def cleanup(self):
        """Cleanup resources"""
        await self.entity_extractor.close()
        await self.concept_extractor.close()
