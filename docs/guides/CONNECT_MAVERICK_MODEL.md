# 🚀 Connect Your Maverick Model

You already have the Maverick model! Here's how to connect it to your agent system.

## ✅ What You Have

- **Model**: Maverick Q4 (227GB) at `models/maverick-gguf/maverick-q4_k_m.gguf`
- **Server**: llama.cpp server that will run on port 8090
- **Startup scripts**: `scripts/start_maverick_cpu.sh` and `scripts/start_maverick_gpu.sh`

---

## 🚀 Step 1: Start Maverick Server

Choose based on your hardware:

### Option A: Using GPU (Recommended if you have NVIDIA GPU)

```bash
./scripts/start_maverick_gpu.sh
```

### Option B: Using CPU Only

```bash
./scripts/start_maverick_cpu.sh
```

**Wait a few seconds for the model to load...**

### Verify Maverick is Running

```bash
curl http://localhost:8090/health
```

**Expected**: `{"status":"ok"}` or similar response

---

## 🔌 Step 2: Connect Maverick to Your Agent System

Edit the inference endpoint to use your Maverick model:

```bash
nano mcp-server/core/server.py
```

**Find line ~908** (search for `@app.post("/inference")`) and replace with:

```python
@app.post("/inference", response_model=ModelInferenceResponse)
async def model_inference(request: ModelInferenceRequest):
    """Direct model inference endpoint - Using Maverick Model"""
    try:
        import requests as req
        from datetime import datetime
        
        # Call Maverick llama.cpp server
        maverick_response = req.post(
            "http://localhost:8090/completion",
            json={
                "prompt": f"{request.system_prompt or 'You are a helpful AI assistant.'}\n\nUser: {request.prompt}\n\nAssistant:",
                "n_predict": request.max_tokens,
                "temperature": request.temperature,
                "stop": ["\nUser:", "\n\n"],
                "stream": False
            },
            timeout=60
        )
        
        data = maverick_response.json()
        response_text = data.get("content", "")
        
        return ModelInferenceResponse(
            response=response_text,
            model="maverick-q4",
            tokens_used=data.get("tokens_predicted", 0) + data.get("tokens_evaluated", 0),
            metadata={
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "timestamp": datetime.utcnow().isoformat(),
                "model_path": "maverick-q4_k_m.gguf"
            }
        )
        
    except req.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Maverick server not running. Start it with: ./scripts/start_maverick_cpu.sh"
        )
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {str(e)}"
        )
```

**Save the file** (Ctrl+X, Y, Enter)

---

## 🔄 Step 3: Restart MCP Server

```bash
pkill -f start_mcp_server_single.py
sleep 2
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &
```

---

## 🧪 Step 4: Test Your Maverick Connection

```bash
curl -X POST http://localhost:8080/inference \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello and introduce yourself in one sentence.",
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

**You should see**: A response from your Maverick model! ✅

---

## 🤖 Step 5: Create an Agent

Now create an agent that will use Maverick:

```bash
curl -X POST http://localhost:8080/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maverick Research Agent",
    "description": "Research assistant powered by Maverick model",
    "agent_type": "research",
    "capabilities": ["research", "search", "memory"],
    "system_prompt": "You are Maverick, a helpful AI research assistant. Provide detailed, accurate information.",
    "tools": ["query_knowledge_graph", "search_semantic"],
    "max_concurrent_tasks": 5,
    "task_timeout_seconds": 300,
    "custom_config": {}
  }'
```

**Save the agent ID from the response!**

---

## 💬 Step 6: Chat with Your Maverick-Powered Agent

### Using the Chat Script

```bash
./venv/bin/python3 chat_with_agent.py
```

### Using curl

```bash
export AGENT_ID="your-agent-id"

curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"message\": \"Hello! What can you help me with?\"
  }"
```

---

## 🛠️ Troubleshooting

### Maverick Server Won't Start

```bash
# Check logs
tail -50 logs/maverick_server.log

# Common issues:
# 1. Not enough RAM (needs ~32GB for Q4 model)
# 2. Model file not found - verify path:
ls -lh models/maverick-gguf/maverick-q4_k_m.gguf

# 3. Port already in use
lsof -i :8090
```

### Connection Refused

```bash
# Verify Maverick is running
curl http://localhost:8090/health

# If not running, start it:
./scripts/start_maverick_cpu.sh

# Check it's loaded:
tail -f logs/maverick_server.log
```

### Slow Responses

- **CPU Mode**: Expected, especially for large contexts
- **GPU Mode**: Make sure you're using `start_maverick_gpu.sh`
- **Reduce max_tokens**: Try 200-500 instead of 1000+

---

## 📊 Performance Tips

### For Best Performance

1. **Use GPU if available**: `./scripts/start_maverick_gpu.sh`
2. **Reduce context size**: Set `-c 8192` instead of 32768 in startup script
3. **Use Q4 model**: Already using it (227GB) - good balance of speed/quality
4. **Batch requests**: Let multiple users share the same model instance

### Monitor Performance

```bash
# Watch server logs
tail -f logs/maverick_server.log

# Check memory usage
htop

# Check GPU usage (if using GPU)
nvidia-smi -l 1
```

---

## ✅ Quick Commands

### Start/Stop Maverick

```bash
# Start (CPU)
./scripts/start_maverick_cpu.sh

# Start (GPU)
./scripts/start_maverick_gpu.sh

# Stop
pkill -f llama-server

# Status
curl http://localhost:8090/health
```

### Restart Everything

```bash
# 1. Stop all
pkill -f llama-server
pkill -f start_mcp_server_single.py
pkill -f admin_app.py
sleep 2

# 2. Start Maverick
./scripts/start_maverick_cpu.sh &
sleep 5

# 3. Start MCP Server
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &

# 4. Start Dashboard
cd ui && nohup ../venv/bin/python3 -m streamlit run admin_app.py --server.port 8501 --server.headless true > /tmp/admin_dashboard.log 2>&1 & cd ..
```

---

## 🎯 You're All Set!

Your local Maverick model is now powering your AI agents!

**System Architecture**:
```
User → Agent System (port 8080) → Maverick Model (port 8090)
```

**No external API needed** - everything runs on your hardware! 🚀

---

**Last Updated**: 2025-11-04
