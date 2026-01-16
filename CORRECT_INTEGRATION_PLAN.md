# 🔌 CORRECT MULTI-AGENT INTEGRATION PLAN

**Date**: January 12, 2026
**Status**: READY TO IMPLEMENT
**Timeline**: 3-5 days

---

## 🎯 CORRECT ARCHITECTURE UNDERSTANDING

```
┌─────────────────────────────────────────────────────────────────┐
│  life-navigator-monorepo (Frontend + Gateway)                   │
│                                                                   │
│  ├── apps/web (Next.js)              ← USER INTERFACE           │
│  ├── apps/mobile (React Native)      ← MOBILE APP               │
│  ├──backend (FastAPI)                ← API GATEWAY              │
│  │   └── LNCoreClient                ← CLIENT TO ln-core        │
│  ├── services/api                    ← Vertex AI integration    │
│  └── services/agents                 ← Vertex AI clients        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/gRPC
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ln-core (Multi-Agent Backend)                                  │
│                                                                   │
│  ├── services/agents/                 ← L0/L1/L2 AGENTS         │
│  │   ├── orchestration/               ← L0 Master Orchestrator  │
│  │   ├── domain/                      ← L1 Domain Managers      │
│  │   └── specialists/                 ← L2 Specialists          │
│  ├── services/graphrag-rs/            ← Rust GraphRAG (100x⚡)  │
│  ├── services/api/                    ← Agent API endpoints     │
│  ├── ln_core/graph/                   ← GraphRAG orchestration  │
│  └── ln_core/clients/                 ← Neo4j, Qdrant clients   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 KEY REALIZATION

### What Already Exists ✅
1. **LNCoreClient** in monorepo (`backend/app/clients/ln_core_client.py`)
   - Service-to-service auth with Google Cloud ID tokens
   - Methods: `chat()`, `execute_task()`, `list_agents()`, `get_conversations()`

2. **ln-core Multi-Agent System** (separate repo)
   - L0 Orchestrator, L1 Domain Managers, L2 Specialists
   - GraphRAG integration with Neo4j
   - Complete agent infrastructure

3. **Frontend UI** in monorepo (90%+ complete)
   - Onboarding, Goals, Benefits, Risk, Chat, Scenario Lab

### What's Missing ❌
1. **ln-core API endpoints** are not fully implemented yet
2. **Frontend → Backend → ln-core** integration is incomplete
3. **Vertex AI integration in ln-core** (currently uses Llama 4)
4. **Feature-specific agent endpoints** (onboarding, goals, benefits, etc.)

---

## 📋 REVISED INTEGRATION STRATEGY

### Phase 1: Connect Frontend to ln-core (Via Backend Gateway)
**Goal**: Wire up existing UI components to ln-core agents through LNCoreClient

### Phase 2: Implement ln-core Agent API Endpoints
**Goal**: Create the API layer in ln-core that LNCoreClient calls

### Phase 3: Integrate Vertex AI into ln-core
**Goal**: Replace/augment Llama 4 Maverick with Vertex AI Gemini

---

## 🚀 PHASE 1: FRONTEND → BACKEND → LN-CORE CONNECTION

### 1.1 Onboarding Integration

#### A. Update Backend Chat Endpoint to Use LNCoreClient

**File**: `/backend/app/api/v1/endpoints/chat.py` (Lines 50+)

**Current State**: Uses placeholder logic
**Target**: Call ln-core orchestrator

```python
from app.clients.ln_core_client import get_ln_core_client

@router.post("/", response_model=ChatResponse)
async def send_message(request: ChatRequest, user_id: str = Depends(get_current_user_id)):
    """Send message to AI system - routes to ln-core multi-agent orchestrator."""

    ln_core = get_ln_core_client()

    try:
        # Route to ln-core orchestrator
        result = await ln_core.chat(
            agent_id="orchestrator",  # L0 Orchestrator
            message=request.message,
            user_id=user_id,
            conversation_id=request.conversation_id,
            system_prompt_override=request.system_prompt_override,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        return ChatResponse(
            conversation_id=result["conversation_id"],
            message_id=result.get("message_id", str(uuid4())),
            agent_id=result.get("agent_id", "orchestrator"),
            message=result["message"],
            tokens_used=result.get("tokens_used"),
            model_name=result.get("model_name"),
            confidence_score=result.get("confidence"),
            reasoning_steps=result.get("reasoning_chain", []),
            sources=result.get("sources", []),
            disclaimers=result.get("disclaimers", []),
        )

    except Exception as e:
        logger.error(f"ln-core chat error: {e}")
        raise HTTPException(status_code=500, detail="AI service unavailable")
```

#### B. Create Onboarding-Specific Backend Endpoints

**File**: `/backend/app/api/v1/endpoints/onboarding.py` (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.clients.ln_core_client import get_ln_core_client
from app.api.deps import get_current_user_id

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

class OnboardingAnalysisRequest(BaseModel):
    domain: str  # education, career, financial, health
    goals: dict
    user_context: dict

class OnboardingAnalysisResponse(BaseModel):
    analysis: str
    recommendations: list[str]
    confidence: float
    next_steps: list[str]

@router.post("/analyze", response_model=OnboardingAnalysisResponse)
async def analyze_onboarding_input(
    request: OnboardingAnalysisRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Analyze user input during onboarding (education, career, financial, health).
    Routes to appropriate domain specialist in ln-core.
    """
    ln_core = get_ln_core_client()

    # Construct analysis prompt
    prompt = f"""
    Analyze the following {request.domain} goals from onboarding:
    Goals: {request.goals}
    User Context: {request.user_context}

    Provide:
    1. Feasibility analysis
    2. Timeline estimation
    3. Required resources
    4. Specific recommendations
    5. Potential challenges
    """

    try:
        result = await ln_core.execute_task(
            agent_id=f"{request.domain}_manager",  # e.g., "education_manager"
            task_type="onboarding_analysis",
            input_text=prompt,
            user_id=user_id,
            context={
                "domain": request.domain,
                "goals": request.goals,
                "user_context": request.user_context
            }
        )

        return OnboardingAnalysisResponse(
            analysis=result["output"],
            recommendations=result.get("recommendations", []),
            confidence=result.get("confidence", 0.85),
            next_steps=result.get("next_steps", [])
        )

    except Exception as e:
        logger.error(f"Onboarding analysis error: {e}")
        raise HTTPException(status_code=500, detail="Analysis failed")

@router.post("/complete", response_model=dict)
async def complete_onboarding(
    profile: dict,
    user_id: str = Depends(get_current_user_id)
):
    """
    Complete onboarding - generates personalized roadmap using L0 Orchestrator.
    """
    ln_core = get_ln_core_client()

    prompt = f"""
    User completed onboarding with profile: {profile}

    Generate a personalized 90-day roadmap with:
    1. Immediate actions (Week 1)
    2. Foundation building (Weeks 2-4)
    3. Growth phase (Weeks 5-8)
    4. Optimization (Weeks 9-12)
    """

    try:
        result = await ln_core.execute_task(
            agent_id="orchestrator",
            task_type="roadmap_generation",
            input_text=prompt,
            user_id=user_id,
            context={"profile": profile}
        )

        return {
            "roadmap": result["output"],
            "confidence": result.get("confidence", 0.85),
            "success": True
        }

    except Exception as e:
        logger.error(f"Roadmap generation error: {e}")
        raise HTTPException(status_code=500, detail="Roadmap generation failed")
```

#### C. Update Frontend Onboarding to Call Backend

**File**: `/apps/web/src/app/onboarding/questionnaire/page.tsx` (Lines 150+)

```typescript
// After each questionnaire step
const handleEducationSubmit = async (data: any) => {
  setIsAnalyzing(true);

  try {
    const response = await fetch('/api/backend/onboarding/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'education',
        goals: data,
        user_context: {
          userId,
          previousAnswers: formData
        }
      })
    });

    const analysis = await response.json();

    // Show AI feedback to user
    setAgentFeedback({
      analysis: analysis.analysis,
      recommendations: analysis.recommendations,
      confidence: analysis.confidence
    });

    // Store and proceed
    setFormData({...formData, education: data, educationAnalysis: analysis});
    setCurrentStep(STEPS.CAREER);

  } catch (error) {
    console.error('Analysis failed:', error);
    // Continue without AI feedback
    setCurrentStep(STEPS.CAREER);
  } finally {
    setIsAnalyzing(false);
  }
};

// On completion
const handleComplete = async () => {
  try {
    const response = await fetch('/api/backend/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: formData })
    });

    const { roadmap } = await response.json();

    // Show roadmap to user
    setPersonalizedRoadmap(roadmap);

    // Mark setup as complete
    await fetch('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ setupCompleted: true })
    });

    router.push('/dashboard');

  } catch (error) {
    console.error('Completion failed:', error);
  }
};
```

### 1.2 Goals Integration

**File**: `/backend/app/api/v1/endpoints/goals.py` (NEW)

```python
@router.post("/analyze", response_model=GoalAnalysisResponse)
async def analyze_goal(
    goal_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Analyze goal feasibility using ln-core goals manager agent."""

    # Fetch goal from database
    goal = await db.goals.get(goal_id)
    user_context = await db.users.get_context(user_id)

    ln_core = get_ln_core_client()

    prompt = f"""
    Analyze this goal:
    Title: {goal.title}
    Category: {goal.category}
    Target Date: {goal.targetDate}
    Target Amount: {goal.targetAmount}

    User Context:
    Income: {user_context.income}
    Savings: {user_context.savings}
    Existing Goals: {len(user_context.goals)}

    Provide:
    1. Feasibility score (0-100)
    2. Required monthly contribution
    3. Risk factors
    4. Milestone recommendations
    5. Alternative approaches if not feasible
    """

    try:
        result = await ln_core.execute_task(
            agent_id="goals_manager",
            task_type="goal_feasibility_analysis",
            input_text=prompt,
            user_id=user_id,
            context={"goal": goal.dict(), "user": user_context.dict()}
        )

        return GoalAnalysisResponse(
            feasibility_score=result.get("feasibility_score", 75),
            monthly_contribution=result.get("monthly_contribution"),
            risk_factors=result.get("risks", []),
            milestones=result.get("milestones", []),
            recommendations=result.get("recommendations", []),
            confidence=result.get("confidence", 0.80)
        )

    except Exception as e:
        logger.error(f"Goal analysis error: {e}")
        raise HTTPException(status_code=500, detail="Analysis failed")

@router.post("/conflicts", response_model=ConflictAnalysisResponse)
async def detect_goal_conflicts(
    user_id: str = Depends(get_current_user_id)
):
    """Detect conflicting goals using ln-core goals manager."""

    user_goals = await db.goals.list_by_user(user_id)

    ln_core = get_ln_core_client()

    prompt = f"""
    Analyze these goals for conflicts:
    {[g.dict() for g in user_goals]}

    Identify:
    1. Resource competition (same funds needed)
    2. Timeline conflicts (overlapping critical periods)
    3. Priority conflicts (misaligned importance)
    4. Constraint violations (exceeds capacity)

    For each conflict, provide resolution strategies.
    """

    result = await ln_core.execute_task(
        agent_id="goals_manager",
        task_type="conflict_detection",
        input_text=prompt,
        user_id=user_id
    )

    return ConflictAnalysisResponse(
        conflicts=result.get("conflicts", []),
        resolutions=result.get("resolutions", []),
        optimized_priority=result.get("optimized_priority", [])
    )
```

### 1.3 Benefits Integration

**File**: `/backend/app/api/v1/endpoints/benefits.py` (NEW)

```python
@router.post("/optimize", response_model=BenefitOptimizationResponse)
async def optimize_benefits(
    user_id: str = Depends(get_current_user_id)
):
    """Optimize benefit selections using ln-core benefits optimizer agent."""

    benefit_selections = await db.benefits.get_rankings(user_id)
    goals = await db.goals.list_by_user(user_id)
    employer_benefits = await db.employer_benefits.get(user_id)

    ln_core = get_ln_core_client()

    # Benefit-Goal Alignment Analysis
    alignment_prompt = f"""
    Benefit selections: {benefit_selections}
    User goals: {[g.dict() for g in goals]}

    Analyze alignment and suggest improvements:
    1. Misaligned benefits (not supporting stated goals)
    2. Missing benefits that would help goals
    3. Over-prioritized benefits
    4. Synergies between benefits and goals
    """

    alignment_result = await ln_core.execute_task(
        agent_id="benefits_optimizer",
        task_type="benefit_goal_alignment",
        input_text=alignment_prompt,
        user_id=user_id
    )

    # Employer Benefits Optimization
    if employer_benefits:
        employer_prompt = f"""
        Employer benefits: {employer_benefits.dict()}

        Identify top 5 optimization opportunities:
        1. 401k match maximization
        2. HSA contributions
        3. ESPP participation
        4. Mega backdoor Roth
        5. FSA optimization

        For each, provide:
        - Action required
        - Annual savings potential
        - Implementation steps
        """

        employer_result = await ln_core.execute_task(
            agent_id="benefits_optimizer",
            task_type="employer_benefits_optimization",
            input_text=employer_prompt,
            user_id=user_id
        )
    else:
        employer_result = None

    return BenefitOptimizationResponse(
        alignment_analysis=alignment_result["output"],
        misalignments=alignment_result.get("misalignments", []),
        recommendations=alignment_result.get("recommendations", []),
        employer_opportunities=employer_result.get("opportunities", []) if employer_result else [],
        total_potential_savings=employer_result.get("total_savings", 0) if employer_result else 0
    )
```

### 1.4 Scenario Lab Integration

**File**: `/backend/app/api/v1/endpoints/scenario_lab.py` (NEW)

```python
@router.post("/scenarios/{version_id}/analyze", response_model=ScenarioAnalysisResponse)
async def analyze_scenario(
    version_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Analyze scenario simulation results using ln-core scenario analyzer."""

    version = await db.scenario_versions.get(version_id)

    ln_core = get_ln_core_client()

    prompt = f"""
    Scenario Analysis:
    Title: {version.scenario.title}
    Goals: {version.goals}
    Success Probability: {version.results.final_success_probability}
    Status: {version.results.status}
    Top Drivers: {version.results.top_drivers}
    Top Risks: {version.results.top_risks}

    Generate an executive summary covering:
    1. Overall assessment
    2. Key findings
    3. Critical risks to address
    4. Recommended actions (prioritized)
    """

    result = await ln_core.execute_task(
        agent_id="scenario_analyzer",
        task_type="scenario_interpretation",
        input_text=prompt,
        user_id=user_id,
        context={"scenario": version.dict()}
    )

    return ScenarioAnalysisResponse(
        executive_summary=result["output"],
        key_findings=result.get("key_findings", []),
        critical_risks=result.get("risks", []),
        recommended_actions=result.get("actions", []),
        confidence=result.get("confidence", 0.85)
    )

@router.post("/scenarios/{version_id}/plan", response_model=ActionPlanResponse)
async def generate_action_plan(
    version_id: str,
    timeframe: str,
    user_id: str = Depends(get_current_user_id)
):
    """Generate phased action plan using ln-core scenario analyzer."""

    version = await db.scenario_versions.get(version_id)

    ln_core = get_ln_core_client()

    prompt = f"""
    Generate a {timeframe} phased action plan for:
    {version.dict()}

    Phases:
    1. Immediate (1-2 weeks): Critical actions
    2. Foundation (1-2 months): Setup tasks
    3. Execution (3-6 months): Main work
    4. Optimization (6-12 months): Refinements

    For each phase:
    - Key tasks (3-5 per phase)
    - Timeline
    - Success criteria
    - Dependencies
    """

    result = await ln_core.execute_task(
        agent_id="scenario_analyzer",
        task_type="action_plan_generation",
        input_text=prompt,
        user_id=user_id,
        context={"scenario": version.dict(), "timeframe": timeframe}
    )

    return ActionPlanResponse(
        phases=result.get("phases", []),
        timeline=result.get("timeline"),
        success_criteria=result.get("success_criteria", []),
        confidence=result.get("confidence", 0.80)
    )
```

---

## 🔧 PHASE 2: IMPLEMENT LN-CORE AGENT API ENDPOINTS

**Location**: `/home/riffe007/Documents/projects/ln-core/services/api/`

These endpoints need to be implemented in ln-core to handle requests from LNCoreClient.

### 2.1 Agent Chat Endpoint

**File**: `ln-core/services/api/routes/agents.py`

```python
from fastapi import APIRouter, Header
from ln_core.agents.orchestrator import Orchestrator, OrchestratorRequest

router = APIRouter(prefix="/api/v1/agents")

@router.post("/{agent_id}/chat")
async def agent_chat(
    agent_id: str,
    request: ChatRequest,
    x_user_id: str = Header(...)
):
    """
    Chat with an agent (orchestrator, domain manager, or specialist).
    """
    # Initialize orchestrator
    orchestrator = Orchestrator(config=OrchestratorConfig())

    # Create orchestrator request
    orc_request = OrchestratorRequest(
        user_id=x_user_id,
        query=request.message,
        domain=request.context.get("domain") if request.context else None,
        priority="normal",
        require_citations=True
    )

    # Process with orchestrator
    response = await orchestrator.process(orc_request)

    return {
        "conversation_id": request.conversation_id or str(uuid4()),
        "message_id": str(uuid4()),
        "agent_id": agent_id,
        "message": response.response,
        "tokens_used": response.latency_ms // 10,  # Estimate
        "model_name": response.model_used,
        "confidence": response.confidence,
        "reasoning_chain": response.reasoning_chain,
        "sources": response.sources,
        "disclaimers": response.disclaimers
    }
```

### 2.2 Task Execution Endpoint

**File**: `ln-core/services/api/routes/agents.py`

```python
@router.post("/{agent_id}/tasks")
async def execute_task(
    agent_id: str,
    request: TaskRequest,
    x_user_id: str = Header(...)
):
    """
    Execute a task with a specific agent.
    Supports: onboarding_analysis, goal_feasibility_analysis, conflict_detection, etc.
    """
    orchestrator = Orchestrator(config=OrchestratorConfig())

    # Route task to appropriate specialist based on agent_id and task_type
    if agent_id == "goals_manager":
        specialist = await get_goals_manager()
        result = await specialist.execute_task(
            task_type=request.task_type,
            input_text=request.input_text,
            context=request.context
        )
    elif agent_id == "benefits_optimizer":
        specialist = await get_benefits_optimizer()
        result = await specialist.execute_task(
            task_type=request.task_type,
            input_text=request.input_text,
            context=request.context
        )
    # ... other agents

    return {
        "task_id": str(uuid4()),
        "status": "completed",
        "output": result.output,
        "confidence": result.confidence,
        "recommendations": result.recommendations,
        "next_steps": result.next_steps
    }
```

### 2.3 List Agents Endpoint

```python
@router.get("/")
async def list_agents(x_user_id: str = Header(...)):
    """List available agents."""
    return [
        {"id": "orchestrator", "name": "Master Orchestrator", "level": "L0"},
        {"id": "goals_manager", "name": "Goals Manager", "level": "L1"},
        {"id": "benefits_optimizer", "name": "Benefits Optimizer", "level": "L1"},
        {"id": "scenario_analyzer", "name": "Scenario Analyzer", "level": "L1"},
        {"id": "education_manager", "name": "Education Manager", "level": "L1"},
        {"id": "career_manager", "name": "Career Manager", "level": "L1"},
        {"id": "finance_manager", "name": "Finance Manager", "level": "L1"},
        {"id": "health_manager", "name": "Health Manager", "level": "L1"},
        # L2 specialists...
    ]
```

---

## 🤖 PHASE 3: INTEGRATE VERTEX AI INTO LN-CORE

**Goal**: Replace/augment Llama 4 Maverick with Vertex AI Gemini in ln-core

### 3.1 Add Vertex AI Client to ln-core

**File**: `ln-core/ln_core/inference/vertex_ai_client.py` (NEW)

Copy the Vertex AI Gemini client from monorepo:
```bash
cp /home/riffe007/Documents/projects/life-navigator-monorepo/services/api/app/services/gemini_client.py \
   /home/riffe007/Documents/projects/ln-core/ln_core/inference/vertex_ai_client.py
```

### 3.2 Update Model Router to Support Vertex AI

**File**: `ln-core/ln_core/inference/model_router.py`

```python
from ln_core.inference.vertex_ai_client import GeminiClient

class ModelRouter:
    def __init__(self):
        self.llama_client = LlamaClient()  # Existing
        self.gemini_client = GeminiClient(project_id=settings.GCP_PROJECT_ID)  # NEW

    async def select_model(self, ...):
        # Routing logic
        if settings.ENABLE_VERTEX_AI:
            if complexity == "simple" or subscription_tier == "freemium":
                return ModelSelection(
                    model_id="gemini-2.0-flash",
                    client=self.gemini_client,
                    reasoning="Fast, cost-effective Vertex AI"
                )
            else:
                return ModelSelection(
                    model_id="llama-4-maverick-17b",
                    client=self.llama_client,
                    reasoning="High-quality local inference"
                )
        else:
            # Fallback to Llama only
            return ModelSelection(model_id="llama-4-maverick-17b", client=self.llama_client)
```

### 3.3 Update Orchestrator to Use Model Router

**File**: `ln-core/ln_core/agents/orchestrator/orchestrator.py`

```python
async def process(self, request: OrchestratorRequest) -> OrchestratorResponse:
    # ... existing code ...

    # Select model
    model_selection = await self.model_router.select_model(
        domain=request.domain,
        subscription_tier=user_subscription,
        complexity=complexity,
        requires_reasoning=True,
        user_id=request.user_id
    )

    # Generate response using selected model
    if model_selection.model_id.startswith("gemini"):
        response_text = await model_selection.client.chat(
            prompt=final_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1000
        )
    else:
        response_text = await model_selection.client.generate(
            prompt=final_prompt,
            temperature=0.3,
            max_tokens=1000
        )

    # ... rest of processing ...
```

---

## 📅 IMPLEMENTATION TIMELINE

### **Day 1: Backend Endpoints (Monorepo)** (8h)
- [ ] Create `/backend/app/api/v1/endpoints/onboarding.py`
- [ ] Create `/backend/app/api/v1/endpoints/goals.py`
- [ ] Create `/backend/app/api/v1/endpoints/benefits.py`
- [ ] Create `/backend/app/api/v1/endpoints/scenario_lab.py`
- [ ] Update `/backend/app/api/v1/router.py` to include new endpoints
- [ ] Test with mock responses

### **Day 2: Frontend Integration** (8h)
- [ ] Update onboarding flow to call backend
- [ ] Add "Ask AI" button to goals page
- [ ] Add "Optimize" button to benefits page
- [ ] Add "AI Analysis" to scenario lab
- [ ] Test end-to-end with mock backend

### **Day 3: ln-core API Endpoints** (8h)
- [ ] Implement `/api/v1/agents/{agent_id}/chat` in ln-core
- [ ] Implement `/api/v1/agents/{agent_id}/tasks` in ln-core
- [ ] Implement `/api/v1/agents/` list endpoint
- [ ] Deploy ln-core locally and test with LNCoreClient

### **Day 4: Vertex AI Integration in ln-core** (8h)
- [ ] Copy Vertex AI client to ln-core
- [ ] Update Model Router to support Vertex AI
- [ ] Update Orchestrator to use Model Router
- [ ] Test Vertex AI integration end-to-end

### **Day 5: Testing & Polish** (8h)
- [ ] End-to-end integration testing
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation updates

---

## ✅ SUCCESS CRITERIA

- [ ] Frontend can successfully call backend endpoints
- [ ] Backend can successfully call ln-core via LNCoreClient
- [ ] ln-core processes requests and returns valid responses
- [ ] Vertex AI is successfully integrated in ln-core
- [ ] All 6 features (onboarding, goals, benefits, risk, chat, scenario lab) have AI integration
- [ ] Response time P95 < 3 seconds
- [ ] Error rate < 1%

---

## 🚨 CRITICAL NOTES

1. **ln-core deployment**: Ensure ln-core is deployed and accessible at `settings.LN_CORE_URL`
2. **Authentication**: Verify Google Cloud ID token auth is working
3. **Vertex AI credentials**: Ensure GCP service account has Vertex AI permissions
4. **Cost monitoring**: Track Vertex AI costs as usage increases

---

## 📚 NEXT IMMEDIATE ACTION

```bash
# In life-navigator-monorepo
cd /home/riffe007/Documents/projects/life-navigator-monorepo/backend/app/api/v1/endpoints

# Create new endpoints
touch onboarding.py goals.py benefits.py scenario_lab.py

# Start with onboarding.py
code onboarding.py
```

---

**Status**: ✅ **READY TO IMPLEMENT**
**Timeline**: 5 days with 1 developer
**Launch Target**: January 17, 2026

---

*Generated: January 12, 2026*
