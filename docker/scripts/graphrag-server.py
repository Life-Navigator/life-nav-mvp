#!/usr/bin/env python3
"""
GraphRAG HTTP Server - Cloud Run Entry Point

This FastAPI server wraps the GraphRAG functionality to provide
an HTTP API for Cloud Run deployment.
"""

import logging
import os
import sys
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Configure logging for Cloud Run (JSON format)
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Life Navigator GraphRAG API",
    description="Graph-based Retrieval Augmented Generation service",
    version="1.0.0",
)


# Request/Response Models
class QueryRequest(BaseModel):
    """Request model for GraphRAG queries."""
    query: str
    user_id: Optional[str] = None
    context: Optional[dict] = None
    max_results: int = 10
    include_sources: bool = True


class QueryResponse(BaseModel):
    """Response model for GraphRAG queries."""
    answer: str
    sources: list[dict] = []
    entities: list[dict] = []
    relationships: list[dict] = []
    confidence: float = 0.0


class IndexRequest(BaseModel):
    """Request model for document indexing."""
    document_id: str
    content: str
    metadata: Optional[dict] = None
    extract_entities: bool = True


class IndexResponse(BaseModel):
    """Response model for document indexing."""
    document_id: str
    entities_extracted: int
    relationships_created: int
    success: bool


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    services: dict


# Initialize GraphRAG service
graphrag_service = None


def get_graphrag_service():
    """Lazily initialize and return the GraphRAG service."""
    global graphrag_service
    if graphrag_service is None:
        try:
            from graphrag.service import GraphRAGService
            graphrag_service = GraphRAGService()
            logger.info("GraphRAG service initialized successfully")
        except ImportError as e:
            logger.warning(f"GraphRAG module not available: {e}")
            # Return a mock service for testing
            graphrag_service = MockGraphRAGService()
    return graphrag_service


class MockGraphRAGService:
    """Mock service for testing when full GraphRAG is not available."""

    async def query(self, query: str, **kwargs) -> dict:
        return {
            "answer": f"Mock response for: {query}",
            "sources": [],
            "entities": [],
            "relationships": [],
            "confidence": 0.0,
        }

    async def index_document(self, document_id: str, content: str, **kwargs) -> dict:
        return {
            "document_id": document_id,
            "entities_extracted": 0,
            "relationships_created": 0,
            "success": True,
        }

    def health_check(self) -> dict:
        return {
            "neo4j": "mock",
            "qdrant": "mock",
            "embeddings": "mock",
        }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for Cloud Run."""
    service = get_graphrag_service()

    try:
        services = service.health_check()
        return HealthResponse(
            status="healthy",
            version="1.0.0",
            services=services
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="degraded",
            version="1.0.0",
            services={"error": str(e)}
        )


@app.post("/query", response_model=QueryResponse)
async def query_knowledge_graph(request: QueryRequest):
    """
    Query the knowledge graph using GraphRAG.

    This endpoint performs semantic search and graph traversal
    to find relevant information and generate answers.
    """
    logger.info(f"Query received: {request.query[:100]}...")

    service = get_graphrag_service()

    try:
        result = await service.query(
            query=request.query,
            user_id=request.user_id,
            context=request.context,
            max_results=request.max_results,
            include_sources=request.include_sources,
        )

        return QueryResponse(
            answer=result.get("answer", ""),
            sources=result.get("sources", []),
            entities=result.get("entities", []),
            relationships=result.get("relationships", []),
            confidence=result.get("confidence", 0.0),
        )

    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/index", response_model=IndexResponse)
async def index_document(request: IndexRequest):
    """
    Index a document into the knowledge graph.

    This endpoint extracts entities and relationships from the document
    and adds them to the graph for later retrieval.
    """
    logger.info(f"Indexing document: {request.document_id}")

    service = get_graphrag_service()

    try:
        result = await service.index_document(
            document_id=request.document_id,
            content=request.content,
            metadata=request.metadata,
            extract_entities=request.extract_entities,
        )

        return IndexResponse(
            document_id=result.get("document_id", request.document_id),
            entities_extracted=result.get("entities_extracted", 0),
            relationships_created=result.get("relationships_created", 0),
            success=result.get("success", True),
        )

    except Exception as e:
        logger.error(f"Indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/entities/{entity_id}")
async def get_entity(entity_id: str):
    """Get a specific entity from the knowledge graph."""
    service = get_graphrag_service()

    try:
        entity = await service.get_entity(entity_id)
        if entity is None:
            raise HTTPException(status_code=404, detail="Entity not found")
        return entity
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/relationships")
async def get_relationships(
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
    relationship_type: Optional[str] = None,
    limit: int = 100
):
    """Query relationships in the knowledge graph."""
    service = get_graphrag_service()

    try:
        relationships = await service.get_relationships(
            source_id=source_id,
            target_id=target_id,
            relationship_type=relationship_type,
            limit=limit,
        )
        return {"relationships": relationships}
    except Exception as e:
        logger.error(f"Failed to get relationships: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info("Starting GraphRAG API server")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'unknown')}")

    # Pre-initialize the service
    get_graphrag_service()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down GraphRAG API server")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
