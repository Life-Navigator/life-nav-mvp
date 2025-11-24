"""
GraphRAG Orchestrator

Unified interface for the dual-graph architecture with compliance validation.
Coordinates between Neo4j, Qdrant, PostgreSQL, and the compliance validator.

Usage:
    >>> orchestrator = await GraphRAGOrchestrator.create()
    >>> # Ingest regulatory document to central knowledge graph
    >>> await orchestrator.ingest_regulation(
    ...     document_path="/path/to/irs_publication.pdf",
    ...     regulation_type="tax_law",
    ...     source="IRS"
    ... )
    >>> # Process user query with compliance validation
    >>> result = await orchestrator.process_query(
    ...     user_id="user123",
    ...     query="What's the best investment strategy for my 401k?",
    ...     validate_compliance=True
    ... )
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid

from utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class QueryContext:
    """Context retrieved for a user query"""
    central_regulations: List[Dict[str, Any]] = field(default_factory=list)
    personal_documents: List[Dict[str, Any]] = field(default_factory=list)
    personal_transactions: List[Dict[str, Any]] = field(default_factory=list)
    conversation_memory: List[Dict[str, Any]] = field(default_factory=list)
    graph_relationships: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProcessedResponse:
    """Result of processing a query with compliance validation"""
    query: str
    response: str
    is_compliant: bool
    was_rewritten: bool
    original_response: Optional[str]  # Only if rewritten
    context: QueryContext
    compliance_log_id: Optional[str]
    processing_time_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class GraphRAGOrchestrator:
    """
    Main orchestrator for GraphRAG operations.

    Coordinates:
    - Neo4j: Central knowledge graph (regulations) + Personal knowledge graph
    - Qdrant: Vector similarity search across all collections
    - PostgreSQL: GraphRAG tables and relational data
    - ComplianceValidator: Block -> Reassess -> Rewrite flow
    - EmbeddingService: Local sentence-transformers embeddings
    """

    def __init__(
        self,
        neo4j_client,
        qdrant_client,
        postgres_client,
        embedding_service,
        compliance_validator,
        llm_client=None
    ):
        """
        Initialize orchestrator with all clients.

        Args:
            neo4j_client: Neo4jClient instance
            qdrant_client: QdrantVectorClient instance
            postgres_client: GraphRAGClient instance (PostgreSQL)
            embedding_service: EmbeddingService instance
            compliance_validator: ComplianceValidator instance
            llm_client: Optional LLM client for response generation
        """
        self.neo4j = neo4j_client
        self.qdrant = qdrant_client
        self.postgres = postgres_client
        self.embeddings = embedding_service
        self.compliance = compliance_validator
        self.llm = llm_client

        logger.info("GraphRAGOrchestrator initialized")

    @classmethod
    async def create(cls, llm_client=None) -> "GraphRAGOrchestrator":
        """
        Factory method to create a fully initialized orchestrator.

        Args:
            llm_client: Optional LLM client

        Returns:
            Configured GraphRAGOrchestrator instance
        """
        from graphrag.neo4j_client import get_neo4j_client
        from graphrag.qdrant_client import get_qdrant_client
        from graphrag.client import get_graphrag_client
        from graphrag.embedding_service import get_embedding_service
        from graphrag.compliance_validator import create_compliance_validator

        # Initialize all clients
        neo4j = await get_neo4j_client()
        qdrant = await get_qdrant_client()
        postgres = await get_graphrag_client()
        embeddings = await get_embedding_service()

        # Create compliance validator
        compliance = await create_compliance_validator(
            neo4j_client=neo4j,
            qdrant_client=qdrant,
            embedding_model=embeddings,
            llm_client=llm_client
        )

        return cls(
            neo4j_client=neo4j,
            qdrant_client=qdrant,
            postgres_client=postgres,
            embedding_service=embeddings,
            compliance_validator=compliance,
            llm_client=llm_client
        )

    # =========================================================================
    # Central Knowledge Graph Operations (Regulatory)
    # =========================================================================

    async def ingest_regulation(
        self,
        document_path: str,
        regulation_type: str,
        source: str,
        title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Ingest a regulatory document into the central knowledge graph.

        Args:
            document_path: Path to the document
            regulation_type: Type (e.g., "tax_law", "sec_rule", "hipaa")
            source: Source agency (e.g., "IRS", "SEC", "HHS")
            title: Optional document title
            metadata: Additional metadata

        Returns:
            Ingestion result with regulation_id and stats
        """
        import time
        start_time = time.time()

        from graphrag.document_ingestion import DocumentIngestionPipeline, DocumentType

        # Map regulation type to document type
        type_map = {
            "tax_law": DocumentType.TAX_LAW,
            "sec_rule": DocumentType.FINRA,
            "hipaa": DocumentType.REGULATION,
            "regulation": DocumentType.REGULATION,
            "compliance": DocumentType.COMPLIANCE,
            "best_practice": DocumentType.BEST_PRACTICE
        }

        doc_type = type_map.get(regulation_type, DocumentType.REGULATION)

        # Create ingestion pipeline for centralized content
        pipeline = DocumentIngestionPipeline(
            graphrag_client=self.postgres,
            embedding_service=self.embeddings
        )

        # Ingest document
        result = await pipeline.ingest_document(
            file_path=document_path,
            document_type=doc_type,
            user_id="centralized",  # Central graph uses centralized user
            metadata={"source": source, **(metadata or {})}
        )

        # Generate regulation ID
        regulation_id = f"{source}-{datetime.utcnow().strftime('%Y')}-{uuid.uuid4().hex[:8]}"

        # Add to Neo4j central graph
        await self.neo4j.add_regulation(
            regulation_id=regulation_id,
            title=title or document_path.split("/")[-1],
            regulation_type=regulation_type,
            source=source,
            content=result.get("content_summary", ""),
            effective_date=datetime.utcnow().isoformat(),
            metadata=metadata
        )

        # Index embeddings in Qdrant central knowledge collection
        if result.get("chunks"):
            points = []
            for i, chunk in enumerate(result["chunks"]):
                embedding = await self.embeddings.encode(chunk["text"])
                points.append({
                    "id": f"{regulation_id}-chunk-{i}",
                    "embedding": embedding.tolist(),
                    "regulation_id": regulation_id,
                    "chunk_text": chunk["text"],
                    "category": regulation_type,
                    "source": source,
                    "metadata": {"chunk_index": i, "total_chunks": len(result["chunks"])}
                })

            await self.qdrant.upsert_central_knowledge(points)

        processing_time = (time.time() - start_time) * 1000

        logger.info(
            f"Regulation ingested: {regulation_id}",
            extra={
                "source": source,
                "type": regulation_type,
                "chunks": len(result.get("chunks", [])),
                "processing_time_ms": processing_time
            }
        )

        return {
            "regulation_id": regulation_id,
            "title": title,
            "source": source,
            "type": regulation_type,
            "chunks_processed": len(result.get("chunks", [])),
            "processing_time_ms": processing_time
        }

    async def add_compliance_rule(
        self,
        regulation_id: str,
        title: str,
        category: str,
        description: str,
        conditions: List[str],
        actions: List[str],
        severity: str = "warning"
    ) -> str:
        """
        Add a compliance rule to the central knowledge graph.

        Args:
            regulation_id: Parent regulation ID
            title: Rule title
            category: Category (e.g., "disclosure", "investment_limit")
            description: Rule description
            conditions: Conditions that trigger this rule
            actions: Required actions
            severity: Severity level ("info", "warning", "block")

        Returns:
            rule_id
        """
        rule_id = f"{regulation_id}-rule-{uuid.uuid4().hex[:8]}"

        await self.neo4j.add_rule(
            rule_id=rule_id,
            regulation_id=regulation_id,
            title=title,
            category=category,
            description=description,
            conditions=conditions,
            actions=actions,
            severity=severity
        )

        logger.info(f"Compliance rule added: {rule_id}")
        return rule_id

    # =========================================================================
    # Personal Knowledge Graph Operations (User Data)
    # =========================================================================

    async def ingest_user_document(
        self,
        user_id: str,
        document_path: str,
        document_type: str,
        title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Ingest a user document into their personal knowledge graph.

        Args:
            user_id: User identifier
            document_path: Path to the document
            document_type: Type (e.g., "tax_return", "medical_record", "bank_statement")
            title: Optional document title
            metadata: Additional metadata

        Returns:
            Ingestion result with document_id and stats
        """
        import time
        start_time = time.time()

        from graphrag.document_ingestion import DocumentIngestionPipeline, DocumentType

        # Map document type
        type_map = {
            "tax_return": DocumentType.TAX_LAW,
            "medical_record": DocumentType.REGULATION,
            "bank_statement": DocumentType.FINRA,
            "financial": DocumentType.FINRA
        }

        doc_type = type_map.get(document_type, DocumentType.REGULATION)

        # Create ingestion pipeline
        pipeline = DocumentIngestionPipeline(
            graphrag_client=self.postgres,
            embedding_service=self.embeddings
        )

        # Ingest with user's ID (RLS)
        result = await pipeline.ingest_document(
            file_path=document_path,
            document_type=doc_type,
            user_id=user_id,
            metadata=metadata
        )

        document_id = f"doc-{user_id}-{uuid.uuid4().hex[:8]}"

        # Add to Neo4j personal graph
        await self.neo4j.add_user_document(
            user_id=user_id,
            document_id=document_id,
            title=title or document_path.split("/")[-1],
            document_type=document_type,
            content_summary=result.get("content_summary", "")[:500],
            source_path=document_path,
            metadata=metadata
        )

        # Index embeddings in Qdrant personal documents collection
        if result.get("chunks"):
            points = []
            for i, chunk in enumerate(result["chunks"]):
                embedding = await self.embeddings.encode(chunk["text"])
                points.append({
                    "id": f"{document_id}-chunk-{i}",
                    "embedding": embedding.tolist(),
                    "document_id": document_id,
                    "chunk_text": chunk["text"],
                    "document_type": document_type,
                    "metadata": {"chunk_index": i}
                })

            await self.qdrant.upsert_personal_documents(user_id, points)

        processing_time = (time.time() - start_time) * 1000

        logger.info(
            f"User document ingested: {document_id}",
            extra={
                "user_id": user_id,
                "type": document_type,
                "chunks": len(result.get("chunks", [])),
                "processing_time_ms": processing_time
            }
        )

        return {
            "document_id": document_id,
            "user_id": user_id,
            "title": title,
            "type": document_type,
            "chunks_processed": len(result.get("chunks", [])),
            "processing_time_ms": processing_time
        }

    async def store_transaction(
        self,
        user_id: str,
        transaction_id: str,
        account_id: str,
        amount: float,
        category: str,
        merchant: Optional[str] = None,
        date: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Store a financial transaction in the user's personal knowledge graph.

        Args:
            user_id: User identifier
            transaction_id: Transaction identifier
            account_id: Bank account ID
            amount: Transaction amount
            category: Category
            merchant: Merchant name
            date: Transaction date
            description: Optional description for embedding
            metadata: Additional metadata

        Returns:
            transaction_id
        """
        # Add to Neo4j personal graph
        await self.neo4j.add_user_transaction(
            user_id=user_id,
            transaction_id=transaction_id,
            account_id=account_id,
            amount=amount,
            category=category,
            merchant=merchant,
            date=date,
            metadata=metadata
        )

        # Generate embedding for the transaction description
        if description:
            embedding = await self.embeddings.encode(description)

            await self.qdrant.upsert_personal_transactions(
                user_id=user_id,
                points=[{
                    "id": transaction_id,
                    "embedding": embedding.tolist(),
                    "transaction_id": transaction_id,
                    "description": description,
                    "category": category,
                    "amount": amount,
                    "metadata": metadata or {}
                }]
            )

        logger.debug(f"Transaction stored: {transaction_id}")
        return transaction_id

    # =========================================================================
    # Query Processing with Compliance Validation
    # =========================================================================

    async def retrieve_context(
        self,
        user_id: str,
        query: str,
        include_central: bool = True,
        include_personal: bool = True,
        include_memory: bool = True,
        limit: int = 5
    ) -> QueryContext:
        """
        Retrieve relevant context for a query from all graphs.

        Args:
            user_id: User identifier
            query: User query
            include_central: Include central regulatory knowledge
            include_personal: Include personal documents/transactions
            include_memory: Include conversation memory
            limit: Maximum results per source

        Returns:
            QueryContext with retrieved information
        """
        context = QueryContext()

        # Generate query embedding
        query_embedding = await self.embeddings.encode(query)
        query_vector = query_embedding.tolist()

        # Search central knowledge (regulations)
        if include_central:
            context.central_regulations = await self.qdrant.search_central_knowledge(
                query_embedding=query_vector,
                limit=limit,
                score_threshold=0.5
            )

        # Search personal documents
        if include_personal:
            context.personal_documents = await self.qdrant.search_personal_documents(
                user_id=user_id,
                query_embedding=query_vector,
                limit=limit,
                score_threshold=0.5
            )

            context.personal_transactions = await self.qdrant.search_personal_transactions(
                user_id=user_id,
                query_embedding=query_vector,
                limit=limit,
                score_threshold=0.5
            )

        # Search conversation memory
        if include_memory:
            context.conversation_memory = await self.qdrant.search_conversation_memory(
                user_id=user_id,
                agent_id="navigator",  # Default agent
                query_embedding=query_vector,
                limit=limit,
                score_threshold=0.5
            )

        context.metadata = {
            "query": query,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }

        return context

    async def process_query(
        self,
        user_id: str,
        query: str,
        validate_compliance: bool = True,
        agent_id: str = "navigator"
    ) -> ProcessedResponse:
        """
        Process a user query with context retrieval and compliance validation.

        Args:
            user_id: User identifier
            query: User query
            validate_compliance: Whether to run compliance validation
            agent_id: Agent identifier for memory

        Returns:
            ProcessedResponse with response and compliance status
        """
        import time
        start_time = time.time()

        # Retrieve context
        context = await self.retrieve_context(user_id, query)

        # Generate response (using LLM if available)
        response = await self._generate_response(query, context)

        # Validate compliance if requested
        is_compliant = True
        was_rewritten = False
        original_response = None
        compliance_log_id = None

        if validate_compliance:
            compliance_result = await self.compliance.validate_response(
                user_id=user_id,
                query=query,
                response=response,
                context={"retrieved_context": context.metadata}
            )

            is_compliant = compliance_result.is_compliant
            compliance_log_id = compliance_result.validation_log_id

            if compliance_result.compliant_response:
                was_rewritten = True
                original_response = response
                response = compliance_result.compliant_response

        # Store in conversation memory
        query_embedding = await self.embeddings.encode(query)
        response_embedding = await self.embeddings.encode(response)

        await self.qdrant.upsert_conversation_memory(
            user_id=user_id,
            agent_id=agent_id,
            points=[
                {
                    "id": f"query-{uuid.uuid4().hex[:8]}",
                    "embedding": query_embedding.tolist(),
                    "content": query,
                    "role": "user"
                },
                {
                    "id": f"response-{uuid.uuid4().hex[:8]}",
                    "embedding": response_embedding.tolist(),
                    "content": response,
                    "role": "assistant"
                }
            ]
        )

        processing_time = (time.time() - start_time) * 1000

        return ProcessedResponse(
            query=query,
            response=response,
            is_compliant=is_compliant,
            was_rewritten=was_rewritten,
            original_response=original_response,
            context=context,
            compliance_log_id=compliance_log_id,
            processing_time_ms=processing_time
        )

    async def _generate_response(
        self,
        query: str,
        context: QueryContext
    ) -> str:
        """
        Generate a response using retrieved context.

        Args:
            query: User query
            context: Retrieved context

        Returns:
            Generated response
        """
        if not self.llm:
            # Fallback: Return context summary
            return self._format_context_response(query, context)

        # Build prompt with context
        prompt = self._build_rag_prompt(query, context)

        try:
            response = await self.llm.generate(prompt)
            return response
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return self._format_context_response(query, context)

    def _build_rag_prompt(self, query: str, context: QueryContext) -> str:
        """Build RAG prompt with context"""
        context_parts = []

        if context.central_regulations:
            regs = "\n".join([
                f"- {r.get('chunk_text', '')[:200]}..."
                for r in context.central_regulations[:3]
            ])
            context_parts.append(f"REGULATORY CONTEXT:\n{regs}")

        if context.personal_documents:
            docs = "\n".join([
                f"- {d.get('chunk_text', '')[:200]}..."
                for d in context.personal_documents[:3]
            ])
            context_parts.append(f"YOUR DOCUMENTS:\n{docs}")

        if context.personal_transactions:
            txns = "\n".join([
                f"- {t.get('description', '')} ({t.get('category', '')}): ${t.get('amount', 0)}"
                for t in context.personal_transactions[:5]
            ])
            context_parts.append(f"RECENT TRANSACTIONS:\n{txns}")

        context_str = "\n\n".join(context_parts)

        return f"""You are Life Navigator, a helpful AI assistant for personal finance and health management.

CONTEXT:
{context_str}

USER QUERY: {query}

Please provide a helpful, accurate response based on the context above. Important:
1. If you're providing financial guidance, recommend consulting a licensed professional
2. If you're providing health information, recommend consulting a healthcare provider
3. Be specific and actionable where possible
4. Reference relevant regulations when appropriate

RESPONSE:"""

    def _format_context_response(self, query: str, context: QueryContext) -> str:
        """Format a response from context when LLM is unavailable"""
        parts = [f"Based on your query: '{query}'"]

        if context.central_regulations:
            parts.append("\nRelevant regulations found:")
            for reg in context.central_regulations[:2]:
                parts.append(f"- {reg.get('chunk_text', '')[:150]}...")

        if context.personal_documents:
            parts.append("\nRelevant documents found:")
            for doc in context.personal_documents[:2]:
                parts.append(f"- {doc.get('chunk_text', '')[:150]}...")

        parts.append("\nPlease consult with a licensed professional for personalized advice.")

        return "\n".join(parts)

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def get_system_stats(self) -> Dict[str, Any]:
        """Get statistics from all system components"""
        return {
            "neo4j": self.neo4j.get_stats(),
            "qdrant": self.qdrant.get_stats(),
            "postgres": self.postgres.get_stats(),
            "compliance": await self.compliance.get_validation_stats()
        }

    async def delete_user_data(self, user_id: str) -> Dict[str, Any]:
        """
        Delete all data for a user (GDPR compliance).

        Args:
            user_id: User identifier

        Returns:
            Deletion summary
        """
        # Delete from Qdrant
        qdrant_result = await self.qdrant.delete_user_data(user_id)

        # Note: Neo4j and PostgreSQL deletion would need to be implemented
        # based on specific requirements

        logger.info(f"User data deleted: {user_id}")

        return {
            "user_id": user_id,
            "qdrant": qdrant_result,
            "deleted_at": datetime.utcnow().isoformat()
        }


# Factory function
async def create_orchestrator(llm_client=None) -> GraphRAGOrchestrator:
    """
    Create a configured GraphRAG orchestrator.

    Args:
        llm_client: Optional LLM client

    Returns:
        Configured GraphRAGOrchestrator instance
    """
    return await GraphRAGOrchestrator.create(llm_client=llm_client)
