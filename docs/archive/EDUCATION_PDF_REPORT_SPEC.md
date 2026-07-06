# EDUCATION — PDF REPORT GENERATOR SPEC

A premium, branded, evidence-backed PDF generated from **structured data** (never free text),
regenerable and versioned. Design only.

## Generation model

- Source of truth = `education_comparison_reports` + `report_sections` + `report_charts` rows
  (structured). The PDF is a **deterministic render** of that data → same inputs reproduce the
  same report (versioned via `reports.version`).
- Pipeline: comparison engine → persists report rows (sections + chart specs as JSON) →
  renderer turns rows into the PDF → stores `pdf_url` + metadata. The **report evidence graph**
  (`EducationComparisonReport -[:COMPILES_INTO]-> EducationRecommendation -[:HAS_EVIDENCE]->…`)
  backs every claim.
- Rendering: server-side (Core API or a worker job), e.g. headless-Chromium/HTML→PDF or a
  typed PDF lib. **No Gemini in the renderer**; copy comes from the structured recommendation +
  evidence (LLM may draft prose earlier, but only over grounded evidence, gated by the boundary).

## Report sections (in order)

1. Cover page (user, date, version, brand) 2. Executive summary 3. Ranked program comparison
2. Recommended choice 5. Why this is recommended 6. Goal alignment 7. Financial impact
3. Career impact 9. Debt & cash-flow analysis 10. ROI scenarios 11. Risk analysis
4. Sensitivity analysis 13. Assumptions 14. Evidence & sources 15. Tradeoffs 16. Next steps.

## Charts (from `report_charts.spec_json`)

total-cost comparison · expected salary uplift · debt-burden comparison · breakeven timeline ·
ROI scenario range (worst/likely/best band) · goal-alignment score · risk score · confidence
score. Each chart is a data spec (series + labels + source refs), rendered by the chart layer —
not a hardcoded image.

## Requirements

- **Visually appealing + branded + readable + exportable.**
- **Evidence-backed**: every claim/number cites its `:Evidence` source (footnote/appendix
  "Evidence & sources"); **no unsupported claims**.
- **Provenance**: each fact shows source + as_of + confidence.
- **Regenerable**: stored structured data + version → rebuild anytime; old versions retained.
- **No fake data**: missing inputs render as "data not available — add X", never invented.
- Includes the **education_guidance disclaimer** (decision support, not admissions/financial/
  legal advice; escalation where stakes warrant).

## Outputs / storage

- **PDF** (file) + **report metadata** row (`education_comparison_reports`).
- **Report evidence graph** (Neo4j subgraph) for traceability + chat ("what's this report based
  on?").
- **Downloadable link** (signed, owner-scoped, expiring).
- **Optional shareable advisor/parent view** (later): a read-only, redacted variant gated by
  explicit user consent — never auto-shared, never exposing internals.

## Security

Owner-scoped (RLS); signed download URLs; no service-role/Gemini keys client-side; no internal
system names (Qdrant/Neo4j/GraphRAG/worker) in the report. Shareable views require explicit
consent + a consent record.
