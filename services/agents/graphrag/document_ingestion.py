"""
Document Ingestion Pipeline for Centralized GraphRAG

Ingests documents (PDF, HTML, Markdown) into centralized knowledge graph.
Supports FINRA regulations, CFP guidelines, tax laws, and other regulatory content.
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import re

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

from utils.logging import get_logger
from utils.errors import GraphRAGError

logger = get_logger(__name__)


class DocumentIngestionPipeline:
    """
    Ingest documents into centralized GraphRAG for shared knowledge.

    Features:
    - Multi-format support (PDF, HTML, Markdown)
    - Semantic chunking with overlaps
    - Automatic embedding generation
    - Relationship extraction
    - Duplicate detection
    - Metadata tagging

    Example:
        >>> pipeline = DocumentIngestionPipeline(graphrag_client)
        >>> result = await pipeline.ingest_document(
        ...     file_path="finra_rule_2111.pdf",
        ...     document_type="finra",
        ...     metadata={"source": "FINRA Manual", "date": "2024-01-15"}
        ... )
    """

    # Special user_id for centralized knowledge
    CENTRALIZED_USER_ID = "centralized"

    # Document type categories
    DOCUMENT_TYPES = {
        "finra": "FINRA Regulations",
        "cfp": "CFP Guidelines",
        "tax_law": "Tax Laws and IRS Documents",
        "regulation": "General Regulations",
        "compliance": "Compliance Guidelines",
        "best_practice": "Industry Best Practices"
    }

    def __init__(
        self,
        graphrag_client,
        embedding_model: str = "all-MiniLM-L6-v2",
        chunk_size: int = 512,
        chunk_overlap: int = 50
    ):
        """
        Initialize document ingestion pipeline.

        Args:
            graphrag_client: GraphRAG client for storage
            embedding_model: Model name for sentence-transformers
            chunk_size: Target chunk size in tokens
            chunk_overlap: Overlap between chunks in tokens
        """
        self.graphrag = graphrag_client
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        # Initialize embedding model
        if SentenceTransformer:
            try:
                self.embedder = SentenceTransformer(embedding_model)
                logger.info(f"Loaded embedding model: {embedding_model}")
            except Exception as e:
                logger.warning(f"Failed to load embedding model: {e}. Using mock embeddings.")
                self.embedder = None
        else:
            logger.warning("sentence-transformers not installed. Using mock embeddings.")
            self.embedder = None

    async def ingest_document(
        self,
        file_path: str,
        document_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        replace_existing: bool = False
    ) -> Dict[str, Any]:
        """
        Ingest a document into centralized GraphRAG.

        Process:
        1. Load and parse document
        2. Chunk into semantic segments
        3. Generate embeddings
        4. Check for duplicates
        5. Store as entities
        6. Create relationships

        Args:
            file_path: Path to document file
            document_type: Category (finra, cfp, tax_law, etc.)
            metadata: Additional metadata (source, date, author)
            replace_existing: If True, replace existing document with same hash

        Returns:
            {
                "document_id": str,
                "file_name": str,
                "document_type": str,
                "chunks_stored": int,
                "relationships_created": int,
                "duplicate": bool,
                "status": "success" | "duplicate_skipped",
                "processing_time_ms": float
            }

        Raises:
            GraphRAGError: If ingestion fails
        """
        start_time = datetime.now(timezone.utc)

        try:
            path = Path(file_path)
            if not path.exists():
                raise GraphRAGError(f"File not found: {file_path}")

            logger.info(f"Starting ingestion: {path.name} ({document_type})")

            # 1. Load and parse document
            content = await self._load_document(path)

            # 2. Calculate document hash for duplicate detection
            doc_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

            # Check for duplicates
            if not replace_existing:
                existing = await self._check_duplicate(doc_hash)
                if existing:
                    logger.info(f"Document already exists: {path.name} (hash: {doc_hash[:8]})")
                    return {
                        "document_id": existing,
                        "file_name": path.name,
                        "document_type": document_type,
                        "chunks_stored": 0,
                        "relationships_created": 0,
                        "duplicate": True,
                        "status": "duplicate_skipped",
                        "processing_time_ms": 0
                    }

            # 3. Chunk into semantic segments
            chunks = self._chunk_document(content)
            logger.info(f"Document chunked into {len(chunks)} segments")

            # 4. Generate embeddings
            embeddings = self._generate_embeddings(chunks)

            # 5. Prepare metadata
            doc_metadata = {
                "file_name": path.name,
                "file_size": path.stat().st_size,
                "file_type": path.suffix,
                "document_hash": doc_hash,
                "ingestion_date": datetime.now(timezone.utc).isoformat(),
                "document_type_name": self.DOCUMENT_TYPES.get(document_type, document_type),
                **(metadata or {})
            }

            # 6. Store document header entity
            document_id = await self.graphrag.store_entity(
                user_id=self.CENTRALIZED_USER_ID,
                entity_type=f"{document_type}_document",
                properties={
                    "title": path.stem,
                    "chunk_count": len(chunks),
                    "content_preview": content[:500],
                    **doc_metadata
                },
                embedding=embeddings[0] if embeddings else None,
                metadata=doc_metadata
            )

            logger.info(f"Document header stored: {document_id}")

            # 7. Store chunks as entities
            chunk_ids = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_id = await self.graphrag.store_entity(
                    user_id=self.CENTRALIZED_USER_ID,
                    entity_type=f"{document_type}_chunk",
                    properties={
                        "content": chunk,
                        "chunk_index": i,
                        "parent_document_id": document_id,
                        "document_title": path.stem,
                        "word_count": len(chunk.split())
                    },
                    embedding=embedding,
                    metadata={
                        "document_hash": doc_hash,
                        "chunk_total": len(chunks)
                    }
                )
                chunk_ids.append(chunk_id)

            logger.info(f"Stored {len(chunk_ids)} chunks")

            # 8. Create relationships
            relationship_count = 0

            # Link header to all chunks
            for chunk_id in chunk_ids:
                await self.graphrag.store_relationship(
                    user_id=self.CENTRALIZED_USER_ID,
                    source_entity_id=document_id,
                    target_entity_id=chunk_id,
                    relationship_type="contains",
                    properties={"relationship": "document_to_chunk"}
                )
                relationship_count += 1

            # Sequential chunk relationships
            for i in range(len(chunk_ids) - 1):
                await self.graphrag.store_relationship(
                    user_id=self.CENTRALIZED_USER_ID,
                    source_entity_id=chunk_ids[i],
                    target_entity_id=chunk_ids[i + 1],
                    relationship_type="follows",
                    properties={"sequence": i}
                )
                relationship_count += 1

            # Calculate processing time
            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

            logger.info(
                f"Ingestion complete: {path.name} - "
                f"{len(chunk_ids)} chunks, {relationship_count} relationships "
                f"({processing_time:.2f}ms)"
            )

            return {
                "document_id": document_id,
                "file_name": path.name,
                "document_type": document_type,
                "chunks_stored": len(chunk_ids),
                "relationships_created": relationship_count,
                "duplicate": False,
                "status": "success",
                "processing_time_ms": processing_time
            }

        except Exception as e:
            logger.error(f"Document ingestion failed: {e}", error=e)
            raise GraphRAGError(f"Failed to ingest document: {e}")

    async def _load_document(self, path: Path) -> str:
        """Load and parse document based on file extension."""
        try:
            if path.suffix.lower() == ".pdf":
                return await self._parse_pdf(path)
            elif path.suffix.lower() in [".html", ".htm"]:
                return await self._parse_html(path)
            elif path.suffix.lower() in [".md", ".markdown", ".txt"]:
                return path.read_text(encoding='utf-8')
            else:
                # Try reading as plain text
                return path.read_text(encoding='utf-8')
        except Exception as e:
            raise GraphRAGError(f"Failed to load document: {e}")

    async def _parse_pdf(self, path: Path) -> str:
        """Parse PDF file and extract text."""
        if not PyPDF2:
            raise GraphRAGError("PyPDF2 not installed. Install with: pip install PyPDF2")

        try:
            text = []
            with open(path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    text.append(page.extract_text())
            return "\n\n".join(text)
        except Exception as e:
            raise GraphRAGError(f"Failed to parse PDF: {e}")

    async def _parse_html(self, path: Path) -> str:
        """Parse HTML file and extract text."""
        if not BeautifulSoup:
            raise GraphRAGError("BeautifulSoup not installed. Install with: pip install beautifulsoup4")

        try:
            html = path.read_text(encoding='utf-8')
            soup = BeautifulSoup(html, 'html.parser')

            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            # Get text
            text = soup.get_text()

            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = '\n'.join(chunk for chunk in chunks if chunk)

            return text
        except Exception as e:
            raise GraphRAGError(f"Failed to parse HTML: {e}")

    def _chunk_document(self, content: str) -> List[str]:
        """
        Chunk document into overlapping segments using sentence boundaries.

        Uses a simple sentence-based approach:
        - Split by sentence boundaries (. ! ?)
        - Combine sentences until chunk_size is reached
        - Add overlap from previous chunk
        """
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', content)

        chunks = []
        current_chunk = []
        current_length = 0
        overlap_sentences = []

        for sentence in sentences:
            sentence_length = len(sentence.split())

            # Check if adding this sentence exceeds chunk size
            if current_length + sentence_length > self.chunk_size and current_chunk:
                # Save current chunk
                chunks.append(" ".join(current_chunk))

                # Calculate overlap
                overlap_length = 0
                overlap_sentences = []
                for s in reversed(current_chunk):
                    s_len = len(s.split())
                    if overlap_length + s_len <= self.chunk_overlap:
                        overlap_sentences.insert(0, s)
                        overlap_length += s_len
                    else:
                        break

                # Start new chunk with overlap
                current_chunk = overlap_sentences + [sentence]
                current_length = sum(len(s.split()) for s in current_chunk)
            else:
                current_chunk.append(sentence)
                current_length += sentence_length

        # Add final chunk
        if current_chunk:
            chunks.append(" ".join(current_chunk))

        return chunks

    def _generate_embeddings(self, chunks: List[str]) -> List[List[float]]:
        """Generate embeddings for text chunks."""
        if self.embedder:
            try:
                embeddings = self.embedder.encode(chunks)
                return [emb.tolist() for emb in embeddings]
            except Exception as e:
                logger.warning(f"Embedding generation failed: {e}. Using mock embeddings.")

        # Mock embeddings (384 dimensions for all-MiniLM-L6-v2)
        import random
        return [[random.random() for _ in range(384)] for _ in chunks]

    async def _check_duplicate(self, doc_hash: str) -> Optional[str]:
        """
        Check if document with same hash already exists.

        Returns:
            document_id if duplicate found, None otherwise
        """
        # This would query the database for existing documents with the same hash
        # For now, return None (no duplicate detection in GraphRAG client yet)
        # TODO: Implement duplicate check in GraphRAG client
        return None

    async def list_documents(
        self,
        document_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        List ingested documents.

        Args:
            document_type: Filter by document type (optional)
            limit: Maximum number of documents to return

        Returns:
            List of document metadata dicts
        """
        # This would query entities with entity_type ending in "_document"
        # For now, return empty list
        # TODO: Implement in GraphRAG client
        return []

    async def delete_document(self, document_id: str) -> Dict[str, Any]:
        """
        Delete document and all its chunks.

        Args:
            document_id: Document entity ID

        Returns:
            {"deleted": True, "chunks_deleted": int}
        """
        # This would delete the document entity and all related chunks
        # TODO: Implement in GraphRAG client
        return {"deleted": False, "error": "Not implemented"}


# Global instance (lazy initialization)
_ingestion_pipeline: Optional[DocumentIngestionPipeline] = None


async def get_ingestion_pipeline(graphrag_client=None) -> DocumentIngestionPipeline:
    """
    Get or create global document ingestion pipeline.

    Args:
        graphrag_client: GraphRAG client (required on first call)

    Returns:
        Shared DocumentIngestionPipeline instance
    """
    global _ingestion_pipeline

    if _ingestion_pipeline is None:
        if graphrag_client is None:
            raise ValueError("graphrag_client required on first call")

        _ingestion_pipeline = DocumentIngestionPipeline(graphrag_client)
        logger.info("Global document ingestion pipeline created")

    return _ingestion_pipeline
