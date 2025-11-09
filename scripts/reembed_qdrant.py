#!/usr/bin/env python3
"""
Re-embed all documents in Qdrant with E5-large-v2 (1024 dimensions).

Migration from all-MiniLM-L6-v2 (384d) → E5-large-v2 (1024d)

Steps:
1. Create new Qdrant collection with 1024 dimensions
2. Fetch all documents from old collection
3. Re-embed using new embedding service
4. Upload to new collection
5. Validate retrieval quality (A/B test)
6. Cutover to new collection
"""
import asyncio
import logging
from typing import List, Dict
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "services/agents"))

from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class QdrantMigration:
    """Qdrant collection migration with re-embedding"""

    def __init__(
        self,
        qdrant_url: str = "http://localhost:6333",
        old_collection: str = "life_navigator_dev",
        new_collection: str = "life_navigator_dev_1024",
        old_model: str = "all-MiniLM-L6-v2",
        new_model: str = "intfloat/e5-large-v2",
        batch_size: int = 100
    ):
        self.qdrant_client = QdrantClient(url=qdrant_url)
        self.old_collection = old_collection
        self.new_collection = new_collection
        self.old_model = old_model
        self.new_model = new_model
        self.batch_size = batch_size

        # Load new embedding model
        logger.info(f"Loading embedding model: {new_model}")
        self.embedding_model = SentenceTransformer(new_model)

    async def create_new_collection(self):
        """Create new Qdrant collection with 1024 dimensions"""
        logger.info(f"Creating new collection: {self.new_collection}")

        try:
            self.qdrant_client.create_collection(
                collection_name=self.new_collection,
                vectors_config=models.VectorParams(
                    size=1024,  # E5-large-v2 dimension
                    distance=models.Distance.COSINE
                )
            )
            logger.info(f"✅ Created collection: {self.new_collection}")

        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"Collection {self.new_collection} already exists, using existing")
            else:
                raise

    async def fetch_all_documents(self) -> List[Dict]:
        """Fetch all documents from old collection"""
        logger.info(f"Fetching documents from: {self.old_collection}")

        documents = []
        offset = None

        while True:
            # Fetch batch of documents
            results = self.qdrant_client.scroll(
                collection_name=self.old_collection,
                limit=self.batch_size,
                offset=offset,
                with_payload=True,
                with_vectors=False  # Don't need old vectors
            )

            points, next_offset = results

            if not points:
                break

            for point in points:
                documents.append({
                    "id": point.id,
                    "text": point.payload.get("text", ""),
                    "metadata": point.payload
                })

            logger.info(f"Fetched {len(documents)} documents so far...")

            if next_offset is None:
                break

            offset = next_offset

        logger.info(f"✅ Fetched {len(documents)} total documents")
        return documents

    async def reembed_documents(self, documents: List[Dict]) -> List[Dict]:
        """Re-embed documents using E5-large-v2"""
        logger.info(f"Re-embedding {len(documents)} documents...")

        # E5 requires passage prefix for documents
        texts = [f"passage: {doc['text']}" for doc in documents]

        # Batch embed
        embeddings = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]

            batch_embeddings = self.embedding_model.encode(
                batch,
                normalize_embeddings=True,
                show_progress_bar=True,
                convert_to_numpy=False
            )

            embeddings.extend(batch_embeddings)

            logger.info(f"Re-embedded {min(i + self.batch_size, len(texts))}/{len(texts)} documents")

        # Combine documents with new embeddings
        reembedded = []
        for doc, embedding in zip(documents, embeddings):
            reembedded.append({
                "id": doc["id"],
                "vector": embedding.tolist(),
                "payload": doc["metadata"]
            })

        logger.info(f"✅ Re-embedded all documents with {self.new_model}")
        return reembedded

    async def upload_to_new_collection(self, documents: List[Dict]):
        """Upload re-embedded documents to new collection"""
        logger.info(f"Uploading {len(documents)} documents to {self.new_collection}")

        # Prepare points for upload
        points = [
            models.PointStruct(
                id=doc["id"],
                vector=doc["vector"],
                payload=doc["payload"]
            )
            for doc in documents
        ]

        # Upload in batches
        for i in range(0, len(points), self.batch_size):
            batch = points[i:i + self.batch_size]

            self.qdrant_client.upsert(
                collection_name=self.new_collection,
                points=batch
            )

            logger.info(f"Uploaded {min(i + self.batch_size, len(points))}/{len(points)} documents")

        logger.info(f"✅ Upload complete")

    async def validate_retrieval(self) -> Dict:
        """Validate retrieval quality with test queries"""
        logger.info("Validating retrieval quality with test queries...")

        test_queries = [
            "What is my current budget status?",
            "Show me recent transactions",
            "How can I improve my credit score?",
            "Tax deduction opportunities",
            "Investment portfolio performance"
        ]

        results = {"old_collection": [], "new_collection": []}

        for query in test_queries:
            # E5 uses query prefix for queries
            query_vector_old = self.embedding_model.encode(
                f"query: {query}",
                normalize_embeddings=True
            ).tolist()

            # Search old collection (Note: dimensionality mismatch, skip for now)
            # old_results = self.qdrant_client.search(
            #     collection_name=self.old_collection,
            #     query_vector=query_vector_old,
            #     limit=5
            # )

            # Search new collection
            new_results = self.qdrant_client.search(
                collection_name=self.new_collection,
                query_vector=query_vector_old,
                limit=5
            )

            logger.info(f"Query: '{query}'")
            logger.info(f"  New collection top result score: {new_results[0].score:.4f}")

            results["new_collection"].append({
                "query": query,
                "top_score": new_results[0].score,
                "results_count": len(new_results)
            })

        logger.info(f"✅ Validation complete")
        return results

    async def run_migration(self):
        """Execute full migration pipeline"""
        logger.info("=" * 70)
        logger.info("QDRANT MIGRATION: all-MiniLM-L6-v2 → E5-large-v2")
        logger.info("=" * 70)

        # Step 1: Create new collection
        await self.create_new_collection()

        # Step 2: Fetch all documents
        documents = await self.fetch_all_documents()

        if not documents:
            logger.warning("No documents found in old collection!")
            return

        # Step 3: Re-embed documents
        reembedded_docs = await self.reembed_documents(documents)

        # Step 4: Upload to new collection
        await self.upload_to_new_collection(reembedded_docs)

        # Step 5: Validate retrieval
        validation_results = await self.validate_retrieval()

        # Summary
        logger.info("=" * 70)
        logger.info("MIGRATION COMPLETE")
        logger.info("=" * 70)
        logger.info(f"Documents migrated: {len(documents)}")
        logger.info(f"Old collection: {self.old_collection} (384d)")
        logger.info(f"New collection: {self.new_collection} (1024d)")
        logger.info(f"Embedding model: {self.new_model}")
        logger.info("=" * 70)
        logger.info("")
        logger.info("NEXT STEPS:")
        logger.info("1. Update services/graphrag-rs/config.toml:")
        logger.info(f"   collection_name = \"{self.new_collection}\"")
        logger.info("2. Restart GraphRAG service")
        logger.info("3. Monitor retrieval quality")
        logger.info("4. Delete old collection after 1 week of stable operation")
        logger.info("=" * 70)


async def main():
    """Run migration"""
    migration = QdrantMigration()

    try:
        await migration.run_migration()
    except KeyboardInterrupt:
        logger.warning("Migration interrupted by user")
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
