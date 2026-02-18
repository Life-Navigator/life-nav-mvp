# Action Plan - Wire the Life Navigator App

**Date**: November 2, 2025
**Goal**: Get the multi-agent system actually working with real LLM and knowledge base
**Time Estimate**: 3-4 days of focused work

---

## 🎯 The Real Problem (No BS)

You have 280,000+ lines of excellent agent code that's never been connected to:
1. ❌ The actual LLM (Maverick) - agents return mock responses
2. ❌ The knowledge base (GraphRAG) - agents can't query FINRA rules
3. ❌ Each other (Message Bus) - no agent-to-agent communication

**What works**: Maverick LLM server, GraphRAG, PostgreSQL, admin dashboard

**What doesn't work**: The agents talking to anything real

---

## Day 1: Implement vLLM Client (6-8 hours)

### Morning: Create VLLMClient (4 hours)

**Task**: Implement `models/vllm_client.py`

**File to create**: `models/vllm_client.py`

**What it needs**:
```python
class VLLMClient:
    def __init__(self, base_url="http://localhost:8090/v1", model="llama-4-maverick"):
        """Connect to Maverick server"""

    async def generate(self, prompt: str, temperature=0.7, max_tokens=2048):
        """Generate text (non-streaming)"""
        # POST to /v1/completions or /v1/chat/completions

    async def generate_stream(self, prompt: str):
        """Generate text (streaming)"""
        # POST with stream=True

    async def count_tokens(self, text: str):
        """Estimate token count"""

    def health_check(self):
        """Check if Maverick is running"""
        # GET /health or /v1/models
```

**Test criteria**:
- Can connect to Maverick at localhost:8090
- Can generate a simple response: "What is 2+2?"
- Streaming works
- Error handling for when Maverick is down

**Files to reference**:
- `ui/maverick_chat.py` - Already has working API calls to Maverick!
- Copy the working pattern from there

**Test script**: Create `test_vllm_client.py`
```python
import asyncio
from models.vllm_client import VLLMClient

async def test():
    client = VLLMClient()

    # Test 1: Health check
    assert client.health_check(), "Maverick not running"

    # Test 2: Simple generation
    response = await client.generate("What is 2+2?")
    print(f"Response: {response}")
    assert len(response) > 0

    # Test 3: Streaming
    async for chunk in client.generate_stream("Count to 5"):
        print(chunk, end="")

    print("\n✅ All tests passed!")

asyncio.run(test())
```

---

### Afternoon: Wire VLLMClient to Agents (3 hours)

**Task**: Pass real VLLMClient to agents instead of None

**Files to modify**:
1. `ui/chat_app.py` - Change initialization
2. `agents/core/base_agent.py` - Use self.vllm_client instead of mock

**Before**:
```python
# ui/chat_app.py line 74-76
orchestrator = await create_agent_hierarchy(
    vllm_client=None,  # ❌ Mock!
    config={"mock_mode": True}
)
```

**After**:
```python
# Import
from models.vllm_client import VLLMClient

# Initialize
vllm_client = VLLMClient(base_url="http://localhost:8090/v1")

orchestrator = await create_agent_hierarchy(
    vllm_client=vllm_client,  # ✅ Real!
    config={"mock_mode": False}
)
```

**Test**:
- Launch `streamlit run ui/chat_app.py`
- Type "What is 2+2?"
- Should get real LLM response, not mock

**Stop here if it works!** Don't go further until you see a real LLM response in the chat UI.

---

## Day 2: Connect GraphRAG to Agents (6-8 hours)

### Morning: Wire GraphRAG Client (3 hours)

**Task**: Pass real GraphRAG client to agents

**Files to modify**:
1. `ui/chat_app.py` - Initialize GraphRAG client
2. Pass to `create_agent_hierarchy`

**Code change**:
```python
# ui/chat_app.py
from graphrag.client import get_graphrag_client

async def initialize_agent_system(use_mock_data: bool = False):  # Default to False!
    # Create REAL clients
    vllm_client = VLLMClient(base_url="http://localhost:8090/v1")
    graphrag_client = await get_graphrag_client()  # ✅ Real GraphRAG!

    orchestrator = await create_agent_hierarchy(
        vllm_client=vllm_client,
        graphrag_client=graphrag_client,  # ✅ Real!
        mcp_client=None,  # Can stay None for now
        message_bus=None,  # Can stay None for now
        config={"mock_mode": False}
    )
    return orchestrator
```

**Test**:
- Make sure PostgreSQL is running
- Make sure you have documents uploaded
- Launch chat app
- Agent should be able to query knowledge base

---

### Afternoon: Upload Test Documents & Test End-to-End (4 hours)

**Task**: Upload FINRA rules and test agent can retrieve them

**Steps**:
1. Launch admin dashboard: `streamlit run ui/admin_app.py`
2. Upload a FINRA document (use the sample from `demo_complete_system.py`)
3. Verify it's in database: `psql -d life_navigator_db -c "SELECT title FROM graphrag.documents LIMIT 5"`
4. Launch chat app
5. Ask: "What is FINRA Rule 2111 about?"
6. Agent should retrieve the rule from GraphRAG and answer with real content

**Success criteria**:
- ✅ Agent calls GraphRAG to search for "FINRA Rule 2111"
- ✅ Agent gets document chunks back
- ✅ Agent uses LLM to synthesize answer
- ✅ User sees accurate response about suitability requirements

**Debug tips**:
- Add logging to see GraphRAG queries
- Check agent is actually calling `self.graphrag_client.search_documents()`
- Verify embeddings are being generated

---

## Day 3: Test All Agents & Fix Issues (6-8 hours)

### Morning: Test Each Specialist Agent (4 hours)

**Task**: Verify each of the 11 agents works

**Test queries**:
1. Budget Agent: "Help me analyze my budget"
2. Tax Agent: "What tax deductions can I claim?"
3. Investment Agent: "Should I invest in index funds?"
4. Debt Agent: "How should I pay off my credit cards?"
5. Savings Agent: "Help me build an emergency fund"
6. Job Search Agent: "Find me software engineering jobs"
7. Resume Agent: "Review my resume for ATS optimization"

**For each agent**:
- Verify orchestrator routes to correct agent
- Verify agent gets context from GraphRAG (if applicable)
- Verify agent uses LLM for reasoning
- Verify response makes sense

**Log issues**:
- Create `DAY3_ISSUES.md` to track what breaks
- Fix as you go

---

### Afternoon: Fix Integration Issues (3 hours)

**Common issues to expect**:
1. Async/await errors (Streamlit + asyncio)
2. GraphRAG query timeouts
3. LLM context length exceeded
4. Agent routing failures
5. Error handling gaps

**Fix strategy**:
- One issue at a time
- Add error logging
- Test after each fix
- Commit working fixes

---

## Day 4: Polish & Documentation (4-6 hours)

### Morning: Add Missing Features (3 hours)

**Optional improvements** (only if Days 1-3 worked):

1. **User Sessions** (1 hour)
   - Save conversation history to PostgreSQL
   - Restore on reload

2. **Conversation Context** (1 hour)
   - Pass previous messages to agents
   - Maintain conversation memory

3. **Better Error Messages** (1 hour)
   - Show helpful errors when LLM is down
   - Show progress indicators

---

### Afternoon: Documentation & Cleanup (2 hours)

**Task**: Update README with real quickstart

**Create**: `QUICKSTART_REAL.md`

```markdown
# Life Navigator - Real Quickstart

## 1. Start Services
```bash
# Terminal 1: PostgreSQL (if not running)
docker-compose up -d postgres

# Terminal 2: Maverick LLM
./scripts/start_maverick_gpu.sh

# Wait 2 minutes for Maverick to load
```

## 2. Upload Knowledge Base
```bash
# Terminal 3: Admin Dashboard
streamlit run ui/admin_app.py

# Upload FINRA rules, tax documents, etc.
```

## 3. Chat with Agents
```bash
# Terminal 4: Chat App
streamlit run ui/chat_app.py

# Try:
# - "What is FINRA Rule 2111?"
# - "Help me create a budget"
# - "Review my resume for software engineering"
```

## What Actually Works
- ✅ Multi-agent orchestration
- ✅ Real LLM reasoning (Maverick)
- ✅ Knowledge base queries (GraphRAG)
- ✅ 11 specialist agents
```

**Update**: `README.md` to point to this

---

## Testing Checklist (Do NOT Skip)

Before claiming "it works":

### Day 1 Tests
- [ ] VLLMClient can connect to Maverick
- [ ] VLLMClient generates text
- [ ] Chat app shows real LLM response (not mock)

### Day 2 Tests
- [ ] GraphRAG client connects to PostgreSQL
- [ ] Documents can be uploaded via admin dashboard
- [ ] Agent can retrieve documents from GraphRAG
- [ ] Agent uses retrieved docs in response

### Day 3 Tests
- [ ] Orchestrator correctly routes to 5+ different agents
- [ ] Each agent can complete its core task
- [ ] No critical errors in logs
- [ ] Responses make sense (not hallucinated)

### Day 4 Tests
- [ ] README quickstart works from scratch
- [ ] Another person could follow the docs
- [ ] All integration points documented

---

## What NOT to Do (Lessons Learned)

❌ **Don't claim it's done until you test it**
❌ **Don't trust documentation - run the code**
❌ **Don't create completion percentages - show working demos**
❌ **Don't analyze - build and test**
❌ **Don't add features before core works**

✅ **DO make it work first, optimize later**
✅ **DO test each step before moving on**
✅ **DO commit working code frequently**
✅ **DO document what actually works**

---

## If You Get Stuck

### Problem: Maverick won't start
**Solution**: Check GPU, try CPU mode, verify model path

### Problem: GraphRAG can't connect
**Solution**: Verify PostgreSQL running, check connection string

### Problem: Agents return garbage
**Solution**: Check prompt engineering in agent code

### Problem: Streamlit async errors
**Solution**: Use `asyncio.run()` wrapper, not bare `await`

---

## Success Criteria (Day 4 End)

You know it's REALLY working when:
1. ✅ User types question in chat UI
2. ✅ Orchestrator routes to correct agent (visible in logs)
3. ✅ Agent queries GraphRAG for context (visible in logs)
4. ✅ Agent sends prompt to Maverick LLM
5. ✅ Agent returns synthesized answer
6. ✅ Answer is accurate and helpful
7. ✅ Can do this 10 times without errors

**Demo video**: Record yourself doing this end-to-end. If you can't record it working, it's not done.

---

## Estimated Hours

| Day | Focus | Hours | Cumulative |
|-----|-------|-------|------------|
| Day 1 | VLLMClient + basic wiring | 6-8 | 8 |
| Day 2 | GraphRAG integration + testing | 6-8 | 16 |
| Day 3 | All agents + bug fixes | 6-8 | 24 |
| Day 4 | Polish + docs | 4-6 | 30 |

**Total: 30 hours over 4 days**

Realistic pace: 6-8 hours/day = Done by end of Week 1

---

## Files You'll Create/Modify

### New Files:
- `models/vllm_client.py` - LLM client
- `test_vllm_client.py` - Test suite
- `DAY3_ISSUES.md` - Issue tracker
- `QUICKSTART_REAL.md` - Real quickstart guide

### Modified Files:
- `ui/chat_app.py` - Wire real clients
- `agents/core/base_agent.py` - Use real clients instead of mocks
- `README.md` - Update with real quickstart

### Files to Reference:
- `ui/maverick_chat.py` - Working Maverick API calls
- `graphrag/client.py` - Working GraphRAG queries
- `demo_complete_system.py` - Sample documents

---

## Tomorrow Morning - First Thing

1. Open `ui/maverick_chat.py`
2. Copy the API call pattern
3. Create `models/vllm_client.py`
4. Test it works with Maverick
5. Wire it to chat app
6. **See a real response** before lunch

That's the only goal for tomorrow. Everything else can wait.

---

**Remember**: You're not 20% done. You're 90% done with code, 20% done with integration.

The code is excellent. The wiring is missing. Let's wire it up.

🚀 Let's make it ACTUALLY work tomorrow.
