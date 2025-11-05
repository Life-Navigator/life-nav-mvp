# Troubleshooting Chat Connection

## Quick Diagnosis

### Step 1: Check Both Services Are Running

```bash
# Check backend
curl http://localhost:8080/health

# Expected: {"status":"healthy",...}

# Check frontend
curl -I http://localhost:3000

# Expected: HTTP/1.1 200 or 307
```

### Step 2: Check Agents Available

```bash
curl http://localhost:8080/agents?user_id=default_user
```

Expected response:
```json
{
  "agents": [{
    "id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
    "name": "Test Research Agent",
    ...
  }],
  "total": 1
}
```

### Step 3: Test Chat Endpoint

```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"d35a5a87-4eb0-442c-b4ff-a6ee31fe950e","message":"test"}'
```

Expected: Should return a response with conversation_id and message.

---

## Common Issues

### Issue 1: Send Button is Disabled

**Symptoms**: Can't click the Send button in chat

**Causes**:
1. No text entered in input field
2. Agent not loaded (no green dot)
3. Currently sending a message

**Solutions**:

#### Check Agent Status Indicator

Look at the header of the chat sidebar:
- 🟡 **Yellow dot** = Loading agent (wait a moment)
- 🟢 **Green dot** = Ready to chat
- **No dot** = Agent failed to load

#### Open Browser Console

Press F12 and look for errors like:
```
Failed to load agents: ...
```

If you see network errors:
- Backend might not be running
- CORS might be misconfigured
- Network connectivity issue

---

### Issue 2: "Loading AI agent..." Forever

**Symptoms**: Chat shows "Loading AI agent..." but never changes to green

**Solution**: Agent list API call is failing

**Check**:
1. Open http://localhost:3000/test-agent
2. Check if agents load there
3. Look at browser console (F12) for errors

**Fix**:
```bash
# Restart backend
pkill -f start_mcp_server_single.py
cd ~/Documents/projects/life-navigator-agents
source venv/bin/activate
python3 start_mcp_server_single.py
```

---

### Issue 3: Network Error When Sending Message

**Symptoms**: Error message appears after clicking Send

**Solutions**:

#### Check Browser Console

Look for:
```
POST http://localhost:8080/chat net::ERR_CONNECTION_REFUSED
```

This means backend is not running.

**Fix**:
```bash
# Check if backend is running
lsof -i :8080

# If not, start it
pnpm dev:backend
```

---

### Issue 4: CORS Error (Despite Being Configured)

**Symptoms**: Browser console shows:
```
Access to fetch at 'http://localhost:8080' blocked by CORS policy
```

**Solution**: Backend needs to be restarted after CORS configuration

```bash
# Restart backend
pkill -f start_mcp_server_single.py
pnpm dev:backend

# Or use the auto-start
pnpm dev:all
```

---

### Issue 5: Not Logged In

**Symptoms**: Redirected to /auth/login

**Solution**: You need to be logged in to use the app

1. Go to http://localhost:3000/auth/login
2. Sign up or sign in
3. Return to dashboard
4. Chat should now work

---

## Testing Procedure

### Test 1: Direct API Test (No Browser)

```bash
# 1. Check health
curl http://localhost:8080/health

# 2. List agents
curl http://localhost:8080/agents?user_id=default_user

# 3. Send test message
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "d35a5a87-4eb0-442c-b4ff-a6ee31fe950e",
    "message": "Hello, can you help me?"
  }'
```

If all three work → Backend is fine, issue is in frontend
If any fail → Backend has a problem

---

### Test 2: Frontend Test Page

1. Go to http://localhost:3000/test-agent
2. Check:
   - Health status shows green ✅
   - Agent list shows "Test Research Agent"
   - Can select the agent
   - Can type and send message
   - Receive a response

If test page works → Side chat has an issue
If test page fails → Check browser console for errors

---

### Test 3: Side Chat

1. Go to http://localhost:3000/dashboard
2. Click blue floating button (bottom-right)
3. Wait for green dot to appear
4. Type "test" and press Enter
5. Should receive a response

---

## Debug Mode

### Enable Detailed Logging

Open browser console (F12) and run:

```javascript
// Check if agentApi is available
const { agentApi } = await import('/src/lib/api/agent.ts');

// Test health
const health = await agentApi.health();
console.log('Health:', health);

// Test agents list
try {
  const agents = await agentApi.listAgents('default_user');
  console.log('Agents:', agents);
} catch (err) {
  console.error('Error loading agents:', err);
}

// Test chat (use actual agent ID from above)
try {
  const response = await agentApi.chat({
    agent_id: 'd35a5a87-4eb0-442c-b4ff-a6ee31fe950e',
    message: 'test'
  });
  console.log('Chat response:', response);
} catch (err) {
  console.error('Error sending chat:', err);
}
```

This will show exactly where the connection is failing.

---

## Environment Check

### Verify Configuration

Check `.env.local`:

```bash
cat .env.local | grep AGENT_API
```

Should show:
```
NEXT_PUBLIC_AGENT_API_URL=http://localhost:8080
```

If missing or wrong, update it and restart frontend:
```bash
# Fix .env.local
echo "NEXT_PUBLIC_AGENT_API_URL=http://localhost:8080" >> .env.local

# Restart frontend
# Press Ctrl+C in terminal
pnpm dev
```

---

## Still Not Working?

### Collect Information

1. **Backend logs**: Check terminal running backend
2. **Frontend logs**: Check terminal running `pnpm dev`
3. **Browser console**: Press F12, copy all errors
4. **Network tab**: F12 → Network → Try to send message → Copy failed request details

### Common Error Messages and Solutions

| Error Message | Solution |
|---------------|----------|
| `Failed to load agents` | Backend not running or CORS issue |
| `agent_id is required` | Agent not selected/loaded |
| `Connection refused` | Backend not running on port 8080 |
| `404 Not Found` | Wrong API endpoint URL |
| `500 Internal Server Error` | Backend error, check backend logs |
| `Network request failed` | Backend crashed or not accessible |

---

## Quick Reset

If nothing works, try a full reset:

```bash
# 1. Stop everything
pkill -f start_mcp_server_single.py
pkill -f "next dev"

# 2. Start fresh
cd ~/Documents/projects/lifenavigator
pnpm dev:all
```

This starts both backend and frontend together.

---

## Success Checklist

When everything is working correctly:

- [ ] Backend responds to health check
- [ ] Agents list returns Test Research Agent
- [ ] Chat endpoint responds to test message
- [ ] Test page (localhost:3000/test-agent) loads without errors
- [ ] Test page shows green health status
- [ ] Test page shows available agent
- [ ] Can send message on test page
- [ ] Side chat button appears (blue, bottom-right)
- [ ] Clicking button opens sidebar
- [ ] Sidebar shows green dot
- [ ] Can type message
- [ ] Send button is enabled
- [ ] Message sends successfully
- [ ] Response appears in chat

---

## Contact Points

If you're stuck, check:

1. **Backend logs** (terminal running backend)
2. **Frontend logs** (terminal running `pnpm dev`)
3. **Browser console** (F12 → Console)
4. **Network tab** (F12 → Network → filter by "agents" or "chat")

The error message will tell you exactly what's wrong!
