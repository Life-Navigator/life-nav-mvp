# 🚀 Quick Start Guide - Connect & Chat with Your AI Agents

## 📋 Overview

This guide will walk you through:
1. Starting all services
2. Connecting your LLM model
3. Creating an agent
4. Chatting with your agent
5. Using the web interface

**Time to complete**: 10-15 minutes

---

## ✅ Prerequisites

Before starting, ensure you have:

- ✅ PostgreSQL running on port 5432
- ✅ Redis running on port 6379
- ✅ Neo4j running on port 7687
- ✅ Qdrant running on port 6333
- ✅ Python virtual environment activated (`./venv`)
- ✅ All dependencies installed (`pip install -r requirements.txt`)

---

## 🚀 Step 1: Start All Services

### 1.1 Start MCP Server

```bash
# From project root directory
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &

# Wait a few seconds, then verify
curl http://localhost:8080/health
```

**Expected Output**:
```json
{
  "status": "healthy",
  "databases": {
    "postgres": "ok",
    "redis": "ok",
    "neo4j": "ok",
    "qdrant": "ok"
  }
}
```

**Troubleshooting**:
- If server doesn't start: `tail -50 /tmp/mcp_server.log` to see errors
- If database connections fail: Check that all databases are running
- Port already in use: `pkill -f start_mcp_server_single.py` then retry

### 1.2 Start Admin Dashboard

```bash
# From project root directory
cd ui
nohup ../venv/bin/python3 -m streamlit run admin_app.py --server.port 8501 --server.headless true > /tmp/admin_dashboard.log 2>&1 &
cd ..

# Wait a few seconds, then verify
curl -I http://localhost:8501
```

**Expected Output**: `HTTP/1.1 200 OK`

**Troubleshooting**:
- Check logs: `tail -50 /tmp/admin_dashboard.log`
- Port already in use: `pkill -f admin_app.py` then retry

---

## 🔌 Step 2: Connect Your LLM Model

You have 3 options for connecting a model:

### Option A: Use OpenAI API (Easiest)

**1. Install OpenAI SDK**:
```bash
./venv/bin/pip install openai
```

**2. Edit the inference endpoint**:
```bash
nano mcp-server/core/server.py
```

**3. Find line ~908** (search for `@app.post("/inference")`) and replace with:

```python
@app.post("/inference", response_model=ModelInferenceResponse)
async def model_inference(request: ModelInferenceRequest):
    """Direct model inference endpoint"""
    try:
        from openai import OpenAI
        from datetime import datetime
        
        # Initialize OpenAI client
        client = OpenAI(
            api_key="YOUR_OPENAI_API_KEY"  # Replace with your key
        )
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # or "gpt-4" for better quality
            messages=[
                {
                    "role": "system", 
                    "content": request.system_prompt or "You are a helpful AI assistant."
                },
                {"role": "user", "content": request.prompt}
            ],
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        return ModelInferenceResponse(
            response=response.choices[0].message.content,
            model=response.model,
            tokens_used=response.usage.total_tokens,
            metadata={
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {str(e)}"
        )
```

**4. Restart MCP server**:
```bash
pkill -f start_mcp_server_single.py
sleep 2
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &
```

---

### Option B: Use Local Model (Ollama)

**1. Install and start Ollama**:
```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama2

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

**2. Edit the inference endpoint** (same as above, line ~908):

```python
@app.post("/inference", response_model=ModelInferenceResponse)
async def model_inference(request: ModelInferenceRequest):
    """Direct model inference endpoint"""
    try:
        import requests as req
        from datetime import datetime
        
        # Call Ollama API
        ollama_response = req.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama2",
                "prompt": f"{request.system_prompt or 'You are helpful.'}\n\nUser: {request.prompt}\n\nAssistant:",
                "stream": False,
                "options": {
                    "temperature": request.temperature,
                    "num_predict": request.max_tokens
                }
            }
        )
        
        data = ollama_response.json()
        
        return ModelInferenceResponse(
            response=data["response"],
            model="llama2",
            tokens_used=data.get("eval_count", 0),
            metadata={
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {str(e)}"
        )
```

**3. Restart MCP server** (same as Option A).

---

### Option C: Use Anthropic Claude

**1. Install Anthropic SDK**:
```bash
./venv/bin/pip install anthropic
```

**2. Edit the inference endpoint** (line ~908):

```python
@app.post("/inference", response_model=ModelInferenceResponse)
async def model_inference(request: ModelInferenceRequest):
    """Direct model inference endpoint"""
    try:
        from anthropic import Anthropic
        from datetime import datetime
        
        # Initialize Anthropic client
        client = Anthropic(
            api_key="YOUR_ANTHROPIC_API_KEY"  # Replace with your key
        )
        
        # Call Anthropic API
        message = client.messages.create(
            model="claude-3-opus-20240229",  # or claude-3-sonnet for faster/cheaper
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            system=request.system_prompt or "You are a helpful AI assistant.",
            messages=[
                {"role": "user", "content": request.prompt}
            ]
        )
        
        return ModelInferenceResponse(
            response=message.content[0].text,
            model="claude-3-opus",
            tokens_used=message.usage.input_tokens + message.usage.output_tokens,
            metadata={
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {str(e)}"
        )
```

**3. Restart MCP server** (same as Option A).

---

## 🧪 Step 3: Test Your Model Connection

```bash
# Test the inference endpoint
curl -X POST http://localhost:8080/inference \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello and introduce yourself in one sentence.",
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

**Expected Output** (if working):
```json
{
  "response": "Hello! I'm an AI assistant here to help you with questions and tasks.",
  "model": "gpt-3.5-turbo",
  "tokens_used": 23,
  "metadata": {
    "temperature": 0.7,
    "max_tokens": 100,
    "timestamp": "2025-11-04T07:00:00.000000"
  }
}
```

**If you see an error**:
- Check API key is correct
- For OpenAI: Verify key at https://platform.openai.com/api-keys
- For Anthropic: Verify key at https://console.anthropic.com/
- For Ollama: Make sure `ollama serve` is running
- Check server logs: `tail -50 /tmp/mcp_server.log`

---

## 🤖 Step 4: Create Your First Agent

### Method 1: Using the Web UI (Easiest)

**1. Open the dashboard**:
```bash
# Open in your browser
http://localhost:8501
```

**2. Navigate to "🤖 Agent Management"** in the sidebar

**3. Click "➕ Create New Agent" tab**

**4. Select a template** (e.g., "Research Agent")

**5. Fill in the form**:
- **Name**: "My First Agent"
- **Description**: "A helpful research assistant"
- **System Prompt**: Keep the default or customize
- **Capabilities**: Leave as selected
- **Tools**: Select tools you want the agent to use
- **Max Concurrent Tasks**: 5
- **Task Timeout**: 300 seconds

**6. Click "💾 Save Agent"**

**7. Note the agent ID** - you'll see it in the "My Agents" tab

---

### Method 2: Using the API

```bash
# Create an agent via API
curl -X POST http://localhost:8080/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Agent",
    "description": "A helpful research assistant",
    "agent_type": "research",
    "capabilities": ["research", "search", "memory"],
    "system_prompt": "You are a helpful AI research assistant. Provide detailed, accurate information and cite sources when possible.",
    "tools": ["query_knowledge_graph", "search_semantic"],
    "max_concurrent_tasks": 5,
    "task_timeout_seconds": 300,
    "custom_config": {}
  }'
```

**Response**:
```json
{
  "id": "abc-123-def-456",
  "name": "My First Agent",
  ...
}
```

**Save the agent ID** for the next step!

---

## 💬 Step 5: Chat with Your Agent

### Method 1: Using curl (Command Line)

```bash
# Replace AGENT_ID with your actual agent ID
export AGENT_ID="abc-123-def-456"

# Send a message
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"message\": \"Hello! Can you explain what multi-agent systems are?\"
  }"
```

**Expected Output**:
```json
{
  "conversation_id": "conv-xyz-789",
  "agent_id": "abc-123-def-456",
  "message": "Multi-agent systems are distributed computing systems where multiple autonomous agents interact...",
  "metadata": {
    "agent_name": "My First Agent",
    "agent_type": "research"
  },
  "timestamp": "2025-11-04T07:00:00.000000"
}
```

**Continue the conversation** (use the same conversation_id):
```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"conversation_id\": \"conv-xyz-789\",
    \"message\": \"Can you give me some examples?\"
  }"
```

---

### Method 2: Using Python Script

Create a file `chat_with_agent.py`:

```python
#!/usr/bin/env python3
import requests
import json

# Configuration
MCP_SERVER_URL = "http://localhost:8080"
AGENT_ID = "abc-123-def-456"  # Replace with your agent ID

def chat(message, conversation_id=None):
    """Send a message to the agent"""
    url = f"{MCP_SERVER_URL}/chat"
    data = {
        "agent_id": AGENT_ID,
        "message": message
    }
    
    if conversation_id:
        data["conversation_id"] = conversation_id
    
    response = requests.post(url, json=data)
    response.raise_for_status()
    return response.json()

def main():
    print("🤖 Chat with your AI Agent")
    print("=" * 50)
    
    conversation_id = None
    
    while True:
        # Get user input
        user_message = input("\nYou: ").strip()
        
        if user_message.lower() in ['exit', 'quit', 'bye']:
            print("👋 Goodbye!")
            break
        
        if not user_message:
            continue
        
        # Send message to agent
        print("\n🤔 Agent is thinking...")
        try:
            response = chat(user_message, conversation_id)
            
            # Save conversation ID for continuity
            conversation_id = response["conversation_id"]
            
            # Display agent response
            print(f"\n🤖 Agent: {response['message']}\n")
            
        except Exception as e:
            print(f"\n❌ Error: {str(e)}\n")

if __name__ == "__main__":
    main()
```

**Run it**:
```bash
chmod +x chat_with_agent.py
./venv/bin/python3 chat_with_agent.py
```

---

### Method 3: Using the Web UI (Coming Soon)

The chat interface in the dashboard is being developed. For now, use the API methods above.

---

## 🎯 Step 6: Execute Tasks

You can also execute specific tasks (not just chat):

```bash
# Execute a research task
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"task_type\": \"research\",
    \"input_text\": \"Find information about reinforcement learning in multi-agent systems\",
    \"context\": {\"priority\": \"high\"}
  }"
```

**Response**:
```json
{
  "task_id": "task-123",
  "agent_id": "abc-123-def-456",
  "status": "completed",
  "result": "Reinforcement learning in multi-agent systems involves...",
  "metadata": {...},
  "created_at": "2025-11-04T07:00:00.000000",
  "completed_at": "2025-11-04T07:00:05.000000"
}
```

**Check task status**:
```bash
curl http://localhost:8080/tasks/task-123
```

**List all tasks**:
```bash
curl "http://localhost:8080/tasks?agent_id=$AGENT_ID"
```

---

## 🛠️ Common Operations

### View All Agents

```bash
curl "http://localhost:8080/agents?user_id=default_user"
```

### Update an Agent

```bash
curl -X PUT "http://localhost:8080/agents/$AGENT_ID?user_id=default_user" \
  -H "Content-Type: application/json" \
  -d '{
    "system_prompt": "You are now a more specialized research assistant focused on AI safety.",
    "max_concurrent_tasks": 10
  }'
```

### Deactivate an Agent

```bash
curl -X PUT "http://localhost:8080/agents/$AGENT_ID?user_id=default_user" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

### Delete an Agent

```bash
curl -X DELETE "http://localhost:8080/agents/$AGENT_ID?user_id=default_user"
```

---

## 📊 Monitor Your System

### Check System Health

```bash
curl http://localhost:8080/health
```

### View Agent Statistics

```bash
curl http://localhost:8080/agents/stats/summary
```

### Access Admin Dashboard

Open in browser: **http://localhost:8501**

Available pages:
- 📊 **System Overview** - Real-time metrics and statistics
- 📄 **Document Ingestion** - Upload and manage documents
- 🔍 **Search & Discovery** - Test GraphRAG queries
- 🤖 **Agent Management** - Create and manage agents
- 🛡️ **Guardrails Monitor** - View safety metrics
- 📈 **Traffic Analytics** - API usage stats

---

## 🐛 Troubleshooting

### MCP Server Won't Start

```bash
# Check logs
tail -100 /tmp/mcp_server.log

# Common issues:
# 1. Port already in use
pkill -f start_mcp_server_single.py
sleep 2
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &

# 2. Database connection failed
# Verify all databases are running:
docker ps  # if using Docker
# OR check individual services
```

### Dashboard Won't Start

```bash
# Check logs
tail -100 /tmp/admin_dashboard.log

# Restart dashboard
pkill -f admin_app.py
cd ui
nohup ../venv/bin/python3 -m streamlit run admin_app.py --server.port 8501 --server.headless true > /tmp/admin_dashboard.log 2>&1 &
cd ..
```

### Model Inference Fails

```bash
# Test inference endpoint directly
curl -X POST http://localhost:8080/inference \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "temperature": 0.7, "max_tokens": 50}'

# Check for errors in MCP server logs
tail -100 /tmp/mcp_server.log | grep -i error

# Common issues:
# 1. API key not set or invalid
# 2. Model service (Ollama) not running
# 3. Rate limiting (OpenAI/Anthropic)
```

### Agent Not Responding

```bash
# Verify agent exists and is active
curl "http://localhost:8080/agents/$AGENT_ID?user_id=default_user"

# Check agent is active (is_active: true)
# If not, reactivate:
curl -X PUT "http://localhost:8080/agents/$AGENT_ID?user_id=default_user" \
  -H "Content-Type: application/json" \
  -d '{"is_active": true}'
```

---

## 🚀 Quick Reference

### Start Everything

```bash
# Start MCP Server
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &

# Start Dashboard
cd ui && nohup ../venv/bin/python3 -m streamlit run admin_app.py --server.port 8501 --server.headless true > /tmp/admin_dashboard.log 2>&1 & cd ..

# Verify
curl http://localhost:8080/health
curl -I http://localhost:8501
```

### Stop Everything

```bash
pkill -f start_mcp_server_single.py
pkill -f admin_app.py
```

### Restart Everything

```bash
# Stop
pkill -f start_mcp_server_single.py
pkill -f admin_app.py
sleep 2

# Start
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &
cd ui && nohup ../venv/bin/python3 -m streamlit run admin_app.py --server.port 8501 --server.headless true > /tmp/admin_dashboard.log 2>&1 & cd ..
```

---

## 📚 Next Steps

1. **Explore the Dashboard**: http://localhost:8501
2. **Read API Docs**: `API_ENDPOINTS_COMPLETE.md`
3. **Create More Agents**: Try different templates (Analyst, Writer, Planner)
4. **Upload Documents**: Use the Document Ingestion page
5. **Test GraphRAG**: Query your knowledge graph
6. **Monitor Performance**: Check the Traffic Analytics page

---

## 🎉 You're Ready!

Your AI agent system is now running and ready to use!

**URLs**:
- 🔧 MCP Server: http://localhost:8080
- 🖥️ Dashboard: http://localhost:8501
- 📖 API Docs: `./API_ENDPOINTS_COMPLETE.md`

**Need Help?**
- Check logs: `/tmp/mcp_server.log` and `/tmp/admin_dashboard.log`
- Review documentation: `REAL_DATA_AND_MODEL_INTEGRATION_COMPLETE.md`
- Test endpoints: Use the curl examples above

**Happy chatting with your AI agents!** 🤖✨
