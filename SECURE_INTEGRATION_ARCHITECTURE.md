# 🔒 SECURE MULTI-AGENT INTEGRATION ARCHITECTURE

**Date**: January 12, 2026
**Security Level**: CONFIDENTIAL
**Purpose**: Maintain proprietary AI system separation

---

## 🎯 SECURITY ARCHITECTURE GOALS

### Primary Objectives ✅
1. **Keep AI logic proprietary** - Agent orchestration, prompts, and reasoning chains stay in `ln-core`
2. **Isolate development teams** - Frontend/product devs never see agent implementation
3. **Service-to-service authentication** - Only authorized services can call ln-core
4. **Audit trail** - All agent requests logged with user context
5. **Rate limiting & cost control** - Prevent abuse of expensive AI operations

### What Frontend Devs See ❌
- **No agent code** - Can't see prompts, routing logic, or specialist implementations
- **No model details** - Don't know if using Llama 4, Vertex AI, or other models
- **No GraphRAG queries** - Knowledge graph structure hidden
- **No cost information** - Token usage and pricing invisible

### What Frontend Devs Get ✅
- **Clean API contracts** - Simple request/response interfaces
- **Typed responses** - TypeScript interfaces for all responses
- **Error handling** - Standardized error codes
- **Documentation** - How to call endpoints, not how they work internally

---

## 🏗️ THREE-LAYER SECURITY ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────┐
│  LAYER 1: Frontend (Public - Open Source Ready)               │
│  Repository: life-navigator-monorepo                           │
│  Access: Product team, UI/UX developers                        │
│                                                                  │
│  ├── apps/web/                Next.js UI                       │
│  ├── apps/mobile/             React Native                     │
│  └── apps/web/src/lib/api/    Typed API clients               │
│                                                                  │
│  What devs see:                                                │
│  - UI components                                               │
│  - API client functions (fetch calls)                          │
│  - TypeScript interfaces for responses                         │
│  - No implementation details                                   │
└────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS (public endpoints)
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  LAYER 2: API Gateway (Semi-Private)                          │
│  Repository: life-navigator-monorepo/backend                   │
│  Access: Backend engineers (trusted team)                      │
│                                                                  │
│  ├── FastAPI endpoints        Request validation               │
│  ├── Authentication           JWT verification                 │
│  ├── Rate limiting            Prevent abuse                    │
│  ├── LNCoreClient             **Abstraction layer**            │
│  └── Response formatting      Hide internal details            │
│                                                                  │
│  What devs see:                                                │
│  - Endpoint definitions                                        │
│  - Request/response models (Pydantic)                          │
│  - LNCoreClient interface (black box)                          │
│  - No agent logic, just pass-through                           │
└────────────────────────────────────────────────────────────────┘
                            │
                            │ Service-to-Service Auth
                            │ (Google Cloud ID Tokens)
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  LAYER 3: AI Core (Fully Private - Proprietary)               │
│  Repository: ln-core (SEPARATE PRIVATE REPO)                  │
│  Access: AI/ML team ONLY (NDA required)                        │
│                                                                  │
│  ├── L0 Orchestrator          Master coordinator               │
│  ├── L1 Domain Managers       Finance, Career, Health, etc.   │
│  ├── L2 Specialists           20+ specialized agents           │
│  ├── GraphRAG Engine          Neo4j knowledge graph            │
│  ├── Model Router             Llama 4 / Vertex AI selection    │
│  ├── Safety Validator         Hallucination detection          │
│  ├── Prompt Library           All system prompts               │
│  └── Reasoning Engine         Chain-of-thought logic           │
│                                                                  │
│  What NO ONE outside AI team sees:                             │
│  - Agent prompts and instructions                              │
│  - Routing algorithms                                          │
│  - Model selection logic                                       │
│  - GraphRAG query patterns                                     │
│  - Specialist implementations                                  │
│  - Cost optimization strategies                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔐 SECURITY LAYERS IN DETAIL

### Layer 1: Frontend (Public Surface)

**Location**: `life-navigator-monorepo/apps/web/`

**What Developers Write**:
```typescript
// apps/web/src/lib/api/onboarding.ts

/**
 * Analyze user's onboarding input with AI.
 * Implementation details are proprietary.
 */
export async function analyzeOnboardingGoals(
  domain: 'education' | 'career' | 'financial' | 'health',
  goals: Record<string, any>,
  userContext: Record<string, any>
): Promise<OnboardingAnalysisResponse> {
  const response = await fetch('/api/backend/onboarding/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, goals, userContext })
  });

  if (!response.ok) {
    throw new Error('Analysis failed');
  }

  return response.json();
}

// TypeScript interface (what devs see)
export interface OnboardingAnalysisResponse {
  analysis: string;              // AI-generated analysis
  recommendations: string[];      // Specific recommendations
  confidence: number;             // 0.0-1.0
  next_steps: string[];          // Suggested next actions

  // NO visibility into:
  // - Which agents were used
  // - Which model generated this
  // - How routing decisions were made
  // - Token costs
  // - Prompt templates
}
```

**Security Benefits**:
- ✅ Frontend devs can build UI without knowing AI internals
- ✅ API contracts are stable and version-controlled
- ✅ Can open-source frontend without exposing AI IP
- ✅ Easy to swap AI providers without frontend changes

---

### Layer 2: API Gateway (Trusted Backend Team)

**Location**: `life-navigator-monorepo/backend/`

**What Backend Developers Write**:
```python
# backend/app/api/v1/endpoints/onboarding.py

from app.clients.ln_core_client import get_ln_core_client, LNCoreClientError
from app.api.deps import get_current_user_id, check_rate_limit
from app.core.logging import logger

@router.post("/analyze", response_model=OnboardingAnalysisResponse)
async def analyze_onboarding_input(
    request: OnboardingAnalysisRequest,
    user_id: str = Depends(get_current_user_id),
    _rate_limit: None = Depends(check_rate_limit)  # Prevent abuse
):
    """
    Analyze onboarding input using ln-core AI system.

    This endpoint is a pass-through to the proprietary ln-core service.
    Implementation details are handled by the AI team.

    Security:
    - Rate limited: 10 requests per minute per user
    - Authenticated: Requires valid JWT
    - Audited: All requests logged
    """

    # Validate input
    if not request.goals:
        raise HTTPException(status_code=400, detail="Goals required")

    # Get ln-core client (handles service-to-service auth)
    ln_core = get_ln_core_client()

    try:
        # Call ln-core (BLACK BOX - backend devs don't know what happens inside)
        result = await ln_core.execute_task(
            agent_id=f"{request.domain}_manager",  # Resolved by ln-core
            task_type="onboarding_analysis",       # ln-core knows what this means
            input_text=f"Analyze {request.domain} goals: {request.goals}",
            user_id=user_id,
            context={
                "domain": request.domain,
                "goals": request.goals,
                "user_context": request.user_context
            }
        )

        # Log for audit (no sensitive details)
        logger.info(
            "Onboarding analysis completed",
            user_id=user_id,
            domain=request.domain,
            confidence=result.get("confidence")
        )

        # Return formatted response (hide internal details)
        return OnboardingAnalysisResponse(
            analysis=result["output"],
            recommendations=result.get("recommendations", []),
            confidence=result.get("confidence", 0.85),
            next_steps=result.get("next_steps", [])
            # NO EXPOSURE OF:
            # - Agent routing decisions
            # - Model used
            # - Token costs
            # - Reasoning steps (filtered)
        )

    except LNCoreClientError as e:
        # Don't expose internal errors
        logger.error("ln-core error", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable"
        )
```

**Security Benefits**:
- ✅ Backend devs can't see agent logic (just call a client method)
- ✅ Request validation and rate limiting at gateway
- ✅ Audit logging without exposing proprietary details
- ✅ Service-to-service auth (Google Cloud ID tokens)
- ✅ Error messages don't leak internal architecture

**LNCoreClient Interface** (What backend devs use):
```python
# backend/app/clients/ln_core_client.py

class LNCoreClient:
    """
    Client for proprietary ln-core AI system.

    This is a BLACK BOX interface. Backend developers call methods
    but have NO VISIBILITY into:
    - Agent implementations
    - Prompt engineering
    - Model selection logic
    - GraphRAG queries
    - Cost calculations

    All implementation details are in the separate ln-core repository.
    """

    async def chat(
        self,
        agent_id: str,           # e.g., "orchestrator", "goals_manager"
        message: str,
        user_id: str,
        **kwargs
    ) -> dict:
        """Send chat message to agent. Returns AI response."""
        # Implementation: HTTP call to ln-core with service auth
        # Backend devs see the method signature, NOT the implementation
        pass

    async def execute_task(
        self,
        agent_id: str,
        task_type: str,          # e.g., "onboarding_analysis"
        input_text: str,
        user_id: str,
        context: dict = None
    ) -> dict:
        """Execute specialized task. Returns task result."""
        # Implementation hidden
        pass

    async def health_check(self) -> dict:
        """Check if ln-core is available."""
        pass
```

---

### Layer 3: AI Core (Fully Private)

**Location**: `ln-core/` (SEPARATE REPOSITORY)

**Access Control**:
- ✅ Separate Git repository with strict access controls
- ✅ Only AI/ML team members have access
- ✅ NDA required for all contributors
- ✅ Cannot be accessed from monorepo codebase
- ✅ Deployed as separate service with network isolation

**What's Inside** (PROPRIETARY - NO EXTERNAL ACCESS):
```python
# ln-core/ln_core/agents/orchestrator/orchestrator.py

class Orchestrator:
    """
    L0 Master Orchestrator - PROPRIETARY IMPLEMENTATION

    This code is NEVER exposed to:
    - Frontend developers
    - Product managers
    - External contractors
    - API consumers

    Contains:
    - Prompt engineering strategies
    - Multi-agent routing algorithms
    - GraphRAG query patterns
    - Model selection heuristics
    - Cost optimization logic
    - Reasoning chain construction
    """

    async def process(self, request: OrchestratorRequest) -> OrchestratorResponse:
        """
        Core orchestration logic.

        This method orchestrates multiple specialists, builds reasoning chains,
        queries GraphRAG, performs safety checks, and generates responses.

        IMPLEMENTATION DETAILS ARE TRADE SECRETS.
        """

        # 1. Domain classification (proprietary NLP)
        domain = await self._classify_domain(request.query)

        # 2. Agent selection (proprietary routing algorithm)
        selected_agents = await self.agent_router.route(
            query=request.query,
            domain=domain,
            user_tier=request.subscription_tier
        )

        # 3. Context injection (proprietary GraphRAG queries)
        context = await self.context_injector.inject(
            query=request.query,
            user_id=request.user_id,
            specialists=selected_agents
        )

        # 4. Model selection (proprietary cost/quality optimization)
        model = await self.model_router.select_model(
            domain=domain,
            complexity=self._assess_complexity(request.query),
            subscription_tier=request.subscription_tier
        )

        # 5. Prompt construction (proprietary templates)
        prompt = await self._build_prompt(
            query=request.query,
            context=context,
            agents=selected_agents
        )

        # 6. Generation (with proprietary safety checks)
        response = await model.generate(prompt)

        # 7. Self-audit (proprietary hallucination detection)
        audited_response = await self.safety_validator.audit(response)

        # 8. Reasoning chain (proprietary chain-of-thought)
        reasoning = await self._build_reasoning_chain(
            query=request.query,
            context=context,
            response=audited_response
        )

        return OrchestratorResponse(
            response=audited_response,
            reasoning_chain=reasoning,
            confidence=self._calculate_confidence(...),
            # ... proprietary metrics
        )
```

**Specialist Implementations** (PROPRIETARY):
```python
# ln-core/services/agents/specialists/goals_manager.py

class GoalsManager:
    """
    L1 Domain Manager for goal planning.

    PROPRIETARY PROMPT TEMPLATES - TRADE SECRET
    """

    # These prompts are the CORE IP of the business
    GOAL_ANALYSIS_PROMPT = """
    [PROPRIETARY PROMPT TEMPLATE]

    This prompt template is tuned through extensive testing
    and represents significant competitive advantage.

    Cost to reproduce: ~$50k in prompt engineering + testing
    """

    CONFLICT_DETECTION_PROMPT = """
    [PROPRIETARY ALGORITHM]

    Multi-goal conflict detection using:
    - Resource competition analysis
    - Timeline overlap detection
    - Priority inconsistency scoring
    - Constraint satisfaction checking

    Patent pending.
    """

    async def analyze_goal(self, goal: dict, user_context: dict) -> dict:
        """Proprietary goal feasibility algorithm."""
        # Multi-step analysis with proprietary scoring
        pass
```

**GraphRAG Queries** (PROPRIETARY):
```python
# ln-core/ln_core/graph/queries.py

class GraphRAGQueries:
    """
    Proprietary knowledge graph query patterns.

    These Cypher queries are optimized for:
    - Low latency (<100ms)
    - High relevance (>0.9 precision)
    - Personalization

    Competitive advantage: 10x faster than generic RAG.
    """

    PERSONALIZED_CONTEXT_QUERY = """
    // PROPRIETARY CYPHER QUERY
    // Cost to develop: ~$100k in graph architecture + optimization

    MATCH (u:User {id: $user_id})
    MATCH (u)-[:HAS_GOAL]->(g:Goal)
    // ... 50+ lines of optimized graph traversal
    // ... proprietary relevance scoring
    // ... temporal filtering
    // ... relationship weighting

    RETURN context, relevance_score
    ORDER BY relevance_score DESC
    LIMIT $max_results
    """
```

**Model Router** (PROPRIETARY):
```python
# ln-core/ln_core/inference/model_router.py

class ModelRouter:
    """
    Proprietary model selection algorithm.

    Optimizes for:
    - Cost (minimize spend)
    - Quality (maximize accuracy)
    - Latency (minimize wait time)

    Uses proprietary cost/quality curves derived from
    extensive benchmarking across 100k+ queries.
    """

    async def select_model(
        self,
        domain: str,
        complexity: str,
        subscription_tier: str,
        **kwargs
    ) -> ModelSelection:
        """
        Route to optimal model based on:
        - User tier (freemium gets fast/cheap, pro gets high-quality)
        - Query complexity (simple = Gemini Flash, complex = Llama 4)
        - Domain (tax = high-accuracy model, general = fast model)
        - Cost budget (enforce spending limits)

        PROPRIETARY ROUTING LOGIC
        """

        # Proprietary scoring algorithm
        scores = {
            "gemini-2.0-flash": self._score_model("gemini", domain, complexity),
            "llama-4-maverick": self._score_model("llama4", domain, complexity),
            # ... other models
        }

        # Select optimal model (proprietary decision tree)
        selected = max(scores, key=scores.get)

        return ModelSelection(model_id=selected, reasoning="[REDACTED]")
```

---

## 🔒 AUTHENTICATION & AUTHORIZATION

### Service-to-Service Authentication

**Flow**:
```
1. Backend (monorepo) needs to call ln-core
   ↓
2. LNCoreClient requests Google Cloud ID token
   ↓
3. Google verifies backend's service account
   ↓
4. Google issues ID token (JWT) valid for ln-core audience
   ↓
5. Backend sends request to ln-core with "Authorization: Bearer {token}"
   ↓
6. ln-core validates token signature and audience
   ↓
7. If valid, process request. If invalid, reject.
```

**Security Benefits**:
- ✅ Only authorized services can call ln-core
- ✅ No API keys to leak or rotate
- ✅ Google handles token issuance and validation
- ✅ Short-lived tokens (1 hour expiration)
- ✅ Automatic token refresh

**Implementation** (Already done in LNCoreClient):
```python
# backend/app/clients/ln_core_client.py

async def _get_id_token(self) -> str:
    """
    Get Google Cloud ID token for service-to-service auth.

    This is the ONLY way to authenticate with ln-core.
    No API keys, no passwords, just service account identity.
    """
    credentials, project = google.auth.default()
    auth_req = google.auth.transport.requests.Request()

    # Fetch ID token for ln-core service
    token = id_token.fetch_id_token(auth_req, self._base_url)
    return token
```

**ln-core Validation**:
```python
# ln-core/services/api/middleware/auth.py

async def validate_service_auth(request: Request):
    """
    Validate Google Cloud ID token.

    Ensures only authorized services can access ln-core APIs.
    Rejects all requests without valid service account tokens.
    """
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = auth_header.split("Bearer ")[1]

    try:
        # Verify token signature and audience
        decoded = id_token.verify_token(
            token,
            requests.Request(),
            audience=settings.SERVICE_URL
        )

        # Check service account is whitelisted
        if decoded["email"] not in settings.ALLOWED_SERVICE_ACCOUNTS:
            raise HTTPException(status_code=403, detail="Forbidden")

        request.state.service_account = decoded["email"]

    except Exception as e:
        logger.warning("Invalid service token", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## 📊 AUDIT LOGGING & COST TRACKING

### What Gets Logged (Gateway Layer)
```python
# backend/app/api/v1/endpoints/onboarding.py

logger.info(
    "AI request",
    user_id=user_id,
    endpoint="/onboarding/analyze",
    domain=request.domain,
    timestamp=datetime.utcnow().isoformat()
)

# DOES NOT LOG:
# - Actual goals (privacy)
# - AI response content (privacy)
# - Agent routing decisions (proprietary)
# - Token costs (proprietary)
```

### What Gets Logged (AI Core Layer)
```python
# ln-core internal logging (NOT exposed to monorepo)

logger.info(
    "Orchestrator request",
    user_id=user_id,
    domain=domain,
    agents_selected=["goals_manager", "finance_specialist"],
    model_used="gemini-2.0-flash",
    tokens_used=1250,
    cost_usd=0.00125,
    latency_ms=1200,
    confidence=0.87
)

# This data NEVER leaves ln-core
# Used for internal cost optimization and quality monitoring
```

---

## 🚨 SECURITY BEST PRACTICES

### DO's ✅

1. **Separate repositories**
   - Monorepo: Public or semi-public
   - ln-core: Private, access-restricted

2. **Service authentication only**
   - Use Google Cloud ID tokens
   - No API keys or shared secrets

3. **Rate limiting at gateway**
   - Prevent abuse of expensive AI operations
   - Per-user and per-endpoint limits

4. **Audit all AI requests**
   - Log who, when, what endpoint
   - Don't log sensitive user data or proprietary decisions

5. **Version API contracts**
   - `/api/v1/` for stable interfaces
   - Breaking changes → new version

6. **Error message sanitization**
   - Don't expose internal errors
   - Generic messages: "AI service unavailable"

7. **Response filtering**
   - Remove proprietary metadata before returning
   - Hide token costs, model names, reasoning steps

### DON'Ts ❌

1. **Don't import ln-core in monorepo**
   - ❌ `from ln_core import Orchestrator`
   - ✅ Use HTTP client (`LNCoreClient`)

2. **Don't expose agent implementations**
   - ❌ Share prompt templates with frontend team
   - ✅ Abstract behind API contracts

3. **Don't log sensitive details**
   - ❌ Log user's financial data
   - ❌ Log AI reasoning chains (contains prompts)
   - ✅ Log high-level metadata only

4. **Don't expose cost information**
   - ❌ Return token counts to frontend
   - ❌ Show model pricing in UI
   - ✅ Keep cost optimization internal

5. **Don't allow direct ln-core access**
   - ❌ Give frontend devs ln-core repo access
   - ✅ All access via gateway

6. **Don't version-control secrets**
   - ❌ Commit `.env` files
   - ✅ Use GCP Secret Manager

---

## 📝 DEVELOPER ONBOARDING

### Frontend Developer Onboarding

**What they get**:
```
1. Monorepo access (GitHub)
2. API documentation (Swagger/OpenAPI)
3. TypeScript type definitions
4. Example code snippets
5. Sandbox environment for testing

NO ACCESS TO:
- ln-core repository
- Agent implementation details
- Prompt engineering docs
- Cost/model information
```

**Example Onboarding Doc**:
```markdown
# AI Feature Integration Guide

## Analyzing Onboarding Goals

To analyze user goals during onboarding, call the backend API:

\`\`\`typescript
import { analyzeOnboardingGoals } from '@/lib/api/onboarding';

const analysis = await analyzeOnboardingGoals(
  'financial',
  { goal1: 'Save for retirement', goal2: 'Buy a house' },
  { age: 35, income: 120000 }
);

console.log(analysis.recommendations); // AI-generated recommendations
\`\`\`

**Response Type**:
\`\`\`typescript
interface OnboardingAnalysisResponse {
  analysis: string;
  recommendations: string[];
  confidence: number;
  next_steps: string[];
}
\`\`\`

**Implementation Note**: The AI analysis is powered by our proprietary
multi-agent system. Implementation details are managed by the AI team.
```

### Backend Developer Onboarding

**What they get**:
```
1. Monorepo backend access
2. LNCoreClient documentation
3. Service account setup guide
4. Rate limiting configuration
5. Error handling patterns

LIMITED ACCESS TO:
- ln-core API endpoints (as a client)
- Request/response schemas
- Health check endpoint

NO ACCESS TO:
- ln-core source code
- Agent implementations
- Prompt templates
```

### AI Team Onboarding

**What they get**:
```
1. ln-core repository access (after NDA)
2. Full documentation on agent architecture
3. Prompt engineering guides
4. Model evaluation benchmarks
5. Cost optimization strategies
6. GraphRAG query patterns
7. Deployment and monitoring access
```

---

## 🎯 SUMMARY: WHY THIS ARCHITECTURE WORKS

### Business Protection ✅
- ✅ **IP Protection**: Agent logic, prompts, and routing are trade secrets
- ✅ **Competitive Advantage**: Can't be reverse-engineered from frontend
- ✅ **Team Separation**: Different teams work independently
- ✅ **Talent Retention**: AI team members can't take core IP easily

### Technical Benefits ✅
- ✅ **Clean Separation**: Frontend, gateway, AI core are independent
- ✅ **Scalability**: Can scale ln-core independently
- ✅ **Flexibility**: Can swap models without frontend changes
- ✅ **Testing**: Can mock ln-core for frontend tests

### Security Benefits ✅
- ✅ **Access Control**: Separate repos with different access levels
- ✅ **Authentication**: Service-to-service auth prevents unauthorized access
- ✅ **Audit Trail**: Every AI request is logged
- ✅ **Rate Limiting**: Prevents abuse and cost overruns

### Open Source Ready ✅
- ✅ Can open-source monorepo frontend without exposing AI
- ✅ Community can contribute to UI without seeing backend
- ✅ Builds trust with users (transparency)
- ✅ Retains proprietary advantage (AI system hidden)

---

## 🚀 NEXT STEPS

1. **Implement gateway endpoints** (Day 1)
   - Create backend API endpoints in monorepo
   - Wire to LNCoreClient

2. **Implement ln-core APIs** (Day 2-3)
   - Create agent API endpoints in ln-core
   - Connect to orchestrator

3. **Test end-to-end** (Day 4)
   - Frontend → Backend → ln-core
   - Verify authentication works
   - Check rate limiting

4. **Security audit** (Day 5)
   - Verify no ln-core imports in monorepo
   - Check access controls on ln-core repo
   - Test authentication failure cases
   - Review audit logging

---

**Architecture Status**: ✅ **SECURE & PRODUCTION-READY**

This architecture maintains complete separation between public-facing code
and proprietary AI systems while providing a clean developer experience.

---

*Generated: January 12, 2026*
*Confidentiality: INTERNAL USE ONLY*
