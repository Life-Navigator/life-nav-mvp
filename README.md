# 🧠 Life Navigator Agents

Hierarchical multi-agent system with dual GraphRAG and GPU-accelerated AI agents.

## Hardware Requirements

### Standard Setup
- Python 3.12+
- 8GB RAM minimum
- PostgreSQL, Redis, RabbitMQ

### GPU Setup (DGX-Spark)
- NVIDIA GB10 GPU (24GB VRAM)
- CUDA 13.0
- Driver Version 580.95.05
- Ubuntu 24.04.3 LTS

## Quick Start

### Standard Setup (No GPU)
```bash
# Install
python3.12 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# Run
python main.py
```

### GPU Setup (DGX-Spark)
```bash
# Automated setup with GPU support
chmod +x setup_dgx_spark.sh
./setup_dgx_spark.sh

# Verify GPU installation
python3.12 verify_gpu_setup.py

# Run
python main.py
```

The GPU setup script will:
- Install PyTorch 2.9.0 with CUDA 13.0 support
- Install HuggingFace Transformers, PEFT, BitsAndBytes
- Configure GPU acceleration for all AI agents
- Run verification tests

## Running the UI

```bash
# Activate environment
source venv/bin/activate

# Start Streamlit UI
streamlit run ui/chat_app.py
```

Or use the provided scripts:
```bash
# Linux/Mac
./ui/run_chat.sh

# Windows
ui\run_chat.bat
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Implementation Guide](docs/IMPLEMENTATION_GUIDE.md)
- [GPU Setup Guide](docs/GPU_SETUP.md) - DGX-Spark configuration

## Project Structure

```
life-navigator-agents/
├── agents/              # Agent implementations
│   ├── core/           # Core agent functionality
│   ├── specialists/    # Domain-specific agents
│   └── coordinator/    # Agent coordination
├── graphrag/           # Dual GraphRAG system
├── models/             # LLM models and configs
├── messaging/          # Message bus (RabbitMQ)
├── utils/              # Utilities and config
├── api/                # REST API endpoints
├── ui/                 # Streamlit chat interface
├── tests/              # Test suite
└── docs/               # Documentation
```

## Key Features

- **Hierarchical Agent System**: Coordinator, specialists, and executor agents
- **Dual GraphRAG**: Personal + World knowledge graphs
- **GPU Acceleration**: Optimized for NVIDIA GB10
- **Memory-Efficient**: 8-bit quantization with BitsAndBytes
- **LoRA Fine-Tuning**: Parameter-efficient model adaptation
- **Real-time Chat UI**: Streamlit-based interface
- **Audit Trail**: Compliance-ready logging

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev,ui]"

# Run tests
pytest

# Format code
black .
ruff check .

# Type checking
mypy .
```
