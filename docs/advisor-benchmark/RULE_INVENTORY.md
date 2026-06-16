# LifeNavigator Advisor — Rule Inventory

This document is the **evidence base** for the advisor suppression analysis and the top-25 analyses. It catalogs every distinct rule that shapes advisor behavior across the hybrid advisor pipeline:

```
user message
  → RelationshipManager.converse()   (deterministic engine: persistence, correction handling, safe fallback text)
  → AdvisorContextBuilder.build()     (guardrails: classified facts, discovery scores, allowed numbers, real graph)
  → build_constraints()               (rule envelope: persistence off, one question, disallowed topics, intent)
  → AdvisorLLM.generate()             (the LLM IS the advisor — Gemini default / Vertex-Claude experiment)
  → validate()                        (deterministic trust gate: no invented data, no advice overreach, repairs)
  → _compose()                        (renders the validated six/five-section turn)
```

**Sources inventoried:**

- `apps/lifenavigator-core-api/app/services/advisor_llm.py` (ADVISOR_SYSTEM prompt, temperature map, GeminiAdvisorLLM / VertexClaudeAdvisorLLM)
- `apps/lifenavigator-core-api/app/services/advisor_validator.py` (`_ADVICE`, `_RELATION`, `_RELATION_ASSERT`, `_FIN_NUM`, `validate`)
- `apps/lifenavigator-core-api/app/services/advisor_context.py` (`numbers_in`, `allowed_numbers`, `_SAFETY`, relationship derivation)
- `apps/lifenavigator-core-api/app/services/advisor_orchestrator.py` (`_enhance`, `_is_repairable`, `_compose`, `build_constraints`, telemetry)
- `apps/lifenavigator-core-api/app/services/advisor_math.py` (`verify_derivations`, AST-restricted evaluator, unit constants)
- `apps/lifenavigator-core-api/app/services/relationship_manager.py` (deterministic discovery engine the advisor wraps)
- `apps/lifenavigator-core-api/app/services/medical_safety.py`, `trust_safety.py` (domain safety gates)
- `apps/lifenavigator-core-api/app/dependencies.py`, `app/routers/life.py` (config / env flags / routing)

**Origin** = where the rule lives (`prompt` | `validator` | `orchestrator` | `context` | `math` | `engine` | `config`).
**Category** = Safety | Compliance | Prompt | Validator | Product | Config | Unknown.
Line numbers are approximate (snapshot at inventory time).

---

## advisor_llm.py — ADVISOR_SYSTEM prompt + LLM clients

| Rule ID | File           | Line    | Exact Text (short)                                                                                                                             | Purpose                                                          | Origin       | Category   |
| ------- | -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------ | ---------- |
| R001    | advisor_llm.py | 20      | `ADVISOR_PROMPT_VERSION = "advisor-hybrid-6.0.0"`                                                                                              | Versions the prompt; logged per turn for audit                   | config       | Config     |
| R002    | advisor_llm.py | 24-31   | `TEMPERATURE = {"discovery":0.40,"summary":0.30,"clarify":0.30,"goal_extraction":0.10,"structured":0.00,"explanation":0.20}`                   | Low/zero temperatures — advisor is grounded, not creative        | prompt       | Prompt     |
| R003    | advisor_llm.py | 34-37   | "You are not a chatbot, a wizard, or a questionnaire... never 'this collected my information.'"                                                | Persona/identity: elite advisor, not intake form                 | prompt       | Prompt     |
| R004    | advisor_llm.py | 39-41   | "YOU drive the conversation. The supplied context is your set of GUARDRAILS... not following a script."                                        | LLM leads; rules are guardrails not a script                     | prompt       | Prompt     |
| R005    | advisor_llm.py | 43-46   | "SHOW YOUR REASONING AND THEN TAKE A POSITION... Every turn exposes six things, in this order:"                                                | Mandatory six-section output structure                           | prompt       | Prompt     |
| R006    | advisor_llm.py | 48-49   | "1. DECISION FRAME — name the decision... never skip it."                                                                                      | Section 1 required: frame the decision + key drivers             | prompt       | Prompt     |
| R007    | advisor_llm.py | 50-51   | "2. TRADEOFFS — the genuine tensions... Frame both sides honestly."                                                                            | Section 2 required: honest two-sided tradeoffs                   | prompt       | Prompt     |
| R008    | advisor_llm.py | 52-53   | "3. WHAT WE KNOW — the relevant facts the user has already given, in their OWN words and numbers."                                             | Section 3: prove you listened, use their words                   | prompt       | Prompt     |
| R009    | advisor_llm.py | 54-61   | "4. RECOMMENDATION — your grounded read... Take a clear position... Include ONE non-obvious, grounded INSIGHT."                                | Section 4: take a hedged position + one insight                  | prompt       | Prompt     |
| R010    | advisor_llm.py | 62-64   | "5. WHAT WOULD CHANGE THIS — the 1-3 highest-value missing inputs... never generic, philosophical, or vision-oriented."                        | Section 5: decision-relevant missing inputs only                 | prompt       | Prompt     |
| R011    | advisor_llm.py | 65-66   | "6. BEST NEXT QUESTION — exactly ONE question: specific, decision-advancing, high-leverage."                                                   | Section 6: exactly one high-leverage question                    | prompt       | Prompt     |
| R012    | advisor_llm.py | 68-71   | "USE WHAT THE USER ALREADY TOLD YOU... NEVER start over. NEVER ask for something already given."                                               | Cross-turn memory; no restarting the conversation                | prompt       | Prompt     |
| R013    | advisor_llm.py | 71      | "NEVER ask 'what does 'it' refer to' when the conversation already says what 'it' is."                                                         | Don't ask about resolvable referents                             | prompt       | Prompt     |
| R014    | advisor_llm.py | 73-74   | "NUMBERS — a calculator checks EVERY number you write. Get this wrong and the entire reply is discarded."                                      | Number-grounding contract; rejection consequence                 | prompt       | Validator  |
| R015    | advisor_llm.py | 75-76   | "1. The user's OWN numbers — in any clear notation ($72k or $72,000), naturally, never in quotation marks."                                    | Allowed number type 1: user's verbatim figures                   | prompt       | Validator  |
| R016    | advisor_llm.py | 76-79   | "2. A number you COMPUTE that you ALSO record in `derivations` as {label, expression, value}."                                                 | Allowed number type 2: declared derivations only                 | prompt       | Validator  |
| R017    | advisor_llm.py | 78-79   | "if a number in your prose is not the user's verbatim, it MUST have a matching derivation — otherwise DELETE it."                              | Hard rule: undeclared computed numbers must be deleted           | prompt       | Validator  |
| R018    | advisor_llm.py | 80-84   | "You may ONLY compute these four safe shapes" (sum/diff, ratio, interest, comparison)                                                          | Whitelist of permitted computations                              | prompt       | Validator  |
| R019    | advisor_llm.py | 85-88   | "DO NOT attempt any computation that needs a number the user did NOT give... NO projections... NO '3-6 months' benchmarks."                    | Forbid assumed-operand math (projections, benchmarks, inflation) | prompt       | Validator  |
| R020    | advisor_llm.py | 91-95   | "NO INVENTED CONNECTIONS — reason about THIS decision only. Avoid: 'competes with', 'trades off against', 'connected to'..."                   | No goal-to-goal links without a real graph edge                  | prompt       | Validator  |
| R021    | advisor_llm.py | 97-105  | "QUESTION QUALITY — advisor-grade, never intake... AVOID (Level 1 intake)... AVOID (vision deflection)... Elite (uses their own numbers)."     | Question quality ladder; ban intake/vision questions             | prompt       | Product    |
| R022    | advisor_llm.py | 105     | "Never ask a question the context already answers."                                                                                            | Don't re-ask answered questions                                  | prompt       | Prompt     |
| R023    | advisor_llm.py | 107-108 | "VOICE — a CFP / family-office partner / trusted advisor. Calm, precise, warm, confident. NOT a therapist."                                    | Voice/tone constraints                                           | prompt       | Prompt     |
| R024    | advisor_llm.py | 109-111 | "BANNED openers and filler — never write: 'You're weighing a significant decision'... 'Thanks for sharing'."                                   | Banned opener/filler phrases                                     | prompt       | Prompt     |
| R025    | advisor_llm.py | 112     | "Earned confidence: say what you know plainly; say what you don't know briefly and honestly."                                                  | Honesty about known/unknown                                      | prompt       | Prompt     |
| R026    | advisor_llm.py | 113     | "No therapy clichés, no motivational positivity, no corporate fluff, no restating the question verbatim."                                      | Ban clichés / fluff / restatement                                | prompt       | Prompt     |
| R027    | advisor_llm.py | 115-117 | "RELATIONSHIPS — reason from the user's REAL graph... These are the ONLY relationships that exist."                                            | Relationships limited to persisted graph                         | prompt       | Validator  |
| R028    | advisor_llm.py | 118-120 | "You MAY point out how two goals connect ONLY when that pair appears in graph_connections or relationship_edges."                              | Conditional permission to cite a real connection                 | prompt       | Validator  |
| R029    | advisor_llm.py | 121-122 | "If relationships_available is false... do NOT mention any connection, link, or tradeoff between goals."                                       | No-graph → no connection talk                                    | prompt       | Validator  |
| R030    | advisor_llm.py | 123-124 | "Whenever your message references a relationship, you MUST cite the exact pair(s) in relationships_referenced."                                | Citation required for any relationship claim                     | prompt       | Validator  |
| R031    | advisor_llm.py | 127     | "Use ONLY the supplied context. If something is not in it, you do not know it — ask, or mark it missing."                                      | Context-only grounding                                           | prompt       | Safety     |
| R032    | advisor_llm.py | 128-129 | "NEVER invent goals, facts, numbers, OR relationships."                                                                                        | Core no-fabrication rule                                         | prompt       | Safety     |
| R033    | advisor_llm.py | 130-134 | "ADVICE — ALLOWED: a grounded STRATEGIC / PERSONAL-FINANCE / LIFE-PLANNING recommendation... Take a clear, hedged position."                   | Allowed advice scope (V4 relaxation)                             | prompt       | Compliance |
| R034    | advisor_llm.py | 135-139 | "NEVER ALLOWED (still hard-blocked): MEDICAL advice... specific LEGAL directives... specific TAX directives... a SPECIFIC investment product." | Four hard-blocked advice categories                              | prompt       | Compliance |
| R035    | advisor_llm.py | 140-141 | "Every recommendation must be GROUNDED in the user's own facts... add a brief 'confirm with a [professional]' note."                           | Grounding + professional-referral requirement                    | prompt       | Compliance |
| R036    | advisor_llm.py | 142-143 | "you never save anything... Always set should_persist to false."                                                                               | LLM never persists; should_persist=false                         | prompt       | Safety     |
| R037    | advisor_llm.py | 144     | "Ask at most ONE question."                                                                                                                    | One-question-per-turn cap                                        | prompt       | Product    |
| R038    | advisor_llm.py | 145-147 | "REPAIR MODE: if the constraints include a `repair_note`... obey the note exactly... Do not introduce any new ungrounded number."              | Repair-mode behavior contract                                    | prompt       | Validator  |
| R039    | advisor_llm.py | 149-169 | "Respond with a SINGLE JSON object only (no prose, no markdown fences) matching exactly: {...}"                                                | Strict JSON output schema                                        | prompt       | Prompt     |
| R040    | advisor_llm.py | 170-171 | "Always populate decision_frame, tradeoffs (≥2), what_we_know (≥1), recommendation, what_we_still_need (1-3), next_question."                  | Required-field minimums                                          | prompt       | Prompt     |
| R041    | advisor_llm.py | 178-182 | `NullAdvisorLLM ... always returns None so the orchestrator uses the rule-based response`                                                      | Deterministic-only escape hatch                                  | config       | Config     |
| R042    | advisor_llm.py | 188-202 | `parse_advisor_json` — "strip code fences, grab the first {...} object"                                                                        | Tolerant JSON parse before validation                            | orchestrator | Validator  |
| R043    | advisor_llm.py | 224-243 | GeminiAdvisorLLM `generate` — "Any failure returns None → orchestrator falls back"                                                             | Gemini path never raises                                         | config       | Safety     |
| R044    | advisor_llm.py | 246-255 | VertexClaudeAdvisorLLM — "identical ADVISOR_SYSTEM... benchmark delta attributable to the MODEL alone"                                         | Claude control experiment, identical pipeline                    | config       | Config     |
| R045    | advisor_llm.py | 282-284 | `"max_tokens": 2048` (Vertex body)                                                                                                             | Output token cap on the Claude path                              | config       | Config     |

---

## advisor_validator.py — deterministic trust gate

| Rule ID | File                 | Line    | Exact Text (short)                                                                                                 | Purpose                                                       | Origin        | Category                                     |
| ------- | -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------- | -------------------------------------------- | ---------- | --------------------------------------------- | -------------- | ------------------------------------------------- | --------- | --------- |
| R046    | advisor_validator.py | 21-27   | `\_RELATION = re.compile(r"\b(connected to                                                                         | linked to                                                     | tied to       | ...                                          | reinforces | both (support                                 | feed...))\b")` | Detects relationship-asserting connective phrases | validator | Validator |
| R047    | advisor_validator.py | 32-38   | `\_RELATION_ASSERT = re.compile(r"\b(connection between                                                            | interrelated                                                  | ...           | competes? with                               | ...)\b")`  | Detects two-entity mutual relationship claims | validator      | Validator                                         |
| R048    | advisor_validator.py | 41-58   | `_asserts_goal_relationship` — "True only if the text asserts a relationship that needs a real graph edge"         | Distinguishes goal-to-goal claims from benign discovery talk  | validator     | Validator                                    |
| R049    | advisor_validator.py | 54-57   | `named >= 2 or goal_words >= 2` → relationship asserted                                                            | Heuristic: ≥2 named goals / ≥2 "goal" words triggers gate     | validator     | Validator                                    |
| R050    | advisor_validator.py | 68-82   | `_ADVICE = re.compile(...)` MEDICAL/LEGAL/TAX/PRODUCT regex                                                        | Hard-block regex for the four forbidden advice classes        | validator     | Compliance                                   |
| R051    | advisor_validator.py | 60-67   | "strategic / personal-finance / life-planning recommendations are now ALLOWED... number-grounding gate UNCHANGED." | V4 policy: grounded advice allowed, fabrication still blocked | validator     | Compliance                                   |
| R052    | advisor_validator.py | 84      | `\_FIN_NUM = re.compile(r"\$\d[\d,]\*(?:\.\d+)?                                                                    | \d[\d,]\*(?:\.\d+)?%                                          | \b\d{3,}\b")` | Defines a "financial-looking" number to gate | validator  | Validator                                     |
| R053    | advisor_validator.py | 87-91   | `_first_question` — "Keep everything up to and including the FIRST question mark."                                 | Trim multi-question replies to first question                 | validator     | Validator                                    |
| R054    | advisor_validator.py | 101-116 | `_pair_supported` — "A cited {a,b} is real if it matches a connected pair — exact, or label-containment."          | Validates a relationship citation against real edges          | validator     | Validator                                    |
| R055    | advisor_validator.py | 119-144 | `_check_relationships` — "every cited relationship must be a REAL connected pair... no graph → no claim."          | Three relationship gate rules                                 | validator     | Validator                                    |
| R056    | advisor_validator.py | 150-151 | "if not isinstance(result, dict): return False... ['output is not a JSON object']"                                 | Reject malformed (non-object) output                          | validator     | Validator                                    |
| R057    | advisor_validator.py | 159-169 | "EVERY field rendered to the user must pass the SAME trust checks... folded into `visible`."                       | All visible sections gated together                           | validator     | Validator                                    |
| R058    | advisor_validator.py | 171-173 | `if _ADVICE.search(visible): reasons.append("contains advice/recommendation/medical-legal language")`              | Reject on hard-blocked advice match                           | validator     | Compliance                                   |
| R059    | advisor_validator.py | 175-184 | "any financial-looking number must already be in context, OR be a deterministically VERIFIED computation."         | Reject invented numbers; allow user's + verified              | validator     | Validator                                    |
| R060    | advisor_validator.py | 179-181 | `allowed = context.allowed_numbers \| verified_vals`                                                               | Allowed-number set = context numbers ∪ verified derivations   | validator     | Validator                                    |
| R061    | advisor_validator.py | 186-188 | `if not next_q and not summary: reasons.append("no next_question and no summary")`                                 | Must ask a question (or be a summary turn)                    | validator     | Validator                                    |
| R062    | advisor_validator.py | 192-194 | `rel_reasons, valid_citations = _check_relationships(...)`                                                         | Reject invented graph reasoning                               | validator     | Validator                                    |
| R063    | advisor_validator.py | 196-197 | `if reasons: return False, {}, reasons`                                                                            | Any reason → reject → deterministic fallback                  | validator     | Validator                                    |
| R064    | advisor_validator.py | 202     | `safe["should_persist"] = False  # the LLM NEVER persists`                                                         | Force-disable persistence on accepted output                  | validator     | Safety                                       |
| R065    | advisor_validator.py | 206-210 | "Repair (not reject) a multi-question turn: keep... the FIRST question, drop the extra."                           | Repair multi-question instead of rejecting                    | validator     | Validator                                    |
| R066    | advisor_validator.py | 212-219 | "Drop any candidate goal that matches a previously rejected goal (never resurrect)."                               | Suppress rejected goals on accept-path                        | validator     | Product                                      |
| R067    | advisor_validator.py | 220-222 | "Facts must declare a user_message source; drop fabricated-source facts. Categories stay separate."                | Only user-sourced facts survive                               | validator     | Safety                                       |
| R068    | advisor_validator.py | 223-224 | `safe["relationships_referenced"] = valid_citations`                                                               | Keep only real-edge relationship citations                    | validator     | Validator                                    |
| R069    | advisor_validator.py | 225     | `safe["derivations"] = kept_derivs  # only the verified-correct computations survive`                              | Strip unverified derivations from output                      | validator     | Validator                                    |

---

## advisor_context.py — guardrail builder + allowed numbers

| Rule ID | File               | Line    | Exact Text (short)                                                                                                                          | Purpose                                            | Origin  | Category   |
| ------- | ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------- | ---------- |
| R070    | advisor_context.py | 9-13    | "confirmed_facts / candidate_facts / assumptions / missing_data" — "categories are NEVER merged"                                            | Strict fact classification, never collapsed        | context | Safety     |
| R071    | advisor_context.py | 36      | `_PRIMARY_TYPES = {"Goal", "Life Objective"}`                                                                                               | Node types eligible for relationship reasoning     | context | Validator  |
| R072    | advisor_context.py | 38-39   | `_SAFETY[0] = "Do not give medical, legal, or tax advice."`                                                                                 | Safety constraint surfaced to the LLM              | context | Compliance |
| R073    | advisor_context.py | 40      | `_SAFETY[1] = "Do not state final financial recommendations — those come from the recommendation engine."`                                  | Defer final financial recs to the engine           | context | Compliance |
| R074    | advisor_context.py | 41      | `_SAFETY[2] = "Never invent goals, facts, or numbers. If unknown, ask or mark as missing."`                                                 | No-fabrication safety constraint                   | context | Safety     |
| R075    | advisor_context.py | 42      | `_SAFETY[3] = "Keep confirmed facts, candidate facts, assumptions and missing data in separate categories."`                                | Category-separation constraint                     | context | Safety     |
| R076    | advisor_context.py | 43      | `_SAFETY[4] = "...nothing is saved until a deterministic validator confirms it."`                                                           | Persistence requires validator confirmation        | context | Safety     |
| R077    | advisor_context.py | 44-46   | `_SAFETY[5] = "Reference a relationship... ONLY if it appears in relationship_edges... If those are empty, do not mention any connection."` | Relationship-grounding safety constraint           | context | Validator  |
| R078    | advisor_context.py | 49-64   | `numbers_in` — "Numbers the user has stated... emits BOTH the bare digits and the magnitude-expanded form."                                 | Builds the allowed-number set (k/M/% expansion)    | context | Validator  |
| R079    | advisor_context.py | 67-91   | `_expand_money_forms` — "'$22k'→{'22000'}, '24%'→{'24','0.24'}"                                                                             | Normalizes notations so valid user numbers match   | context | Validator  |
| R080    | advisor_context.py | 102-148 | `derive_graph_relations` — "Computed from persisted edges only — never inferred. No edges → empty."                                         | The one real relationship algorithm                | context | Validator  |
| R081    | advisor_context.py | 136-147 | 2-hop primary-node links via direct_edge or shared_node                                                                                     | Defines citable connections (≤2 hops)              | context | Validator  |
| R082    | advisor_context.py | 191-193 | `return relationship_edges[:40], connections[:15]`                                                                                          | Bound the graph context handed to the LLM          | context | Config     |
| R083    | advisor_context.py | 227-229 | `relationships_available = bool(self.relationship_edges or self.connections)`                                                               | Flag gating all relationship talk                  | context | Validator  |
| R084    | advisor_context.py | 231-265 | `prompt_dict` — "no raw DB rows, no secrets... CONSTRAINTS and SIGNALS, not a script."                                                      | Defines the exact bounded guardrail payload        | context | Safety     |
| R085    | advisor_context.py | 243     | `"candidate_facts": []  # the deterministic engine asserts none yet`                                                                        | Engine asserts no candidate facts; LLM may propose | context | Product    |
| R086    | advisor_context.py | 255-257 | `"numbers_you_may_reference": sorted(self.allowed_numbers)`                                                                                 | Surfaces user numbers so advisor engages them      | context | Validator  |
| R087    | advisor_context.py | 261-262 | `"conversation_so_far": self.conversation_so_far` (P0.1)                                                                                    | Cross-turn context so advisor never starts over    | context | Product    |
| R088    | advisor_context.py | 300-304 | `priorities = [...] if (d.get("coverage_pct") or 0) < 80`                                                                                   | Domain priority = coverage below 80%               | context | Product    |
| R089    | advisor_context.py | 307-315 | `_relationships` — "No graph service → empty."                                                                                              | Real graph only; no synthetic edges                | context | Validator  |
| R090    | advisor_context.py | 317-326 | `_confirmed` — "Confirmed = the user said it (vision/objective/goals)."                                                                     | Defines confirmed-fact membership                  | context | Safety     |
| R091    | advisor_context.py | 344-348 | "numbers the user stated in PRIOR turns are still their own... so it never 'loses' $60k said two turns ago."                                | Prior-turn numbers stay allowed                    | context | Validator  |
| R092    | advisor_context.py | 346     | `hist = list(history or [])[-6:]`                                                                                                           | Cap cross-turn history at 6 turns                  | context | Config     |

---

## advisor_math.py — derivation verifier

| Rule ID | File            | Line    | Exact Text (short)                                                                                                        | Purpose                                              | Origin | Category  |
| ------- | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------ | --------- |
| R093    | advisor_math.py | 4-14    | "accepted ONLY if (1) every operand traces to a USER number or unit constant AND (2) the arithmetic is actually correct." | Two-part derivation acceptance criterion             | math   | Validator |
| R094    | advisor_math.py | 23      | `_UNIT_CONSTANTS = {12.0, 52.0, 365.0, 100.0}`                                                                            | Whitelisted non-user constants (time + percent base) | math   | Validator |
| R095    | advisor_math.py | 24      | `_EXPR_OK = re.compile(r"^[0-9.,\s()+\-*/%]+$")`                                                                          | Expression must be pure arithmetic characters        | math   | Validator |
| R096    | advisor_math.py | 28-50   | `expand_money` — "'$22k'→{22000}, '24%'→{24,0.24}, '2.5M'→{2500000}"                                                      | Float expansion of user tokens for operand matching  | math   | Validator |
| R097    | advisor_math.py | 61-76   | `_eval` — only Constant / BinOp(+,-,\*,/) / UnaryOp; "raise on anything non-arithmetic"                                   | Restricted AST evaluator (no `eval`)                 | math   | Safety    |
| R098    | advisor_math.py | 79-82   | `_safe_eval` — "'%' is treated as '/100'. Raises on anything non-arithmetic."                                             | Safe arithmetic evaluation                           | math   | Safety    |
| R099    | advisor_math.py | 119-120 | `if not expr or not claimed or not _EXPR_OK.match(expr): continue`                                                        | Skip malformed/non-arithmetic derivations            | math   | Validator |
| R100    | advisor_math.py | 121-128 | "Every literal operand must trace to a user number or a unit constant." (`_ok`, 1% / 0.5 tolerance)                       | Operand provenance check                             | math   | Validator |
| R101    | advisor_math.py | 133     | `if computed != computed or computed in (inf, -inf): continue`                                                            | Reject NaN / infinity results                        | math   | Validator |
| R102    | advisor_math.py | 138-139 | `tol = max(1.0, abs(computed) * 0.05)` — "allow the model's rounding"                                                     | Arithmetic-correctness tolerance (5%)                | math   | Validator |
| R103    | advisor_math.py | 140-143 | "kept.append(...)" only when computed matches claimed within tolerance                                                    | Only correct derivations are kept/verified           | math   | Validator |

---

## advisor_orchestrator.py — envelope, repair, compose, telemetry

| Rule ID | File                    | Line    | Exact Text (short)                                                                                                                | Purpose                                                 | Origin       | Category   |
| ------- | ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------ | ---------- |
| R104    | advisor_orchestrator.py | 54      | `intent = "summary" if base.get("complete") else "discovery"`                                                                     | Coarse intent (drives temperature + summary permission) | orchestrator | Product    |
| R105    | advisor_orchestrator.py | 60-61   | `"allowed_topics": ["discovery","clarification","summary", context.current_stage]`                                                | Permitted conversation topics                           | orchestrator | Product    |
| R106    | advisor_orchestrator.py | 62-65   | `"disallowed_topics": ["final financial advice","medical advice","legal advice","tax advice","specific product recommendations"]` | Forbidden topics in the envelope                        | orchestrator | Compliance |
| R107    | advisor_orchestrator.py | 66      | `"max_questions": 1`                                                                                                              | One-question cap as a constraint                        | orchestrator | Product    |
| R108    | advisor_orchestrator.py | 67      | `"persistence_allowed": False  # the LLM never persists`                                                                          | Persistence disabled in the envelope                    | orchestrator | Safety     |
| R109    | advisor_orchestrator.py | 68      | `"must_classify_facts": True`                                                                                                     | Require fact classification                             | orchestrator | Product    |
| R110    | advisor_orchestrator.py | 75-82   | `_is_repairable` — "Only grounding misses... NOT advice/medical/legal/tax overreach."                                             | Only grounding rejections get a repair retry            | orchestrator | Validator  |
| R111    | advisor_orchestrator.py | 80      | `if "advice" in txt or "medical" in txt or "legal" in txt: return False`                                                          | Advice/medical/legal rejections never repaired          | orchestrator | Compliance |
| R112    | advisor_orchestrator.py | 85-142  | `_compose` — "Every section here was already trust-checked by validate(); we only format it."                                     | Render only validated sections                          | orchestrator | Validator  |
| R113    | advisor_orchestrator.py | 138-141 | "a grounded recommendation carries a light, deterministic scope disclaimer... not personalized financial, legal, or tax advice."  | Mandatory disclaimer appended to any recommendation     | orchestrator | Compliance |
| R114    | advisor_orchestrator.py | 196-202 | "One retry: transient Gemini failures... surface as None... The retried output still passes through validate()."                  | Single transient-failure retry                          | orchestrator | Config     |
| R115    | advisor_orchestrator.py | 213-234 | "give the model ONE targeted chance to remove the offending items and re-validate... SAME validator."                             | One repair retry through the same gate                  | orchestrator | Validator  |
| R116    | advisor_orchestrator.py | 221-226 | `repair_note = "Your previous draft was rejected for: ... REMOVE every ungrounded number and every relationship claim."`          | Exact repair instruction sent back to the model         | orchestrator | Validator  |
| R117    | advisor_orchestrator.py | 235-239 | `if not ok: base["llm_status"] = "fallback:..."` → deterministic fallback                                                         | Failed validation → rule-based fallback                 | orchestrator | Safety     |
| R118    | advisor_orchestrator.py | 242-245 | `if not composed: ... fallback:empty`                                                                                             | Empty composed output → fallback                        | orchestrator | Safety     |
| R119    | advisor_orchestrator.py | 246-249 | "Merge: only the human-facing text changes; all deterministic outcomes are preserved."                                            | LLM text replaces only the message, never engine state  | orchestrator | Safety     |
| R120    | advisor_orchestrator.py | 250-251 | `if safe.get("missing_data"): base["missing_data"] = ...  # advisory display only — not persisted`                                | Missing-data is display-only                            | orchestrator | Product    |
| R121    | advisor_orchestrator.py | 257-259 | `except Exception ... base["llm_status"] = "fallback:error"`                                                                      | Any exception → fallback, user never sees an error      | orchestrator | Safety     |
| R122    | advisor_orchestrator.py | 167-184 | `_fetch_history` — "Tenant-scoped (user_id AND conversation_id); best-effort... Oldest-first."                                    | Cross-turn history read, tenant-isolated                | orchestrator | Safety     |
| R123    | advisor_orchestrator.py | 179     | `order="created_at.desc", limit=6`                                                                                                | History limited to 6 most-recent turns                  | orchestrator | Config     |
| R124    | advisor_orchestrator.py | 284-312 | `converse_stream` — "yield a fast deterministic ACK first... then the fully validated enhanced answer."                           | Stream the trust-safe ack before validated answer       | orchestrator | Product    |
| R125    | advisor_orchestrator.py | 321-327 | "Metadata-only log line (no full message/response/raw → keeps PII out of logs)."                                                  | PII-safe telemetry logging                              | orchestrator | Safety     |

---

## relationship_manager.py — deterministic discovery engine (the advisor wraps this)

| Rule ID | File                    | Line    | Exact Text (short)                                                                                                                   | Purpose                                                     | Origin | Category |
| ------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------ | -------- |
| R126    | relationship_manager.py | 18-25   | `_CORRECTION_RE` — "Rule 2: user corrections are authoritative... we never re-assert a rejected interpretation."                     | Detect user corrections; corrections win                    | engine | Product  |
| R127    | relationship_manager.py | 26-30   | `_REJECTED_PHRASE_RE` — "Pull the rejected concept out... persisted + suppressed forever (P0.2)."                                    | Extract rejected concept for permanent suppression          | engine | Product  |
| R128    | relationship_manager.py | 37-40   | "Goal-DRIVEN flow (Rule 4/5)... we do NOT march through family→career→finance→health asking domain questions the user never raised." | Goal-driven discovery, not a domain march                   | engine | Product  |
| R129    | relationship_manager.py | 41-64   | `FLOW` — fixed 7-step discovery interview (vision, primary_goal, priority, financial_goal, time_horizon, risk, constraint)           | Deterministic discovery question set                        | engine | Product  |
| R130    | relationship_manager.py | 80-104  | `_rejected_norms` — "Normalized rejected goals... to suppress forever."                                                              | Build the suppression set from rejected_goals               | engine | Product  |
| R131    | relationship_manager.py | 138-143 | "P0.3: a goal the user rejected never appears in the final model"                                                                    | Rejected goals excluded from final model                    | engine | Product  |
| R132    | relationship_manager.py | 294-310 | "Rule 2... apologize, do NOT classify or advance, ask them to restate... PERSIST the rejected concept."                              | On correction: apologize + persist rejection, don't advance | engine | Product  |
| R133    | relationship_manager.py | 316-318 | "You're right — I overreached, and I should only work from what you actually told me."                                               | Deterministic correction-acknowledgment text                | engine | Product  |
| R134    | relationship_manager.py | 333-340 | "P0.5: a goal can surface in ANY answer... Extract from every substantive message... so no stated goal is ever dropped."             | Extract goals from every message                            | engine | Product  |
| R135    | relationship_manager.py | 341-351 | "P0.3: suppress any candidate matching a previously rejected goal (persists across sessions)."                                       | Suppress rejected goals in candidates                       | engine | Product  |
| R136    | relationship_manager.py | 352-354 | "P0.1: persist every surviving candidate goal so it accumulates across turns (never lost)."                                          | Accumulate candidate goals across turns                     | engine | Product  |
| R137    | relationship_manager.py | 356-358 | "Rule 7: during discovery, nothing is finalized — use draft language, not 'recommendations refreshed'."                              | Draft language during discovery                             | engine | Product  |
| R138    | relationship_manager.py | 371-372 | "Rule 3: EXTRACT first, classify later — reflect the user's OWN words... ask them to confirm before any classification."             | Extract-then-confirm before classifying                     | engine | Product  |
| R139    | relationship_manager.py | 394-405 | "if the user already has connected financial data, acknowledge it... we won't re-ask the numbers."                                   | Don't re-ask numbers already known from Plaid               | engine | Product  |

---

## medical_safety.py / trust_safety.py — domain safety gates

| Rule ID | File              | Line  | Exact Text (short)                                                                                             | Purpose                                                 | Origin | Category   |
| ------- | ----------------- | ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ | ---------- |
| R140    | medical_safety.py | 2-6   | "Health is **wellness/lifestyle guidance only** — never medical care... BLOCKS diagnosis/dosing/prescription." | Health domain = wellness only                           | engine | Safety     |
| R141    | medical_safety.py | 13-17 | `_EMERGENCY = ("chest pain","can't breathe","suicidal","stroke","overdose",...)`                               | Emergency-symptom escalation triggers                   | engine | Safety     |
| R142    | medical_safety.py | 18-22 | `_DOSING = ("how much should i take","what dose","dosage","prescribe","titrate",...)`                          | Block dosing/prescription requests                      | engine | Safety     |
| R143    | medical_safety.py | 23-26 | `_DIAGNOSIS = ("diagnose","do i have","is this cancer","am i sick",...)`                                       | Block diagnosis requests                                | engine | Safety     |
| R144    | medical_safety.py | 28-31 | `_NEEDS_REVIEW = ("lab result","blood test","medication","hormone",...)`                                       | Flag for physician review even when allowed             | engine | Safety     |
| R145    | medical_safety.py | 33-36 | `DISCLAIMER = "This is general wellness guidance, not medical advice. Consult a licensed clinician."`          | Mandatory health disclaimer                             | engine | Compliance |
| R146    | medical_safety.py | 62-71 | `if any(k in q for k in _EMERGENCY): SafetyDecision("escalate",...)`                                           | Emergency → escalate, not allowed                       | engine | Safety     |
| R147    | medical_safety.py | 72-86 | dosing/diagnosis → `SafetyDecision("block",...allowed=False)`                                                  | Dosing/diagnosis → blocked                              | engine | Safety     |
| R148    | trust_safety.py   | 23-31 | `TrustSafetyGate.review_output` — "F1 returns a permissive pass... AI output review is wired in F2."           | Scaffold gate, currently permissive (not yet enforcing) | engine | Unknown    |

---

## Config / routing — env flags and endpoints

| Rule ID | File            | Line    | Exact Text (short)                                                                                        | Purpose                                            | Origin | Category |
| ------- | --------------- | ------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ | -------- |
| R149    | dependencies.py | 280     | `enabled = os.environ.get("ADVISOR_LLM_ENABLED", "true")...`                                              | Master on/off for LLM enhancement (default ON)     | config | Config   |
| R150    | dependencies.py | 284     | `use_claude = os.environ.get("USE_VERTEX_CLAUDE", "false")...`                                            | Route to Claude-on-Vertex experiment (default OFF) | config | Config   |
| R151    | dependencies.py | 298     | `model=os.environ.get("ADVISOR_MODEL", "claude-opus-4-1@20250805")`                                       | Default Vertex model for the Claude path           | config | Config   |
| R152    | dependencies.py | 273-276 | "falls back to pure rule-based automatically if Gemini is unavailable... The LLM never writes to the DB." | Wiring-level fallback + no-write invariant         | config | Safety   |
| R153    | life.py         | 95, 109 | `trace_ok = trace and os.environ.get("ADVISOR_TRACE_ENABLED",...)`                                        | Diagnostic trace only when explicitly enabled      | config | Config   |
| R154    | life.py         | 85-96   | `discovery_chat` — "The advisor IS the onboarding." (single-turn endpoint)                                | Advisor turn endpoint contract                     | config | Product  |
| R155    | life.py         | 101-112 | `discovery_chat_stream` — SSE variant emitting ack then final                                             | Streaming advisor endpoint                         | config | Product  |

---

### Notes on overlaps (for the suppression analysis)

- The **number-grounding** rule appears in three layers: prompt (R014–R019), validator (R059–R060), and math verifier (R093–R103). The prompt instructs; the validator + math verifier enforce.
- The **relationship-grounding** rule likewise spans prompt (R027–R030), context derivation (R080–R083, R089), and validator (R046–R049, R054–R055, R068).
- The **four hard-blocked advice categories** appear in prompt (R034), validator regex (R050), envelope disallowed-topics (R106), and the non-repairable rule (R111).
- **Persistence-off** is asserted four times (R036 prompt, R064 validator, R067 facts, R108 envelope) plus the wiring invariant (R152) — the LLM can never write to the DB.
- The deterministic engine (R126–R139) and medical gate (R140–R148) run _outside_ the LLM path and provide the trust-safe fallback text the orchestrator returns whenever the LLM output is rejected.
