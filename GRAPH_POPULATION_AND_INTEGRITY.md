# GRAPH POPULATION + INTEGRITY ENGINE — 2026-06-11

The Graph Population sprint's keystone, on real validated data. Live on Core API v72 + prod `b2f7e7f`.
Mission proof: **domain CRUD data now becomes Life Graph nodes**, and **Graph Integrity** is a live,
real-data completeness metric. No fabricated nodes, no fake confidence, no synthetic data.

## What shipped (this turn)

- **Family → Graph population (Rule 2):** `personal_graph()` now derives nodes from the live Family CRUD
  tables (`family.dependents`, `beneficiaries`, `emergency_contacts`, `trusted_advisors`) → one node per
  entity + a **Family hub** node, with `part_of` edges (entity → hub) and a `supports` edge (hub →
  family_stability objective). So every Family entity a user creates appears in the graph.
- **Graph Integrity Engine (Phase 7 / Rule 4):** `_graph_integrity()` computes per-domain completeness from
  REAL data presence — finance (`financial_accounts`), career (`career_profiles`+`certifications`), health
  (`sleep_logs`+`vitals`), education (`education_records`+`courses`), family (entity count), life
  (objectives). Defensive cross-schema counts; **absent data → 0% (honest, never fabricated).** Returned in
  `/v1/life/graph` as `graph_integrity {domains, overall}` and rendered as a Completeness strip on the graph.
- **Node lineage (Phase 5 start):** family nodes carry `source: "User entry"` + `updated_at`; the node
  details panel now shows **Source** + **Updated** (data lineage) alongside type/domain/confidence/relationship_count.

## Validation (prod, real user)

Added 1 dependent + 1 beneficiary + 1 emergency contact + 1 trusted advisor via the CRUD routes, then read
`/api/life/graph`:

- **family nodes = 5** (Dependent, Beneficiary, Emergency Contact, Trusted Advisor, Family hub) ✅
- `family_hub` present; `part_of` edges present ✅
- `graph_integrity` = `{family: 80, finance/career/health/education/life: 0, overall: 13}` — family reflects
  the 4 real entities; others honestly 0 (this user has no other-domain data) ✅
- Earlier 3-domain CRUD + dependents all persist/delete (prior turn) ✅

## Bug found + fixed during validation

My new family tables were granted only to `authenticated`, so the Core API role couldn't read them →
beneficiary/contact/advisor nodes were missing (only `dependents`, from migration 131, appeared). Fixed:
`grant … to service_role, anon` on the three tables + `notify pgrst reload` (applied to prod + appended to
the migration). Re-validated → all 4 entity types now populate.

## Node / Edge contract status (Deliverables 5/6)

- **Node:** id, type, label, domain, confidence, **source**, **updated_at**, relationship_count (client),
  status. `source_count`/`document_count`/connected-recs/reports are NOT yet wired (need per-node provenance
  joins) — shown as honest omissions, not fabricated.
- **Edge:** from, target, relationship_type (`rel`), confidence (= weight). A dedicated edge-inspection
  panel (Phase 6: evidence/reasoning) is NOT built yet.

## Honest scope — what's NOT done (the rest of the mega-sprint)

- **Health / Career / Education graph population:** their tab CRUD must be wired first (endpoints exist;
  copy the Family pattern), then the SAME `personal_graph()` enrichment reads their tables. This turn did
  Family (the only domain with live CRUD).
- **Edge inspection panel** (Phase 6) — not built.
- **source_count / document_count / connected recommendations-reports-decisions** on nodes — not wired.
- The 10 separate deliverable docs are consolidated here; per-domain reports (Health/Career/Education) await
  those domains' population.

## Pilot readiness

The graph is now a live, real-data intelligence layer (Family populated + integrity metric). Health/Career/
Education CRUD + their graph population are the remaining climb to 80+. The pattern is proven end-to-end:
**CRUD table → personal_graph() reads it → nodes + edges + integrity → inspectable in the 3D graph.**
