# LIOS — Prompt Operating System Plan

> How every LLM agent's prompt is assembled, versioned, and governed: the four-layer stack (Constitution →
> Subsystem → Domain → Task). Companion to `LIOS_ARCHITECTURE.md` and `COMPLIANCE_AND_SAFETY_FLOW.md`.
> Architecture only — no prompt text to ship, no code.

---

## 1. Why a prompt OS

Today the advisor is driven by a single large system prompt (`ADVISOR_SYSTEM`, version
`advisor-hybrid-2.2.0`) that bundles identity, behavior, domain framing, safety, and output schema in one
string. That works for one agent — but LIOS has many LLM agents (Advisor, Goal Discovery, the domain
reasoners, the Critic), and they must all share the **same non-negotiable invariants** while differing in
behavior and knowledge.

The Prompt OS solves this by composing every agent's prompt from **four layers**, so the invariants live in
one place (the Constitution), are inherited by every agent, and are **versioned and governed** centrally.

> Principle: **a prompt asks the model to behave; the Compliance gate guarantees it.** The Prompt OS makes
> good behavior likely and consistent; it is never the _only_ line of defense (see
> `COMPLIANCE_AND_SAFETY_FLOW.md`).

---

## 2. The four layers

```
   ┌─────────────────────────────────────────────────────────────┐
   │ 1. BASE CONSTITUTION   (identical for EVERY LLM agent)        │  ← the invariants
   ├─────────────────────────────────────────────────────────────┤
   │ 2. SUBSYSTEM PROMPT    (per tier/role)                        │  ← how this kind of agent behaves
   ├─────────────────────────────────────────────────────────────┤
   │ 3. DOMAIN PROMPT       (per domain, when applicable)          │  ← domain knowledge + boundaries
   ├─────────────────────────────────────────────────────────────┤
   │ 4. TASK PROMPT         (per turn)                             │  ← bounded context + this request + schema
   └─────────────────────────────────────────────────────────────┘
                 │  composed in order, system → user
                 ▼
        the model call (gemini-2.5-flash, Fly backend only)
```

Layers 1–3 are **system instruction**; layer 4 carries the **bounded context + user input + required output
schema** as the user message. Composition is deterministic and the assembled prompt is **stamped with a
version** (the concatenation of each layer's version) that is logged on the turn.

### Layer 1 — Base Constitution (every agent inherits this)

The invariants from `LIOS_ARCHITECTURE.md` §1, expressed as model instruction. Outline (content to be
authored in the implementation phase; this is the spec of _what it must contain_):

- **Identity & posture:** a decision-intelligence advisor, not a chatbot/wizard/questionnaire; lead, don't
  interrogate.
- **No fabrication:** use ONLY the supplied context; never invent goals, facts, numbers, or relationships.
- **Numbers:** reflect only the user's own numbers (from `numbers_you_may_reference`); never compute new
  ones in prose.
- **Relationships:** reference a relationship only if it appears in the supplied real edges, and cite it.
- **No advice:** never give final financial/legal/medical/tax advice; for "how much / what should I" name
  the missing inputs and gather them.
- **Never persist:** you may PROPOSE candidate facts/goals; you never save; always `should_persist=false`.
- **Honesty:** if you don't know, say so; never a fabricated percentage or certainty.
- **Output discipline:** return the exact JSON object the task layer specifies — no prose, no fences.

### Layer 2 — Subsystem prompt (per role)

How this _kind_ of agent behaves. Examples of what each contains:

- **Advisor / Discovery:** lead the conversation; ask exactly ONE strong question; reflect the user's real
  situation and numbers; explain why the question matters; use the discovery scores to prioritize.
- **Goal Discovery:** propose candidate goals mapped to a domain with a reason + confidence; never resurrect
  a rejected goal; ask to clarify when ambiguous rather than guess.
- **Domain reasoner:** explain the domain summary the deterministic engine produced; never produce a new
  number; surface evidence-backed recommendations only.
- **Critic:** adversarial — try to refute the claim using its cited evidence; default to "refuted" when
  uncertain; judge, never rewrite.

### Layer 3 — Domain prompt (per domain)

Domain knowledge + the domain's specific boundary. Examples:

- **Finance:** how to frame net worth / cash flow / retirement; APR/rate language; the "not financial
  advice" line; reflect figures, never recompute them in prose.
- **Family / Estate:** members/guardianship/beneficiary framing; the "not legal advice" line.
- **Career / Education:** opportunity framing; ROI as a _framework_, not a recommendation.
- **Health:** support and readiness only; **never** diagnose, prescribe, or interpret clinical values;
  privacy-forward.
- **Decision Intelligence:** present modeled tradeoffs + the calculation trace; never "the answer."
  Agents that aren't domain-specific (e.g. the core discovery Advisor early in onboarding) may omit layer 3.

### Layer 4 — Task prompt (per turn)

The specific request, assembled by the deterministic Memory/Context + planner:

- the **bounded context** (`prompt_dict`): classified facts, `numbers_you_may_reference`, real edges +
  connected pairs, discovery scores, domain priorities, rejected goals, safety constraints,
  `relationships_available`.
- the **user message** (or domain request).
- the **plan/constraints** (intent, temperature, what's allowed this turn).
- the **required output schema** (the exact JSON shape Compliance will validate).

---

## 3. Assembly per agent

```
compose_prompt(agent, turn):
   system =  CONSTITUTION[vC]
          +  SUBSYSTEM[agent.role][vS]
          +  (DOMAIN[turn.domain][vD]  if agent is domain-scoped)
   user   =  TASK( bounded_context, user_message, plan, output_schema )
   prompt_version = "lios/" + agent.role + "/" + vC + "." + vS + ("." + vD if domain) + "@" + task_schema_v
   return (system, user, prompt_version)
```

- The assembly is **deterministic** (Memory/Context + planner build the task layer; the rest are versioned
  constants). The LLM never assembles its own prompt.
- The composed **`prompt_version`** is logged on every turn (today: `advisor-hybrid-2.2.0`; under LIOS it
  becomes the layered identifier above), so any output can be traced to the exact instruction set that
  produced it.

---

## 4. Versioning & governance

- **Each layer is independently versioned.** A safety change to the Constitution bumps `vC` and applies to
  _every_ agent at once. A behavior tweak to one domain bumps only that `vD`.
- **The turn records the full composed version.** Telemetry already carries `prompt_version`; LIOS extends
  it to the layered id. This lets us A/B and to attribute a quality change (or regression) to a specific
  layer/version. (Concrete precedent this session: a prompt change bumped the version, a regression appeared
  in the metrics, and the fix was attributed and verified — the version stamp is what made that possible.)
- **Changes are reviewed + evaluated.** No Constitution/Subsystem/Domain change ships without:
  1. a run of the eval harness (fallback rate, trust checks) proving no regression, and
  2. for any change near a safety boundary, a Compliance test proving the gate still holds.
- **Prompts are NOT the safety mechanism.** The Constitution makes the model _want_ to comply; the
  Compliance gate makes non-compliance _impossible to ship_. A prompt regression therefore degrades quality
  (more fallbacks), never safety.

---

## 5. Interaction with Compliance (prompt ↔ gate symmetry)

Every Constitution rule has a **corresponding Compliance gate**, so the model is asked to do the right thing
_and_ prevented from doing the wrong thing:

| Constitution says                      | Compliance enforces                                      |
| -------------------------------------- | -------------------------------------------------------- |
| use only the user's numbers            | reject numbers not in `allowed_numbers`                  |
| cite relationships from the real graph | reject goal-to-goal claims without a real edge           |
| never give advice                      | reject directive advice / medical / legal / tax language |
| ask one question                       | repair multi-question to the first                       |
| never persist                          | force `should_persist=false`                             |
| propose facts with a real source       | filter facts to `source=user_message`                    |

This symmetry is the heart of LIOS: **the prompt and the gate are designed together.** Adding a new prompt
capability requires checking (and if needed extending) its Compliance counterpart.

---

## 6. Output schema discipline

Every LLM agent returns a **fixed JSON object** (defined in the task layer), e.g. the advisor's
`{reflection, next_question, why_this_question, summary, confirmed_facts[], candidate_facts[], assumptions[],
candidate_goals[], missing_data[], relationships_referenced[], warnings[], should_persist:false}`. A
tolerant parser strips fences/noise; malformed output is rejected by Compliance → fallback. Structured
output is itself a hallucination control (it narrows what the model can say) and is what makes deterministic
validation possible.

---

## 7. What this replaces / formalizes

- **Today:** one `ADVISOR_SYSTEM` string (`advisor-hybrid-2.2.0`) encoding layers 1–3 inline, plus a
  per-turn `prompt_dict` (layer 4). It works and is the proven baseline.
- **LIOS:** factor that single string into a shared **Constitution** + per-role **Subsystem** + per-domain
  **Domain** layers, so new agents inherit safety for free and prompts become independently versioned and
  governed. Layer 4 (bounded context + schema) is already exactly the right shape and is kept as-is.

No prompt text is shipped in this phase, no agent is added, no runtime behavior changes — this is the plan
for how prompts will be structured when implementation begins.

---

## 8. Definition of done (prompt-OS architecture)

A new engineer can answer:

- What invariants does _every_ LLM agent carry, and where do they live? (the Constitution, layer 1)
- How does an agent's prompt get built for a given turn, and how is it versioned? (§3–4)
- Why can't a prompt change make the product unsafe? (prompt ↔ gate symmetry, §5; gate authority, §4)
- How would we add a new domain agent's prompt without re-deriving safety? (inherit layers 1–2, add layer 3,
  extend the matching Compliance gate)
