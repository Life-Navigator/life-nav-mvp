# Executive Pilot Simulation — Trust, Consistency & the Report Viewer

**Sprint:** Finish Line · **Date:** 2026-06-16 · **Type:** DESIGN SIMULATION (no code changed)

> **This is an honest DESIGN simulation, NOT a live user study.** No users were minted; no
> sessions were run. Each judgment is reasoned against the **actual live surfaces** (cited
> by file:line). Scores are 1–10, deliberately **conservative**. The point is to surface
> trust/consistency failure modes and pressure-test the **report viewer being built this
> sprint** before real pilots touch it. Live validation (mint test users, run the journey)
> remains the required next step.

Builds on `docs/pilot-polish/PILOT_EXPERIENCE_SIMULATION.md` (same archetypes). That doc
established the surfaces land well; **this one focuses on trust, cross-surface consistency,
and the new in-app report viewer** rather than first-impression delight.

---

## The live surfaces under test (file-cited)

| Surface                               | File                                                     | Trust posture                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| End-of-discovery reveal               | `apps/web/src/components/onboarding/DiscoveryReveal.tsx` | Reads `/api/life/my-life`; honest "still getting to know you" when `life_brief.ready===false` (`DiscoveryReveal.tsx:139`); never fabricates (`:269` empty card). Confidence + source shown (`:223-229`). |
| Life Brief V2 + "Why Arcana Believes" | `apps/web/src/components/dashboard/LifeBrief.tsx`        | Narrative + provenance (confidence_pct + source, `LifeBrief.tsx:188-192`); "Why Arcana believes this" surfaces `narrative_explanation` only, renders nothing when null (`:204`).                         |
| Recommendation visibility             | `/dashboard/recommendations` + `RecCard` in viewer       | Quantified impact shown **only when populated**, else "Impact not yet quantified" (`reports/[type]/page.tsx:156-160`); evidence + assumptions surfaced.                                                  |
| Explainable graph                     | `apps/web/src/app/life-graph/explainable/page.tsx`       | Real-edges-only (per memory); **no usage instrumentation** (see analytics doc).                                                                                                                          |
| **Report viewer (this sprint)**       | `apps/web/src/app/dashboard/reports/[type]/page.tsx`     | New. Reads existing `/v1/reports/{type}/preview`; **every section has an honest empty state**; narrative-led; PDF retained (`:273`).                                                                     |

**Single strongest trust property:** all five surfaces read from the **same `/api/life/my-life`
and report-preview payloads** and degrade to honest empty states rather than fabricating —
consistent with the "No mock data — ever" rule. This is the consistency backbone the
simulation rewards.

---

## The new report viewer — focused trust read

The viewer (`reports/[type]/page.tsx`) is the headline of this sprint. Honest assessment:

**Strengths (build trust):**

- Narrative LEADS (`:323` "Current Narrative" section before Goals/Risks), matching the
  reveal and Life Brief — same story, three places → consistency.
- Provenance throughout: per-rec confidence (`:151`), evidence + assumptions (`:170-194`),
  appendix counts (`:548-560`), citations (`:562-575`), governance disclaimer (`:579`).
- Determinism claim is **shown to the user**: "same inputs → same report" (`:269`) — exactly
  what a CPA/attorney needs to trust it.
- Quantified impact is **honest about absence** ("Impact not yet quantified", `:159`).

**Weak spots (erode trust / consistency):**

1. **Two confidence numbers can disagree.** The viewer shows `cover.confidence_pct` (`:285`),
   per-objective `primary_objective.confidence` (`:366`), per-rec `rec.confidence` (`:151`),
   and `appendix.avg_confidence_pct` (`:557`) — four confidence figures on one page from
   different fields. If they diverge, a numerate persona (CPA/VC/advisor) will distrust all
   of them. **Needs one reconciled, labeled confidence story.**
2. **Empty-state sprawl.** A thin pilot profile renders a report that is mostly "No X yet"
   (`:319, :398, :412, :424, :438, :461, :482, :530, :574`). Honest, but reads as "the
   product has nothing for me." A near-empty report is worse than no report button.
   **Needs a minimum-data gate**: don't expose the report until ≥N populated sections.
3. **Error path leaks status codes.** `Report unavailable (${r.status})` (`:211`) surfaces a
   raw HTTP code to the user. Minor, but un-executive.
4. **Section numbering is fragile.** `next()` increments a running counter (`:254`) but the
   Executive Summary is unnumbered while body sections are numbered — a persona who downloads
   the PDF and compares to the on-screen view may see different numbering. **Verify PDF and
   in-app viewer agree** (the broken-promise risk: "the PDF doesn't match what I saw").
5. **PDF vs in-app parity is unverified.** The viewer is new; the PDF route predates it.
   Two renderers of the same report is a classic consistency trap. **Must be diffed before
   pilot.**

---

## Persona results (conservative; trust-weighted)

Scores reflect **trust & consistency**, not first-impression delight (covered in the prior
sim). 1–10. "Invest" = would they fund it; "Pay" = would they personally subscribe.

| Persona            | First 5 min | First rec | First report | First graph | First insight | Recommend | Invest  |   Pay   |
| ------------------ | :---------: | :-------: | :----------: | :---------: | :-----------: | :-------: | :-----: | :-----: |
| VC                 |      8      |     7     |      6       |      6      |       8       |     7     |    6    |    6    |
| Founder            |      8      |     7     |      6       |      7      |       8       |     8     |    6    |    6    |
| Executive          |      8      |     7     |      6       |      6      |       8       |     7     |    5    |    6    |
| Attorney           |      7      |     7     |      7       |      7      |       7       |     7     |    5    |    6    |
| CPA                |      6      |     8     |      6       |      5      |       7       |     7     |    5    |    6    |
| Financial Advisor  |      8      |     8     |      7       |      6      |       8       |     8     |    6    |    7    |
| Military Veteran   |      7      |     7     |      6       |      5      |       7       |     7     |    4    |    5    |
| Young Family       |      9      |     7     |      6       |      6      |       8       |     8     |    5    |    6    |
| ChatGPT Power User |      7      |     7     |      6       |      7      |       8       |     7     |    5    |    5    |
| High Performer     |      8      |     7     |      6       |      6      |       8       |     8     |    5    |    6    |
| **Avg**            |   **7.6**   |  **7.2**  |   **6.2**    |   **6.1**   |    **7.7**    |  **7.4**  | **5.2** | **5.9** |

These run **slightly below** the prior sim's averages **by design** — this pass discounts
delight and prices in the trust/consistency risks above (esp. the multi-confidence problem,
empty-state sprawl, and PDF parity), which a skeptical professional audience will hit.

### Per-persona notes (trust lens)

- **VC** — Reveal + "Why Arcana believes" + determinism line ("same inputs → same report")
  read as a real moat. Will _immediately_ stress-test the four confidence numbers; if they
  disagree the pitch collapses. **Invest gated on consistency, not features.**
- **Founder** — `legacy_entrepreneurship` narrative + tension lands; report is the artifact
  they'd forward to a co-founder, so PDF≠on-screen would burn them.
- **Executive** — Wants the report to be _the_ deliverable; near-empty sections on a busy
  exec's thin profile reads as "not for me yet." Minimum-data gate matters most here.
- **Attorney** — Highest report score (7): evidence + assumptions + citations + disclaimer
  is exactly the provenance they respect. Will notice if a citation list is empty (`:574`).
- **CPA** — Lowest first-5-min (intake feels like data entry) but highest first-rec (8):
  `expected_impact` quantification is the hook — **only if it's actually populated on live
  data**; the honest "not yet quantified" fallback is the realistic case and caps the score.
- **Financial Advisor** — Best overall + only "Pay 7": sees the report viewer as a
  client-facing deliverable. The one persona the viewer most directly converts.
- **Military Veteran** — Thin profile → empty-state-heavy report; lowest invest (4). Honest,
  but unsatisfying. Needs the data-completeness nudge to feel progress.
- **Young Family** — Strongest first-5-min (9): "sequence, not sacrifice" tension is the
  holy-shit line. Report value capped by empty sections until they add data.
- **ChatGPT Power User** — Feels the differentiator (grounded + explainable + remembers me)
  but is the harshest on _any_ inconsistency vs a chat box; multi-confidence is a red flag.
- **High Performer** — Burnout framing acknowledged; wants a recurring "what changed" hook
  (still missing) to come back; report is a one-time read today.

---

## Weak spots — consistent across personas

1. **Multiple confidence numbers, one page** (report viewer `:151/:285/:366/:557`). The
   #1 cross-persona trust risk for every numerate archetype. **Reconcile to one labeled story.**
2. **Empty-state sprawl on thin profiles.** Honest but demoralizing; a mostly-"No X yet"
   report reads as an empty product. **Gate report exposure on minimum populated sections.**
   Hits Veteran/Executive/Family hardest.
3. **PDF vs in-app report parity is unverified.** New viewer + old PDF route = consistency
   trap; a mismatch is a broken promise to exactly the personas (Attorney/Advisor/Founder)
   who forward the artifact. **Diff before pilot.**
4. **No way for the user to say "this isn't me."** The narrative is shown with confidence
   but never validated by the user (see `PILOT_ANALYTICS_READINESS.md` — Narrative Accuracy
   is uninstrumented). Every persona forms a silent accuracy judgment we cannot see.
5. **Graph is a dead-end + unmeasured.** Strong on launch but no usage instrumentation
   (`life-graph/explainable/page.tsx`), and no "so what / next action" off the graph. Lowest
   per-surface scores (avg 6.1).
6. **No recurring hook.** Across personas, "I want to come back" depends on a delta/"what
   changed" surface that doesn't exist yet — caps Return/Pay.

---

## Verdict

The trust _spine_ is real and consistent: one payload, narrative-led, provenance-shown,
honest empty states, determinism stated to the user. That is rare and is the platform's
credibility moat. **Recommend** (~7.4) holds.

But the simulation prices the pilot's _conversion_ metrics — **Invest (5.2) and Pay (5.9)** —
**below the bar**, for two reasons that are both fixable and both about consistency, not
intelligence:

1. **The report viewer can show conflicting confidence numbers and empty-heavy reports,**
   undermining the one artifact professionals most want to trust.
2. **We cannot see the user's trust judgment** (no narrative-accuracy / NPS / feedback UI),
   so the pilot can't _prove_ trust even where it exists.

**Pre-pilot must-fix (consistency, not features):** (a) reconcile report confidence to one
labeled number; (b) gate report exposure on minimum data; (c) diff PDF vs in-app report;
(d) ship the narrative-accuracy + NPS widgets from the analytics readiness doc. With those
four, the report viewer becomes the deliverable that lifts Invest/Pay, and the pilot becomes
_measurable_ — together those are what move this from "impressive demo" to "fundable pilot."
