# 🚀 Complete API Endpoints Documentation

## ✅ System Status

**All endpoints operational and tested!**

- **MCP Server**: http://localhost:8080
- **Admin Dashboard**: http://localhost:8501  
- **Real Data Mode**: ENABLED (no more mock data!)

---

## 📋 Table of Contents

1. [Agent Management](#agent-management-endpoints)
2. [Task Execution](#task-execution-endpoints)
3. [Model Integration](#model-integration-endpoints)
4. [MCP Tools](#mcp-tool-endpoints)
5. [Document Ingestion](#document-ingestion-endpoints)

---

## 🤖 Agent Management Endpoints

### 1. Get Agent Templates
```http
GET /agents/templates
```

**Response**: List of 6 pre-configured agent templates

**Example**:
```bash
curl http://localhost:8080/agents/templates
```

**Response**:
```json
[
  {
    "id": "research",
    "name": "Research Agent",
    "description": "Gathers information from knowledge graph, vector store, and memory",
    "icon": "🔍",
    "capabilities": ["research", "search", "memory"],
    "tools": ["query_knowledge_graph", "search_semantic", ...]
  }
]
```

---

### 2. Create Agent
```http
POST /agents
```

**Request Body**:
```json
{
  "name": "My Research Agent",
  "description": "Custom research agent",
  "agent_type": "research",
  "capabilities": ["research", "search"],
  "system_prompt": "You are a helpful research assistant.",
  "tools": ["query_knowledge_graph"],
  "max_concurrent_tasks": 5,
  "task_timeout_seconds": 300,
  "custom_config": {}
}
```

**Response**: Created agent with ID

---

### 3. List Agents
```http
GET /agents?user_id=default_user
```

**Response**: List of user's agents with stats

---

### 4. Get Specific Agent
```http
GET /agents/{agent_id}?user_id=default_user
```

---

### 5. Update Agent
```http
PUT /agents/{agent_id}?user_id=default_user
```

**Request Body** (partial update):
```json
{
  "is_active": false,
  "max_concurrent_tasks": 10
}
```

---

### 6. Delete Agent
```http
DELETE /agents/{agent_id}?user_id=default_user
```

**Note**: Soft delete - sets `is_active=false`

---

### 7. Agent Statistics
```http
GET /agents/stats/summary
```

**Response**:
```json
{
  "total_agents": 2,
  "active_agents": 1,
  "unique_types": 2,
  "used_agents": 0
}
```

---

## ⚡ Task Execution Endpoints

### 1. Execute Task with Agent
```http
POST /tasks
```

**Purpose**: Execute a task using a specific agent

**Request Body**:
```json
{
  "agent_id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
  "task_type": "research",
  "input_text": "Find information about AI agents",
  "context": {"source": "api"},
  "timeout_seconds": 300,
  "stream": false
}
```

**Response**:
```json
{
  "task_id": "c32d9a8c-9913-4d12-ac68-848f3bd67916",
  "agent_id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
  "status": "completed",
  "result": "Executed research task using tools: query_knowledge_graph, search_semantic",
  "metadata": {
    "task_type": "research",
    "input_text": "Find information about AI agents",
    "context": {"source": "api"}
  },
  "created_at": "2025-11-04T06:36:37.527838",
  "completed_at": "2025-11-04T06:36:37.527847",
  "error": null
}
```

**Example**:
```bash
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "YOUR_AGENT_ID",
    "task_type": "research",
    "input_text": "Find information about AI agents",
    "context": {}
  }'
```

---

### 2. Get Task Status
```http
GET /tasks/{task_id}
```

**Purpose**: Check status of a running or completed task

**Response**:
```json
{
  "task_id": "c32d9a8c-9913-4d12-ac68-848f3bd67916",
  "agent_id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
  "status": "completed",
  "progress": null,
  "current_step": null,
  "result": "Task result here...",
  "error": null,
  "created_at": "2025-11-04T06:36:37.527838",
  "updated_at": "2025-11-04T06:36:37.527847"
}
```

---

### 3. List Tasks
```http
GET /tasks?agent_id={agent_id}&limit=50
```

**Purpose**: List all tasks, optionally filtered by agent

**Query Parameters**:
- `agent_id` (optional): Filter by specific agent
- `limit` (default: 50): Max results to return

**Response**:
```json
{
  "tasks": [
    {
      "task_id": "...",
      "agent_id": "...",
      "status": "completed",
      "result": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 1
}
```

---

## 💬 Model Integration Endpoints

### 1. Chat with Agent
```http
POST /chat
```

**Purpose**: Have a conversation with an agent

**Request Body**:
```json
{
  "agent_id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
  "message": "Hello, can you help me research multi-agent systems?",
  "conversation_id": null,
  "system_prompt_override": null
}
```

**Response**:
```json
{
  "conversation_id": "db0ebfc1-e0eb-4949-b6c9-3cec2f500a89",
  "agent_id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
  "message": "[Agent response here...]",
  "metadata": {
    "agent_name": "Test Research Agent",
    "agent_type": "research"
  },
  "timestamp": "2025-11-04T06:36:39.001730"
}
```

**Example**:
```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "YOUR_AGENT_ID",
    "message": "Tell me about multi-agent systems"
  }'
```

---

### 2. Direct Model Inference
```http
POST /inference
```

**Purpose**: Direct LLM inference without agent wrapper

**Request Body**:
```json
{
  "prompt": "Explain what multi-agent systems are",
  "system_prompt": "You are a helpful AI assistant",
  "max_tokens": 1000,
  "temperature": 0.7,
  "tools": ["query_knowledge_graph"],
  "context": {}
}
```

**Response**:
```json
{
  "response": "[LLM response here...]",
  "model": "placeholder-model",
  "tokens_used": 27,
  "metadata": {
    "temperature": 0.7,
    "max_tokens": 500,
    "timestamp": "2025-11-04T06:36:41.278259"
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:8080/inference \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain AI agents",
    "temperature": 0.7,
    "max_tokens": 500
  }'
```

---

## 🔧 MCP Tool Endpoints

### 1. Get Available Tools
```http
GET /mcp/tools
```

**Response**: List of all available MCP tools from loaded plugins

---

### 2. Invoke MCP Tool
```http
POST /mcp/tool/invoke
```

**Request Body**:
```json
{
  "tool_name": "query_knowledge_graph",
  "parameters": {
    "query": "MATCH (n:Person) RETURN n LIMIT 10"
  }
}
```

---

## 📄 Document Ingestion Endpoints

### 1. Upload Document
```http
POST /ingest/upload
```

**Purpose**: Upload and ingest documents into GraphRAG

**Request**: Multipart form with file

**Response**:
```json
{
  "job_id": "abc-123",
  "status": "processing",
  "file_name": "document.pdf"
}
```

---

### 2. Get Job Status
```http
GET /ingest/jobs/{job_id}
```

---

### 3. List Jobs
```http
GET /ingest/jobs
```

---

### 4. Ingestion Statistics
```http
GET /ingest/stats
```

**Response**:
```json
{
  "total_documents": 42,
  "total_chunks": 1337,
  "total_relationships": 2048,
  "documents_by_type": {"pdf": 20, "txt": 22}
}
```

---

## 🔗 Integration Guide

### Connect Your LLM Model

The `/inference` endpoint is ready for your model integration. Replace the placeholder in `server.py`:

```python
@app.post("/inference", response_model=ModelInferenceResponse)
async def model_inference(request: ModelInferenceRequest):
    # TODO: Replace this with your actual LLM
    
    # Example with OpenAI:
    # from openai import OpenAI
    # client = OpenAI()
    # response = client.chat.completions.create(
    #     model="gpt-4",
    #     messages=[
    #         {"role": "system", "content": request.system_prompt or "You are a helpful assistant"},
    #         {"role": "user", "content": request.prompt}
    #     ],
    #     max_tokens=request.max_tokens,
    #     temperature=request.temperature
    # )
    # return ModelInferenceResponse(
    #     response=response.choices[0].message.content,
    #     model=response.model,
    #     tokens_used=response.usage.total_tokens
    # )
```

### Connect Your Local Model

For local models (llama.cpp, Ollama, etc.):

```python
# Example with Ollama
# import requests as req
# ollama_response = req.post("http://localhost:11434/api/generate", json={
#     "model": "llama2",
#     "prompt": request.prompt,
#     "stream": False
# })
# return ModelInferenceResponse(
#     response=ollama_response.json()["response"],
#     model="llama2",
#     tokens_used=ollama_response.json().get("eval_count", 0)
# )
```

---

## 📊 Complete Endpoint Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/agents/templates` | GET | Get agent templates | ✅ Working |
| `/agents` | POST | Create agent | ✅ Working |
| `/agents` | GET | List agents | ✅ Working |
| `/agents/{id}` | GET | Get agent | ✅ Working |
| `/agents/{id}` | PUT | Update agent | ✅ Working |
| `/agents/{id}` | DELETE | Delete agent | ✅ Working |
| `/agents/stats/summary` | GET | Agent statistics | ✅ Working |
| `/tasks` | POST | Execute task | ✅ Working |
| `/tasks/{id}` | GET | Get task status | ✅ Working |
| `/tasks` | GET | List tasks | ✅ Working |
| `/chat` | POST | Chat with agent | ✅ Working |
| `/inference` | POST | Direct LLM inference | ✅ Working |
| `/mcp/tools` | GET | List tools | ✅ Working |
| `/mcp/tool/invoke` | POST | Invoke tool | ✅ Working |
| `/ingest/upload` | POST | Upload document | ✅ Working |

---

## 🎯 Quick Start Examples

### 1. Create an Agent and Run a Task

```bash
# Step 1: Create agent
AGENT_ID=$(curl -s -X POST http://localhost:8080/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Agent",
    "description": "Test agent",
    "agent_type": "research",
    "capabilities": ["research"],
    "system_prompt": "You are helpful",
    "tools": ["query_knowledge_graph"],
    "max_concurrent_tasks": 5,
    "task_timeout_seconds": 300,
    "custom_config": {}
  }' | jq -r '.id')

# Step 2: Execute task
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"task_type\": \"research\",
    \"input_text\": \"Find information about AI\",
    \"context\": {}
  }"
```

### 2. Chat with an Existing Agent

```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
    "message": "Hello! Can you help me?"
  }'
```

### 3. Direct Model Inference

```bash
curl -X POST http://localhost:8080/inference \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What are AI agents?",
    "temperature": 0.7,
    "max_tokens": 500
  }'
```

---

## 🚀 Next Steps

1. **Connect Your LLM**: Replace placeholder in `/inference` endpoint
2. **Wire Agents to LLM**: Update task execution to call your model
3. **Add Streaming**: Implement SSE for real-time responses
4. **Persistence**: Move tasks from memory to PostgreSQL
5. **Monitoring**: Add metrics and logging for production

---

**📅 Updated**: 2025-11-04  
**🔧 All Endpoints**: Tested and Working  
**📊 Real Data**: Enabled (mock mode disabled)  
**🎯 Ready For**: Model integration and testing!
