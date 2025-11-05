# GraphRAG System Architecture
## Centralized + Personalized Knowledge Graph with Context & Memory

**Last Updated:** 2025-10-31
**Status:** Design Phase
**LLM Backend:** Llama-4-Maverick (Q4_K_M local, Q6_K GCP production)

---

## Executive Summary

This document outlines the architecture for a dual-mode GraphRAG system:

1. **Centralized GraphRAG** - Shared organizational knowledge
2. **Personalized GraphRAG** - User-specific knowledge with row-level security
3. **Context Management** - Dynamic context injection and retrieval
4. **Memory System** - Conversation history and learned preferences

### Key Features
- ✅ Multi-tenant with row-level security (RLS)
- ✅ Hybrid vector + graph search
- ✅ Conversational memory with context
- ✅ Real-time knowledge updates
- ✅ Privacy-preserving personalization
- ✅ Integration with Maverick LLM

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                      │
│  (Chat UI, API Endpoints, Admin Dashboard, Mobile Apps)         │
└───────────────────┬─────────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────────┐
│                    API Gateway & Auth Layer                      │
│  - User Authentication (JWT, OAuth2)                            │
│  - Authorization & RLS Enforcement                               │
│  - Rate Limiting & Request Routing                               │
└───────────────────┬─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌────────▼─────────┐
│  Centralized   │    │   Personalized   │
│   GraphRAG     │    │    GraphRAG      │
│                │    │   (with RLS)     │
└───────┬────────┘    └────────┬─────────┘
        │                      │
        └──────────┬───────────┘
                   │
        ┌──────────▼──────────┐
        │  Knowledge Manager   │
        │  - Context Builder   │
        │  - Memory Manager    │
        │  - Graph Operations  │
        └──────────┬──────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────┐  ┌─────▼─────┐  ┌────▼────┐
│ Vector │  │   Graph   │  │ Memory  │
│  Store │  │ Database  │  │  Store  │
│(Qdrant)│  │  (Neo4j)  │  │ (Redis) │
└────┬───┘  └─────┬─────┘  └────┬────┘
     │            │              │
     └────────────┼──────────────┘
                  │
        ┌─────────▼──────────┐
        │   Maverick LLM     │
        │  (Q4 Local/Test)   │
        │  (Q6 GCP/Prod)     │
        └────────────────────┘
```

---

## 1. Centralized GraphRAG

### Purpose
Shared organizational knowledge accessible to all authorized users.

### Components

#### 1.1 Knowledge Graph Structure
```
Entities:
- Documents
- Concepts
- People
- Projects
- Organizations
- Events
- Facts

Relationships:
- MENTIONS
- RELATES_TO
- AUTHORED_BY
- PART_OF
- OCCURRED_IN
- REFERENCES
- DERIVED_FROM
```

#### 1.2 Data Model
```cypher
// Document Node
(:Document {
  id: UUID,
  title: String,
  content: String,
  embedding: Vector[1536],
  created_at: DateTime,
  updated_at: DateTime,
  source: String,
  metadata: Map
})

// Concept Node
(:Concept {
  id: UUID,
  name: String,
  description: String,
  embedding: Vector[1536],
  importance: Float,
  category: String
})

// Relationship with weights
-[:RELATES_TO {
  strength: Float,
  context: String,
  extracted_at: DateTime
}]->
```

#### 1.3 Indexing Strategy
```python
# Vector Index for semantic search
CREATE VECTOR INDEX document_embeddings
FOR (d:Document)
ON d.embedding
OPTIONS {
  dimension: 1536,
  similarity: 'cosine'
}

# Full-text search for keyword matching
CREATE FULLTEXT INDEX document_content
FOR (d:Document)
ON EACH [d.title, d.content]

# Property indexes for filtering
CREATE INDEX document_created_at FOR (d:Document) ON d.created_at
CREATE INDEX concept_category FOR (c:Concept) ON c.category
```

#### 1.4 Ingestion Pipeline
```
Source Data → Document Parser → Entity Extraction (Maverick)
     ↓              ↓                    ↓
Chunking → Embedding (Maverick) → Relationship Extraction
     ↓              ↓                    ↓
 Neo4j Graph ← Qdrant Vectors ← Validation & Deduplication
```

---

## 2. Personalized GraphRAG with Row-Level Security

### Purpose
User-specific knowledge with strict access controls and privacy.

### 2.1 RLS Implementation

#### Database Schema
```sql
-- User table
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User nodes in Neo4j
(:User {
  user_id: UUID,
  username: String,
  tenant_id: UUID,
  access_level: Integer
})

-- All personalized nodes include ownership
(:PersonalDocument {
  id: UUID,
  user_id: UUID,  // Owner
  tenant_id: UUID,  // Organization
  content: String,
  embedding: Vector[1536],
  is_private: Boolean,
  shared_with: [UUID],  // List of user_ids with access
  created_at: DateTime
})
```

#### RLS Policy (PostgreSQL for metadata)
```sql
-- Enable RLS
ALTER TABLE personal_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own documents
CREATE POLICY personal_document_access ON personal_documents
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id')::UUID
    OR current_setting('app.current_user_id')::UUID = ANY(shared_with)
    OR current_setting('app.user_role') = 'admin'
  );

-- Policy: Users can only modify their own documents
CREATE POLICY personal_document_modify ON personal_documents
  FOR UPDATE
  USING (user_id = current_setting('app.current_user_id')::UUID);
```

#### Neo4j RLS via Query Wrapping
```cypher
// Every personalized query is wrapped with access control
MATCH (u:User {user_id: $current_user_id})
MATCH (d:PersonalDocument)
WHERE d.user_id = u.user_id
  OR u.user_id IN d.shared_with
  OR u.access_level >= 99  // Admin
RETURN d
```

### 2.2 Privacy & Security

**Data Isolation:**
- Physical: Separate Qdrant collections per tenant
- Logical: User_id filtering in all queries
- Encryption: At-rest encryption for embeddings
- Audit: All access logged with user_id + timestamp

**Sharing Model:**
```python
# User A shares document with User B
MATCH (doc:PersonalDocument {id: $doc_id, user_id: $user_a_id})
SET doc.shared_with = doc.shared_with + [$user_b_id]

# Create sharing relationship
MATCH (a:User {user_id: $user_a_id})
MATCH (b:User {user_id: $user_b_id})
MATCH (doc:PersonalDocument {id: $doc_id})
CREATE (a)-[:SHARED {
  shared_at: datetime(),
  permissions: ['read']
}]->(doc)<-[:HAS_ACCESS]-(b)
```

---

## 3. Context Management System

### Purpose
Dynamically inject relevant context into LLM prompts based on conversation state and user intent.

### 3.1 Context Types

```python
class ContextType(Enum):
    CONVERSATIONAL = "conversational"  # Recent chat history
    SEMANTIC = "semantic"              # Vector-retrieved docs
    GRAPH = "graph"                    # Graph-traversed knowledge
    TEMPORAL = "temporal"              # Time-based context
    USER_PROFILE = "user_profile"      # User preferences/history
    ORGANIZATIONAL = "organizational"  # Company-wide knowledge
```

### 3.2 Context Builder

```python
class ContextBuilder:
    """Builds optimal context for LLM prompts"""

    def __init__(
        self,
        max_tokens: int = 32000,  # Maverick supports 1M, but start conservative
        relevance_threshold: float = 0.7
    ):
        self.max_tokens = max_tokens
        self.relevance_threshold = relevance_threshold

    async def build_context(
        self,
        user_id: str,
        query: str,
        conversation_id: str,
        context_types: List[ContextType]
    ) -> Dict[str, Any]:
        """Build multi-faceted context"""

        context_parts = []

        # 1. Conversational context (recent messages)
        if ContextType.CONVERSATIONAL in context_types:
            recent_messages = await self.get_conversation_history(
                conversation_id, limit=10
            )
            context_parts.append({
                "type": "conversational",
                "content": recent_messages,
                "weight": 1.0
            })

        # 2. Semantic context (vector search)
        if ContextType.SEMANTIC in context_types:
            relevant_docs = await self.semantic_search(
                query, user_id, top_k=5
            )
            context_parts.append({
                "type": "semantic",
                "content": relevant_docs,
                "weight": 0.9
            })

        # 3. Graph context (relationship traversal)
        if ContextType.GRAPH in context_types:
            graph_context = await self.graph_traverse(
                query, user_id, depth=2
            )
            context_parts.append({
                "type": "graph",
                "content": graph_context,
                "weight": 0.85
            })

        # 4. User profile context
        if ContextType.USER_PROFILE in context_types:
            user_profile = await self.get_user_profile(user_id)
            context_parts.append({
                "type": "user_profile",
                "content": user_profile,
                "weight": 0.6
            })

        # 5. Temporal context
        if ContextType.TEMPORAL in context_types:
            temporal = await self.get_temporal_context(query, user_id)
            context_parts.append({
                "type": "temporal",
                "content": temporal,
                "weight": 0.7
            })

        # Rank and truncate to fit token budget
        ranked_context = self.rank_and_truncate(context_parts)

        return {
            "context": ranked_context,
            "metadata": {
                "total_tokens": self.count_tokens(ranked_context),
                "sources": [c["type"] for c in context_parts],
                "query": query,
                "user_id": user_id
            }
        }

    def rank_and_truncate(
        self,
        context_parts: List[Dict]
    ) -> str:
        """Rank by relevance and truncate to token budget"""
        # Sort by weight * relevance
        sorted_parts = sorted(
            context_parts,
            key=lambda x: x["weight"],
            reverse=True
        )

        # Build context string within budget
        context_str = ""
        tokens_used = 0

        for part in sorted_parts:
            part_text = self.format_context_part(part)
            part_tokens = self.count_tokens(part_text)

            if tokens_used + part_tokens <= self.max_tokens:
                context_str += part_text + "\n\n"
                tokens_used += part_tokens
            else:
                # Truncate this part if possible
                remaining_tokens = self.max_tokens - tokens_used
                truncated = self.truncate_to_tokens(
                    part_text, remaining_tokens
                )
                context_str += truncated
                break

        return context_str
```

### 3.3 Context Retrieval Strategies

**Hybrid Search:**
```python
async def hybrid_search(
    query: str,
    user_id: str,
    alpha: float = 0.5  # Weight between vector and keyword
) -> List[Document]:
    """Combine vector similarity + keyword matching"""

    # Vector search
    vector_results = await qdrant_client.search(
        collection_name=f"user_{user_id}",
        query_vector=embed(query),
        limit=10,
        score_threshold=0.7
    )

    # Keyword search in Neo4j
    keyword_results = await neo4j_session.run("""
        CALL db.index.fulltext.queryNodes(
            'document_content', $query
        ) YIELD node, score
        WHERE node.user_id = $user_id
        RETURN node, score
        ORDER BY score DESC
        LIMIT 10
    """, query=query, user_id=user_id)

    # Merge results with weighted scoring
    merged = merge_results(
        vector_results, keyword_results, alpha
    )

    return merged[:5]  # Top 5
```

**Graph Traversal:**
```cypher
// Find related concepts within 2 hops
MATCH (start:Concept)-[:RELATES_TO*1..2]-(related:Concept)
WHERE start.name CONTAINS $query
  AND related.user_id = $user_id
RETURN DISTINCT related,
  length(shortestPath((start)-[:RELATES_TO*]-(related))) as distance
ORDER BY related.importance DESC, distance ASC
LIMIT 10
```

---

## 4. Memory System

### Purpose
Maintain conversation state, user preferences, and learned patterns over time.

### 4.1 Memory Types

```python
class MemoryType(Enum):
    SHORT_TERM = "short_term"    # Current conversation
    WORKING = "working"           # Session state
    LONG_TERM = "long_term"       # Persistent preferences
    EPISODIC = "episodic"         # Past conversations
    SEMANTIC = "semantic"         # Learned facts
```

### 4.2 Memory Architecture

**Storage:**
- **Redis** - Short-term & working memory (fast, ephemeral)
- **PostgreSQL** - Long-term memory (persistent, structured)
- **Neo4j** - Episodic & semantic memory (graph relationships)

### 4.3 Memory Manager

```python
class MemoryManager:
    """Manages multi-tiered memory system"""

    def __init__(self):
        self.redis = RedisClient()
        self.postgres = PostgresClient()
        self.neo4j = Neo4jClient()

    # ==================== SHORT-TERM MEMORY ====================

    async def add_to_conversation(
        self,
        conversation_id: str,
        message: Dict[str, Any],
        ttl: int = 3600  # 1 hour
    ):
        """Add message to short-term conversation memory"""
        key = f"conversation:{conversation_id}"
        await self.redis.lpush(key, json.dumps(message))
        await self.redis.expire(key, ttl)

    async def get_conversation_history(
        self,
        conversation_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """Retrieve recent conversation"""
        key = f"conversation:{conversation_id}"
        messages = await self.redis.lrange(key, 0, limit - 1)
        return [json.loads(m) for m in messages]

    # ==================== WORKING MEMORY ====================

    async def set_session_state(
        self,
        session_id: str,
        state: Dict[str, Any],
        ttl: int = 7200  # 2 hours
    ):
        """Store session state (current task, context, etc.)"""
        key = f"session:{session_id}"
        await self.redis.setex(
            key, ttl, json.dumps(state)
        )

    async def get_session_state(
        self,
        session_id: str
    ) -> Optional[Dict]:
        """Retrieve session state"""
        key = f"session:{session_id}"
        state = await self.redis.get(key)
        return json.loads(state) if state else None

    # ==================== LONG-TERM MEMORY ====================

    async def save_user_preference(
        self,
        user_id: str,
        preference_key: str,
        preference_value: Any
    ):
        """Store user preference"""
        await self.postgres.execute("""
            INSERT INTO user_preferences (user_id, key, value)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, key)
            DO UPDATE SET value = $3, updated_at = NOW()
        """, user_id, preference_key, json.dumps(preference_value))

    async def get_user_preferences(
        self,
        user_id: str
    ) -> Dict[str, Any]:
        """Retrieve all user preferences"""
        rows = await self.postgres.fetch("""
            SELECT key, value FROM user_preferences
            WHERE user_id = $1
        """, user_id)
        return {row['key']: json.loads(row['value']) for row in rows}

    # ==================== EPISODIC MEMORY ====================

    async def save_conversation_summary(
        self,
        conversation_id: str,
        user_id: str,
        summary: str,
        key_points: List[str],
        sentiment: str
    ):
        """Save conversation summary to episodic memory"""
        await self.neo4j.run("""
            MERGE (u:User {user_id: $user_id})
            CREATE (c:Conversation {
                id: $conversation_id,
                summary: $summary,
                key_points: $key_points,
                sentiment: $sentiment,
                created_at: datetime()
            })
            CREATE (u)-[:HAD_CONVERSATION]->(c)
        """,
            user_id=user_id,
            conversation_id=conversation_id,
            summary=summary,
            key_points=key_points,
            sentiment=sentiment
        )

    async def recall_similar_conversations(
        self,
        user_id: str,
        current_query: str,
        limit: int = 5
    ) -> List[Dict]:
        """Find similar past conversations"""
        query_embedding = await embed(current_query)

        # Search in Neo4j
        results = await self.neo4j.run("""
            MATCH (u:User {user_id: $user_id})-[:HAD_CONVERSATION]->(c:Conversation)
            WITH c, gds.similarity.cosine(c.embedding, $query_embedding) AS similarity
            WHERE similarity > 0.7
            RETURN c, similarity
            ORDER BY similarity DESC, c.created_at DESC
            LIMIT $limit
        """,
            user_id=user_id,
            query_embedding=query_embedding,
            limit=limit
        )

        return [dict(record['c']) for record in results]

    # ==================== SEMANTIC MEMORY ====================

    async def learn_fact(
        self,
        user_id: str,
        fact: str,
        source: str,
        confidence: float
    ):
        """Store learned fact"""
        await self.neo4j.run("""
            MATCH (u:User {user_id: $user_id})
            MERGE (f:Fact {content: $fact})
            ON CREATE SET
                f.id = randomUUID(),
                f.created_at = datetime(),
                f.confidence = $confidence
            MERGE (u)-[r:KNOWS]->(f)
            SET r.learned_from = $source,
                r.last_accessed = datetime()
        """,
            user_id=user_id,
            fact=fact,
            confidence=confidence,
            source=source
        )

    async def retrieve_facts(
        self,
        user_id: str,
        topic: str
    ) -> List[str]:
        """Retrieve learned facts about a topic"""
        results = await self.neo4j.run("""
            MATCH (u:User {user_id: $user_id})-[r:KNOWS]->(f:Fact)
            WHERE f.content CONTAINS $topic
            SET r.last_accessed = datetime()
            RETURN f.content, f.confidence
            ORDER BY f.confidence DESC, r.last_accessed DESC
            LIMIT 10
        """, user_id=user_id, topic=topic)

        return [record['f.content'] for record in results]

    # ==================== MEMORY CONSOLIDATION ====================

    async def consolidate_memory(
        self,
        user_id: str,
        conversation_id: str
    ):
        """Move important short-term memories to long-term storage"""

        # 1. Get conversation from Redis
        messages = await self.get_conversation_history(conversation_id)

        # 2. Extract key information using Maverick
        summary = await self.summarize_conversation(messages)
        key_points = await self.extract_key_points(messages)
        learned_facts = await self.extract_facts(messages)
        user_preferences = await self.infer_preferences(messages)

        # 3. Save to long-term memory
        await self.save_conversation_summary(
            conversation_id, user_id,
            summary, key_points, "neutral"
        )

        # 4. Update user preferences
        for key, value in user_preferences.items():
            await self.save_user_preference(user_id, key, value)

        # 5. Store learned facts
        for fact in learned_facts:
            await self.learn_fact(
                user_id, fact['content'],
                conversation_id, fact['confidence']
            )

        return {
            "summary": summary,
            "key_points": key_points,
            "facts_learned": len(learned_facts),
            "preferences_updated": len(user_preferences)
        }
```

### 4.4 Memory Retrieval Strategy

```python
async def retrieve_relevant_memory(
    user_id: str,
    current_query: str,
    context_window: int = 4000
) -> Dict[str, Any]:
    """Intelligently retrieve relevant memories"""

    memory_context = {
        "short_term": [],
        "episodic": [],
        "semantic": [],
        "preferences": {}
    }

    # 1. Recent conversation (short-term)
    conversation_id = get_current_conversation_id(user_id)
    memory_context["short_term"] = await memory_manager.get_conversation_history(
        conversation_id, limit=10
    )

    # 2. Similar past conversations (episodic)
    memory_context["episodic"] = await memory_manager.recall_similar_conversations(
        user_id, current_query, limit=3
    )

    # 3. Relevant facts (semantic)
    # Extract topic from query
    topics = extract_topics(current_query)
    all_facts = []
    for topic in topics:
        facts = await memory_manager.retrieve_facts(user_id, topic)
        all_facts.extend(facts)
    memory_context["semantic"] = all_facts[:5]

    # 4. User preferences
    memory_context["preferences"] = await memory_manager.get_user_preferences(user_id)

    # Format into context string
    context_str = format_memory_context(memory_context, max_tokens=context_window)

    return {
        "context": context_str,
        "metadata": memory_context
    }
```

---

## 5. Integration with Maverick LLM

### 5.1 Query Pipeline

```python
class GraphRAGQueryPipeline:
    """End-to-end query processing with Maverick"""

    async def process_query(
        self,
        user_id: str,
        query: str,
        conversation_id: str,
        use_centralized: bool = True,
        use_personalized: bool = True
    ) -> Dict[str, Any]:
        """Process query through full GraphRAG pipeline"""

        # 1. Build context
        context_builder = ContextBuilder(max_tokens=16000)
        context = await context_builder.build_context(
            user_id=user_id,
            query=query,
            conversation_id=conversation_id,
            context_types=[
                ContextType.CONVERSATIONAL,
                ContextType.SEMANTIC,
                ContextType.GRAPH,
                ContextType.USER_PROFILE
            ]
        )

        # 2. Retrieve memory
        memory = await retrieve_relevant_memory(
            user_id, query, context_window=8000
        )

        # 3. Search centralized knowledge
        centralized_results = []
        if use_centralized:
            centralized_results = await self.search_centralized(
                query, top_k=5
            )

        # 4. Search personalized knowledge
        personalized_results = []
        if use_personalized:
            personalized_results = await self.search_personalized(
                user_id, query, top_k=5
            )

        # 5. Build final prompt
        prompt = self.build_prompt(
            query=query,
            context=context,
            memory=memory,
            centralized=centralized_results,
            personalized=personalized_results
        )

        # 6. Query Maverick
        response = await maverick_client.chat(
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant with access to a knowledge graph. Use the provided context and memory to give accurate, personalized responses."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=2000
        )

        # 7. Extract and store learnings
        answer = response["choices"][0]["message"]["content"]
        await self.post_process(
            user_id, conversation_id, query, answer, context
        )

        return {
            "answer": answer,
            "sources": {
                "centralized": centralized_results,
                "personalized": personalized_results,
                "memory": memory["metadata"]
            },
            "metadata": {
                "tokens_used": response["usage"]["total_tokens"],
                "context_tokens": context["metadata"]["total_tokens"]
            }
        }

    def build_prompt(
        self,
        query: str,
        context: Dict,
        memory: Dict,
        centralized: List,
        personalized: List
    ) -> str:
        """Build comprehensive prompt"""

        prompt = f"""# User Query
{query}

# Your Memory (Past Conversations & Learned Facts)
{memory['context']}

# Relevant Knowledge from Organization
"""

        for doc in centralized[:3]:
            prompt += f"- {doc['title']}: {doc['summary']}\n"

        prompt += f"""
# Your Personal Knowledge
"""

        for doc in personalized[:3]:
            prompt += f"- {doc['title']}: {doc['summary']}\n"

        prompt += f"""
# Additional Context
{context['context'][:2000]}  # Truncate if needed

# Instructions
Using the above information, please provide a comprehensive answer to the user's query.
- Prioritize information from Personal Knowledge when available
- Reference specific sources when making claims
- If information is uncertain or missing, acknowledge it
- Maintain conversation context from Memory

Answer:"""

        return prompt

    async def post_process(
        self,
        user_id: str,
        conversation_id: str,
        query: str,
        answer: str,
        context: Dict
    ):
        """Post-process: store memory, update graph"""

        # 1. Add to conversation history
        await memory_manager.add_to_conversation(
            conversation_id,
            {"role": "user", "content": query}
        )
        await memory_manager.add_to_conversation(
            conversation_id,
            {"role": "assistant", "content": answer}
        )

        # 2. Extract and store new facts
        new_facts = await extract_facts_from_response(answer)
        for fact in new_facts:
            await memory_manager.learn_fact(
                user_id, fact['content'],
                conversation_id, fact['confidence']
            )

        # 3. Update user profile
        inferred_prefs = await infer_preferences_from_interaction(
            query, answer
        )
        for key, value in inferred_prefs.items():
            await memory_manager.save_user_preference(
                user_id, key, value
            )
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Neo4j database
- [ ] Set up Qdrant vector store
- [ ] Set up Redis for memory
- [ ] Implement basic authentication & RLS
- [ ] Create data models

### Phase 2: Centralized GraphRAG (Weeks 3-4)
- [ ] Document ingestion pipeline
- [ ] Entity & relationship extraction
- [ ] Vector embedding generation
- [ ] Basic search functionality
- [ ] Integration with Maverick

### Phase 3: Personalized GraphRAG (Weeks 5-6)
- [ ] User-specific document upload
- [ ] RLS implementation in Neo4j & Qdrant
- [ ] Sharing mechanisms
- [ ] Privacy controls
- [ ] Audit logging

### Phase 4: Context Management (Week 7)
- [ ] Context builder implementation
- [ ] Hybrid search (vector + keyword)
- [ ] Graph traversal algorithms
- [ ] Context ranking & truncation

### Phase 5: Memory System (Week 8)
- [ ] Short-term memory (Redis)
- [ ] Long-term memory (PostgreSQL)
- [ ] Episodic memory (Neo4j)
- [ ] Memory consolidation
- [ ] Preference learning

### Phase 6: Integration & Testing (Weeks 9-10)
- [ ] End-to-end pipeline testing
- [ ] Performance optimization
- [ ] Load testing
- [ ] Security audit
- [ ] User acceptance testing

### Phase 7: Production Deployment (Week 11-12)
- [ ] GCP deployment (Q6_K Maverick)
- [ ] Monitoring & alerting
- [ ] Backup & disaster recovery
- [ ] Documentation
- [ ] Training materials

---

## 7. Technology Stack

### Core Components
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **LLM** | Llama-4-Maverick | Q4 local, Q6 GCP production |
| **Graph Database** | Neo4j | Knowledge graph storage |
| **Vector Store** | Qdrant | Embedding search |
| **Memory Cache** | Redis | Short-term & working memory |
| **Relational DB** | PostgreSQL | User data, preferences, audit logs |
| **Message Queue** | RabbitMQ | Async processing |
| **API Framework** | FastAPI | REST API endpoints |
| **Auth** | Keycloak / Auth0 | Authentication & authorization |
| **Monitoring** | Prometheus + Grafana | Metrics & dashboards |

### Infrastructure
- **Local Dev:** Docker Compose
- **Production:** GCP (GKE for orchestration)
- **CI/CD:** GitHub Actions
- **IaC:** Terraform

---

## 8. Key Considerations

### Performance
- Target latency: < 2s for query processing
- Cache frequently accessed nodes
- Optimize graph queries with indexes
- Batch embedding generation
- Use connection pooling

### Scalability
- Horizontal scaling for API layer
- Neo4j clustering for graph
- Qdrant sharding for vectors
- Redis cluster for memory
- Load balancing with NGINX

### Security
- End-to-end encryption
- RLS at database level
- API rate limiting
- Input validation & sanitization
- Regular security audits
- GDPR compliance (right to be forgotten)

### Cost Optimization
- Cache embeddings (don't regenerate)
- Batch API calls to Maverick
- Use Q4 for development/testing
- Q6 only for production
- Spot instances for non-critical workloads
- Auto-scaling based on load

---

## 9. Success Metrics

### Technical Metrics
- Query response time: < 2s (p95)
- Search relevance: > 0.85 (user rating)
- System availability: 99.9%
- Memory recall accuracy: > 90%

### Business Metrics
- User engagement (daily active users)
- Query volume
- Knowledge base growth rate
- User satisfaction (NPS score)

---

## Next Steps

1. **Review & Approval** - Get stakeholder sign-off on architecture
2. **POC Development** - Build minimal viable system (Phase 1-2)
3. **User Testing** - Validate with pilot users
4. **Iterate** - Refine based on feedback
5. **Production Launch** - Full deployment on GCP

---

**Document Owner:** AI/ML Team
**Reviewers:** Engineering, Product, Security
**Status:** Draft - Pending Review
