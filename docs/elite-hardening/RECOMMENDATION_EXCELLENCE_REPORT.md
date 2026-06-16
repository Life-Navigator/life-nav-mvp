# Recommendation Excellence Report — LifeNavigator

**Date:** 2026-06-16 · **Scope:** Code-level audit of the recommendations experience for a 20-person elite pilot. Every claim is cited to `file:line` against real code; no behavior is inferred beyond what the code shows.

---

## Verdict

**The engine is genuinely elite; the experience is fragmented and the moat is invisible. 6.5/10.** `recommendations_os.py` is the best recommendation code in this repo — evidence-gated, quantified, recomputed, ranked by a visible formula, with a real lifecycle. But three independent recommendation engines feed three unconnected surfaces, the user's #1 page (`/dashboard`) never shows the OS at all, and the entire built explainability/provenance layer (why-chains, counterfactuals, evidence lineage) is **orphaned — not called by a single component.** An elite user will see a polished roadmap on one URL and a different "top recommendation" on the home dashboard, and will never see the graph behind any of it.

---

## How recommendations are generated + displayed (cited)

There are **three separate engines**, not one:

**Engine A — `recommendations_os.py` (the real OS, Python/Core API).**
`apps/lifenavigator-core-api/app/services/recommendations_os.py`. This is the "evidence-or-nothing" engine the memory describes. The `write()` integrity gate is real:

```python
# recommendations_os.py:66-69
# Integrity: no recommendation without evidence (Deliverable 3).
ev = evidence or []
if not ev:
    return None
```

It computes a **visible priority formula** at write time — `Impact × Confidence × Urgency × Evidence ÷ Effort` (`:74-84`), ages it with decay (`:436-444`), dedups by finding (`:454-471`), classifies into ACTION/RISK/OPPORTUNITY/DEPENDENCY/INFORMATION (`:28`), and prunes recs no longer supported by evidence (`:418-428`). The 401(k)-match rec (`:227-253`) and the life-insurance gap rec (`:274-293`) are genuinely recomputed — `_recompute_retirement` actually re-runs the plan at current vs. target contribution (`:175-205`). Surfaced via `/v1/recommendations/roadmap` (`routers/recommendations.py:40-43`).

**Engine B — `lib/finance/recommendations.ts` (deterministic TS, runs server-side on the web app).**
`apps/web/src/lib/finance/recommendations.ts` (678 lines). Persona-aware, reads `finance.financial_accounts` + `finance.transactions` + `user_persona_profile`, enforces debt-before-invest and fragile-persona stabilization (`:15-23`), compliance-scans its own strings (`:51-65`). This is what the **home dashboard** actually shows: `apps/web/src/app/dashboard/page.tsx:7,31-38` calls `getRecommendations(svc, user.id)` and renders only `recommendations[0]` as the hero "next best action."

**Engine C — Next-Dollar Optimizer.** `/api/optimizer/run`, rendered at `apps/web/src/app/dashboard/next-dollar-optimizer/page.tsx`. Its own allocation/tradeoff/assumption model with accept/reject (`:69-75`). (Note: `RECOMMENDATION_GOLDEN_SET.md:21` records this surface as historically "structurally blind to persona data" — verify it now reads the user graph.)

**Display:** The flagship roadmap UI (`apps/web/src/app/dashboard/recommendations/page.tsx`) is excellent — Now/Next/Later sequence (`:404-444`), per-card current→target→delta (`:278-289`), the formula printed on the card (`:309-311`), and a collapsible `Explainability` block (`:104-251`) showing why / data used / source lineage / assumptions / confidence / expected impact / affected domains. It correctly renders **honest empties** ("No evidence attached yet", `:139-141`) rather than fabricating.

---

## 5 Ranked Issues

### 1. Three engines, three "single answers" — the dashboard contradicts the roadmap

`apps/web/src/app/dashboard/page.tsx:31-38` shows the hero recommendation from **Engine B** (`finance/recommendations.ts`, reading `financial_accounts`), while `apps/web/src/app/dashboard/recommendations/page.tsx:350` shows **Engine A** (`recommendations_os`, reading `documents`). These read different data stores and rank differently. The OS file's own docstring claims "No recommendation lives outside here" (`recommendations_os.py:7`) — but the user's most-visited page sources recs from a different engine entirely. An elite user will notice the home page and the Recommendations page disagree about what matters most.
**Fix:** Make `/dashboard` hero call `/api/recommendations` (the OS `prioritize`/`roadmap`) for its next-best-action, and demote `finance/recommendations.ts` to a _collector_ that `emit()`s into the OS via `sync()` rather than rendering directly.

### 2. The entire explainability/provenance moat is orphaned — zero callers

`apps/web/src/app/api/recommendations/[id]/why/route.ts` (why-chains), `/counterfactuals/route.ts`, `/evidence/route.ts`, `/audit-trail/route.ts`, `/assumptions/route.ts` all exist and are non-trivial (the why route builds a deterministic `buildWhyChain` with governance guarding, `why/route.ts:37,56-62`; counterfactuals re-run engines with perturbations, `counterfactuals/route.ts:44-65`). **No `.tsx` component fetches any of them** (verified: grep for fetches of these routes returns nothing). Worse, they key on `recommendation_audit_trail.id` (`why/route.ts:1-6`), a _different_ identity than the OS `recommendations.id` the roadmap renders — so even if wired, they wouldn't join. The claimed moat (provenance + counterfactuals) is built but unreachable.
**Fix:** Wire the roadmap card's "Why & evidence" expander (`recommendations/page.tsx:319`) to call `/why` and `/counterfactuals`; first reconcile the id namespaces so an OS rec can resolve its audit-trail row.

### 3. Provenance is shallow text, not the graph

The `Explainability` "Source / evidence lineage" section (`recommendations/page.tsx:144-162`) renders `e.source_table` as a string chip like `documents:401k_statement` → "this recommendation". That's the _table name_, not a link to the actual document, edge, or extracted field. The evidence statements written in the OS are hand-authored prose (`recommendations_os.py:252`, `:292`), not pointers into the life graph. For the platform whose entire pitch is "we show you the edges," the user cannot click through to the source document or see the graph path.
**Fix:** Store `document_id` / graph edge id in each evidence item (not just `source_table`), and make the lineage chips deep-link to `/dashboard/documents/{id}` and `/life-graph/explainable`.

### 4. Dead stub components + dead domain rec pages signal abandonment

`apps/web/src/components/domain/career/JobRecommendations.tsx`, `education/CourseRecommendations.tsx`, `healthcare/WellnessRecommendations.tsx`, and `insights/components/Recommendations.tsx` are all **0-byte empty files** (`ls -la` confirmed). The career and education `/recommendations` pages render only `CareerTabEmpty` / `EducationTabEmpty` (`career/recommendations/page.tsx:4-6`, `education/recommendations/page.tsx:4-6`) — permanent empty states, never populated by the OS even though the OS emits `career`/`education`-domain recs (`recommendations_os.py:366`). The family page is the only domain page wired to real data (`family/recommendations/page.tsx:19-23`).
**Fix:** Delete the 0-byte stubs; have the domain recommendation tabs filter the OS roadmap by `impacted_domains`/`category` instead of showing a hardcoded empty state.

### 5. "Affected goals: none linked yet" is hardcoded — recs aren't tied to the user's objectives in the UI

`recommendations/page.tsx:246` literally renders the static string `Affected goals: none linked yet` for every card, despite the OS generating recs _from_ life objectives (`recommendations_os.py:380-415`, where each rec's evidence is "You told us your objective is '...'"). The strongest personalization signal the OS has — "this advances the goal you stated" — is computed and then thrown away at the UI layer.
**Fix:** Pass `objective`/`finding_label` linkage through `_shape()` (`recommendations_os.py:488-502`) into the roadmap payload and render the real linked goal instead of the placeholder.

---

## Assessment against the elite bar

**1. Personalized + evidence-grounded, or generic?** Genuinely personalized for the engines that ship. Real examples:

- _401(k) match_ (`recommendations_os.py:245-253`): "Increase your 401(k) from {rate}% to {match}%... you're leaving ${uncaptured}/yr on the table" with recomputed retirement-success delta. This is **not** ChatGPT-generic — it uses _your_ statement's contribution rate and match.
- _Debt payoff_ (`finance/recommendations.ts:274-293`): "Pay down your {APR}% card... that ${balance} balance is accruing ${annualInterest}/yr" — real APR, real balance, framed against the 7% market average. Excellent.
- _Estate dependency_ (`recommendations_os.py:295-316`): names the _specific_ missing documents and is correctly typed DEPENDENCY ("the state decides — not you"), never a vague "see an attorney."
  None of the live engines emit generic filler; the OS even has an anti-generic audit gate (`recommendations_os.py:558`, `:587`).

**2. Does each rec answer why-this / why-now / why-me / impact / next-action?**

- _Why this / why me:_ yes (evidence statements cite your data, `recommendations_os.py:73`).
- _Impact:_ yes, quantified and often recomputed (`:286-290`).
- _What next:_ yes (`recommended_action`, `:96`).
- **Why now: weak.** Urgency is a crude binary (`time_sensitive ? 0.8 : 0.5`, `:77`); there's no real time-criticality (e.g., open-enrollment deadline, tax-year cutoff). The roadmap shows "Now" but rarely says _why it's time-sensitive today_.

**3. Provenance visibility (the moat):** Partial and shallow. The roadmap surfaces evidence _statements_ and _table names_ (`recommendations/page.tsx:130-162`) — better than nothing — but the deep provenance layer (why-chains, counterfactuals, document/edge links) is **orphaned** (Issue 2) and the lineage is text, not graph (Issue 3). The moat is built but the user can't reach it.

**4. Prioritization:** Defensible and the best part of the system. Visible formula (`recommendations_os.py:81`), decay (`:437`), behavior-based down-weighting of dismissed/deferred findings (`:158-173`), dedup-by-finding (`:454`), and a printed "why #1 beat #2" comparison (`:504-522`). This is genuinely elite. (Caveat: only on the roadmap page; the dashboard hero uses Engine B's simpler `rank` field.)

**5. Action loop:** Strong on the roadmap. Full lifecycle (accept/start/defer/complete/dismiss, `recommendations/page.tsx:322-339`) → `/status` → `recommendation_events` (`recommendations_os.py:658-666`), and acting **does** feed the model: dismiss/defer down-weights the finding next sync (`:158-173`) and the `_signature` includes event count so reads recompute (`:139`). The optimizer also logs accept/reject (`next-dollar-optimizer/page.tsx:69-75`). This closes the loop better than most products.

**6. Empty-state honesty:** Excellent and consistent. The roadmap empty state invites an upload, never fabricates (`recommendations/page.tsx:398-402`); the `Explainability` block shows honest per-section empties (`:139,160,178,193,224,243`); family recs are empty-until-real (`family/recommendations/page.tsx:35-40`). Fully compliant with the no-mock-data rule.

---

## Top 3 leverage upgrades (make recs feel uncannily personal + trustworthy)

1. **Collapse to one engine and one home truth.** Route the `/dashboard` hero through the OS `prioritize` (Issue 1) and turn `finance/recommendations.ts` into an OS collector. The instant the home page and the Recommendations page agree, and both cite the same evidence, trust jumps — incoherence is the fastest way to lose an elite user.

2. **Make provenance clickable — wire the orphaned moat (Issues 2 + 3).** On every card's "Why & evidence" expander, call `/why` and `/counterfactuals`, and turn each evidence chip into a deep link to the source document and the graph edge. "Here's the exact statement in your uploaded 401(k), here's the edge, and here's what changes if your match were 6% instead" is the uncanny moment no ChatGPT can produce. The code is already written — it just isn't connected.

3. **Give "why now" real teeth.** Replace the binary urgency (`:77`) with date-anchored time-criticality sourced from real data — open-enrollment windows, tax-year deadlines, policy lapse dates, RMD ages. A rec that says "do this before Dec 31 or you lose the {amount} match this tax year" is the difference between a list and a fiduciary.

---

## What's genuinely excellent (don't regress)

- **The evidence integrity gate** (`recommendations_os.py:66-69`) — no evidence, no recommendation, enforced at the only write path. This is the platform's spine; protect it.
- **Visible, auditable prioritization** — the formula is computed, stored, decayed, behavior-nudged, and _printed on the card_ (`:81`, `recommendations/page.tsx:309`). Most "AI advisors" hide their ranking; this shows its work.
- **Correct domain boundaries by rec type** — health is INFORMATION-only with a medical-boundary disclaimer (`:318-334`), estate is DEPENDENCY not legal advice (`:308`), military GI Bill is personalized-or-DEPENDENCY never a generic "up to 36 months" (`:336-379`). The audit reviewer gates enforce this (CFP/CPA/estate/physician/VSO, `:589-601`).
- **A real closed action loop** — lifecycle events actually re-rank future recs (`:158-173`), not just a UI toggle.
- **Pervasive honest empty states** — zero fabrication anywhere in the rendered surface.
