# LIFE_FACTS_RENDERING_MAP.md — Sprint B

How extracted `life.facts` should surface across every product surface. The advisor reader is **shipped** (LIFE_FACTS_READER.md); these are the remaining **surfacing** wires — all reads over the same existing table, no new infra.

## The single source

`life.facts` rows: `{id, fact_type:"<doc_type>.<field_key>", value, domain, confidence, confirmation_status, source, provenance:{document_id}, updated_at}`. Written on every document upload. Every surface below reads this same table, filtered to the user (RLS) and to `confirmation_status in ('confirmed','inferred')`.

## Rendering map

| Surface                | What to render from life.facts                                                                                   | Read path                                                                   | State                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Advisor** ✅ SHIPPED | Extracted values as cited, number-gate-eligible facts                                                            | `advisor_facts.build_fact_packet` (done)                                    | live                                                       |
| **Dashboard**          | "Recently learned about you" strip — last N confirmed facts with the document they came from                     | new `GET /v1/life/facts?limit=8` proxy → dashboard widget                   | Empty: "Upload a document and what we learn appears here." |
| **Recommendations**    | Attach the facts that triggered/support a rec as evidence chips (join rec → fact_type/domain)                    | recommendation card evidence drawer reads life.facts by domain              | Already has evidence_json; add life.facts-backed evidence  |
| **Family**             | Pillar evidence: successor trustee, beneficiaries, coverage amount under the Estate/Beneficiary/Survivor pillars | family page reads life.facts where domain='family'                          | feeds FAMILY_SURFACING_AUDIT                               |
| **Career**             | Comp/title/employer facts extracted from offer letters / pay stubs                                               | career page reads life.facts where domain='career'                          | —                                                          |
| **Education**          | Degrees/certs/enrollment extracted from transcripts                                                              | education page reads life.facts where domain='education'                    | —                                                          |
| **Reports**            | An "Extracted facts (with provenance)" appendix section in the PDF                                               | `report_engine` adds a life.facts section (cite document_id + page via 165) | honest empty when none                                     |
| **Timeline**           | Each fact's `created_at` → a "We learned X from your <doc>" event                                                | FAMILY_TIMELINE / DOCUMENT_CHANGE_VISIBILITY union                          | —                                                          |

## Recommended shared primitive

Add ONE backend reader `LifeFactsService.facts(ctx, domain=None, limit=N)` over `life.facts` and a `GET /v1/life/facts` endpoint; every web surface consumes it via a thin proxy. This avoids N ad-hoc selects and gives a single place to enforce the confirmed/inferred trust gate + provenance shape. (The advisor already inlines this; extract it to the shared service when wiring the 2nd consumer.)

## Trust + provenance rules (uniform across surfaces)

- Confirmed/inferred only; never render `candidate`.
- Always show the source document + confidence tier; inferred values labeled "pending confirmation" with a one-click confirm (reuses the migration-165 review lifecycle).
- One-click to the Evidence drawer (page/section/char-span) via `provenance.document_id` → `documents.document_fields` (live since 165).
- Never overwrite a user-confirmed domain value with a document fact (read-before-write, already enforced in `_bridge_family`).

## Sequencing (highest ROI first)

1. ✅ Advisor (shipped).
2. Dashboard "recently learned" strip (most visible "the platform is working" moment).
3. Family pillar evidence (ties to FAMILY_COMMAND_CENTER).
4. Reports appendix + Recommendations evidence chips.
5. Career/Education surfacing.
   </content>
