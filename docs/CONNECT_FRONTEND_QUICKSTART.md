# 🚀 Frontend Connection Quick Start

## TL;DR - 3 Steps to Connect Your Frontend

Your frontend at **localhost:3000** → Backend API at **localhost:8080** → Maverick Model

### Step 1: Start Backend

```bash
./START_MAVERICK_QUICKSTART.sh
```

Wait 1-2 minutes for Maverick to load.

### Step 2: Test Connection

Open browser console at http://localhost:3000 and run:

```javascript
fetch('http://localhost:8080/health')
  .then(r => r.json())
  .then(console.log);
```

Should return: `{"status": "healthy", ...}`

### Step 3: Use API in Your Frontend

**Key Endpoints**:
- `GET /agents` - List agents
- `POST /chat` - Chat with agent (main endpoint)
- `POST /inference` - Direct model access

---

## 📋 Integration Checklist

- [x] **CORS Enabled** - Backend allows requests from localhost:3000
- [x] **Maverick Connected** - Both `/chat` and `/inference` use Maverick
- [x] **Real Data Mode** - All queries hit real databases
- [ ] **Create an Agent** - Use admin dashboard (localhost:8501) or API
- [ ] **Test Chat** - Send message via `/chat` endpoint
- [ ] **Integrate in Frontend** - Use provided code examples

---

## 🔌 Quick API Reference

### List Agents
```bash
curl http://localhost:8080/agents?user_id=default_user
```

### Create Agent
```bash
curl -X POST http://localhost:8080/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Agent",
    "description": "AI assistant",
    "agent_type": "research",
    "capabilities": ["research"],
    "system_prompt": "You are a helpful assistant."
  }'
```

### Chat with Agent
```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "YOUR_AGENT_ID",
    "message": "Hello!"
  }'
```

---

## 💻 Frontend Code

### JavaScript Fetch Example

```javascript
// Chat with agent
async function chatWithAgent(agentId, message) {
  const response = await fetch('http://localhost:8080/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      message: message
    })
  });

  const data = await response.json();
  return data.message; // Agent's response
}

// Example usage
const agentResponse = await chatWithAgent('agent_123', 'Hello!');
console.log(agentResponse);
```

### React Hook Example

```typescript
import { useState } from 'react';

export function useChat(agentId: string) {
  const [loading, setLoading] = useState(false);

  async function sendMessage(message: string) {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message })
      });
      const data = await res.json();
      return data.message;
    } finally {
      setLoading(false);
    }
  }

  return { sendMessage, loading };
}
```

---

## 🧪 Test Page

Open `docs/test-api.html` in your browser to test the API connection interactively.

Or use this quick test:

```html
<!DOCTYPE html>
<html>
<body>
  <h1>Test Backend API</h1>
  <button onclick="testAPI()">Test Connection</button>
  <pre id="output"></pre>

  <script>
    async function testAPI() {
      const output = document.getElementById('output');

      try {
        // Test health
        output.textContent = 'Testing /health...\n';
        const health = await fetch('http://localhost:8080/health').then(r => r.json());
        output.textContent += 'Health: ' + JSON.stringify(health, null, 2) + '\n\n';

        // Test agents
        output.textContent += 'Testing /agents...\n';
        const agents = await fetch('http://localhost:8080/agents?user_id=default_user').then(r => r.json());
        output.textContent += 'Agents: ' + JSON.stringify(agents, null, 2);
      } catch (e) {
        output.textContent += 'Error: ' + e.message;
      }
    }
  </script>
</body>
</html>
```

---

## 📚 Full Documentation

**Complete Guide**: `docs/FRONTEND_INTEGRATION_GUIDE.md`

**Includes**:
- Full API reference
- TypeScript/JavaScript examples
- Python examples
- React hooks
- Error handling
- CORS configuration
- Troubleshooting

---

## 🚨 Common Issues

### CORS Error
**Already fixed!** CORS is enabled for localhost:3000

### Connection Refused
```bash
# Make sure backend is running
curl http://localhost:8080/health

# If not, start it
./START_MAVERICK_QUICKSTART.sh
```

### "Agent not found"
Create an agent first:
```bash
# Via dashboard
open http://localhost:8501

# Or via API
curl -X POST http://localhost:8080/agents -H "Content-Type: application/json" -d '{...}'
```

---

## ✅ System Status

- **Backend API**: http://localhost:8080 ✅
- **Maverick Model**: http://localhost:8090 ✅
- **Admin Dashboard**: http://localhost:8501 ✅
- **Your Frontend**: http://localhost:3000 ⏳ (waiting for you!)

---

**You're all set to connect your frontend!** 🎉

Use the API client code in `FRONTEND_INTEGRATION_GUIDE.md` to integrate with your frontend application.
