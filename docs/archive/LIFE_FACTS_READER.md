# LIFE_FACTS_READER.md — Sprint B (SHIPPED)

**Status: BUILT + TESTED (code, not just design).** This is the #1-ROI fix from the V2 audit: `life.facts` was a write-only sink with zero readers. It now has its first reader, in the advisor fact packet.

## The problem (verified, end-to-end)

- **Write side (already existed):** `documents.py:_bridge` → `IngestionService.submit_life_fact` writes EVERY extracted field to `life.facts` as `{fact_type: "<doc_type>.<field_key>", value, domain, confidence, confirmation_status, provenance:{document_id}}`, idempotent by `<doc_id>:<key>` (`documents.py:535-560`).
- **Read side (was missing):** `advisor_facts.build_fact_packet` read career/education/finance/family + documents-as-count-and-titles, but **never `life.facts`**. So the advisor knew "you have a trust on file" but could not cite the _successor trustee, beneficiaries, or coverage amount inside it_. A project-wide grep confirmed no `select` of `life.facts` anywhere.

## What shipped

`apps/lifenavigator-core-api/app/services/advisor_facts.py` — new reader block before the conflicts section:

- Reads `life.facts` (schema `life`) for the user via the existing `_rows` helper (service-role + explicit `user_id`, RLS-equivalent).
- **Trust gate:** includes only `confirmation_status in ('confirmed','inferred')` — speculative `candidate` agent-inferences are excluded.
- **Ranking + bound:** confirmed first, then by confidence; capped at `_MAX_PER_CATEGORY * 2` (12) so advisor context stays small/cheap.
- **Mapping:** `fact_type` `"trust.successor_trustee"` → label `"Successor trustee"`, source `"Extracted from your trust"`, domain from the row, `sourceTable="life.facts"`, `recordId=row.id`, confidence from the row.
- **Honest framing:** `inferred` facts get `" (pending your confirmation)"` appended to the source — the advisor never asserts an unconfirmed extraction as settled fact.

## Why this is high-leverage (three wins from one reader)

1. **Citable values.** Every `_fact` carries `sourceTable + recordId + confidence`; the advisor validator (`advisor_validator.validate`) keeps only cited facts present in the packet, so extracted values become assertions the advisor can make _and defend_.
2. **Number-gate unlock.** `numbers_in_facts()` now harvests figures from `life.facts` values, so the advisor can echo a real coverage amount (e.g. `1000000`) without the number-gate rejecting it as ungrounded. (Test asserts this.)
3. **No new infra.** Pure read over an existing, RLS-protected, provenance-complete table. No schema, no model, no migration.

## Tests

`tests/test_advisor_facts.py::test_extracted_document_facts_surface_from_life_facts`:

- confirmed + inferred surface; `candidate` excluded;
- provenance intact (`sourceTable=life.facts`, `recordId`, label humanized);
- inferred flagged "pending your confirmation";
- extracted figure present in `numbers_in_facts`.
  Result: **6/6 advisor-facts tests pass; full backend suite 595 passed; no regressions.**

## Boundaries honored

- Confirmed/inferred only (trust). Inferred never asserted as settled.
- Bounded context. Defensive (`_rows` swallows errors — grounding never breaks a turn).
- Reuses the exact provenance contract every other fact uses — uniform citation + validation.

## Next (rendering, see LIFE_FACTS_RENDERING_MAP.md)

The advisor is the highest-value reader and is done. The same `life.facts` select pattern should be surfaced in Dashboard / Recommendations / Family / Career / Education / Reports so the user _sees_ extracted facts, not just the advisor citing them. Those are surfacing tasks over the same table — specified next.
</content>
