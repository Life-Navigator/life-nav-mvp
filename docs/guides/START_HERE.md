# 🎯 START HERE - Get Your AI Agent System Running with Maverick

## ⚡ Quick Start (10 Minutes)

You already have the **Maverick model** (227GB)! Let's connect it to your agent system.

---

## 🚀 Step 1: Start Everything (Automated)

```bash
# Run the automated startup script
./START_MAVERICK_QUICKSTART.sh
```

This script will:
1. ✅ Start Maverick model server (port 8090)
2. ✅ Start MCP Server (port 8080)
3. ✅ Start Admin Dashboard (port 8501)

**Wait ~30 seconds for Maverick to load into memory...**

---

## ✅ Step 2: Maverick Connection Ready!

**Good news!** The MCP server is already configured to use your local Maverick model. Both the `/chat` and `/inference` endpoints are connected to `http://localhost:8090`.

**No manual editing needed!** The system is ready to use.

---

## 🧪 Step 3: Test Maverick Connection

```bash
curl -X POST http://localhost:8080/inference \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello in one sentence",
    "temperature": 0.7,
    "max_tokens": 50
  }'
```

**Expected**: A JSON response with Maverick's greeting! ✅

---

## 🤖 Step 4: Create Your First Agent

### Option A: Web UI (Easiest)
1. Open: http://localhost:8501
2. Click: "🤖 Agent Management" in sidebar
3. Click: "➕ Create New Agent"
4. Select: "Research Agent" template
5. Name: "Maverick Research Agent"
6. Click: "💾 Save Agent"
7. **Copy the agent ID** from "My Agents" tab

### Option B: Command Line
```bash
curl -X POST http://localhost:8080/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maverick Agent",
    "description": "Powered by local Maverick model",
    "agent_type": "research",
    "capabilities": ["research", "search"],
    "system_prompt": "You are Maverick, a helpful AI assistant.",
    "tools": ["query_knowledge_graph"],
    "max_concurrent_tasks": 5,
    "task_timeout_seconds": 300,
    "custom_config": {}
  }'
```

---

## 💬 Step 5: Chat with Your Maverick Agent! 🎉

```bash
./venv/bin/python3 chat_with_agent.py
```

**That's it!** The script will:
- Show available agents
- Let you select one
- Start chatting with your local Maverick model

**Example conversation:**
```
You: Hello! What can you help me with?

🤖 Agent: Hello! I'm Maverick, your AI assistant. I can help you with...
- Researching information
- Answering questions
- Analyzing data
...

You: Tell me about AI agents

🤖 Agent: AI agents are autonomous software entities...
```

---

## 📚 Full Documentation

- **[CONNECT_MAVERICK_MODEL.md](CONNECT_MAVERICK_MODEL.md)** - Detailed Maverick setup
- **[QUICKSTART_GUIDE.md](QUICKSTART_GUIDE.md)** - Complete walkthrough
- **[API_ENDPOINTS_COMPLETE.md](API_ENDPOINTS_COMPLETE.md)** - API reference

---

## 🛠️ Quick Commands

### Check Everything is Running
```bash
curl http://localhost:8090/health    # Maverick
curl http://localhost:8080/health    # MCP Server
curl http://localhost:8501           # Dashboard
```

### View Logs
```bash
tail -f logs/maverick_server.log      # Maverick logs
tail -f /tmp/mcp_server.log            # MCP Server logs
tail -f /tmp/admin_dashboard.log       # Dashboard logs
```

### Restart Everything
```bash
./START_MAVERICK_QUICKSTART.sh
```

---

## 🎯 What You Get

✅ **Local Maverick Model** - 227GB Q4 quantized, no API costs  
✅ **Real Data** - All queries hit real databases  
✅ **5 API Endpoints** - Task execution, chat, inference  
✅ **6 Agent Templates** - Research, Analyst, Writer, Planner, Executor, Custom  
✅ **No External APIs** - Everything runs on your hardware  
✅ **No API Costs** - Use your own model  

---

## 🚀 You're All Set!

Your local Maverick model is ready to power your AI agents!

**System Architecture**:
```
You → chat_with_agent.py → Agent System (8080) → Maverick (8090)
```

**Happy chatting with your Maverick-powered agents!** 🤖✨
