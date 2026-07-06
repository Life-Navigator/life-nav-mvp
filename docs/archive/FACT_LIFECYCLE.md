# LIOS — Fact Lifecycle

> The complete lifecycle of a **fact** in LifeNavigator: every state, who owns each transition, the guard
> that must hold, and how it's observed. Validation review of the LIOS architecture against this lifecycle.
> Companion to `TRUTH_AND_PROVENANCE_MODEL.md`. Architecture review only — no code, no prompts.

A "fact" = a single atomic claim about the user (e.g. "savings = $60k", "has 2 children", "marginal tax
22%"). Goals, risks, recommendations, relationships, and decisions have their own lifecycle documents; this
one is the base from which they all draw.

---

## 1. States

| State        | Meaning                                                         | Persisted?        | May drive guidance?                    |
| ------------ | --------------------------------------------------------------- | ----------------- | -------------------------------------- |
| `proposed`   | offered by an LLM agent or an extractor; unverified             | no                | no                                     |
| `validated`  | passed Compliance (real source, allowed number, category-clean) | no (session)      | as a clearly-labeled candidate only    |
| `candidate`  | shown to the user / awaiting confirmation; usable in-session    | no                | as candidate                           |
| `confirmed`  | user confirmed, or on-record from a document/account            | **yes**           | yes                                    |
| `superseded` | replaced by a newer confirmed value                             | yes (history)     | no (the replacement does)              |
| `stale`      | confirmed but past its freshness window                         | yes               | yes, but flagged + re-confirm prompted |
| `rejected`   | the user declined/contradicted it                               | yes (tombstone)   | **never** (no resurrection)            |
| `retired`    | deleted on user request / retention policy                      | removed (audited) | no                                     |

---

## 2. State transitions

```
            propose            validate           confirm
  (source) ─────────▶ proposed ───────▶ validated ─────────▶ confirmed ──────┐
                          │ reject          │ fail              ▲   │          │ supersede
                          ▼                 ▼                   │   │ age      ▼
                       dropped           dropped          candidate│   ▼     superseded
                                                          (in-session│  stale ──re-confirm──▶ confirmed
                                            user declines │          │
                                                          ▼          │ user retires
                                                       rejected      ▼
                                                     (tombstone)   retired
```

| Transition                         | Trigger                            | Owning agent                                                    | Guard (must hold)                                | Provenance set                 |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ | ------------------------------ |
| → `proposed`                       | user message / extraction          | Advisor · Goal Discovery · Document Intelligence                | has a declared source                            | source + confidence            |
| `proposed` → `validated`           | post-generation gate               | **Compliance**                                                  | real source, allowed number, no category merge   | unchanged                      |
| `proposed`/`validated` → `dropped` | gate fail                          | Compliance                                                      | —                                                | logged reason                  |
| `validated` → `candidate`          | shown to user / in-session use     | Orchestrator · Memory/Context                                   | category = candidate (never shown as confirmed)  | candidate                      |
| `candidate` → `confirmed`          | user confirms (or on-record)       | **RelationshipManager / domain writer** (approved writers only) | explicit confirmation or document/account source | `user_confirmed` / `on_record` |
| `candidate` → `rejected`           | user declines/contradicts          | RelationshipManager                                             | record tombstone                                 | `user_rejected`                |
| `confirmed` → `superseded`         | newer confirmed value for same key | approved writer                                                 | keep history; one current value                  | new value's provenance         |
| `confirmed` → `stale`              | freshness window elapsed           | Missing Data / freshness rule                                   | time-based                                       | adds `stale_since`             |
| `stale` → `confirmed`              | user re-confirms                   | RelationshipManager                                             | re-confirmation                                  | refreshed `updated_at`         |
| any → `retired`                    | user delete / retention            | domain writer + Audit                                           | user-authorized / policy                         | removal audited                |

**Invariant:** only the **approved writers** perform `candidate → confirmed/rejected/superseded/retired`.
The LLM only ever performs `→ proposed`.

---

## 3. Conflicts & updates

- **Same key, new value:** the new confirmed value supersedes; the old becomes `superseded` (kept for
  history + provenance, not shown as current).
- **User contradicts a confirmed fact:** treated as a new confirmation that supersedes; the contradiction is
  itself a `user_stated` event.
- **Document vs user disagreement** (e.g. statement says $X, user says $Y): both are kept with their
  provenance; the system surfaces the discrepancy and asks which is current — it never silently picks.
- **Candidate that matches a rejected fact/goal:** suppressed by Compliance (no resurrection).

---

## 4. Freshness & decay

Different facts decay at different rates (the freshness window is a per-fact-type property):

- Volatile (account balances, prices): short window → mark `stale` quickly, prompt re-sync.
- Stable (number of children, degree held): effectively non-decaying.
- Domain summaries already carry a `freshness` field; LIOS extends per-fact freshness so the Life Model can
  flag stale inputs rather than present them as current.

Stale facts are still usable but are **flagged** and trigger a Missing-Data nudge to re-confirm; they are
never silently treated as fresh.

---

## 5. Observability

Every transition is auditable:

- `proposed/validated/dropped` → the per-turn telemetry (validator_result, reasons, dropped facts).
- `confirmed/rejected/superseded/retired` → a write with provenance + timestamp on the truth row.
- "Why does the system believe X?" must be answerable from provenance + the confirming event.

---

## 6. Invariants (fact-specific)

1. The LLM may only create `proposed` facts; it never confirms, supersedes, or retires.
2. A `candidate` is never rendered as `confirmed` (category + provenance separation).
3. A `rejected` fact is never resurfaced as a candidate.
4. Every `confirmed` fact has a provenance, a source, a confidence, and an `updated_at`.
5. Numbers usable in conversation must be the user's own (allowed-numbers) even at the `candidate` stage.
6. Supersession keeps history; the current value is unambiguous (exactly one current per key).
7. Deletion is user-authorized (or policy) and audited.

---

## 7. Failure / escalation

| Failure                      | Handling                                                               |
| ---------------------------- | ---------------------------------------------------------------------- |
| Extraction low-confidence    | enters as `candidate`, not `confirmed`; requires confirmation          |
| Confirmation write fails     | fact stays `candidate`; surfaced for retry; never silently "confirmed" |
| Conflicting confirmed values | surface discrepancy + ask; do not auto-pick                            |
| Stale critical input         | flag + Missing-Data nudge; guidance notes the staleness                |

---

## 8. Validation review — does the current architecture satisfy this?

| Lifecycle requirement                       | Today                                                                         | Verdict / gap                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| LLM proposes only; approved writers confirm | live (validator forces `should_persist=false`; RM persists)                   | ✅ holds                                                                                           |
| Category separation (candidate ≠ confirmed) | live (advisor context buckets; validator)                                     | ✅ holds                                                                                           |
| Rejected never resurrected                  | live (validator drops rejected-matching candidates)                           | ✅ holds                                                                                           |
| Provenance on confirmed facts               | partial (provenance on Life Model objective; some derived in API, not stored) | ⚠️ **gap: first-class `provenance_type/source/confidence/updated_at` columns on all truth tables** |
| Supersession with history                   | partial (writes update; explicit history/versioning not uniform)              | ⚠️ **gap: a uniform fact-history/versioning model**                                                |
| Per-fact freshness/decay                    | partial (domain `freshness` exists; per-fact staleness not modeled)           | ⚠️ **gap: per-fact-type freshness windows + stale flagging**                                       |
| Document↔user conflict surfacing            | partial                                                                       | ⚠️ **gap: an explicit discrepancy-resolution flow**                                                |
| Retire/delete + audit                       | partial (RLS + deletes exist; lifecycle not formalized)                       | ⚠️ **gap: a formal retire path + retention policy**                                                |

**Open questions for the build phase:**

1. Where do freshness windows live — per fact type config, or per domain?
2. Is supersession history needed for all facts or only financial/decision-relevant ones?
3. What is the canonical "fact" table shape vs. domain-specific tables (a unified truth ledger vs. per-domain
   rows with shared provenance columns)?

---

## 9. Live vs planned

- **Live:** propose→validate→candidate→confirm/reject; no-resurrection; allowed-numbers at candidate stage;
  provenance on the Life Model objective.
- **Planned:** first-class provenance columns everywhere; uniform supersession/history; per-fact freshness +
  stale flagging; discrepancy-resolution flow; formal retire/retention.
