# Advisor Operating System — Implementation Blueprint

> Design only — no code, no runtime, no prompt changes. How the AOS becomes part of LIOS: it maps onto the
> Prompt Operating System, flows through the LIOS runtime (the wrap + composition engine), and is inherited
> by future multi-agent execution. Builds on the runtime blueprint + the LIOS-Lite build decision.

---

## 1. The chain

```
Advisor Operating System (this directory — the conversational intelligence content)
        │  becomes the content of …
        ▼
Prompt Operating System (docs/lios-prompt-operating-system) — Layers 3, 5, 6, 7
        │  composed at runtime by …
        ▼
LIOS Runtime (docs/lios-runtime-blueprint) — the prompt composition engine + the wrapped advisor
        │  inherited by …
        ▼
Future multi-agent execution (the Decision Engine, Discovery Analyst — LIOS-Lite)
```

The AOS is **not** a new runtime. It is the _elite-behavior content_ that the already-planned LIOS machinery
carries. This is why it is "part of the foundation, not a shortcut": it slots into layers that LIOS already
defines.

## 2. AOS → Prompt OS (where each framework lands)

| AOS framework                                            | Prompt-OS home                                 | What it contributes                                               |
| -------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `ADVISOR_REASONING_FRAMEWORK` (reason-before-asking)     | Layer 3 (Advisor subsystem prompt)             | the 8-step internal pass + "frame then one question"              |
| `ADVISOR_DECISION_FRAMEWORK` (frame, never decide)       | Layer 3 + Layer 6 (task) + the Decision Engine | the decision frame + sensitivity ("what would change the answer") |
| `ADVISOR_DISCOVERY_FRAMEWORK`                            | Layer 3 + the Discovery Analyst                | advisor-led discovery; kill vision-deflection                     |
| `ADVISOR_TRADEOFF_FRAMEWORK`                             | Layer 3 (reasoning step 5)                     | the 6 tensions + compliant framing                                |
| `ADVISOR_QUESTION_FRAMEWORK` (5 levels, 130 examples)    | Layer 3 (question craft)                       | default to Level 4–5                                              |
| `ADVISOR_VOICE_GUIDE`                                    | Layer 2/3 (extends `STYLE_GUIDE`)              | voice, presence, anti-formulaic                                   |
| `ADVISOR_CONTEXT_FRAMEWORK` + `ADVISOR_MEMORY_FRAMEWORK` | Layer 7 (runtime context) + the Memory runtime | thread session specifics forward (the "stop starting over" fix)   |
| `ADVISOR_CONVERSATION_PATTERNS`                          | Layer 6 (per-task)                             | per-scenario playbooks                                            |
| `ADVISOR_EVALUATION_FRAMEWORK`                           | the eval harnesses + metrics                   | scoring the conversational layer                                  |

**Net: the AOS is overwhelmingly Prompt-OS Layer 3 + Layer 7 content** — exactly the "cheap layer" the LIOS
simulation identified as where the value lives, and exactly the [P]/[C] root causes the Excellence Program's
gap report identified (~20 of 25 gaps).

## 3. AOS → LIOS runtime (how it ships, reusing the planned machinery)

From the runtime blueprint, all behavior-preserving + flag-gated:

1. **Prompt Composition Engine** (already planned) composes the AOS-enriched Layer 3/5/6/7 into the advisor's
   system prompt — first proving the composed prompt reproduces today's behavior, then upgrading it with the
   reasoning/decision/voice content.
2. **Context/Memory runtime** (the `ADVISOR_CONTEXT/MEMORY_FRAMEWORK`) threads session specifics into the
   bounded context (Layer 7). This is the one piece that is _context-layer_, not prompt-layer — and the
   single highest-leverage change (fixes "starts over").
3. The **wrapped advisor** runs the enriched prompt; **Compliance still gates every output** unchanged.
4. **Telemetry** scores the new conversational dimensions (`ADVISOR_EVALUATION_FRAMEWORK`) on the live
   `advisor_turns` sink.

No multi-agent runtime is required for the AOS to land on the single advisor — which is the recommended
sequence (improve the advisor first; the LIOS simulation + Excellence Program agree).

## 4. AOS → future multi-agent (how it scales)

Every LIOS conversational surface **inherits the AOS exactly as it inherits the Constitution**:

- **Onboarding** = the Advisor specialized; inherits the full AOS.
- **Relationship Manager's safe-text** = the deterministic floor, written to the AOS voice.
- **Decision Engine** (LIOS-Lite merged decision agent) = implements `ADVISOR_DECISION_FRAMEWORK` over the
  deterministic tools.
- **Discovery Analyst** (merged Goal-Discovery + Goal-Conflict + Missing-Data) = implements
  `ADVISOR_DISCOVERY_FRAMEWORK` + `ADVISOR_TRADEOFF_FRAMEWORK`.
- Any domain agent that addresses the user speaks in the AOS voice + reasoning.

Because the AOS is shared content (like the Constitution), elite conversational intelligence is **uniform
across all current and future agents** — author once, inherited everywhere.

## 5. Recommended build sequence (design-level, gated)

```
1. Prompt Composition Engine reproduces today's advisor (behavior-identical)        [zero change]
2. Context/Memory runtime threads session specifics (the "stop starting over" fix)  [P0-2]
3. Enrich Layer 3 with reasoning + decision + question + voice content              [P0-1/3/4]
4. Score the conversational dimensions on the live harnesses (trust + fallback = 0) [gate]
5. (Later, gated on coverage) the Decision Engine + Discovery Analyst inherit the AOS
```

Steps 1–4 are the Advisor Excellence roadmap's P0 — on the existing single advisor, flag-gated, eval-gated.
Step 5 is LIOS-Lite, gated on the coverage measurement.

## 6. What this does NOT require

No Vertex, no Claude, no multi-agent runtime, no new infrastructure for steps 1–4. The trust spine, the
deterministic engines, RecommendationOS, the telemetry sink — all reused. The AOS is the conversational
_content_ that makes the existing, trustworthy machine _elite_.

## 7. Invariants

1. The AOS lands as Prompt-OS Layer 3/5/6/7 + context/memory runtime content — additive, behavior-preserving
   until proven.
2. Compliance gates every output, unchanged; trust + fallback must stay at 0 through every step.
3. Inherited uniformly by every conversational agent (author once).
4. Numbers from tools/the user; relationships cited; one question; no advice — always.
