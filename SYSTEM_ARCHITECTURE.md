# Life Navigator - Complete System Architecture

## ✅ What You Have Built

### 1. **Llama-4-Maverick-17B-128E-Instruct Model**
- **Size:** 749 GB (55 safetensors shards)
- **Format:** HuggingFace safetensors (native vLLM format)
- **Type:** Mixture of Experts (MoE) with 128 experts
- **Parameters:** ~375B total, ~17B active per token
- **Location:** `/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix/`
- **Status:** Downloaded and ready for vLLM deployment
- **Note:** Full precision model, no quantization needed for GCP multi-GPU setup

### 2. **Multi-Agent System (MCP Server)**
- **Location:** `services/agents/`
- **Components:**
  - MCP Server (FastAPI) - Port 8080
  - Agent Coordinator
  - GraphRAG integration
  - Memory management
  - Tool orchestration
  - Context builder

### 3. **Life Navigator API (FastAPI)**
- **Location:** `services/api/`
- **Port:** 8000
- **Features:**
  - User authentication
  - Database management (PostgreSQL)
  - Finance, Health, Career, Education endpoints
  - Agent integration
  - Document ingestion

### 4. **Next.js Frontend**
- **Location:** `apps/web/`
- **Port:** 3000/3002
- **Features:**
  - Dashboard with all modules
  - Real-time chat integration
  - Responsive design
  - Dark mode support

## Current Deployment Strategy

### Local Development (DGX-Spark)

**Challenge:** Your DGX-Spark GB10 GPU:
- CUDA capability 12.1
- 24GB VRAM
- Incompatible with old PyTorch
- Too small for 749GB Maverick model

**Solution Implemented:**
✅ **Installed vLLM 0.11.0 with PyTorch 2.8.0**
- Supports CUDA 13.0 (compatible with your GPU!)
- Use smaller model for local testing
- Same API interface as production

**Local Setup:**
```bash
# 1. Start vLLM with small model (for local testing on 24GB GPU)
VLLM_MODEL="meta-llama/Llama-3.2-3B-Instruct" ./scripts/dev/start-vllm-server.sh

# 2. Start complete system
./START_COMPLETE_SYSTEM.sh

# Note: Full 749GB Maverick model requires 3x A100 80GB (240GB total VRAM)
```

### GCP Production Deployment

**Recommended Configuration:**
- **GPUs:** 3x A100 80GB
- **Total GPU Memory:** 240 GB
- **Model:** Full Llama-4-Maverick-17B-128E-Instruct
- **Cost:** ~$12-15/hour (~$8,640-10,800/month 24/7)

**GCP Setup:**
```bash
# Use vLLM with tensor parallelism for full Maverick model
TENSOR_PARALLEL_SIZE=3 \
VLLM_MODEL="/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix" \
GPU_MEMORY_UTILIZATION=0.85 \
./scripts/dev/start-vllm-server.sh
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                         │
│                     http://localhost:3000                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Next.js       │
                    │  Frontend      │
                    │  Port: 3000    │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│  FastAPI       │  │  MCP Server    │  │  vLLM       │
│  Backend       │  │  Multi-Agent   │  │  Model      │
│  Port: 8000    │  │  Port: 8080    │  │  Port: 8090 │
└────────┬───────┘  └───────┬────────┘  └──────┬──────┘
         │                  │                   │
    ┌────▼────┐        ┌────▼────┐         ┌───▼────┐
    │ PostgreSQL│      │ Redis    │         │ Model  │
    │ Port: 5432│      │ Port: 6379│        │ Files  │
    └──────────┘        └──────────┘         └────────┘
```

## Component Details

### vLLM Server (Port 8090)
**Purpose:** Serves LLM model with high performance
**Local:** Llama-3.2-3B-Instruct (for testing)
**Production:** Llama-4-Maverick-17B-128E-Instruct

**Endpoints:**
- `/v1/chat/completions` - Chat interface (OpenAI compatible)
- `/v1/completions` - Raw completions
- `/health` - Health check
- `/v1/models` - List loaded models

### MCP Server (Port 8080)
**Purpose:** Multi-agent orchestration and tool management

**Features:**
- Agent coordination
- GraphRAG knowledge retrieval
- Memory management
- Context building
- Tool invocation

**Key Components:**
- `mcp-server/core/server.py` - FastAPI server
- `mcp-server/agents/` - Agent implementations
- `mcp-server/plugins/` - GraphRAG, memory plugins
- `mcp-server/tools/` - Available tools

### FastAPI Backend (Port 8000)
**Purpose:** Main application API

**Modules:**
- `/api/v1/auth` - Authentication
- `/api/v1/users` - User management
- `/api/v1/finance` - Financial data
- `/api/v1/health` - Health records
- `/api/v1/career` - Career management
- `/api/v1/education` - Education tracking
- `/api/v1/agents` - Agent interactions

### Next.js Frontend (Port 3000)
**Purpose:** User interface

**Pages:**
- `/dashboard` - Main dashboard
- `/dashboard/finance` - Financial planning
- `/dashboard/healthcare` - Health tracking
- `/dashboard/career` - Career management
- `/dashboard/education` - Learning goals

## Quick Start Commands

### Complete System (One Command)
```bash
./START_COMPLETE_SYSTEM.sh
```

### Individual Components
```bash
# 1. vLLM (choose model based on environment)
## Local testing
VLLM_MODEL="meta-llama/Llama-3.2-3B-Instruct" ./scripts/dev/start-vllm-server.sh

## GCP production
TENSOR_PARALLEL_SIZE=3 \
VLLM_MODEL="/path/to/maverick" \
./scripts/dev/start-vllm-server.sh

# 2. MCP Server
cd services/agents
./start_mcp_server.sh

# 3. FastAPI Backend
cd services/api
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. Next.js Frontend
cd apps/web
npm run dev
```

## Environment Variables

### vLLM Configuration
```bash
VLLM_MODEL="meta-llama/Llama-3.2-3B-Instruct"  # Model to load
VLLM_PORT=8090                                  # Server port
GPU_MEMORY_UTILIZATION=0.90                     # GPU memory usage
TENSOR_PARALLEL_SIZE=1                          # Number of GPUs
MAX_MODEL_LEN=4096                              # Context window
```

### MCP Server Configuration
```bash
MAVERICK_URL="http://localhost:8090"  # vLLM endpoint
MCP_PORT=8080                         # Server port
MCP_HOST="0.0.0.0"                    # Bind address
```

### API Backend Configuration
```bash
DATABASE_URL="postgresql://..."      # PostgreSQL connection
REDIS_URL="redis://localhost:6379"   # Redis connection
MAVERICK_URL="http://localhost:8090" # vLLM endpoint
```

## Deployment Workflow

### Development (Local)
1. Use smaller model with vLLM
2. Test all features locally
3. Develop and debug
4. Cost: Free (local GPU)

### Production (GCP)
1. Deploy vLLM with full Maverick model on 3x A100
2. Deploy MCP Server and API
3. Deploy Frontend to Vercel/Netlify
4. Cost: ~$8,640-10,800/month

## Next Steps

1. ✅ Healthcare pages fixed
2. ✅ vLLM installed and configured
3. ✅ Maverick client updated
4. ⏳ Start local testing with small model
5. ⏳ Deploy to GCP for production

## Documentation

- **vLLM Setup:** `VLLM_PRODUCTION_SETUP.md`
- **Quick Start:** `QUICK_VLLM_START.md`
- **Maverick Details:** `services/agents/MAVERICK_README.md`
- **GCP Deployment:** `services/agents/LLAMA4_MAVERICK_DEPLOYMENT_GUIDE.md`
