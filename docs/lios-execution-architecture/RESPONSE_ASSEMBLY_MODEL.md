# LIOS Response Assembly Model (stage [10])

> **Design/spec only — no code, no Gemini wiring, no runtime, no Vertex, no beta.** This describes how
> validated findings become the user-facing response: how the Response Composer assembles, what structure it
> emits, how deterministic outcomes and validated LLM text merge, the streaming variant, and honest-empty
> handling. Derived from `docs/lios-execution-architecture/EXECUTION_ARCHITECTURE.md` (stage [10]),
> `docs/lios-execution-architecture/EXECUTION_STATE_MACHINE.md`, `COMPLIANCE_AND_SAFETY_FLOW.md`,
> `docs/lios-agent-specifications/RESPONSE_COMPOSER_AGENT.md`, `docs/lios-agent-specifications/COMPLIANCE_AGENT.md`,
> `docs/lios-agent-specifications/CRITIC_AGENT.md`, and
> `docs/lios-prompt-operating-system/schemas/RESPONSE_COMPOSER_SCHEMA.md` (response-composer-schema-1.0).

---

## 1. The one rule

**No raw agent output reaches users.** Only the Response Composer renders to the surface, and only
**already-validated** content (Compliance `approved` / `approved_with_caveats`, post-Critic). The Composer is
a **renderer, not a reasoner**: it merges _language only_ and adds **no claim, no number, no recommendation,
no relationship, no provenance** that was not already validated upstream. Everything load-bearing is owned and
validated before [10]; the Composer changes wording, never substance. It faces the user only via the
Orchestrator.

```
   validated content (from Compliance, via Orchestrator)
            │   ── adds NOTHING substantive ──▶  language merge only
            ▼
   RESPONSE COMPOSER (deterministic)  ──▶  assistant_message + display-only fields  ──▶  user
            ▲
   deterministic outcomes (goals, panels, structured results)  passed through byte-for-byte
```

---

## 2. What the Composer merges (and what it must not touch)

| Source                                          | How it enters the response                           | Composer may…                                    |
| ----------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Validated LLM text (reflection, why, question)  | merged into readable prose (`assistant_message`)     | change **language only**                         |
| Deterministic outcomes (goals, panels, numbers) | passed through byte-for-byte (`structured_outcomes`) | reformat for display (locale) — values unchanged |
| Inherited evidence / citations / provenance     | echoed display-only                                  | display; never mint                              |
| Required caveats (from `approved_with_caveats`) | attached verbatim to the rendered output             | attach; never drop                               |

**Only the language changes; every structured / persisted outcome is deterministic.** The Composer never
reintroduces anything Compliance dropped or repaired (a trimmed extra question, a dropped uncited
relationship), never restores a claim the Critic refuted, and never persists.

---

## 3. The assembled response structure (every part traceable)

The user-facing response is a structured object whose every part carries provenance and is traceable back to a
deterministic outcome or a validated, cited finding. Each part is display-only at [10] — produced and
validated upstream, never minted here.

```
ASSEMBLED RESPONSE
├── evidence …………… the facts/numbers the response rests on   → provenance: source (user data / tool trace)
├── assumptions ……… what was assumed to reason               → provenance: stated, not silent
├── missing data …… inputs that were needed but absent       → provenance: ranked echo of upstream missing_data[]
├── confidence ……… inherited upstream confidence (not minted)→ provenance: the asserting agent's components
├── tradeoffs ……… framed options from Conflict Resolution    → provenance: which agents disagreed, reconciled
├── recommendations  evidence-backed recs ONLY (post-Critic)  → provenance: cited evidence + edges, labeled
├── next actions …… concrete, safe next steps                 → provenance: derived from validated findings
└── caveats ……… required regulatory/safety caveats           → provenance: Compliance required_caveats[]
```

Mapping to `RESPONSE_COMPOSER_SCHEMA` (`payload`):

```json
{
  "assistant_message": "<language merged from validated content only>",
  "display_only_fields": {
    "structured_outcomes": {},
    "single_question": "",
    "formatting": {},
    "missing_data": [{ "field": "", "why_it_matters": "", "rank": 1 }],
    "relationships_referenced": [{ "from": "", "to": "", "rel": "" }]
  }
}
```

- `evidence`, `recommendations`, `tradeoffs`, `confidence` are inherited (in `structured_outcomes` /
  envelope), **never minted at [10]**.
- `missing_data` and `relationships_referenced` are **display-only echoes** of upstream-validated content —
  shown only if already produced and validated.
- `assistant_message` is language assembled from the validated `safe_payload` only.

---

## 4. Merge contract: deterministic outcomes + validated LLM text

```
   ┌─────────────────────────────┐        ┌──────────────────────────────────┐
   │ DETERMINISTIC OUTCOMES       │        │ VALIDATED LLM TEXT                │
   │ goals · panels · numbers ·   │        │ reflection · why · single        │
   │ tradeoffs · recommendations  │        │ question  (post-Compliance)       │
   │ (authoritative, persisted)   │        │ language only                     │
   └──────────────┬──────────────┘        └─────────────────┬────────────────┘
                  │  pass through byte-for-byte               │  merge into prose
                  └───────────────────┬───────────────────────┘
                                      ▼
                       RESPONSE COMPOSER (deterministic)
                       · enforce single question
                       · balance quotes (non-semantic)
                       · attach required caveats
                       · reformat numbers for locale (values unchanged)
                                      ▼
                       assistant_message + display_only_fields
```

**Rule:** structured and persisted outcomes are deterministic and authoritative; the Composer only changes the
_prose around them_. Same input ⇒ byte-identical output. If the prose and a structured outcome ever appear to
disagree, the structured deterministic outcome is the truth (the Composer cannot have introduced a new number).

---

## 5. Streaming variant (fast ACK first, validated FINAL second)

Two phases reach the surface; only the second carries any validated claim:

```
   t0  USER MESSAGE
        │
        ▼
   [0] DETERMINISTIC TURN ──▶  ACK (stream immediately)
        │                      · safe, deterministic, no LLM claim
        │                      · "Looking at your <domain> picture…" / confirmable outcomes
        │                      · already true — needs no Compliance for claims it makes
        ▼
   [1..9] LLM agents + Critic? + Compliance + repair loop
        │
        ▼
   [10] RESPONSE COMPOSER ──▶  FINAL (stream/replace)
                                · validated content only
                                · replaces/augments the ACK, never contradicts it
```

- The **ACK is the deterministic floor**, streamable instantly because it makes no LLM-authored claim.
- The **FINAL** is emitted only after Compliance; it contains the validated prose + outcomes.
- The FINAL must never contradict the ACK (both rest on the same deterministic outcomes). If the LLM path
  fails, blocks, or exhausts repair, the ACK/floor **is** the final response (`fallback_safe`) — the user
  still gets a complete, truthful answer.

---

## 6. Honest-empty handling (never a fabricated number/%)

When the data is insufficient to reason, the response **says so** — it never invents a number, percentage,
risk, opportunity, goal, or relationship to fill space.

| Situation                           | What the response does                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Required input missing              | name it via `missing_data[]` ("to estimate X I need Y") — no guessed value |
| No evidence for a recommendation    | no recommendation rendered (evidence-or-nothing)                           |
| No real edge for a relationship     | no relationship claim rendered                                             |
| High-stakes claim refuted by Critic | claim dropped; safe lower-confidence response                              |
| Nothing valid to render at all      | Composer renders nothing → Orchestrator serves the deterministic floor     |

The Composer never fabricates filler to cover absence. **Absence → say-so or fallback, never invention.** A
"$0" or "unknown" stated honestly is correct; a fabricated figure is a safety violation.

---

## 7. Stage [10] contract

| Aspect            | Detail                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs            | the validated `safe_payload` (Compliance `approved`/`approved_with_caveats`); deterministic structured outcomes; display formatting hints; required caveats |
| Outputs           | `assistant_message` + `display_only_fields` (per `RESPONSE_COMPOSER_SCHEMA`)                                                                                |
| Determinism       | fully deterministic — no LLM, no DB, no calculation; same input ⇒ byte-identical output                                                                     |
| Adds              | language and non-semantic cleanup only — **no claim/number/recommendation/relationship/provenance**                                                         |
| Confidence        | none asserted (`na_components` = all); inherits and may display upstream confidence                                                                         |
| Failure state     | `blocked` (nothing valid to render) → Orchestrator uses the deterministic floor; never invents filler                                                       |
| Turn-level effect | `success` → turn `completed_governed`; `blocked`/empty → turn `fallback_safe`                                                                               |
| Observability     | `compose` event                                                                                                                                             |

---

## 8. Tie-in to the execution state machine

The Composer is terminal (it does not escalate). Its result sets the turn-level state in
`EXECUTION_STATE_MACHINE.md`:

- `success` (assembled validated content, outcomes preserved) → turn `completed_governed`.
- `blocked` / empty validated payload → Orchestrator serves the deterministic floor → turn `fallback_safe`.

A turn never ends in user-visible `failed`: either governed-and-validated content renders, or the deterministic
floor answers.

---

## 9. Invariants

1. No raw agent output reaches the user — only the Composer renders, only post-Compliance content.
2. The Composer adds no claim, number, recommendation, relationship, or provenance; language changes only.
3. Structured / persisted outcomes are deterministic and authoritative; prose is merged around them, never over them.
4. Every part of the response (evidence · assumptions · missing data · confidence · tradeoffs · recommendations · next actions · caveats) is traceable to a validated upstream source.
5. Streaming: deterministic ACK first (no LLM claim), validated FINAL second; FINAL never contradicts ACK; floor is the fallback FINAL.
6. Honest-empty: insufficient data → say so / fallback; never a fabricated number or percentage.
7. The Composer asserts no confidence of its own; it inherits and may display upstream confidence.
8. Same input ⇒ byte-identical output; nothing Compliance dropped or the Critic refuted is ever reintroduced; faces the user only via the Orchestrator.
