# Implementation Risk Register

**Date:** 2026-07-30 · Phase 8. **Implementation risks only** — architectural risks live in the ADRs and
are not duplicated here.

Likelihood/Impact: L / M / H. Review cadence per risk. Status: `open` unless stated.

---

| ID       | Risk                                                                          | L     | I     | Detection                                                         | Mitigation                                                                                  | Owner          | Cadence           | Escalation       |
| -------- | ----------------------------------------------------------------------------- | ----- | ----- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------- | ----------------- | ---------------- |
| **R-01** | Implementation momentum pressures review into accepting ADRs unexamined       | **H** | **H** | ADRs move to `Accepted` without recorded rejection-trigger owners | Binding status rule; no work package activates without `Accepted` + owned triggers          | Program Lead   | weekly            | Engineering Lead |
| **R-02** | Stage 0 credentials never fully closed; write work starts anyway              | M     | **H** | Any write-enabled package active while G-54 lacks rejection proof | WP-000 is a hard gate on every write package                                                | Security       | weekly            | Engineering Lead |
| **R-03** | OQ investigations stay unowned; programme stalls silently                     | **H** | M     | 0 of 9 owned (current state)                                      | Session 1 assigns owners + dates; unowned = ADR ineligible                                  | Program Lead   | weekly            | Engineering Lead |
| **R-04** | Reviewer contention — Security owns/reviews 9 of 11 ADRs                      | **H** | M     | Sessions slip; parallel work serializes on one person             | Stagger sessions; delegate retrieval-track reviews; two-track rule                          | Program Lead   | weekly            | Engineering Lead |
| **R-05** | Golden set (WP-100) under-resourced because it is off the build critical path | M     | **H** | WP-200/WP-400 reach their gates with no baseline to compare       | Flagged as evidence-critical-path; staffed before Stage 2                                   | AI/Retrieval   | biweekly          | Program Lead     |
| **R-06** | Invariant automation (WP-010) surfaces existing violations (IQ-3)             | M     | M     | DA-2/DA-3 fail on first run against current tree                  | Treat as remediation, not prevention; baseline violation count before gating                | Graph Platform | once, then closed | Program Lead     |
| **R-07** | Prettier/pre-commit reformats generated artifacts and breaks a drift gate     | **M** | M     | Drift gate red after commit                                       | Gates compare content not bytes (verified `120f301a`); re-run gates post-commit             | Graph Platform | per release       | —                |
| **R-08** | WP-600 batch migration partially applies; graph left in mixed state           | M     | **H** | Reconciliation counts diverge mid-run                             | Bounded batches; idempotency (G-22); rehearsed rollback (G-06); stop-on-anomaly             | Graph Platform | per migration     | Engineering Lead |
| **R-09** | Manifest v3 cutover breaks the loader in production                           | L     | **H** | Loader rejects or misreads; retrieval returns empty               | Dual-emit for one release; G-11 parity; rollback = revert loader                            | Security       | per release       | on-call          |
| **R-10** | CONF-A resolved informally by an implementer rather than by reviewers         | M     | M     | ADR-005 work starts before a ruling is recorded                   | WP-300 activation explicitly blocked on the ruling                                          | Program Lead   | weekly            | Engineering Lead |
| **R-11** | Qdrant payload backfill mis-derives trust for points with unknown source      | M     | **H** | Points land as citable that should not be                         | Fail closed: unknown → `inferred`, `citation_eligible=false`; dry-run first                 | Security       | per backfill      | Security lead    |
| **R-12** | Test environment divergence (`.venv` vs CI) hides failures (IQ-4)             | M     | M     | Local green, CI red, or vice versa                                | Pin and document the sanctioned environment                                                 | Platform Ops   | once              | —                |
| **R-13** | Capacity unknown; a package ships into an undersized box                      | M     | M     | G-52 has no baseline today                                        | Load test before any latency-sensitive package reaches S6                                   | Platform Ops   | before S6         | Program Lead     |
| **R-14** | Scope creep — implementation "improves" an ADR decision                       | M     | **H** | A PR changes behaviour no ADR sanctions                           | Decision audit checklist; every package maps to exactly one ADR; unsanctioned work rejected | Program Lead   | per PR            | Engineering Lead |
| **R-15** | ADR-002 built before OQ-2, then reworked                                      | M     | M     | Schema lands before batch homogeneity confirmed                   | WP-500 activation requires OQ-2 resolved                                                    | Graph Platform | weekly            | Program Lead     |
| **R-16** | A rollback is documented but never rehearsed                                  | **M** | **H** | G-06 skipped                                                      | G-06 mandatory before WP-600; rehearsal record required                                     | package owners | per package       | Engineering Lead |

---

## Top three by expected damage

**R-01 — review capture by implementation momentum.** The reason this package is readiness-gated and
depth-proportionate. The mitigation is structural: no activation without acceptance. It is listed first
because it is the risk this document itself could create.

**R-02 — write work starting before credential closure.** Cheapest to prevent, most severe if missed,
and the temptation grows as other work becomes ready.

**R-08 — partial batch migration.** The only risk whose worst case is a corrupted production graph.
Mitigated by four independent controls, and still rated H impact.

---

## Risks explicitly NOT in this register

| Excluded                                        | Where it belongs                                               |
| ----------------------------------------------- | -------------------------------------------------------------- |
| Traversal may add no value                      | ADR-008 falsification criteria — a planned outcome, not a risk |
| Batch provenance may be wrong for Plaid         | ADR-002 / OQ-2 — architectural                                 |
| Global identity would create cross-tenant joins | ADR-006 — rejected option, not a live risk                     |
| Confidence components may correlate             | ADR-010 falsification criteria                                 |
| Gateway may have an unknown caller              | ADR-009 — mitigated by the `410` shim by design                |

Duplicating architectural risk here would create two registers that drift — the same defect class the
platform is being repaired for.
