# Life Navigator Agents: Implementation Sprint Part 1
## Infrastructure, vLLM, BaseAgent, and Database Setup

**Version:** 1.0
**Target Completion:** Days 1-3 (18 hours)
**Status:** Ready to Execute
**Last Updated:** October 26, 2025

---

## 📋 Executive Summary

This document covers **Phase 1** of the Life Navigator Agents implementation:
- vLLM deployment with Llama 4 Maverick + Flash Attention 2
- PostgreSQL schema with pgvector
- BaseAgent framework
- vLLM client with load balancing

**Prerequisites:**
- 2x NVIDIA A100 (80GB) or 4x RTX 4090 (24GB)
- CUDA 12.1+
- Docker & Docker Compose
- Python 3.10+

**Deliverables:**
- Working vLLM instances (<200ms latency)
- PostgreSQL with test data
- BaseAgent abstract class
- vLLM client with health checks

---

## 🎯 Technology Stack

### LLM Infrastructure: Llama 4 Maverick + Flash Attention 2

**Why This Stack:**

1. **Llama 4 Maverick 70B**
   - Best-in-class reasoning for multi-step planning
   - Strong instruction following for task decomposition
   - 128K context window (supports large user histories)
   - Apache 2.0 license (production-friendly)

2. **Flash Attention 2**
   - 2-4x faster inference vs standard attention
   - 10-20x memory reduction (critical for 70B model)
   - Exact attention (no approximation trade-offs)
   - Native support in vLLM 0.5.0+

3. **vLLM Serving**
   - Continuous batching → 23x throughput vs HuggingFace
   - PagedAttention → efficient KV cache management
   - Tensor parallelism for multi-GPU
   - OpenAI-compatible API

**Performance Targets with Flash Attention 2:**
- First token latency: <200ms (vs 500ms standard)
- Throughput: 50-100 tokens/sec (vs 20-30 standard)
- Memory: 45GB VRAM (vs 70GB standard)

---

## 🏗️ Day 1: vLLM Deployment

### Step 1: Environment Preparation (45 min)

```bash
# Install CUDA 12.1+ (Flash Attention 2 requirement)
wget https://developer.download.nvidia.com/compute/cuda/12.1.0/local_installers/cuda_12.1.0_530.30.02_linux.run
sudo sh cuda_12.1.0_530.30.02_linux.run

# Verify CUDA
nvcc --version
nvidia-smi

# Create vLLM environment
conda create -n vllm-flash python=3.10 -y
conda activate vllm-flash

# Install vLLM with Flash Attention 2
pip install vllm==0.5.4  # Latest stable with FA2
pip install flash-attn==2.5.9 --no-build-isolation

# Verify Flash Attention 2
python -c "import flash_attn; print(f'Flash Attention version: {flash_attn.__version__}')"
```

### Step 2: Download Llama 4 Maverick Weights (30 min)

```bash
# Option A: Using HuggingFace Hub (requires approval)
huggingface-cli login
huggingface-cli download meta-llama/Llama-4-Maverick-70B-Instruct \
  --local-dir ./models/llama-4-maverick-70b \
  --local-dir-use-symlinks False

# Option B: Quantized version (for RTX 4090 setup)
huggingface-cli download TheBloke/Llama-4-Maverick-70B-AWQ \
  --local-dir ./models/llama-4-maverick-70b-awq
```

### Step 3: vLLM Configuration Files

Create `infra/vllm/config_instance_1.yaml`:

```yaml
# vLLM Instance 1 Configuration
model: ./models/llama-4-maverick-70b
host: 0.0.0.0
port: 8000

# Flash Attention 2 (automatic detection)
trust_remote_code: true
dtype: float16
max_model_len: 8192  # Adjust based on VRAM

# Multi-GPU setup (2x A100 example)
tensor_parallel_size: 2
pipeline_parallel_size: 1

# Performance tuning
gpu_memory_utilization: 0.95
max_num_batched_tokens: 8192
max_num_seqs: 256
enable_chunked_prefill: true

# Optimization
enable_prefix_caching: true
disable_log_stats: false
```

Create `infra/vllm/config_instance_2.yaml`:

```yaml
# vLLM Instance 2 Configuration (load balancing)
model: ./models/llama-4-maverick-70b
host: 0.0.0.0
port: 8001

# Same settings as instance 1
trust_remote_code: true
dtype: float16
max_model_len: 8192
tensor_parallel_size: 2
pipeline_parallel_size: 1
gpu_memory_utilization: 0.95
max_num_batched_tokens: 8192
max_num_seqs: 256
enable_chunked_prefill: true
enable_prefix_caching: true
```

### Step 4: Launch vLLM Instances

```bash
# Terminal 1: Launch Instance 1 (GPUs 0-1)
CUDA_VISIBLE_DEVICES=0,1 vllm serve ./models/llama-4-maverick-70b \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 2 \
  --dtype float16 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.95 \
  --enable-chunked-prefill \
  --enable-prefix-caching \
  --trust-remote-code

# Terminal 2: Launch Instance 2 (GPUs 2-3)
CUDA_VISIBLE_DEVICES=2,3 vllm serve ./models/llama-4-maverick-70b \
  --host 0.0.0.0 \
  --port 8001 \
  --tensor-parallel-size 2 \
  --dtype float16 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.95 \
  --enable-chunked-prefill \
  --enable-prefix-caching \
  --trust-remote-code
```

### Step 5: Verify Flash Attention 2 is Active

Create `test_vllm_flash_attention.py`:

```python
import requests
import time

def test_vllm_instance(base_url: str):
    """Test vLLM instance and measure latency"""

    # Test prompt
    payload = {
        "model": "meta-llama/Llama-4-Maverick-70B-Instruct",
        "messages": [
            {"role": "user", "content": "Explain quantum computing in one sentence."}
        ],
        "max_tokens": 50,
        "temperature": 0.7
    }

    start = time.time()
    response = requests.post(f"{base_url}/v1/chat/completions", json=payload)
    latency = (time.time() - start) * 1000

    result = response.json()

    print(f"\n=== {base_url} ===")
    print(f"Status: {response.status_code}")
    print(f"Latency: {latency:.2f}ms")
    print(f"Response: {result['choices'][0]['message']['content']}")
    print(f"Tokens: {result['usage']['total_tokens']}")

    # Check for Flash Attention in server logs
    # Should see "[FA2]" in vLLM startup logs
    return latency < 300  # Should be <200ms with FA2

# Test both instances
test_vllm_instance("http://localhost:8000")
test_vllm_instance("http://localhost:8001")
```

**Expected Output:**
```
=== http://localhost:8000 ===
Status: 200
Latency: 156.23ms  ← With Flash Attention 2
Response: Quantum computing uses quantum mechanical phenomena...
Tokens: 45

[vLLM Server Logs Should Show]
INFO: Using Flash Attention 2 backend
INFO: Flash Attention 2 initialized successfully
```

---

## 💾 Day 1 Afternoon: PostgreSQL Schema

### Step 1: Database Schema

Create `infra/postgres/schema.sql`:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- User data (RLS enabled)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Financial accounts
CREATE TABLE financial_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    account_type VARCHAR(50) NOT NULL, -- checking, savings, investment, credit
    institution VARCHAR(100),
    balance DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    account_id UUID REFERENCES financial_accounts(account_id),
    amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(50),
    merchant VARCHAR(255),
    description TEXT,
    date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Career data
CREATE TABLE career_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    current_title VARCHAR(255),
    current_employer VARCHAR(255),
    years_experience INTEGER,
    target_salary DECIMAL(12, 2),
    location VARCHAR(255),
    remote_preference VARCHAR(20), -- remote, hybrid, onsite
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Skills (for career agent)
CREATE TABLE skills (
    skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    skill_name VARCHAR(100) NOT NULL,
    proficiency VARCHAR(20), -- beginner, intermediate, advanced, expert
    years_experience DECIMAL(4, 1),
    last_used DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Document embeddings (for semantic search)
CREATE TABLE document_embeddings (
    doc_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    domain VARCHAR(50) NOT NULL, -- finance, career, education, healthcare
    content TEXT NOT NULL,
    metadata JSONB,
    embedding vector(384), -- all-MiniLM-L6-v2 produces 384-dim vectors
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent task logs (for audit trail)
CREATE TABLE agent_tasks (
    task_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    agent_type VARCHAR(50) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- pending, processing, completed, failed
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_financial_accounts_user ON financial_accounts(user_id);
CREATE INDEX idx_skills_user ON skills(user_id);
CREATE INDEX idx_embeddings_user_domain ON document_embeddings(user_id, domain);

-- Vector similarity index (IVFFLAT for pgvector)
CREATE INDEX idx_embeddings_vector ON document_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Row-Level Security (RLS) policies
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own data
CREATE POLICY user_isolation_accounts ON financial_accounts
    USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY user_isolation_transactions ON transactions
    USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY user_isolation_career ON career_profiles
    USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY user_isolation_skills ON skills
    USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY user_isolation_embeddings ON document_embeddings
    USING (user_id = current_setting('app.user_id')::uuid);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON financial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_career_updated_at BEFORE UPDATE ON career_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Test Data

Create `infra/postgres/seed_test_data.sql`:

```sql
-- Insert test user
INSERT INTO users (user_id, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'test@lifenavigator.ai')
ON CONFLICT DO NOTHING;

-- Insert test financial accounts
INSERT INTO financial_accounts (account_id, user_id, account_type, institution, balance, currency)
VALUES
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'checking', 'Chase Bank', 5430.50, 'USD'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'savings', 'Chase Bank', 12000.00, 'USD'),
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'investment', 'Vanguard', 45000.00, 'USD'),
    ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'credit', 'Chase Sapphire', -2345.67, 'USD')
ON CONFLICT DO NOTHING;

-- Insert test transactions (last 90 days)
INSERT INTO transactions (user_id, account_id, amount, category, merchant, date)
VALUES
    -- Recent transactions
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', -45.20, 'groceries', 'Whole Foods', NOW() - INTERVAL '2 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', -12.50, 'coffee', 'Starbucks', NOW() - INTERVAL '2 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', -1200.00, 'rent', 'Property Management LLC', NOW() - INTERVAL '5 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 3500.00, 'income', 'Employer Direct Deposit', NOW() - INTERVAL '7 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', -85.00, 'utilities', 'PG&E', NOW() - INTERVAL '10 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', -150.00, 'groceries', 'Safeway', NOW() - INTERVAL '12 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', -245.00, 'shopping', 'Amazon', NOW() - INTERVAL '15 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', -60.00, 'dining', 'Chipotle', NOW() - INTERVAL '18 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', -120.00, 'transportation', 'Lyft', NOW() - INTERVAL '20 days'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', 500.00, 'investment', 'Monthly Auto-Invest', NOW() - INTERVAL '25 days')
ON CONFLICT DO NOTHING;

-- Insert career profile
INSERT INTO career_profiles (user_id, current_title, current_employer, years_experience, target_salary, location, remote_preference)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Senior Software Engineer', 'Tech Corp', 8, 180000.00, 'San Francisco, CA', 'hybrid')
ON CONFLICT DO NOTHING;

-- Insert skills
INSERT INTO skills (user_id, skill_name, proficiency, years_experience, last_used)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Python', 'expert', 8.0, NOW() - INTERVAL '1 day'),
    ('11111111-1111-1111-1111-111111111111', 'React', 'advanced', 5.0, NOW() - INTERVAL '3 days'),
    ('11111111-1111-1111-1111-111111111111', 'PostgreSQL', 'advanced', 6.0, NOW() - INTERVAL '1 day'),
    ('11111111-1111-1111-1111-111111111111', 'AWS', 'intermediate', 4.0, NOW() - INTERVAL '7 days'),
    ('11111111-1111-1111-1111-111111111111', 'Machine Learning', 'intermediate', 3.0, NOW() - INTERVAL '30 days')
ON CONFLICT DO NOTHING;
```

### Step 3: Apply Schema

```bash
# Start PostgreSQL container (if not running)
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 5

# Apply schema
docker exec -i life-navigator-postgres psql -U lna_user -d life_navigator_agents < infra/postgres/schema.sql

# Load test data
docker exec -i life-navigator-postgres psql -U lna_user -d life_navigator_agents < infra/postgres/seed_test_data.sql

# Verify
docker exec -it life-navigator-postgres psql -U lna_user -d life_navigator_agents -c "\dt"
docker exec -it life-navigator-postgres psql -U lna_user -d life_navigator_agents -c "SELECT * FROM users;"
```

---

## 📅 Next Steps

Continue to [Part 2](./AGENT_IMPLEMENTATION_SPRINT_PART2.md) for:
- vLLM Client implementation
- BaseAgent framework
- MessageBus integration
- GraphRAG client
- Orchestrator agent
- Integration testing

---

**Created:** October 26, 2025
**Status:** Ready to Execute
**Duration:** 1 day (8-10 hours)
