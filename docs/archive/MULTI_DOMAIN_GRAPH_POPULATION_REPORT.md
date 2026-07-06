# MULTI-DOMAIN GRAPH POPULATION + VALIDATION — 2026-06-11

Career, Education, and Health now populate the Life Graph (joining Family). Live on Core API + prod `af79fcd`.
Consolidates the sprint's 5 requested reports (per-domain population + integrity update + validation).
**No fabricated data** — every node derives from a real row in a real table.

## What shipped — one shared, config-driven backend edit

`personal_graph()` domain-population is now config-driven. Each domain reads its **discrete entity tables**
(time-series logs excluded so the graph doesn't flood; 30-node cap/table) → one node per row + a domain hub +
`part_of` edges + a `supports` edge to the matching objective. `_graph_integrity()` uses the real entity counts.

| Domain    | Tables read (schema)                                                     | Node types                                              | Hub           | Objective edge     |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------- | ------------- | ------------------ |
| Family    | dependents, beneficiaries, emergency_contacts, trusted_advisors (family) | Dependent/Beneficiary/Emergency Contact/Trusted Advisor | family_hub    | → family_stability |
| Career    | experience_records, skills, certifications, career_goals (career)        | Role/Skill/Certification/Professional Goal              | career_hub    | → career_growth    |
| Education | programs, schools, certifications, education_goals (education)           | Program/School/Certification/Learning Goal              | education_hub | (none)             |
| Health    | health_goals, supplement_logs (health)                                   | Health Goal/Supplement                                  | health_hub    | → health_longevity |

## Node lineage (every generated node)

`source = manual_entry`, `table = <schema>.<table>`, `record_id`, `updated_at`, `domain`, `type`, `confidence`.
Surfaced in the graph node details panel (Source + Updated). Edges: source_node, target_node,
relationship_type (`rel`), confidence (= weight).

## Validation (prod, live `/api/life/graph` payload)

Inserted one real row per domain, then read the graph:
| Domain | insert | node appears | lineage | integrity | delete → node removed |
|---|---|---|---|---|---|
| Career | 201 | Role "Senior Engineer" + Career hub | `source=manual_entry, table=career.experience_records` | 20% | ✅ node gone after delete |
| Education | 201 | Program "MBA" + Education hub | ✅ | 20% | (same delete path) |
| Health | 201 | Health Goal "Run a 10k" + Health hub | ✅ | 20% | (same delete path) |
| Family | 201×4 (prior) | 4 entity types + Family hub | ✅ | 80% | ✅ (prior turn) |

Graph nodes by domain after inserts: `{career:2, education:2, health:2}` (entity + hub each).
**Delete cleanup proven:** deleting the career row → the Role node disappears from the next graph fetch.

## Graph Integrity — before / after

- **Before:** only Family populated (family 80%, others 0).
- **After:** career/education/health reflect their real entity counts (20% each with 1 entity; scales 20%/entity to 100%). Finance from `financial_accounts`; life from objectives. Overall rises as real data is added.
- Integrity is **count-based + transparent** (no fabricated scoring), per the sprint's allowance.

## Hard-rule compliance

Not reported from UI / CRUD / graph alone — validated the **full chain**: row persists → graph node (with
lineage) → hub edge → integrity reflects → delete removes the node. Live payload evidence above.

## Honest scope — what remains (the per-domain ENTRY forms)

The shared, hard half (graph population + integrity + lineage + delete-cleanup) is **done for all 4 domains**.
What remains is the user-facing **data-entry tab CRUD** for these specific entity tables: Family has full tab
forms; Career/Education/Health entity tables (experience_records/skills/programs/health_goals/supplements/…)
mostly lack Next CRUD routes + tab forms today (existing endpoints like `/api/career/profile`,
`/api/education/records`, `/api/health-monitoring/manual-entry` target other/related tables). Validation here
used direct inserts to prove the graph mechanism; wiring per-entity CRUD routes + tab forms (copy the Family
`FamilyEntityCrud` pattern) is the **parallel-agent build** — one agent per domain, independent files.

## Definition of Done — status

✅ Family/Career/Education/Health all contribute real graph nodes. ✅ Nodes have lineage + source attribution.
✅ Nodes have relationships (hub + objective edges). ✅ Graph Integrity is live + reflects real data. ✅ Delete
cleanup proven. ◻ Per-domain ENTRY tab CRUD (so users populate via the app, not direct insert) — next, parallel.
Pilot readiness: graph is now materially denser + multi-domain; moves toward 80 as entry forms land.
