# 🚀 Life Navigator Agents: Quick Start Guide
## Get Your Multi-Agent System Running in 24 Hours

**Complete Documentation:**
- 📖 **Part 1:** [AGENT_IMPLEMENTATION_SPRINT.md](./AGENT_IMPLEMENTATION_SPRINT.md) - Infrastructure, vLLM, BaseAgent, Database
- 📖 **Part 2:** [AGENT_IMPLEMENTATION_SPRINT_PART2.md](./AGENT_IMPLEMENTATION_SPRINT_PART2.md) - MessageBus, GraphRAG, Agents, Testing

---

## ⚡ Day 1 Quick Start (3-4 hours)

### Step 1: Install CUDA & vLLM (45 min)

```bash
# Install CUDA 12.1
wget https://developer.download.nvidia.com/compute/cuda/12.1.0/local_installers/cuda_12.1.0_530.30.02_linux.run
sudo sh cuda_12.1.0_530.30.02_linux.run

# Verify
nvcc --version
nvidia-smi  # Should show your GPUs

# Create environment
conda create -n vllm-flash python=3.10 -y
conda activate vllm-flash

# Install vLLM with Flash Attention 2
pip install vllm==0.5.4
pip install flash-attn==2.5.9 --no-build-isolation

# Verify Flash Attention
python -c "import flash_attn; print(f'Flash Attention: {flash_attn.__version__}')"
```

### Step 2: Download Llama 4 Maverick (30 min)

```bash
# Login to HuggingFace
huggingface-cli login

# Download model (70B requires ~140GB disk space)
huggingface-cli download meta-llama/Llama-4-Maverick-70B-Instruct \
  --local-dir ./models/llama-4-maverick-70b \
  --local-dir-use-symlinks False

# Or for RTX 4090 (quantized version)
huggingface-cli download TheBloke/Llama-4-Maverick-70B-AWQ \
  --local-dir ./models/llama-4-maverick-70b-awq
```

### Step 3: Launch vLLM Instances (10 min)

```bash
# Terminal 1: Instance 1 (GPUs 0-1)
CUDA_VISIBLE_DEVICES=0,1 vllm serve ./models/llama-4-maverick-70b \
  --host 0.0.0.0 --port 8000 \
  --tensor-parallel-size 2 \
  --dtype float16 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.95 \
  --enable-chunked-prefill \
  --enable-prefix-caching \
  --trust-remote-code

# Terminal 2: Instance 2 (GPUs 2-3)
CUDA_VISIBLE_DEVICES=2,3 vllm serve ./models/llama-4-maverick-70b \
  --host 0.0.0.0 --port 8001 \
  --tensor-parallel-size 2 \
  --dtype float16 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.95 \
  --enable-chunked-prefill \
  --enable-prefix-caching \
  --trust-remote-code

# Terminal 3: Test both instances
python - <<EOF
import requests
import time

for port in [8000, 8001]:
    start = time.time()
    response = requests.post(
        f"http://localhost:{port}/v1/chat/completions",
        json={
            "model": "meta-llama/Llama-4-Maverick-70B-Instruct",
            "messages": [{"role": "user", "content": "Say hello"}],
            "max_tokens": 10
        }
    )
    latency = (time.time() - start) * 1000
    print(f"Port {port}: {response.status_code}, {latency:.2f}ms")
    if response.status_code == 200:
        print(f"  Response: {response.json()['choices'][0]['message']['content']}")
EOF
```

**Expected Output:**
```
Port 8000: 200, 156.23ms  ← Flash Attention 2 working!
  Response: Hello! How can I help you today?
Port 8001: 200, 148.71ms
  Response: Hello! How can I assist you?
```

### Step 4: Setup PostgreSQL (20 min)

```bash
# Start PostgreSQL with Docker
cd life-navigator-agents
docker-compose up -d postgres

# Wait for PostgreSQL
sleep 10

# Apply schema
docker exec -i life-navigator-postgres psql -U lna_user -d life_navigator_agents \
  < infra/postgres/schema.sql

# Load test data
docker exec -i life-navigator-postgres psql -U lna_user -d life_navigator_agents \
  < infra/postgres/seed_test_data.sql

# Verify
docker exec -it life-navigator-postgres psql -U lna_user -d life_navigator_agents \
  -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM transactions;"
```

### Step 5: Start Message Bus (10 min)

```bash
# Start Redis and RabbitMQ
docker-compose up -d redis rabbitmq

# Verify Redis
docker exec -it life-navigator-redis redis-cli ping
# Should output: PONG

# Verify RabbitMQ
curl -u guest:guest http://localhost:15672/api/overview
# Should return JSON with RabbitMQ stats
```

### Step 6: Install Python Dependencies (15 min)

```bash
# Activate your Python environment
cd life-navigator-agents
source venv/bin/activate  # or conda activate your-env

# Install dependencies
pip install -e ".[dev]"

# Verify installation
python -c "import asyncpg, redis, aio_pika, sentence_transformers; print('✓ All imports successful')"
```

---

## 🧪 Test Your Setup (30 min)

### Quick Smoke Test

```python
# save as test_setup.py
import asyncio
import requests
from messaging.message_bus import MessageBus
from graphrag.client import GraphRAGClient
from models.vllm_client import VLLMClient

async def test_infrastructure():
    print("Testing infrastructure...")

    # Test vLLM
    print("\n1. Testing vLLM...")
    try:
        async with VLLMClient() as client:
            health = await client.health_check_all()
            print(f"   ✓ vLLM instances: {health}")

            response = await client.chat("What is 2+2?", max_tokens=10)
            print(f"   ✓ LLM response: {response[:50]}...")
    except Exception as e:
        print(f"   ✗ vLLM error: {e}")
        return False

    # Test PostgreSQL
    print("\n2. Testing PostgreSQL...")
    try:
        graphrag = GraphRAGClient()
        await graphrag.connect()

        # Query test user
        context = await graphrag.get_user_context(
            user_id="11111111-1111-1111-1111-111111111111",
            domains=["finance"]
        )
        print(f"   ✓ Retrieved {len(context['finance']['accounts'])} accounts")

        await graphrag.disconnect()
    except Exception as e:
        print(f"   ✗ PostgreSQL error: {e}")
        return False

    # Test Message Bus
    print("\n3. Testing Message Bus...")
    try:
        bus = MessageBus()
        await bus.connect()

        # Publish test message
        await bus.publish("test.topic", {"message": "Hello"})
        print(f"   ✓ Published test message")

        is_connected = await bus.is_connected()
        print(f"   ✓ Message bus connected: {is_connected}")

        await bus.disconnect()
    except Exception as e:
        print(f"   ✗ Message bus error: {e}")
        return False

    print("\n✅ All infrastructure tests passed!")
    return True

if __name__ == "__main__":
    asyncio.run(test_infrastructure())
```

Run it:
```bash
python test_setup.py
```

---

## 📊 Hardware Requirements

### Minimum (Development)
- **GPUs:** 2x NVIDIA A100 (40GB) or 4x RTX 4090 (24GB)
- **CPU:** 16 cores
- **RAM:** 64GB
- **Storage:** 200GB SSD

### Recommended (Production)
- **GPUs:** 2x NVIDIA H100 (80GB)
- **CPU:** 32 cores
- **RAM:** 128GB
- **Storage:** 500GB NVMe SSD

### Budget Alternative
- **GPUs:** 4x RTX 4090 (24GB)
- **Model:** Use AWQ 4-bit quantization
- **Tradeoff:** Slightly lower quality, 2x faster inference

---

## 🎯 Day 1 Checklist

Before ending Day 1, verify:

- [ ] vLLM instances running on ports 8000, 8001
- [ ] Flash Attention 2 confirmed (<200ms latency)
- [ ] PostgreSQL with test data loaded
- [ ] Redis and RabbitMQ running
- [ ] All Python dependencies installed
- [ ] Smoke test passed: `python test_setup.py`

**If all checked:** You're ready for Day 2! 🎉

---

## 📅 Sprint Overview

| Day | Focus | Deliverable | Time |
|-----|-------|-------------|------|
| 1 | Infrastructure | vLLM + DB + Message Bus | 4h |
| 2 | Core Code | BaseAgent + vLLM Client | 6h |
| 3 | Integration | Message Bus + GraphRAG | 6h |
| 4 | Orchestrator | L0 Agent with LLM | 6h |
| 5-6 | Domain Layer | Finance Manager + Specialists | 12h |
| 7 | Testing | Integration tests | 6h |
| 8-10 | Refinement | Performance + Edge cases | 18h |

**Total:** 58 hours over 10 days (6h/day average)

---

## 🐛 Troubleshooting

### vLLM Issues

**Problem:** "CUDA out of memory"
```bash
# Solution: Reduce memory utilization
--gpu-memory-utilization 0.85  # Try 0.85 instead of 0.95
--max-model-len 4096           # Reduce from 8192
```

**Problem:** "Flash Attention not found"
```bash
# Solution: Reinstall without build isolation
pip uninstall flash-attn
pip install flash-attn==2.5.9 --no-build-isolation
```

**Problem:** High latency (>500ms)
```bash
# Check Flash Attention is active (should see in vLLM logs):
# INFO: Using Flash Attention 2 backend

# If not, verify CUDA version:
nvcc --version  # Must be 12.1+
```

### PostgreSQL Issues

**Problem:** "Connection refused"
```bash
# Check if running
docker ps | grep postgres

# Check logs
docker logs life-navigator-postgres

# Restart
docker-compose restart postgres
```

**Problem:** RLS not working
```sql
-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename = 'financial_accounts';

-- Test RLS
SET LOCAL app.user_id = '11111111-1111-1111-1111-111111111111';
SELECT * FROM financial_accounts;  -- Should only show user's accounts
```

### Message Bus Issues

**Problem:** Redis connection timeout
```bash
# Check Redis
docker exec -it life-navigator-redis redis-cli ping

# Check connection limit
docker logs life-navigator-redis | grep -i "max"

# Increase max clients if needed
docker-compose.yml:
  redis:
    command: redis-server --maxclients 10000
```

**Problem:** RabbitMQ queue not processing
```bash
# Check RabbitMQ management UI
open http://localhost:15672
# Login: guest/guest

# Check queue depth
# Queues should be empty or processing

# Restart consumer if stuck
docker-compose restart rabbitmq
```

---

## 📞 Getting Help

1. **Check logs:**
   ```bash
   # vLLM logs
   tail -f vllm_instance_1.log

   # Docker logs
   docker-compose logs -f postgres redis rabbitmq

   # Application logs
   tail -f logs/agent.log
   ```

2. **Health checks:**
   ```bash
   # All services
   docker-compose ps

   # vLLM endpoints
   curl http://localhost:8000/health
   curl http://localhost:8001/health

   # PostgreSQL
   docker exec -it life-navigator-postgres pg_isready
   ```

3. **Performance monitoring:**
   ```bash
   # GPU utilization
   watch -n 1 nvidia-smi

   # vLLM stats
   curl http://localhost:8000/metrics
   ```

---

## 🎓 Learning Resources

- **vLLM Documentation:** https://docs.vllm.ai
- **Flash Attention Paper:** https://arxiv.org/abs/2307.08691
- **Llama 4 Model Card:** https://huggingface.co/meta-llama/Llama-4-Maverick-70B-Instruct
- **pgvector Guide:** https://github.com/pgvector/pgvector
- **RabbitMQ Tutorials:** https://www.rabbitmq.com/getstarted.html

---

## ✨ What You'll Build

By Day 14, you'll have:

```
User: "How much did I spend this month?"
  ↓
[Orchestrator] Analyzes intent with Llama 4 Maverick
  ↓ "budget_analysis" intent detected
[Finance Manager] Routes to budget specialist
  ↓
[Budget Specialist]
  - Queries PostgreSQL for transactions
  - Calculates spending by category
  - Generates recommendations
  ↓
[Result] "You spent $1,337.20 this month. Top category:
         Groceries ($450). You're saving 18% - good progress!"
```

**End-to-end latency:** <2 seconds
**LLM inference:** <200ms with Flash Attention 2
**Full observability:** Every step logged, reasoned, and auditable

---

## 🚀 Ready to Build?

1. **Today:** Complete Day 1 checklist above
2. **Tomorrow:** Start [Part 1](./AGENT_IMPLEMENTATION_SPRINT.md) Day 2
3. **Questions?** Check troubleshooting section

**Let's build the world's most powerful personal AI system! 💪**

---

**Created:** October 26, 2025
**Status:** Ready to Execute
**Estimated Completion:** November 9, 2025 (14 days)
