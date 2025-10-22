# Life Navigator Agents - Multi-Agent System

## Project Overview
Standalone hierarchical multi-agent orchestration system for intelligent task decomposition and execution.

## Current Status
✅ **Phase 1 Complete**: Foundation (3,500+ lines)
�� **Phase 2 Next**: Build specialist agents

## Architecture
```
L0: Orchestrator → Strategic planning & task decomposition
L1: Domain Managers → Finance, Career, Education, Healthcare
L2: Specialists → Budget, Investment, Job Search, etc. (TO BUILD)
L3: Tool Users → API integrations (TO BUILD)
```

## Technology Stack
- **Language**: Python 3.12 (async/await)
- **LLM**: Llama 4 Maverick + vLLM (GPU-optimized)
- **GraphRAG**: Dual-layer (Neptune + PostgreSQL RLS)
- **Messaging**: Redis Pub/Sub + RabbitMQ
- **API**: FastAPI

## Key Files (Already Built)
- `agents/core/base_agent.py` - 479 lines - Core framework
- `agents/orchestration/orchestrator.py` - 400+ lines - L0 agent
- `agents/domain/domain_managers.py` - 400+ lines - L1 managers
- `graphrag/client.py` - 500+ lines - Dual GraphRAG
- `models/vllm_client.py` - 400+ lines - vLLM integration
- `messaging/message_bus.py` - 400+ lines - Message bus

## Documentation
- `docs/IMPLEMENTATION_GUIDE.md` - Complete roadmap
- `docs/ARCHITECTURE.md` - Detailed design
- `docs/ARCHITECTURE_COMPARISON.md` - Design decisions

## Development Standards
✅ Type hints mandatory
✅ Google-style docstrings
✅ Black + Ruff formatting
✅ ≥80% test coverage
✅ Async-first patterns
✅ Conventional commits

## Phase 2 Tasks (What to Build Next)
1. **Finance Specialists** (4 agents)
   - BudgetSpecialistAgent
   - InvestmentSpecialistAgent
   - TaxSpecialistAgent
   - DebtSpecialistAgent

2. **Career Specialists** (4 agents)
   - JobSearchSpecialistAgent
   - SkillsSpecialistAgent
   - NetworkingSpecialistAgent
   - PerformanceSpecialistAgent

3. **External Integrations**
   - Plaid (banking)
   - Coinbase (crypto)
   - ADP (payroll)

## How to Help
When asked to build new agents:
1. Follow the pattern in `agents/domain/domain_managers.py`
2. Inherit from `BaseAgent` in `agents/core/base_agent.py`
3. Implement `handle_task()` and `handle_query()`
4. Use GraphRAG for context gathering
5. Create unit tests in `tests/`

## Important Notes
- This is a library/service, NOT the Life Navigator app
- Life Navigator will consume this as a microservice
- Focus on agent logic, not UI or user authentication
