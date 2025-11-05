"""Entity Extraction and Embedding Generation"""

import asyncio
from typing import Dict, List, Any, Optional, Tuple
import structlog
import httpx
import numpy as np

logger = structlog.get_logger(__name__)


class EntityExtractor:
    """
    Extract entities from text using Maverick LLM.

    Identifies:
    - People
    - Organizations
    - Locations
    - Concepts
    - Events
    - Relationships between entities
    """

    def __init__(self, llm_endpoint: str = "http://localhost:8090/v1/chat/completions"):
        self.llm_endpoint = llm_endpoint
        self.client = httpx.AsyncClient(timeout=120.0)

    async def extract_entities(
        self,
        text: str,
        chunk_size: int = 2000
    ) -> Dict[str, Any]:
        """
        Extract entities from text.

        Args:
            text: Text to analyze
            chunk_size: Maximum characters per chunk

        Returns:
            Dictionary containing:
                - entities: List of extracted entities
                - relationships: List of relationships between entities
        """
        logger.info("extracting_entities", text_length=len(text))

        # Split text into manageable chunks
        chunks = self._split_text(text, chunk_size)

        # Extract entities from each chunk
        all_entities = []
        all_relationships = []

        for chunk in chunks:
            entities, relationships = await self._extract_from_chunk(chunk)
            all_entities.extend(entities)
            all_relationships.extend(relationships)

        # Deduplicate entities
        unique_entities = self._deduplicate_entities(all_entities)

        logger.info(
            "extraction_complete",
            entities=len(unique_entities),
            relationships=len(all_relationships)
        )

        return {
            "entities": unique_entities,
            "relationships": all_relationships,
        }

    async def _extract_from_chunk(self, chunk: str) -> Tuple[List[Dict], List[Dict]]:
        """Extract entities from a single chunk"""

        prompt = f"""Analyze the following text and extract:
1. Named entities (people, organizations, locations, concepts, events)
2. Relationships between entities

Text:
{chunk}

Provide your response in the following JSON format:
{{
  "entities": [
    {{"name": "Entity Name", "type": "person|organization|location|concept|event", "description": "brief description"}}
  ],
  "relationships": [
    {{"from": "Entity 1", "to": "Entity 2", "type": "relationship_type", "description": "brief description"}}
  ]
}}"""

        try:
            response = await self.client.post(
                self.llm_endpoint,
                json={
                    "model": "maverick",
                    "messages": [
                        {"role": "system", "content": "You are an expert at extracting structured information from text. Always respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2000,
                }
            )

            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]

                # Parse JSON response
                import json
                try:
                    # Try to extract JSON from markdown code blocks
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()

                    data = json.loads(content)
                    return data.get("entities", []), data.get("relationships", [])

                except json.JSONDecodeError as e:
                    logger.error("json_parse_error", error=str(e), content=content[:200])
                    return [], []

            else:
                logger.error("llm_request_failed", status=response.status_code)
                return [], []

        except Exception as e:
            logger.error("entity_extraction_failed", error=str(e), exc_info=True)
            return [], []

    def _split_text(self, text: str, chunk_size: int) -> List[str]:
        """Split text into chunks"""
        chunks = []
        current_chunk = []
        current_size = 0

        # Split by sentences (approximate)
        sentences = text.replace('\n', ' ').split('. ')

        for sentence in sentences:
            sentence_size = len(sentence)

            if current_size + sentence_size > chunk_size and current_chunk:
                chunks.append('. '.join(current_chunk) + '.')
                current_chunk = []
                current_size = 0

            current_chunk.append(sentence)
            current_size += sentence_size

        if current_chunk:
            chunks.append('. '.join(current_chunk))

        return chunks

    def _deduplicate_entities(self, entities: List[Dict]) -> List[Dict]:
        """Remove duplicate entities"""
        seen = set()
        unique = []

        for entity in entities:
            # Create a key based on name and type
            key = (entity.get("name", "").lower(), entity.get("type", ""))

            if key not in seen:
                seen.add(key)
                unique.append(entity)

        return unique

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


class EmbeddingGenerator:
    """
    Generate embeddings for text chunks.

    Supports:
    - OpenAI-compatible embedding endpoints
    - Local sentence transformers
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        model: str = "text-embedding-3-small",
        use_local: bool = True
    ):
        self.endpoint = endpoint
        self.model = model
        self.use_local = use_local
        self.local_model = None

        if use_local:
            self._load_local_model()

    def _load_local_model(self):
        """Load local sentence transformer model"""
        try:
            from sentence_transformers import SentenceTransformer

            logger.info("loading_local_embedding_model")
            self.local_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("local_embedding_model_loaded")

        except ImportError:
            logger.warning(
                "sentence_transformers_not_installed",
                message="Install with: pip install sentence-transformers"
            )
            self.use_local = False

        except Exception as e:
            logger.error("local_model_load_failed", error=str(e))
            self.use_local = False

    async def generate_embeddings(
        self,
        texts: List[str],
        batch_size: int = 32
    ) -> List[List[float]]:
        """
        Generate embeddings for text chunks.

        Args:
            texts: List of text chunks
            batch_size: Number of texts to process at once

        Returns:
            List of embedding vectors
        """
        logger.info("generating_embeddings", count=len(texts))

        if self.use_local and self.local_model:
            return await self._generate_local_embeddings(texts, batch_size)
        elif self.endpoint:
            return await self._generate_api_embeddings(texts, batch_size)
        else:
            logger.error("no_embedding_method_available")
            raise ValueError("No embedding generation method available")

    async def _generate_local_embeddings(
        self,
        texts: List[str],
        batch_size: int
    ) -> List[List[float]]:
        """Generate embeddings using local model"""

        def _encode_batch(batch):
            return self.local_model.encode(batch, show_progress_bar=False)

        # Process in batches to avoid memory issues
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(None, _encode_batch, batch)

            all_embeddings.extend(embeddings.tolist())

        logger.info("local_embeddings_generated", count=len(all_embeddings))
        return all_embeddings

    async def _generate_api_embeddings(
        self,
        texts: List[str],
        batch_size: int
    ) -> List[List[float]]:
        """Generate embeddings using API endpoint"""

        async with httpx.AsyncClient(timeout=60.0) as client:
            all_embeddings = []

            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]

                try:
                    response = await client.post(
                        self.endpoint,
                        json={
                            "model": self.model,
                            "input": batch,
                        }
                    )

                    if response.status_code == 200:
                        result = response.json()
                        embeddings = [item["embedding"] for item in result["data"]]
                        all_embeddings.extend(embeddings)
                    else:
                        logger.error(
                            "api_embedding_failed",
                            status=response.status_code,
                            batch_index=i
                        )
                        # Return zero vectors as fallback
                        all_embeddings.extend([[0.0] * 384] * len(batch))

                except Exception as e:
                    logger.error(
                        "embedding_request_failed",
                        error=str(e),
                        batch_index=i
                    )
                    # Return zero vectors as fallback
                    all_embeddings.extend([[0.0] * 384] * len(batch))

            logger.info("api_embeddings_generated", count=len(all_embeddings))
            return all_embeddings

    def get_embedding_dimension(self) -> int:
        """Get the dimension of generated embeddings"""
        if self.use_local and self.local_model:
            return self.local_model.get_sentence_embedding_dimension()
        else:
            # Default for text-embedding-3-small
            return 1536


class ConceptExtractor:
    """
    Extract high-level concepts and themes from text.

    Uses LLM to identify:
    - Main topics
    - Key concepts
    - Themes
    - Categories
    """

    def __init__(self, llm_endpoint: str = "http://localhost:8090/v1/chat/completions"):
        self.llm_endpoint = llm_endpoint
        self.client = httpx.AsyncClient(timeout=60.0)

    async def extract_concepts(self, text: str) -> List[Dict[str, str]]:
        """
        Extract concepts from text.

        Args:
            text: Text to analyze

        Returns:
            List of concepts with names and descriptions
        """
        logger.info("extracting_concepts", text_length=len(text))

        # Limit text length for concept extraction
        text_sample = text[:4000]

        prompt = f"""Analyze the following text and identify the main concepts, topics, and themes.

Text:
{text_sample}

Provide a JSON list of concepts:
[
  {{"name": "Concept Name", "description": "brief description", "category": "category"}}
]"""

        try:
            response = await self.client.post(
                self.llm_endpoint,
                json={
                    "model": "maverick",
                    "messages": [
                        {"role": "system", "content": "You are an expert at identifying key concepts and themes. Always respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000,
                }
            )

            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]

                import json
                try:
                    # Try to extract JSON
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()

                    concepts = json.loads(content)
                    logger.info("concepts_extracted", count=len(concepts))
                    return concepts

                except json.JSONDecodeError as e:
                    logger.error("json_parse_error", error=str(e))
                    return []

            else:
                logger.error("llm_request_failed", status=response.status_code)
                return []

        except Exception as e:
            logger.error("concept_extraction_failed", error=str(e), exc_info=True)
            return []

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
