## Summary

GraphRAG data-contract remediation, semantic-platform architecture package, architectural invariant
enforcement, ADR review preparation, and the beta contract. **Draft — not for merge.**

Two production defects fixed; the rest is design, governance, and test enforcement. No production
mutation, no data migration, `GRAPH_GROUNDING_ENABLED` untouched.

**Commit range:** `origin/main..8ac91d1c` (28 commits)

## What changed

**Fixes**

- `120f301a` — the domain filter matched **0 of 1,583** financial points. Worker writes
  `domain: "financial"`; the planner emitted `"finance"`. 71.4% of the corpus was unreachable, and
  `vector_seeds: 0` is indistinguishable from "user has no data". An existing test _asserted the
  defect_, which is part of why it survived.
- `da8c7428` — the manifest generator saw one emitter of two; 86 edge types were untraversable.

**Invariant enforcement** (`a07ff376`)

- 14 tests, all mutation-proven, for: single graph writer (Rust only), read-only Python clients,
  both-endpoint tenant binding, no caller tenant override, no raw-string relationship emission.
- Unconditional `architectural-invariants` CI job — deliberately not path-filtered.
- The two-tenant fixture interprets the tenant predicate in generated Cypher, so deleting the
  far-end binding returns a foreign node and fails the test.

**Design & governance** (docs only)

- `FINAL_TECHNICAL_DESIGN_REVIEW.md` — grounded in a live production baseline; overturns four prior
  conclusions, three of them from this same package.
- 11 ADRs, **all `Proposed`** — none accepted, none authorized for implementation.
- Implementation program, ADR review package, beta contract and backlog.

## Test evidence

| Suite                               | Result                                   |
| ----------------------------------- | ---------------------------------------- |
| core-api pytest                     | **977 passed** (+14)                     |
| ingestion-worker `cargo test --lib` | **85 passed**                            |
| Ontology + domain drift gates       | green                                    |
| Invariant mutation tests            | 4/4 gates proven to fail on broken input |
| gitleaks over 28 commits            | **no leaks found**                       |

## Key documents

- `docs/semantic-platform/FINAL_TECHNICAL_DESIGN_REVIEW.md`
- `docs/semantic-platform/adrs/ADR_DECISION_SUMMARY.md` · `ADR_REJECTION_EVIDENCE.md`
- `docs/semantic-platform/implementation/IMPLEMENTATION_EXECUTIVE_SUMMARY.md`
- `docs/semantic-platform/review/ADR_SESSION_1_GUIDE.md` · `ADR_SESSION_1_RECORD.md`
- `docs/beta/BETA_CONTRACT.md` · `BETA_BACKLOG.md`

## Known blockers and residual risks

- **D-1 credentials unrotated.** Exposed Fly org token + Qdrant `manage` key require revocation with
  **rejected-old-credential proof**. Gates every write-enabled item. **Owner action.**
- **ADR Session 1 not held** — 0 of 11 blocking questions owned, so no acceptance vote is valid.
- **ANOM-1**: 17-tenant Neo4j/Qdrant divergence, unexplained. Must be **classified, never deleted**.
- **No retrieval golden set** — the zero-fabrication beta promise has no instrument (ADR-004).
- **CONF-A**: escalated architectural conflict between ADR-005 and ADR-002, unruled.
- **RES-2**: single-writer scan covers core-api but not `apps/api-gateway`, a live tier holding a
  service-role key.
- Invariant CI gate **reports but does not block** until added to branch protection.

## Status

**This PR remains a DRAFT.** It is published to preserve 28 local-only commits and to make the
package reviewable. It is not a merge request. No ADR in it is accepted, and no implementation
authority is claimed.
