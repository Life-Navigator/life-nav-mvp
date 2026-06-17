# LIOS Runtime Blueprint — Compliance Runtime

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.**
> This doc maps the _live_ deterministic compliance gate to its LIOS future, and proves the path
> **preserves every trust guarantee**. Anchored to the real code: `advisor_validator.py:validate`
> (the LIVE deterministic gate) and `advisor_orchestrator.py:_enhance` (the LIVE caller).
> Paths are relative to `apps/lifenavigator-core-api/` unless noted. Builds on `CURRENT_STATE_AUDIT.md`,
> `ORCHESTRATOR_IMPLEMENTATION_PLAN.md` (phases 8–9), `docs/lios-execution-architecture/COMPLIANCE_PIPELINE.md`,
> and `COMPLIANCE_AND_SAFETY_FLOW.md`.

---

## 1. The path (current → future → optional LLM-assist → user)

```
LLM proposal
   ↓
[TIER 1] DETERMINISTIC VALIDATOR  (LIVE today)        app/services/advisor_validator.py:validate
   · advice/medical/legal/tax boundary  (_ADVICE)
   · allowed-numbers anti-fabrication   (_financial_numbers vs context.allowed_numbers)
   · citation contract / real-edge      (_check_relationships)
   · malformed / empty reject
   · persistence lock + in-gate repairs (should_persist=False, multi-question trim, drop rejected goals)
   ↓ returns (ok, safe_result, reasons)  ← AUTHORITATIVE, pure, no LLM, no IO
   │
   ├── FUTURE: same function, same rules, EXTENDED (more domains/turn-types, same hard rules)
   │
   ↓
[TIER 2] COMPLIANCE AGENT  (LLM-assist, OPTIONAL, NEW — flag COMPLIANCE_AGENT_ENABLED, default off)
   · may surface extra unsupported/unsafe claims, caveats, sensitive-data flags the rules didn't enumerate
   · CAN ONLY TIGHTEN the verdict (approve→caveats→repair→blocked); NEVER loosen
   · on disagreement with Tier 1 → DETERMINISTIC WINS
   ↓ merged verdict (deterministic floor, possibly escalated)
   ↓
RESPONSE COMPOSER (renders validated content only)   app/services/advisor_orchestrator.py:_compose
   ↓
user
```

**One rule everything serves:** Compliance is mandatory and unbypassable before any user-facing text.
There is no path from an LLM proposal to `_compose` that skips `validate`. This is already true in the live
code: `_enhance` calls `validate(out, context)` (line 139) and only reaches `_compose(safe)` (line 146) when
`ok` is True. The LIOS future preserves that exact ordering.

---

## 2. Where it lives today · what owns it · what changes · what must NOT

| Concern                     | Where today                                                                                            | What owns it                                           | What must change for LIOS                                                                  | What must NOT change                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Deterministic gate          | `advisor_validator.py:validate` (line 135)                                                             | the pure `validate(result, context)` function          | extended to more domains/turn-types behind the same contract; emit a richer verdict object | every existing rule + both carve-outs; pure/no-IO; authoritative  |
| Advice boundary             | `_ADVICE` regex (line 64) + check (line 148)                                                           | the regex + the carve-outs (`(?<!much )(?<!whether )`) | add domain directive patterns ONLY by adding, never removing                               | the "much/whether" reflection carve-out; no directive advice      |
| Anti-fabrication (numbers)  | `_financial_numbers` (line 82) vs `context.allowed_numbers` (line 153)                                 | the allowed-numbers set on `AdvisorContext`            | extend `allowed_numbers` sourcing (tool traces, domain summaries)                          | a financial number not in `allowed_numbers` is still rejected     |
| Citation contract           | `_check_relationships` (line 107), `_pair_supported` (line 89), `_asserts_goal_relationship` (line 40) | the real-edge requirement + generic-language carve-out | extend to cross-domain edges                                                               | no goal-to-goal claim without a real cited edge; carve-out (a)(b) |
| Persistence lock            | line 173 `safe["should_persist"]=False`; rejected-goal drop (line 184); source filter (line 192)       | the validator (accept-path)                            | none                                                                                       | the LLM never persists; never resurrect a rejected goal           |
| In-gate repairs             | multi-question trim (line 177, `_first_question` line 75)                                              | the validator                                          | add new deterministic repairs (content-preserving only)                                    | repairs must not weaken a rule; they consume NO loop attempt      |
| The caller / gate placement | `advisor_orchestrator.py:_enhance` line 139–146                                                        | the orchestrator                                       | wrap as a stage; route repair instructions; add Tier 2 call                                | `validate` runs before `_compose`, always                         |
| LLM-assist (Tier 2)         | — (does not exist)                                                                                     | —                                                      | **NEW** `compliance_agent.py`; tighten-only                                                | n/a                                                               |

---

## 3. Live accept/repair/reject → COMPLIANCE_OUTPUT_SCHEMA verdicts (mapping table)

`validate` returns `(ok: bool, safe_result: dict, reasons: list[str])`, plus `safe["_repairs"]` on the
accept path. The LIOS schema (`docs/lios-prompt-operating-system/schemas/COMPLIANCE_OUTPUT_SCHEMA.md`,
Layer 8) emits four statuses. They map one-to-one — **no behavior change, only a richer label**:

| Live `validate` result                                                    | Telemetry today (`_enhance`)                                     | LIOS schema status                                                                  | Meaning                                                 | Next                                      |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `ok=True`, `_repairs == []`                                               | `validator_result = "accepted"` (line 160)                       | `approved`                                                                          | safe + grounded, no fix needed                          | → Composer                                |
| `ok=True`, `_repairs != []` (e.g. `multi_question_trimmed`)               | `validator_result = "repaired"` (line 160)                       | `approved_with_caveats` _(in-gate deterministic repair applied; content preserved)_ | safe; deterministic fix already applied inside the gate | → Composer (repairs/caveats travel along) |
| _(future)_ `require_repair` — needs new content the gate can't synthesize | (not emitted today)                                              | `require_repair`                                                                    | salvageable only by re-author                           | → repair loop (§5), cap N=2               |
| `ok=False` (any `reasons`)                                                | `validator_result = "rejected"`, `fallback_used=True` (line 143) | `blocked`                                                                           | hard violation, unrepairable                            | → deterministic fallback + Audit          |

Today there is no `require_repair` re-author loop — the live gate either accepts (with in-gate deterministic
repair) or rejects to the deterministic fallback. The LIOS `require_repair` status is **additive**: it covers
the case where the violation needs _new_ content (e.g. an unsupported claim that must be re-grounded), which
the deterministic gate cannot synthesize. `risk_level ∈ {low, medium, high, regulated}` is stamped on every
verdict; `regulated` forces caveats on approval and is one of the Critic triggers (see `CRITIC_RUNTIME.md`).

**Carve-outs preserved verbatim** (these are LIVE and MUST NOT change):

- (a) "connects to your vision/goals" generic language is **not** a graph claim — `_asserts_goal_relationship`
  requires two named goals or `goal_words >= 2` (line 55) before it fires.
- (b) reflecting the user's own "how much should I…" wording is **not** advice — the `(?<!much )(?<!whether )`
  negative lookbehinds in `_ADVICE` (line 65) let reflection pass while still catching genuine directives.

---

## 4. Tier 2 LLM-assist — tightens only, deterministic wins on disagreement

The Compliance Agent (Tier 2) is **optional, additive, and subordinate**. Its only job is to catch unsafe
claims the enumerated rules didn't anticipate. The merge rule is one-directional:

```
det = validate(out, context)             # Tier 1 — authoritative
llm = compliance_agent.review(out, ...)  # Tier 2 — advisory (NEW, flagged)

final_status = max(det.status, llm.status, key=STRICTNESS)   # can only get STRICTER
#   STRICTNESS:  approved < approved_with_caveats < require_repair < blocked
#   det.required_caveats  ∪  llm.required_caveats             # caveats union (never drop a caveat)
```

Hard guarantees (mirror `COMPLIANCE_PIPELINE.md` §2 + Invariant 2):

- If Tier 1 says `blocked` (`ok=False`), **no LLM review can rescue it** — `final = blocked`.
- Tier 2 may escalate `approved → require_repair` or `require_repair → blocked`, never the reverse.
- Tier 2 may **add** caveats/flags; it may never remove one Tier 1 attached.
- **On any disagreement, the deterministic verdict wins.** Tier 1 is law; Tier 2 is advisory.
- Tier 2 fails safe: if the LLM is unavailable/unparseable, the verdict is exactly Tier 1's (no degradation).
- Tier 2 is gated by `COMPLIANCE_AGENT_ENABLED` (default off). With the flag off, runtime == today exactly.

This is the lowest-risk shape: the live deterministic gate is unchanged and remains the floor; the LLM tier
can only make the system _more_ conservative, so it cannot introduce a trust regression by construction.

---

## 5. Repair loop + cap (N = 2) tie-in

Two repair kinds, per `COMPLIANCE_PIPELINE.md` §7:

1. **Deterministic in-gate repair (LIVE, no loop):** the gate fixes safe-but-over-broad output itself —
   `multi_question_trimmed` (line 177), drop rejected-matching goals (line 184), filter facts to
   `source == "user_message"` (line 192), force `should_persist=False` (line 173), keep only valid edge
   citations (line 195). These are content-preserving, applied **inside** `validate`, yield `accepted`/
   `repaired` immediately, and consume **zero** loop attempts. This is the fix that took the live fallback
   rate 17% → 0% **without weakening any rule**.

2. **Agent re-author (the loop, FUTURE):** when a violation needs new content (`require_repair`), the
   **Orchestrator** — never agent-to-agent — routes precise `repair_instructions` back to the originating
   agent, which re-runs and re-submits to `validate`.

```
   author → validate → require_repair (attempt n)
                 │ approved/_with_caveats → Composer
                 │ blocked                → deterministic fallback + Audit
                 └ require_repair: n < N(=2) ? re-author : fallback:repair_exhausted
   counter starts 0; each agent re-author increments; in-gate deterministic repairs do NOT increment.
```

**Cap N = 2.** After the second failed re-review → deterministic fallback (`fallback:repair_exhausted`) +
Audit flag. The cap guarantees termination (the call graph stays acyclic and bounded). The live code already
embodies the terminal floor: on `not ok`, `_enhance` sets `base["llm_status"] = "fallback:..."` and the
deterministic `RelationshipManager` text from `_rm.converse` (line 180/204) is what the user sees.

---

## 6. Blocking conditions (→ deterministic fallback, never looped)

These are the live `ok=False` rejects (and their LIOS `blocked` equivalents):

- regulated directive — `_ADVICE` match (advice/medical/legal/tax) → reason "contains advice/recommendation…"
- invented number — a financial-looking number not in `context.allowed_numbers` (line 153)
- unsupported relationship — a cited pair not in `context.connected_pairs`, or a relationship asserted with
  no real edge / when the user has no edges (`_check_relationships`)
- malformed — `result` is not a dict (line 138)
- empty turn — no `next_question` and no `summary` (line 159)
- _(future, additive)_ sensitive-data / cross-tenant exposure flags

On any of these, `validate` returns `ok=False` and the user gets the deterministic safe text. No repair loop.

---

## 7. MUST NOT CHANGE (hard guarantees for the build)

1. **Every existing validator rule stays** — advice boundary, allowed-numbers, citation contract,
   malformed/empty reject, persistence lock — exactly as in `advisor_validator.py`.
2. **Both carve-outs stay** — generic vision language is not a graph claim; reflecting the user's own
   "should I…" wording is not advice. No blanket relaxation; any loosening must be surgical + tested
   (`COMPLIANCE_AND_SAFETY_FLOW.md` §8).
3. **The deterministic gate stays AUTHORITATIVE.** Tier 2 LLM-assist only tightens; deterministic wins on
   disagreement; Tier 2 failing is a no-op, not a downgrade.
4. **Compliance is mandatory before the user** — no path from an LLM proposal to `_compose` skips `validate`.
5. **The LLM never persists / is never the source of truth** (`should_persist=False`, line 173).
6. **No rule is ever weakened to make output pass** — re-author, repair, or fall back; never relax the gate.
7. **Telemetry stays non-blocking + metadata-only** (the `validator_result`/`validator_reason`/
   `validator_repairs`/`fallback_*` fields in `_finish`, lines 223–229; content only in the RLS table).

> Bottom line: the live `advisor_validator.validate` already IS the deterministic compliance floor. LIOS
> keeps it byte-for-byte authoritative, relabels its three outcomes onto the four-status schema, adds an
> optional tighten-only LLM tier behind a flag, and adds a bounded (N=2) re-author loop for the one case the
> gate cannot self-fix. Every trust guarantee is preserved by construction.
