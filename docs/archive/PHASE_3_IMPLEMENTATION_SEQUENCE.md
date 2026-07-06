# PHASE 3 — IMPLEMENTATION SEQUENCE (Career → Education → Family)

Domain-by-domain rollout using the proven Finance/Health framework (DOMAIN_FRAMEWORK
checklist). Career first (it grounds Education's comp/ROI), Education second (flagship), Family
third (depends on both). Each domain = the same 10 layers; unlock only at 15/15 gates. Design
only — no implementation here.

## Why this order

- **Career first:** the COMPENSATION_INTELLIGENCE_ENGINE + JOB_MARKET_INTELLIGENCE built for
  Career are the inputs Education ROI needs (Program→JobTarget→comp lift). Career→Finance
  bridges also land first.
- **Education second:** the flagship; its ROI/recommendations consume Career comp + the live
  Finance graph.
- **Family third:** college planning consumes Education; protection/scenarios consume Finance +
  Health (all live by then).

## Per-domain sprint template (applies to Career, Education, Family)

Each domain runs these sprints; each sprint has **objective · files likely touched · acceptance
criteria · tests · live smoke · blockers · unlock gate**.

| Sprint                               | Objective                                                                                        | Files likely touched                                              | Acceptance                                                    | Tests / smoke                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| **X0** Arch + data-source audit      | confirm sources (BLS/IPEDS/Scorecard), no-guess fields                                           | `<DOMAIN>_IMPLEMENTATION_AUDIT.md`                                | sources + gaps documented                                     | n/a                             |
| **X1** Schema + RLS                  | tables, 116-RLS, security_invoker, **GRANT USAGE**, no triggers                                  | `supabase/migrations/NNN_<domain>_schema.sql`, `config.toml`      | tables+RLS+0 triggers; exposed-schema list **keeps graphrag** | apply + verify counts           |
| **X2** Worker enum + ontology        | enum variants (+as_str/domain/sensitivity/title/summary) + registry edges                        | `entities.rs`, `normalizer.rs`, `ontology.rs`, `relationships.rs` | cargo test green; no RELATED_TO for mapped; clippy            | `cargo test`; **deploy worker** |
| **X3** Core API `<Domain>Service`    | DomainService + router (NOT yet in get_domain_services)                                          | `domains/<d>.py`, `routers/<d>_domain.py`, `dependencies.py`      | summary DomainViewModel; missing→prompts; pytest/ruff/mypy    | endpoint smoke                  |
| **X4** Decision/comparison engine    | the domain's flagship compute (Education: comparison; Career: comp/skill-gap; Family: scenarios) | `domains/<d>.py`, shared `compensation.py`                        | explainable scores; cited evidence                            | unit tests                      |
| **X5** ROI / scenario engine         | worst/likely/best + sensitivity                                                                  | engine module                                                     | scenarios + sensitivity; no black-box                         | tests                           |
| **X6** Recommendation evidence graph | families + persist (uuid5, no-rec-without-evidence) + trigger (after X2 deploy)                  | `domains/<d>.py`, `migrations/NNN_<d>_triggers.sql`               | recs persist + fan out; evidence/assumptions/boundary         | live: generate → graph          |
| **X7** PDF/report (Education only)   | report rows + renderer + report evidence graph                                                   | `report_*` tables, renderer                                       | regenerable, versioned, cited; no fake                        | render smoke                    |
| **X8** Frontend                      | render-only page + `/api/<d>` proxy + nav                                                        | `app/api/<d>/*`, `app/dashboard/<d>/page.tsx`, `Sidebar.tsx`      | type-check; no fake data; missing prompts; safety posture     | route 200                       |
| **X9** Chat grounding                | add `<d>→<D>Recommendation` to `RECOMMENDATION_LABELS`; classify keywords                        | `retriever.py`, `orchestrator.py`, `context_builder.py`           | "why?" cites graph evidence; boundary enforced                | chat smoke                      |
| **X10** 15 Graph Quality Gates       | full audit live                                                                                  | —                                                                 | **15/15**                                                     | gate audit                      |
| **Unlock**                           | register in `get_domain_services` + nav (graceful degradation)                                   | `dependencies.py`, `Sidebar.tsx`                                  | life-profile lists domain; finance/health intact              | prod smoke + approval           |

## Education sub-sequence (the prompt-1 E0–E10, mapped)

E0=X0 · E1=X1 · E2=X2 · E3=X3 · E4=comparison engine (X4) · E5=ROI/scenario (X5) · E6=rec
evidence graph (X6) · E7=**PDF generator (X7)** · E8=frontend comparison tool (X8) · E9=chat
grounding (X9) · E10=15 gates (X10). Education adds the report layer (E7) that Career/Family
don't need.

## Shared prerequisites (build once, before the domains that need them)

- **JOB_MARKET_INTELLIGENCE** (central reference, cited) — before Career X4.
- **COMPENSATION_INTELLIGENCE_ENGINE** (shared service) — before Career X4 + Education X4.

## Cross-cutting invariants (every sprint)

enum-before-trigger · 116-RLS + GRANT USAGE · exposed-schema list **must keep graphrag** (H1
incident) · no RELATED_TO for mapped types · no fake data / missing→prompts · evidence-backed
recs only · tenant-safe · domain stays `unavailable()` until 15/15 + explicit unlock approval.

## Recommended immediate first sprint

**Career X0 + the shared JOB_MARKET_INTELLIGENCE + COMPENSATION_ENGINE design-to-build kickoff**
(Career X1 schema follows). Rationale: Career unblocks Education ROI; the compensation layer is
the highest-leverage shared asset across both.
