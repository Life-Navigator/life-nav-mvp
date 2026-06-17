# LIOS Memory Architecture (Phase 3)

**Thesis.** LIOS owns the _durable life model_ — the long-lived memory of who the user is, what
they want, what's true, and how confident we are. Models (Gemini today, anything tomorrow) are
**replaceable workers** that read this memory to reason and propose, but never _are_ the memory.
The advisor LLM, by design, "never writes DB" — writes go through deterministic services
(`relationship_manager.py`, `life_discovery.py`) and a validator (`advisor_validator.py`). This
doc inventories what memory exists today, names the lifecycle every memory must support, and shows
the canonical record this layer is converging toward.

Status legend: **EXISTS** (persisted + used today) · **PARTIAL** (some storage/fields, lifecycle
incomplete) · **NEW** (not yet built; specified here).

---

## 1. Memory categories — where each lives today

| Category                             | Status  | Lives in (schema.table / module)                                                                                                                                                                                                                                            | Notes                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Facts**                            | PARTIAL | `life.life_vision`, domain CRUD (`family.*`, `career.*`, `education.*`, `health.*`, `finance.financial_accounts`); classified at read-time in `advisor_context.py` (`confirmed_facts` vs `candidate_facts` vs `assumptions` vs `missing_data`)                              | Facts are stored as domain rows, **not** as a uniform "fact" record. Classification is computed per-turn (`AdvisorContextBuilder._confirmed`), not persisted as a status on the row.                                                                                                         |
| **Preferences**                      | PARTIAL | `life.risk_profiles` (tolerance/capacity/behavior/horizon/loss_aversion); `life.life_vision.prompts` (free-form prompt state incl. `time_horizon`)                                                                                                                          | Risk preference is first-class; broader preferences ride in the `prompts` JSONB bag — untyped.                                                                                                                                                                                               |
| **Goals**                            | EXISTS  | `life.life_objectives` (the "need behind the need", `why_chain`, `confidence`, `status`, `themes`, `reasoning`), `life.goals` (goals hung off objectives), `life.candidate_goals` (accumulated-across-turns, `confidence`, `status` active/future_goal, `supporting_quote`) | Strongest category. `candidate_goals` is upserted by normalized text so nothing is lost or collapsed (`relationship_manager._persist_candidate_goals`).                                                                                                                                      |
| **Constraints**                      | EXISTS  | `life.constraints` (`label`, `kind`, `detail`, `severity`, `objective_id`)                                                                                                                                                                                                  | Written immediately on the discovery turn (`relationship_manager.answer`, `kind="stated"`).                                                                                                                                                                                                  |
| **Assumptions**                      | PARTIAL | Surfaced at read-time in `advisor_context.AdvisorContext.assumptions` and in recommendation payloads (`recommendations_os.py` `assumptions=[...]`, surfaced as yellow nodes in `decision_graph.py`/`life_graph_workspace.py`)                                               | Assumptions are **computed and displayed**, not stored as durable, supersedable records. The deterministic discovery engine asserts none (`assumptions=[]`); only the recommendation layer emits them.                                                                                       |
| **Life Events**                      | PARTIAL | `life.life_events` (`event_type`, `event_date`, `importance`, `dependencies` JSONB)                                                                                                                                                                                         | Table exists; not yet populated by a conversational/extraction path and not yet driving impact analysis (see GRAPH doc, "life-event impact analysis" = NEW).                                                                                                                                 |
| **Relationships (graph edges)**      | EXISTS  | `life.life_graph_edges` (`source_node`, `target_node`, `edge_type`, `domain`, `confidence`, `status`) + domain-hub edges computed in `life_discovery.personal_graph`                                                                                                        | Persisted edges + computed `part_of`/`supports` hub edges. `status` column already supports active/inactive — the seed of supersession.                                                                                                                                                      |
| **Decisions**                        | EXISTS  | `decision.*` schema (migrations 134/136), composed by `decision_graph.py` / `decision_workspace.py` into an explainable Documents→Analyses→Impacts→Tradeoffs→Recommendation→Readiness chain                                                                                 | Decision _workspaces_ are first-class; nodes cite their source rows.                                                                                                                                                                                                                         |
| **Scenarios**                        | EXISTS  | `scenario_tree.py` / `scenario_compare.py` (+ scenario lab RLS, migration 006)                                                                                                                                                                                              | Scenario trees and comparisons exist; not yet tied into the memory lifecycle (no supersession when a scenario is realized).                                                                                                                                                                  |
| **Recommendations**                  | EXISTS  | `recommendations.recommendations` table; `recommendations_os.py` (canonical engine — evidence-required, visible formula `Impact × Confidence × Urgency × Evidence ÷ Effort`, `confidence`, `assumptions`, `impacted_domains`, `evidence[].source_table`)                    | Best-instrumented memory for provenance + confidence. "No recommendation without evidence" is enforced (`recommendations_os.py` integrity check).                                                                                                                                            |
| **Documents**                        | EXISTS  | `documents.documents` (migrations 037/143/144/145/153) with `extracted_json`, `confidence`, `status` (incl. `needs_review`), `status_reason`, `doc_type` 26-type taxonomy                                                                                                   | Documents carry confidence + a review status — the closest existing analogue to the full lifecycle. Worker extracts fields → Document/DocumentField graph.                                                                                                                                   |
| **Professional Relationships**       | PARTIAL | `family.trusted_advisors`, `family.emergency_contacts`, `family.beneficiaries` (surfaced as graph nodes in `life_discovery.personal_graph`, family-office domain)                                                                                                           | Stored as family-office CRUD entities and graphed; not yet modeled as a distinct "professional relationship" memory with engagement/role lifecycle.                                                                                                                                          |
| **Cross-turn conversational memory** | EXISTS  | `analytics.advisor_turns` (migration 160): per-turn `user_message`, `advisor_response`, `llm_response_raw`, `confidence`, `graph_edges_available`, `relationships_referenced`, validator outcome, latency/cost                                                              | This is the **only** working "memory store" beyond the canonical model. `advisor_context.py` reads prior turns (`conversation_so_far`, last 6) so the advisor never "starts over". It is telemetry + working memory, **not** durable semantic memory — service-role only, no semantic index. |

**Key honest gap:** there is **no single `memory` table**. Memory today is _category-specific tables_
in the `life.*` (and domain) schemas plus the `advisor_turns` working log. Provenance and confidence
exist where they were needed most (goals, recommendations, documents) and are absent or implicit
elsewhere (facts, preferences, professional relationships).

---

## 2. The memory lifecycle every memory must support

A LIOS memory is not a row you write once. Each of the following must be a _first-class operation_:

| Lifecycle op           | What it means                                                                         | Status today                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Creation**           | A memory enters the model with a source.                                              | **EXISTS** — discovery writes immediately (`relationship_manager.answer` → `life.*`); worker/extraction writes documents; recommendation engine emits recs.                                                                                                                                                       |
| **Verification**       | An unconfirmed memory becomes confirmed (user said it / corroborated).                | **PARTIAL** — confirmation is _computed at read-time_ (`advisor_context._confirmed`, `my_life.py` `vision_confirmed`/`user_confirmed`), **not persisted** as a `verified_at` on the row.                                                                                                                          |
| **Revision**           | A memory's value changes; the old value is not silently lost.                         | **PARTIAL** — upserts overwrite (`life_vision`, `candidate_goals` on conflict). Revision _history_ is not kept.                                                                                                                                                                                                   |
| **Supersession**       | A new memory replaces an older one; the old one is retained as superseded.            | **PARTIAL** — `life.life_objectives.status` allows `superseded`/`archived`/`rejected`; `life.life_graph_edges.status` allows non-`active`. But no general supersession pointer (`superseded_by`) and most categories lack a status column.                                                                        |
| **Expiration**         | A memory has a validity window and stops being authoritative after it.                | **NEW** — no `expires_at` / TTL anywhere. Financial figures, life events, and offers all age, but nothing expires today.                                                                                                                                                                                          |
| **Confidence scoring** | Every memory carries a 0–1 confidence the reasoning layer respects.                   | **PARTIAL** — present on `life_objectives.confidence`, `life_graph_edges.confidence`, recommendations, documents, `candidate_goals.confidence`. **Absent** on constraints, risks/opps, life_events, preferences, facts.                                                                                           |
| **Provenance**         | Every memory knows _where it came from_ (user message / document / tool / inference). | **PARTIAL** — recommendations carry `evidence[].source_table`; graph nodes carry `table`+`record_id` lineage (`life_graph_workspace._map_node` → `dataUsed`); `my_life.py` emits a provenance type (`user_confirmed`/`user_stated`/`advisor_inferred`/`assumption`). Computed at read-time, not stored uniformly. |
| **Audit trail**        | We can answer "why did the advisor say/do this, and from what?".                      | **PARTIAL** — `analytics.advisor_turns` is a strong per-turn audit (raw LLM output, validator result/repairs, fallback reason, edges seen, tokens). Covers the _advisor_, not all memory mutations.                                                                                                               |

**Where it's genuinely solid:** creation, provenance-on-recommendations, confidence-on-graph-and-recs,
and the advisor audit trail. **Where it's PARTIAL/NEW:** a uniform `verified_at`/`superseded_by`,
expiration, confidence on the long tail of categories, and a memory-mutation (not just advisor-turn)
audit log.

---

## 3. The canonical LIOS memory record (target schema)

This is the record every category's row should _map onto_ (a view/adapter today; a real table later).
It is **NEW** as a uniform structure — but every field below already exists on _at least one_
existing table, so this is a unification, not an invention.

```sql
-- TARGET (NEW): a uniform memory envelope. Today this is satisfied piecemeal across life.*,
-- recommendations.recommendations, documents.documents, analytics.advisor_turns.
CREATE TABLE life.memory (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL,
  tenant_id     uuid NOT NULL,
  category      text NOT NULL,          -- Fact|Preference|Goal|Constraint|Assumption|LifeEvent|
                                        -- Relationship|Decision|Scenario|Recommendation|Document|ProfessionalRelationship
  domain        text,                   -- finance|career|education|health|family|estate|insurance|core
  value         jsonb NOT NULL,         -- the memory payload (label/text/structured)
  confidence    numeric,                -- 0..1  (EXISTS on objectives/edges/recs/docs/candidate_goals)
  source        text NOT NULL,          -- user_message | document:<type> | tool:<name> | inference | persona
  provenance    jsonb NOT NULL DEFAULT '{}',  -- {source_table, record_id, evidence:[...], quote}
  status        text NOT NULL DEFAULT 'active', -- active|candidate|confirmed|superseded|archived|rejected|expired
  superseded_by uuid,                   -- NEW: supersession pointer
  created_at    timestamptz NOT NULL DEFAULT now(),
  verified_at   timestamptz,            -- NEW: set when user/corroboration confirms
  superseded_at timestamptz,            -- NEW
  expires_at    timestamptz             -- NEW: validity window (e.g. financial snapshot, offer)
);
```

### How it maps onto what exists

| Envelope field        | `life.life_vision` / objectives   | `life.candidate_goals`      | `life.constraints` / risks / opps | `analytics.advisor_turns`            | `documents.documents`         | `recommendations.recommendations`          |
| --------------------- | --------------------------------- | --------------------------- | --------------------------------- | ------------------------------------ | ----------------------------- | ------------------------------------------ |
| `id`                  | EXISTS (`id` / `user_id` PK)      | EXISTS                      | EXISTS                            | `turn_id`                            | EXISTS                        | EXISTS                                     |
| `category`            | implicit (table = category)       | "Goal (candidate)"          | implicit                          | "ConversationTurn"                   | "Document"                    | "Recommendation"                           |
| `value`               | `title`/`vision_text`/`why_chain` | `goal_text`                 | `label`/`detail`                  | `user_message`/`advisor_response`    | `extracted_json`              | `title`/`description`/`recommended_action` |
| `confidence`          | EXISTS (`confidence`)             | EXISTS                      | **MISSING** (NEW)                 | EXISTS                               | EXISTS                        | EXISTS                                     |
| `source`              | "user_message" (computed)         | `objective_key`/quote       | "stated" (`kind`)                 | `llm_status`                         | `doc_type`                    | `evidence[].source_table`                  |
| `provenance`          | computed in `my_life.py`          | `supporting_quote`          | **thin** (NEW)                    | `relationships_referenced` + raw LLM | `confidence`/`status_reason`  | `evidence[]` (rich)                        |
| `status`              | EXISTS (active/superseded/…)      | EXISTS (active/future_goal) | **MISSING** (NEW)                 | `validator_result`                   | `status` (incl. needs_review) | implicit                                   |
| `verified_at`         | **MISSING** (computed)            | **MISSING**                 | **MISSING**                       | n/a                                  | partial (`status`)            | **MISSING**                                |
| `superseded_by`/`_at` | partial (status only)             | **MISSING**                 | **MISSING**                       | n/a                                  | **MISSING**                   | **MISSING**                                |
| `expires_at`          | **MISSING**                       | **MISSING**                 | **MISSING**                       | n/a                                  | **MISSING**                   | **MISSING**                                |

### What is PARTIAL vs EXISTS — the explicit list

- **EXISTS, fully:** creation; goals/objectives memory with confidence+status; constraints capture;
  recommendation provenance (evidence-required) and confidence; document confidence+review status;
  cross-turn working memory + advisor audit trail (`analytics.advisor_turns`).
- **PARTIAL:** verification (computed at read-time in `my_life.py`/`advisor_context.py`, never
  persisted as `verified_at`); supersession (status enums on `life_objectives` and
  `life_graph_edges` only — no `superseded_by` pointer, no history); confidence (present on the
  high-value categories, missing on constraints/risks/opps/life_events/preferences/facts);
  provenance (rich on recs/graph-nodes, thin or computed elsewhere); audit (advisor turns only,
  not general memory mutations); professional relationships (stored as family CRUD, not modeled as
  a relationship memory with role/engagement lifecycle).
- **NEW (not yet built):** `expires_at` / TTL on any memory; a `superseded_by` supersession pointer;
  a uniform `verified_at`; a single `life.memory` envelope (or equivalent view) so the model layer
  reads _one_ memory contract instead of N category tables; a memory-mutation audit log distinct
  from the advisor-turn log.

---

## 4. Design invariants LIOS memory must preserve (from the codebase, not aspiration)

These are already enforced in code and must survive any memory refactor:

1. **The LLM never writes memory.** Writes are deterministic (`relationship_manager.py`,
   `life_discovery.py`); the validator (`advisor_validator.py`) gates what the LLM may even _say_
   about memory (numbers, relationships).
2. **No fabrication.** The advisor may echo only `allowed_numbers` and may cite a relationship only
   if it is a real edge in `connected_pairs` (`advisor_context.py`, `advisor_validator._check_relationships`).
   The dashboard drops generic archetype labels (`my_life.py` `GENERIC_RISK_OPP_LABELS`).
3. **Rejections are durable and suppressed forever.** `life.rejected_goals` persists a user
   correction; `relationship_manager._rejected_norms` filters it out of all future surfacing — a
   working, category-specific _supersession-by-rejection_ that the general lifecycle should generalize.
4. **Accumulate, never collapse.** `candidate_goals` upserts by normalized text across turns so no
   stated goal is lost and none is merged into a generic label.
5. **Provenance is surfaced to the user.** `my_life.py` tags every section's
   `provenance_type` (confirmed > stated > inferred > assumption) — memory must keep carrying this.
