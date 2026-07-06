# FACT_VISIBILITY_AUDIT.md — Sprint B

Audit of where extracted facts are visible today vs after this sprint. Grounded in the real write/read paths.

## Before this sprint

| Stage                                                   | State                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Extraction → `documents.document_fields`                | ✅ writes value + provenance (page/section/char-span, migration 165)                           |
| Bridge → `life.facts`                                   | ✅ writes every field as a fact with confidence + document provenance (`documents.py:_bridge`) |
| Bridge → Family rows                                    | ✅ moves real `family.*` columns for will/insurance/guardian (so family readiness shifts)      |
| **`life.facts` → any reader**                           | ❌ **ZERO readers** (project-wide grep)                                                        |
| Advisor cites extracted values                          | ❌ could cite "you have a trust" but not its contents                                          |
| Dashboard/Recommendations/Reports show extracted values | ❌ orphaned after the one-time upload result                                                   |

**Net:** the richest, most provenance-complete layer the platform captured was rendered nowhere after upload. "Upload → trust us."

## After this sprint

| Stage                                                               | State                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Advisor reads `life.facts`                                          | ✅ **SHIPPED** — confirmed/inferred extracted values are cited facts + number-gate-eligible (LIFE_FACTS_READER.md) |
| Dashboard / Recommendations / Family / Career / Education / Reports | 🟡 **designed** (LIFE_FACTS_RENDERING_MAP.md) — same-table reads, no new infra                                     |

## Residual visibility gaps (named, not silently dropped)

1. **`*.metadata` attributes are still orphaned.** `_bridge_family` preserves non-column trust/will attributes in `family.*.metadata`; nothing reads metadata. (Surfacing fix, not in this slice.)
2. **Documents never appear in the Life Graph.** The graph reads recommendations/edges, not documents or `life.facts`. (See Sprint H / GRAPH docs.)
3. **Frontend doc-type catalog lists 9 doc types absent from the backend TAXONOMY** → a silent 400 dead-end on upload for those types. (Trust bug; fix the catalog or the taxonomy. Flagged in OCR_TRUST_AUDIT.)
4. **`life.relationships` also has no readers** — MCP-submitted edges (supports/conflicts/blocks) are invisible. (Same orphan class as life.facts; next reader candidate.)

## Verification done

- Confirmed the write path (`_bridge` → `submit_life_fact`) and the prior absence of any reader.
- Confirmed `life.facts` exists in prod (migration object verification, this session).
- Shipped + unit-tested the advisor reader (595 backend tests pass).

## Recommendation

Ship the Dashboard "recently learned" strip next (highest-visibility surfacing), then extract the shared `LifeFactsService` when wiring the second consumer. Close residual gap #3 (doc-type catalog vs taxonomy) before pilot — it's a silent dead-end, the worst kind of trust failure.
</content>
