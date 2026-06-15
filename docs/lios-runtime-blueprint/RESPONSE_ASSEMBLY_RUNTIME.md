# LIOS Runtime Blueprint — Response Assembly Runtime

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.**
> This doc shows how agent outputs + tool results + GraphRAG evidence + recommendations + the compliance
> verdict become **one** user-facing response, starting from the LIVE composer `advisor_orchestrator.py:_compose`
> (line 75) and the LIVE merge in `_enhance` (line 146–162) / streaming in `converse_stream` (line 188).
> Anchored to `docs/lios-execution-architecture/RESPONSE_ASSEMBLY_MODEL.md` (stage [10]),
> `COMPLIANCE_AND_SAFETY_FLOW.md`, and `CURRENT_STATE_AUDIT.md`. Paths relative to
> `apps/lifenavigator-core-api/` unless noted.

---

## 1. The one rule

**No raw agent output reaches users.** Only the Composer renders to the surface, and only **already-validated**
content (Compliance `approved` / `approved_with_caveats`, post-Critic). The Composer is a **renderer, not a
reasoner**: it merges _language only_ and adds **no claim, no number, no recommendation, no relationship, no
provenance** that was not validated upstream. This is already how the live code behaves — `_compose(safe)`
runs on the validator's `safe` result (the `validate(out, context)` output), never on the raw LLM `out`.

---

## 2. The live `_compose` (the starting point)

`advisor_orchestrator.py:_compose(safe)` (line 75) assembles the human-facing message from the **validated**
dict only:

```python
parts = []
refl = safe["reflection"]      → if present
s    = safe["summary"]         → if present (LLM chose to summarise)
q    = safe["next_question"]   → if present  (already trimmed to ONE question by validate)
why  = safe["why_this_question"] → only if q present
return " ".join(parts)
```

And the merge in `_enhance` (line 152–162) preserves the trust spine: **only the human-facing text changes**;
every deterministic outcome from `RelationshipManager.converse` (pending_key, candidate_goals, updates,
persistence) is left untouched. `missing_data` (line 156) and `relationships_referenced` (line 158, real cited
edges only) are attached **display-only — not persisted**. This is the LIOS Composer in miniature for the
single-agent path; LIOS generalizes it to multiple agents/tools/evidence under the same rules.

LIOS adds the contract that the live code already implicitly honors and one safety it doesn't yet enforce
structurally: `_compose` must consume **only** the post-Compliance `safe_payload`, never any agent's raw text.

---

## 3. From many sources to ONE response

```
   agent outputs ─┐
   tool results  ─┤   (deterministic calc + calculation_trace: decision_brain.py, tools.py, FinancialInputResolver)
   GraphRAG      ─┤   (real edges + citations: clients/neo4j_client*, qdrant*, advisor_context graph)
   recommendations┤   (evidence-or-nothing: recommendations_os.py:RecommendationOS.write)
   compliance     ┘   (verdict + required_caveats: advisor_validator.validate → §COMPLIANCE_RUNTIME)
        │
        ▼  Conflict Resolution → confidence propagation (framed tradeoffs, never verdicts)
        ▼  CRITIC? (high-stakes only) → drop refuted claims (see CRITIC_RUNTIME)
        ▼  COMPLIANCE (authoritative) → approved / approved_with_caveats only reach the Composer
        ▼
   RESPONSE COMPOSER (deterministic; the live _compose, generalized)
        · merge validated LLM language into prose
        · pass deterministic outcomes through byte-for-byte
        · attach required caveats verbatim
        · enforce single question; non-semantic cleanup; locale number format (values unchanged)
        ▼
   assistant_message + display_only_fields  →  user   (via the Orchestrator only)
```

The Composer **adds nothing substantive.** Everything load-bearing (evidence, numbers, recs, edges,
confidence, tradeoffs) is owned and validated _before_ [10]; the Composer changes wording, never substance.

---

## 4. The assembled response structure (every part traceable to provenance)

Per `RESPONSE_ASSEMBLY_MODEL.md` §3, each part is display-only at [10] — produced and validated upstream:

| Part                | Provenance source                                        | Live anchor / how it enters                                                          |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **evidence**        | user data / tool `calculation_trace`                     | tool results; `allowed_numbers` on `AdvisorContext`                                  |
| **assumptions**     | stated, not silent                                       | `safe.setdefault("assumptions", [])` (validator line 196)                            |
| **missing data**    | ranked echo of upstream `missing_data[]`                 | `base["missing_data"] = safe["missing_data"]` (orchestrator line 156) — display only |
| **confidence**      | inherited from the asserting agent (NOT minted at [10])  | future envelope; Composer asserts none of its own                                    |
| **tradeoffs**       | which agents disagreed, reconciled (Conflict Resolution) | future stage [6]; framed, never a verdict                                            |
| **recommendations** | cited evidence + edges, labeled (post-Critic)            | `RecommendationOS.write` evidence-or-nothing                                         |
| **next actions**    | derived from validated findings                          | composed from the validated payload                                                  |
| **caveats**         | Compliance `required_caveats[]`                          | attached verbatim; never dropped                                                     |

Mapping to `RESPONSE_COMPOSER_SCHEMA` (`payload`):

```json
{
  "assistant_message": "<language merged from validated content ONLY>",
  "display_only_fields": {
    "structured_outcomes": {}, // deterministic, passed through byte-for-byte
    "single_question": "", // already trimmed to one by validate (_first_question)
    "missing_data": [{ "field": "", "why_it_matters": "", "rank": 1 }],
    "relationships_referenced": [{ "from": "", "to": "", "rel": "" }], // real cited edges only
    "formatting": {}
  }
}
```

`evidence`, `recommendations`, `tradeoffs`, `confidence` are **inherited** (in `structured_outcomes` /
envelope), never minted at [10]. `missing_data` and `relationships_referenced` are **display-only echoes** of
upstream-validated content (exactly what `_enhance` does today at lines 156–159).

---

## 5. Merge contract: deterministic outcomes + validated LLM text (only language changes)

```
   DETERMINISTIC OUTCOMES                 VALIDATED LLM TEXT
   goals · panels · numbers ·             reflection · summary · ONE question · why
   tradeoffs · recommendations            (post-Compliance, language only)
   (authoritative, persisted by RM)
            │ pass through byte-for-byte           │ merge into prose
            └──────────────────┬───────────────────┘
                               ▼
                 RESPONSE COMPOSER (deterministic)
                 · enforce single question (validate already trimmed via _first_question)
                 · attach required caveats verbatim
                 · non-semantic cleanup; locale number format (values unchanged)
                               ▼
                 assistant_message + display_only_fields
```

**Rule:** structured/persisted outcomes are deterministic and authoritative; the Composer only changes the
_prose around them_. Same input ⇒ byte-identical output (fully deterministic — no LLM, no DB, no calc at [10]).
If prose and a structured outcome ever appear to disagree, **the structured deterministic outcome is the
truth** (the Composer cannot have introduced a new number). This is exactly the live invariant: `_enhance`
sets `base["assistant_message"] = composed` (line 153) but leaves all `base` outcomes from
`RelationshipManager` intact.

---

## 6. Streaming (ack/final) — the LIVE `converse_stream`

`converse_stream` (line 188) already implements the two-phase model `RESPONSE_ASSEMBLY_MODEL.md` §5 prescribes:

```
USER MESSAGE
   │
   ▼ [0] deterministic turn (RelationshipManager.converse, line 204)
   ├──▶ yield {"type":"ack", assistant_message: base.assistant_message, pending_key, turn_id}   (line 207)
   │      · safe, deterministic, NO LLM claim — streamable instantly (~1s)
   ▼ [1..9] _enhance: context → generate → (Critic?) → validate → compose  (line 210)
   └──▶ yield {"type":"final", **base}   (line 214)
          · validated content only; replaces/augments the ack, NEVER contradicts it
```

- The **ack is the deterministic floor**, streamable immediately because it makes no LLM-authored claim.
- The **final** is emitted only after Compliance; it carries the validated prose + outcomes.
- If the LLM path fails / blocks / exhausts repair, the ack/floor **is** the final (`fallback_safe`) — the
  user still gets a complete, truthful answer. (Live: on `not ok` or error, `_enhance` only sets
  `llm_status`; `base.assistant_message` stays the deterministic RM text, so `final` == the safe text.)

---

## 7. Honest-empty (never fabricate to fill space)

When data is insufficient, the response **says so** — it never invents a number/%/risk/opportunity/goal/edge:

- required input missing → name it via `missing_data[]` ("to estimate X I need Y"), no guessed value;
- no evidence for a rec → no rec rendered (evidence-or-nothing, `RecommendationOS`);
- no real edge → no relationship claim (validator `_check_relationships` already strips uncited edges);
- Critic-refuted high-stakes claim → dropped → safe lower-confidence response;
- nothing valid to render → Composer renders nothing → Orchestrator serves the deterministic floor.

A stated "$0" / "unknown" is correct; a fabricated figure is a safety violation. The live empty guard already
does this: `if not composed:` → `fallback:empty` (orchestrator line 148–150).

---

## 8. Where it lives · what owns it · what changes · what must NOT

| Concern             | Where today                                               | What owns it                       | What must change for LIOS                                                                                | What must NOT change                                                                               |
| ------------------- | --------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Composer            | `advisor_orchestrator.py:_compose` (line 75)              | the pure `_compose(safe)` function | generalize to multi-agent: assemble evidence/tradeoffs/recs/caveats sections from the validated envelope | renders validated content only; adds no claim/number/rec/edge/provenance; deterministic            |
| Merge               | `_enhance` lines 152–162                                  | the orchestrator                   | merge multiple agents' validated text + deterministic outcomes                                           | only language changes; deterministic outcomes pass through byte-for-byte; authoritative            |
| Display-only fields | `missing_data`/`relationships_referenced` (lines 156–159) | the orchestrator                   | add evidence/tradeoffs/confidence/next-actions as display-only echoes                                    | display only, not persisted; never minted at [10]                                                  |
| Streaming           | `converse_stream` ack/final (lines 207, 214)              | the orchestrator                   | final assembled from the multi-agent validated payload                                                   | ack = deterministic floor (no LLM claim); final never contradicts ack; floor is the fallback final |
| User boundary       | only `_compose` output reaches the proxy → user           | the orchestrator                   | preserve: only the Composer faces the user                                                               | no raw agent output ever reaches the user; faces user via Orchestrator only                        |
| Empty/honest-empty  | `if not composed → fallback:empty` (line 148)             | the orchestrator                   | extend to multi-source absence                                                                           | absence → say-so / fallback, never invention                                                       |

---

## 9. MUST NOT CHANGE

1. **Only the Composer faces the user** — and only with already-validated content (post-Compliance, post-Critic).
2. **Only language changes.** Deterministic/persisted outcomes pass through byte-for-byte and are
   authoritative; if prose and a structured outcome disagree, the structured outcome is the truth.
3. **No raw agent output reaches users** — the Composer consumes the validated `safe_payload`, never raw `out`.
4. **The Composer mints nothing** — no claim, number, recommendation, relationship, provenance, or confidence;
   it inherits and may display upstream confidence.
5. **Nothing dropped/repaired upstream is reintroduced** — a trimmed extra question, an uncited edge, or a
   Critic-refuted claim never comes back at [10].
6. **Streaming contract:** deterministic ack first (no LLM claim), validated final second; final never
   contradicts the ack; on failure the floor IS the final (`fallback_safe`).
7. **Same input ⇒ byte-identical output** (fully deterministic at [10] — no LLM, no DB, no calc).

> Bottom line: the live `_compose` + the `_enhance` merge + `converse_stream` ack/final already embody the
> LIOS Composer for one agent — validated text in, deterministic outcomes preserved, only language changed,
> ack-then-final streaming. LIOS generalizes the same renderer to many agents/tools/evidence under identical
> rules: assemble one traceable, provenance-carrying response from validated content only, and let the
> deterministic floor answer whenever there is nothing valid to render.
