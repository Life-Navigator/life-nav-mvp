# ADVISOR_CONTEXT_ASSEMBLY_AUDIT.md — Phase 4

The actual payload: `GeminiAdvisorLLM.generate()` sends `ADVISOR_SYSTEM` (`advisor_llm.py:34-185`) + `json.dumps({"guardrails": context.prompt_dict(), "constraints": plan})` (`advisor_llm.py:242-243`). Output is forced JSON → `validate()` → `_compose()` prose.

## Findings (evidence-backed)

1. **System prompt too generic?** **No — over-specified.** Strong persona (`advisor_llm.py:34-37`). The problem is rigidity, not blandness.

2. **Over-disclaiming?** **Yes, structurally, in layers.** System prompt forces "confirm with a CPA/attorney/advisor" notes (`advisor_llm.py:64,155`). Worse, the deterministic `_SAFETY` list injected every turn (`advisor_context.py:40-48`, surfaced at `prompt_dict()` `:282`) says `"Do not state final financial recommendations"` and `"Do not give medical, legal, or tax advice"` — which **directly contradicts** the V4 system-prompt relaxations ("ALLOWED: grounded personal-finance recommendation" `:137-140`; "DO give the fitness plan" `:144-146`). The model gets conflicting instructions → hedges/over-refuses. `build_constraints` also injects `disallowed_topics:["final financial advice","medical advice",...]` (`advisor_orchestrator.py:84-87`).

3. **Hides available personal context?** **Yes — biggest context finding.** `build_fact_packet` reads career/education/finance/family/documents but **no health rows** (grep: zero), and **never calls `MilitaryService`** (`military.py:73-126` holds DD214, VA rating, GI Bill, benefit $). The data exists; it never reaches the prompt. So the advisor is blind to health + military context it claims to use.

4. **Irrelevant cross-domain context in a HEALTH chat?** **Yes, under the default agent.** A direct Health agent scopes `domain_facts` to health (`advisor_context.py:388-389`) — but that packet is empty (#3). The **default** agent is the Relationship Manager, `is_orchestrator=True`, so `domain_facts` is **not** filtered; `route_domains` falls back to **all 5 domains** (`advisor_agents.py:189-195`); and `prompt_dict()` **always** ships `known_risks/known_opportunities/known_constraints` + goals + full personal graph regardless of topic (`advisor_context.py:249-283`). Finance risks are present in a health turn.

5. **Forces decision-analysis format?** **Yes, hard requirement.** Six mandatory sections every turn (`advisor_llm.py:45-66`), enforced by required JSON (`:184`: "Always populate decision_frame, tradeoffs ≥2, what_we_know ≥1, recommendation, what_we_still_need, next_question, why_this_question"). No "plan/program" output field exists.

6. **Prevents concrete advice / specific numbers?** **Yes — the severe number gate.** System prompt allows only the user's own numbers or 4 "safe derivations"; explicitly bans projections, growth math, "20% down", "3-6 months", "10-15× income" (`advisor_llm.py:73-89`). Enforced: `_FIN_NUM` matches `$`/`%`/any integer ≥100 (`advisor_validator.py:84`); any unlisted number rejects the **whole reply** (`:182-184`). This conflates _fabricated personal figures_ (rightly dangerous) with _general domain knowledge_ (numbers every competent advisor uses). **Primary driver of vague answers.**

7. **Uses military / fitness / history?** **No.** Military not wired (#3); fitness _permitted_ by prompt but ungrounded (no health facts) and numbers gated; history = last 6 turns only (`advisor_context.py:376`).

8. **Health constraints / wellness governance?** **Partial + inconsistent.** Good: deterministic urgent-care net before the LLM (`advisor_orchestrator.py:187-203`). Bad: `_SAFETY[0]` "no medical advice" (`advisor_context.py:41`) + Health persona "never give medical advice" (`advisor_agents.py:87-88`) have no wellness carve-out, contradicting the system prompt → likely over-refusal on wellness asks.

## The "asks a question instead of answering" mechanism (the key complaint)

**Structural, fires every turn:**

1. System prompt mandates exactly one closing question (`advisor_llm.py:65-66,184`).
2. Validator **rejects** any turn with no `next_question` unless it's a pure summary (`advisor_validator.py:187`); rejection → generic deterministic fallback.
3. A non-question is permitted only when the deterministic engine flags discovery `complete` (`advisor_orchestrator.py:76-78`). Until then the advisor is contractually obligated to ask.

Because useful grounding is missing (#3), the forced question often asks for things it "should" already know.

## Prioritized prompt/context problems

1. **(Highest)** Number gate blocks all general/benchmark numbers → vague answers. `advisor_validator.py:84,182-184` + `advisor_llm.py:73-89`
2. **(High)** Mandatory closing question every turn → over-asking. `advisor_llm.py:65,184` + `advisor_validator.py:187` + `advisor_orchestrator.py:76`
3. **(High)** Health + military data never in prompt → ungrounded. `advisor_facts.py`; `military.py`
4. **(High)** Rigid 6-section contract on every turn → no plans. `advisor_llm.py:45-66,164-185`
5. **(Medium)** Contradictory `_SAFETY` vs V4 system prompt. `advisor_context.py:41-42` vs `advisor_llm.py:137,144`
6. **(Medium)** Default RM agent leaks cross-domain risks/goals/graph. `advisor_context.py:249-283`; `advisor_agents.py:195`
7. **(Low)** Over-disclaiming defaults. `advisor_llm.py:64,155`
