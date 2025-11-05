# 🔌 Frontend Integration Guide - Connect Your UI to the AI Backend

## Overview

This guide shows how to connect your **frontend application (localhost:3000)** to the **AI Agent Backend System (localhost:8080)**.

**Architecture**:
```
Frontend (localhost:3000) → Backend API (localhost:8080) → Maverick Model (localhost:8090)
                                ↓
                           Real Databases
                           (PostgreSQL, Neo4j, Qdrant, Redis)
```

---

## 🚀 Quick Start

### 1. Ensure Backend is Running

```bash
# From project root
./START_MAVERICK_QUICKSTART.sh
```

This starts:
- Maverick Model Server (port 8090)
- MCP Backend API (port 8080)
- Admin Dashboard (port 8501)

Wait ~1-2 minutes for Maverick to load.

### 2. Test Backend is Ready

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

---

## 📡 API Endpoints

Base URL: `http://localhost:8080`

### 1. Agent Management

#### List All Agents
```http
GET /agents?user_id=default_user
```

**Response**:
```json
{
  "agents": [
    {
      "agent_id": "agent_123abc",
      "name": "Research Agent",
      "description": "Helps with research tasks",
      "agent_type": "research",
      "capabilities": ["research", "search"],
      "system_prompt": "You are a helpful research assistant...",
      "status": "active",
      "created_at": "2025-11-03T12:00:00Z"
    }
  ],
  "total": 1
}
```

#### Get Single Agent
```http
GET /agents/{agent_id}?user_id=default_user
```

#### Create New Agent
```http
POST /agents
Content-Type: application/json

{
  "name": "My Custom Agent",
  "description": "Custom agent for specific tasks",
  "agent_type": "research",
  "capabilities": ["research", "search", "memory"],
  "system_prompt": "You are a helpful AI assistant specialized in...",
  "tools": ["query_knowledge_graph", "search_semantic"],
  "max_concurrent_tasks": 5,
  "task_timeout_seconds": 300,
  "custom_config": {}
}
```

**Response**:
```json
{
  "agent_id": "agent_xyz789",
  "name": "My Custom Agent",
  "status": "active",
  "created_at": "2025-11-03T12:30:00Z"
}
```

---

### 2. Chat with Agent (Primary Interface)

#### Send Chat Message
```http
POST /chat
Content-Type: application/json

{
  "agent_id": "agent_123abc",
  "message": "Hello! Can you help me research AI agents?",
  "conversation_id": "optional-conversation-id",
  "system_prompt_override": "Optional custom system prompt for this message"
}
```

**Response**:
```json
{
  "conversation_id": "conv_abc123",
  "agent_id": "agent_123abc",
  "message": "Hello! I'd be happy to help you research AI agents. AI agents are autonomous software entities that can perceive their environment, make decisions, and take actions to achieve specific goals...",
  "metadata": {
    "agent_name": "Research Agent",
    "agent_type": "research",
    "model": "maverick-q4",
    "tokens": 156
  },
  "timestamp": "2025-11-03T12:35:00Z"
}
```

---

### 3. Direct Model Inference (Advanced)

#### Call Maverick Model Directly
```http
POST /inference
Content-Type: application/json

{
  "prompt": "Explain quantum computing in simple terms",
  "system_prompt": "You are a helpful teacher",
  "max_tokens": 500,
  "temperature": 0.7
}
```

**Response**:
```json
{
  "response": "Quantum computing is a revolutionary technology that uses the principles of quantum mechanics...",
  "model": "maverick-q4",
  "tokens_used": 342,
  "metadata": {
    "temperature": 0.7,
    "max_tokens": 500,
    "timestamp": "2025-11-03T12:40:00Z",
    "model_path": "maverick-q4_k_m.gguf"
  }
}
```

---

### 4. Task Execution

#### Execute Task with Agent
```http
POST /tasks
Content-Type: application/json

{
  "agent_id": "agent_123abc",
  "task_type": "research",
  "input_text": "Research the latest developments in quantum computing",
  "context": {
    "sources": ["arxiv", "google_scholar"],
    "max_results": 10
  },
  "timeout_seconds": 300,
  "stream": false
}
```

**Response**:
```json
{
  "task_id": "task_xyz789",
  "agent_id": "agent_123abc",
  "status": "completed",
  "result": "Based on recent research, quantum computing has made significant advances in...",
  "metadata": {
    "sources_found": 8,
    "processing_time": 12.5
  },
  "created_at": "2025-11-03T12:45:00Z",
  "completed_at": "2025-11-03T12:45:12Z",
  "error": null
}
```

#### Get Task Status
```http
GET /tasks/{task_id}
```

#### List Tasks
```http
GET /tasks?agent_id=agent_123abc&limit=50
```

---

## 💻 Frontend Integration Examples

### JavaScript/TypeScript (React, Next.js, etc.)

#### 1. Create API Client

```typescript
// lib/api-client.ts
const API_BASE_URL = 'http://localhost:8080';

export interface ChatRequest {
  agent_id: string;
  message: string;
  conversation_id?: string;
  system_prompt_override?: string;
}

export interface ChatResponse {
  conversation_id: string;
  agent_id: string;
  message: string;
  metadata: {
    agent_name: string;
    agent_type: string;
    model: string;
    tokens: number;
  };
  timestamp: string;
}

export interface Agent {
  agent_id: string;
  name: string;
  description: string;
  agent_type: string;
  capabilities: string[];
  system_prompt: string;
  status: string;
  created_at: string;
}

export class AIBackendClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // List all agents
  async listAgents(userId: string = 'default_user'): Promise<Agent[]> {
    const response = await fetch(`${this.baseUrl}/agents?user_id=${userId}`);
    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.statusText}`);
    }
    const data = await response.json();
    return data.agents;
  }

  // Get single agent
  async getAgent(agentId: string, userId: string = 'default_user'): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}?user_id=${userId}`);
    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }
    return response.json();
  }

  // Create new agent
  async createAgent(agentData: {
    name: string;
    description: string;
    agent_type: string;
    capabilities: string[];
    system_prompt: string;
    tools?: string[];
    max_concurrent_tasks?: number;
    task_timeout_seconds?: number;
    custom_config?: Record<string, any>;
  }): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentData),
    });
    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }
    return response.json();
  }

  // Chat with agent
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Chat request failed');
    }

    return response.json();
  }

  // Direct inference
  async inference(prompt: string, options?: {
    system_prompt?: string;
    max_tokens?: number;
    temperature?: number;
  }) {
    const response = await fetch(`${this.baseUrl}/inference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        system_prompt: options?.system_prompt,
        max_tokens: options?.max_tokens || 1000,
        temperature: options?.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Inference request failed');
    }

    return response.json();
  }

  // Execute task
  async executeTask(request: {
    agent_id: string;
    task_type: string;
    input_text: string;
    context?: Record<string, any>;
    timeout_seconds?: number;
  }) {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Task execution failed');
    }

    return response.json();
  }

  // Get task status
  async getTaskStatus(taskId: string) {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`Failed to get task status: ${response.statusText}`);
    }
    return response.json();
  }

  // Check health
  async health() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}

export const apiClient = new AIBackendClient();
```

#### 2. React Hook for Chat

```typescript
// hooks/useAgentChat.ts
import { useState, useCallback } from 'react';
import { apiClient, ChatRequest, ChatResponse } from '@/lib/api-client';

export function useAgentChat(agentId: string) {
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setError(null);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const request: ChatRequest = {
        agent_id: agentId,
        message,
        conversation_id: conversationId || undefined,
      };

      const response: ChatResponse = await apiClient.chat(request);

      // Update conversation ID
      setConversationId(response.conversation_id);

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
      }]);

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [agentId, conversationId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    conversationId,
  };
}
```

#### 3. React Component Example

```typescript
// components/ChatInterface.tsx
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAgentChat } from '@/hooks/useAgentChat';

export default function ChatInterface() {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');

  const { messages, isLoading, error, sendMessage } = useAgentChat(
    selectedAgentId || ''
  );

  // Load agents on mount
  useEffect(() => {
    async function loadAgents() {
      try {
        const agentList = await apiClient.listAgents();
        setAgents(agentList);
        if (agentList.length > 0) {
          setSelectedAgentId(agentList[0].agent_id);
        }
      } catch (err) {
        console.error('Failed to load agents:', err);
      }
    }
    loadAgents();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedAgentId) return;

    try {
      await sendMessage(inputMessage);
      setInputMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="chat-container">
      {/* Agent Selector */}
      <div className="agent-selector">
        <label>Select Agent:</label>
        <select
          value={selectedAgentId || ''}
          onChange={(e) => setSelectedAgentId(e.target.value)}
        >
          {agents.map((agent: any) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.name} ({agent.agent_type})
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'Agent'}:</strong>
            <p>{msg.content}</p>
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
        {isLoading && <div className="loading">Agent is thinking...</div>}
        {error && <div className="error">{error}</div>}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="input-form">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading || !selectedAgentId}
        />
        <button type="submit" disabled={isLoading || !selectedAgentId}>
          Send
        </button>
      </form>
    </div>
  );
}
```

---

### Python Frontend (Streamlit, Flask, FastAPI)

```python
# frontend/api_client.py
import requests
from typing import Optional, List, Dict, Any

class AIBackendClient:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url

    def list_agents(self, user_id: str = "default_user") -> List[Dict]:
        """List all available agents"""
        response = requests.get(
            f"{self.base_url}/agents",
            params={"user_id": user_id}
        )
        response.raise_for_status()
        return response.json()["agents"]

    def get_agent(self, agent_id: str, user_id: str = "default_user") -> Dict:
        """Get single agent details"""
        response = requests.get(
            f"{self.base_url}/agents/{agent_id}",
            params={"user_id": user_id}
        )
        response.raise_for_status()
        return response.json()

    def create_agent(
        self,
        name: str,
        description: str,
        agent_type: str,
        capabilities: List[str],
        system_prompt: str,
        tools: Optional[List[str]] = None,
        max_concurrent_tasks: int = 5,
        task_timeout_seconds: int = 300,
        custom_config: Optional[Dict] = None
    ) -> Dict:
        """Create new agent"""
        response = requests.post(
            f"{self.base_url}/agents",
            json={
                "name": name,
                "description": description,
                "agent_type": agent_type,
                "capabilities": capabilities,
                "system_prompt": system_prompt,
                "tools": tools or [],
                "max_concurrent_tasks": max_concurrent_tasks,
                "task_timeout_seconds": task_timeout_seconds,
                "custom_config": custom_config or {}
            }
        )
        response.raise_for_status()
        return response.json()

    def chat(
        self,
        agent_id: str,
        message: str,
        conversation_id: Optional[str] = None,
        system_prompt_override: Optional[str] = None
    ) -> Dict:
        """Send chat message to agent"""
        response = requests.post(
            f"{self.base_url}/chat",
            json={
                "agent_id": agent_id,
                "message": message,
                "conversation_id": conversation_id,
                "system_prompt_override": system_prompt_override
            },
            timeout=60
        )
        response.raise_for_status()
        return response.json()

    def inference(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Dict:
        """Direct model inference"""
        response = requests.post(
            f"{self.base_url}/inference",
            json={
                "prompt": prompt,
                "system_prompt": system_prompt,
                "max_tokens": max_tokens,
                "temperature": temperature
            },
            timeout=60
        )
        response.raise_for_status()
        return response.json()

    def execute_task(
        self,
        agent_id: str,
        task_type: str,
        input_text: str,
        context: Optional[Dict] = None,
        timeout_seconds: int = 300
    ) -> Dict:
        """Execute task with agent"""
        response = requests.post(
            f"{self.base_url}/tasks",
            json={
                "agent_id": agent_id,
                "task_type": task_type,
                "input_text": input_text,
                "context": context or {},
                "timeout_seconds": timeout_seconds,
                "stream": False
            },
            timeout=timeout_seconds + 10
        )
        response.raise_for_status()
        return response.json()

    def get_task_status(self, task_id: str) -> Dict:
        """Get task status"""
        response = requests.get(f"{self.base_url}/tasks/{task_id}")
        response.raise_for_status()
        return response.json()

    def health(self) -> Dict:
        """Check backend health"""
        response = requests.get(f"{self.base_url}/health")
        return response.json()

# Example usage
if __name__ == "__main__":
    client = AIBackendClient()

    # List agents
    agents = client.list_agents()
    print(f"Available agents: {len(agents)}")

    if agents:
        agent_id = agents[0]["agent_id"]

        # Chat with agent
        response = client.chat(
            agent_id=agent_id,
            message="Hello! Can you help me with research?"
        )
        print(f"Agent response: {response['message']}")
```

---

## 🔒 CORS Configuration (Important!)

If your frontend is on a different origin (localhost:3000), you need to enable CORS on the backend.

### Enable CORS in Backend

Edit `mcp-server/core/server.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

def create_app():
    app = FastAPI(...)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",  # Your frontend URL
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ... rest of your app setup
```

Then restart the backend:
```bash
pkill -f start_mcp_server_single.py
nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &
```

---

## 🧪 Testing the Integration

### 1. Test from Browser Console

Open your frontend at http://localhost:3000 and run in browser console:

```javascript
// Test health
fetch('http://localhost:8080/health')
  .then(r => r.json())
  .then(console.log);

// List agents
fetch('http://localhost:8080/agents?user_id=default_user')
  .then(r => r.json())
  .then(console.log);

// Chat (replace with actual agent_id)
fetch('http://localhost:8080/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_id: 'your-agent-id',
    message: 'Hello!'
  })
})
  .then(r => r.json())
  .then(console.log);
```

### 2. Test with curl

```bash
# List agents
curl http://localhost:8080/agents?user_id=default_user

# Create agent
curl -X POST http://localhost:8080/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "description": "Test agent",
    "agent_type": "research",
    "capabilities": ["research"],
    "system_prompt": "You are helpful"
  }'

# Chat (use agent_id from above)
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_xyz",
    "message": "Hello!"
  }'
```

---

## 📋 Complete Integration Checklist

- [ ] Backend is running (`./START_MAVERICK_QUICKSTART.sh`)
- [ ] Maverick model loaded (check logs: `tail -f logs/maverick_server.log`)
- [ ] Backend health check passes (`curl http://localhost:8080/health`)
- [ ] CORS enabled in backend for localhost:3000
- [ ] API client created in frontend
- [ ] At least one agent created
- [ ] Successfully sent test chat message
- [ ] Frontend displays agent response

---

## 🚨 Troubleshooting

### CORS Errors
**Problem**: `Access to fetch at 'http://localhost:8080' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Solution**: Enable CORS in `mcp-server/core/server.py` (see CORS section above)

### Connection Refused
**Problem**: `Failed to fetch` or `ERR_CONNECTION_REFUSED`

**Solution**:
```bash
# Check backend is running
curl http://localhost:8080/health

# If not, start it
./START_MAVERICK_QUICKSTART.sh
```

### Slow Responses
**Problem**: Chat responses take >30 seconds

**Solution**: This is expected for first request (model warmup). Subsequent requests should be faster (10-20 tokens/sec).

### Agent Not Found
**Problem**: 404 error when chatting

**Solution**: Create an agent first or use correct agent_id from `/agents` endpoint

---

## 📚 Next Steps

1. **Read this guide** to understand the API
2. **Copy the API client code** into your frontend project
3. **Enable CORS** in the backend
4. **Test with browser console** to verify connectivity
5. **Implement chat UI** using the provided examples
6. **Deploy** to production when ready

---

## 🎯 Summary

**Backend API**: http://localhost:8080
**Frontend**: http://localhost:3000
**Key Endpoints**:
- `GET /agents` - List agents
- `POST /chat` - Chat with agent (primary interface)
- `POST /inference` - Direct model access
- `POST /tasks` - Execute tasks

**Your frontend should**:
1. List available agents
2. Let user select an agent
3. Send chat messages via `POST /chat`
4. Display agent responses
5. Maintain conversation_id for context

**The backend handles**:
- Calling Maverick model
- Managing agent state
- Database queries
- Response generation

---

For more details, see:
- **API Reference**: `docs/guides/API_ENDPOINTS_COMPLETE.md`
- **Backend Setup**: `docs/guides/START_HERE.md`
- **System Overview**: `SYSTEM_READY.md`
