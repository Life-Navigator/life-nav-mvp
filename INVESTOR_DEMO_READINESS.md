# Investor Demo Readiness

**LifeNavigator Elite Pilot Sprint · Advisor-centric demo deliverable**
Grounding date: 2026-06-22 · No fabrication · Every claim traces to real code.
(Overwrites the V2 family-upload-centric version with the Advisor-OS golden path.)

## Verdict

**Conditionally investor-demo-ready on a curated Advisor golden path today; broadly demo-ready once
the Advisor OS loop is built and Health/Education dead-ends are closed.** Across five personas,
_investor demo quality_ averaged **6.9/10** — a "strong product, hidden/read-only UI" score, not a
weak-product score (Trust 7.6, Understanding 7.3, Recommendations 8.2 against Emotional 6.3). The
demo is a **routing problem, not a readiness problem**: stay on the high-scoring surfaces
(Recommendations 8.2, Discovery 7.9, Documents 7.2, Career 7.2) and the platform reads as a credible,
evidence-grounded advisor; wander into Health (5.9) or Education's inert ROI tabs (6.3) and the
surfacing gap shows.

## The thesis the demo must sell

> "Most life-planning apps fabricate confidence. LifeNavigator computes it, shows its work, and acts
> only with your approval."

The differentiator is **traceability + a trustworthy action loop**: every number carries a source
table, a confidence, and (post-DITS, migration 165) a document page; and the advisor never writes
the life model without a visible approval card. The demo's job is to make a skeptical investor
_click the evidence_ and _watch the model move under an approval gate_.

## The Advisor golden path (≈7 minutes)

A single narrative — **Discovery → upload a trust → life.facts surfaces → Advisor states a life
change → approval card → model updates → readiness/recs move → trace the evidence** — staying
entirely on surfaces that render the moat.

### Act 1 — Discovery: the honest starting state (60s)

- Run a short Discovery turn (`/discovery` chat). The live context panel shows coverage % per domain
  and an honest "still forming" state — not a fabricated readiness number.
- **Line:** "It doesn't pretend to know you yet. Watch what it does when given a real document."

### Act 2 — Upload a trust; values become advisor-citable (90s)

- Upload a trust/will PDF in Documents (`apps/web/src/components/documents/DocumentIntelligence.tsx`).
  The 31-type extractor (`documents.py`, `TAXONOMY`) matches the doc, extracts fields via deterministic
  regex with per-field confidence, bridges Family columns (`estate_plans.has_will`) via `_bridge_family`,
  and writes **every field to `life.facts`** with provenance (`documents.py:_bridge` →
  `IngestionService.submit_life_fact`).
- **THE SHIPPED MOMENT:** the advisor can now _cite the contents_ — successor trustee, beneficiaries,
  coverage amount — because **Sprint B's `life.facts` reader is live** in `advisor_facts.build_fact_packet`
  (`advisor_facts.py`; confirmed/inferred only; `sourceTable=life.facts`, `recordId`, confidence).
  Before this sprint the advisor knew "you have a trust on file" but **could not cite a single value
  inside it** (`FACT_VISIBILITY_AUDIT.md`).
- **Line:** "An upload didn't just file a PDF. Its contents are now facts the advisor can quote and defend."

### Act 3 — Advisor states a life change → the approval card (120s) — the closer

- In Advisor mode, type a real life change: _"We moved our wedding from September to March."_
- The **Advisor OS loop** (`ARCANA_ADVISOR_OS.md`): classify intent = `life_change`; extract a typed
  `ProposedAction{tool: submit_life_fact, domain: family, payload:{fact_type:'family.wedding_date', value:'March'}}`;
  traverse existing relationships/recommendations/readiness to compute `affects[]` (read-only).
- Render the **approval card** (`APPROVAL_AND_CHANGE_SYSTEM.md`): "This impacts: wedding timeline,
  home-purchase timing, family planning, savings targets · Proposed updates (4) · [Review] [Approve]."
- **Line:** "It proposes; it never silently writes. The LLM leads, but only the deterministic MCP
  layer writes — and only after you approve."

### Act 4 — Approve → model updates → readiness/recs move (90s)

- Click **Approve**. Selected items execute via the existing `IngestionService` `submit_life_*` tools
  with provenance `source='user_message'`, `submitted_by='advisor'`, `conversation_id` — the same
  sanctioned write path as MCP and document facts.
- Show-what-changed renders the applied diff; readiness recomputes; the **Recommendations roadmap**
  re-sequences (`/dashboard/recommendations`), surfacing the visible priority formula
  `Impact × Confidence × Urgency × Evidence ÷ Effort` (`recommendations_os.py:74–84`).
- **Line:** "One sentence moved a deterministic model — and it told you exactly what changed and why."

### Act 5 — Trace the evidence (60s)

- Expand a recommendation's explainability drawer: evidence rows (`statement` + `source_table`),
  assumptions, confidence %. Click a doc-derived value to open the Evidence drawer (page/section/
  char-span from migration 165): "this number came from page 2 of the trust you uploaded."
- **Line:** "Every claim traces home. That's the whole product."

## Demo risks (honest)

| Risk                                                                 | Why                                                                                                                    | Mitigation for the demo                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Act 3/4 depend on Arcana Advisor OS, which is DESIGNED not BUILT** | The state-change → approval → write loop is specified across 4 Sprint A docs; not yet shipped                          | Until built, demo Acts 3–4 as a **clickable approval-card mock** narrated honestly as "the loop we're shipping," OR cut to the already-live read path: advisor _cites_ the trust's contents (Act 2 is fully live). Do not claim the write loop is live if it isn't. |
| **Live model citation unvalidated**                                  | Advisor citation suite vs a live model + populated account is still a TODO (needs key rotation + Gemini prepay credit) | Use a pre-warmed demo account; have a recorded fallback for the advisor turn in case of a 502.                                                                                                                                                                      |
| **Health surface (5.9)**                                             | Orphan route; 9/13 static empty tabs                                                                                   | Do not navigate to Health.                                                                                                                                                                                                                                          |
| **Education ROI tabs (6.3)**                                         | Inert stubs; `programs` rows uncreatable from web                                                                      | Do not open Education ROI tabs.                                                                                                                                                                                                                                     |
| **Reports (6.4)**                                                    | PDF/citation output unverified from code                                                                               | Mention reports as roadmap; do not generate one live unless pre-verified.                                                                                                                                                                                           |
| **Sparse new-user account**                                          | Early readiness reads sparse                                                                                           | Use a populated demo account; never demo on a fresh signup.                                                                                                                                                                                                         |
| **Life Graph hairball/empty**                                        | NO-GO as hero (`GRAPH_GO_NO_GO.md`)                                                                                    | Keep the graph out of the hero path; tease the "Life Map" Coming-Soon only if asked.                                                                                                                                                                                |

## Pre-demo must-surface checklist

Before any investor demo, confirm:

1. **Demo account is populated** — trust/will uploaded, ≥1 goal, finance + family rows present.
2. **`life.facts` reader is returning cited values** for the demo account (Act 2 is the load-bearing
   live moment — verify the advisor quotes the trustee/beneficiary/coverage amount).
3. **Decide Act 3/4 mode** — either the built Advisor OS loop, or an honestly-narrated approval-card
   mock. Never imply built if mocked.
4. **Recommendations roadmap renders** the priority formula + a quantified impact chip for the demo
   account.
5. **Evidence drawer opens** to a real page-level citation (migration 165) on a doc-derived value.
6. **Navigation is rehearsed** to avoid Health, Education ROI tabs, Reports generation, and the Life
   Graph hero.
7. **Live-model fallback ready** — recorded advisor turn in case of a 502.

## Bottom line

The golden path is a tight, honest, evidence-first narrative whose **Act 2 is fully live today**
(Sprint B shipped the `life.facts` reader, so the advisor cites uploaded-document contents). The
**wow Acts 3–4 (state-a-change → approval → model moves) are designed (Sprint A) but not yet built**
— demo them as a narrated mock until shipped, never as live. With the demo account populated and the
soft surfaces avoided, LifeNavigator presents as exactly what the thesis claims: a trust-first
advisor that shows its work and acts only with approval.
