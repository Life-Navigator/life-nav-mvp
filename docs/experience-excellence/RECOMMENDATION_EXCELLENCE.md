# Recommendation Excellence — Audit & Surfacing Design

**Sprint:** Experience Excellence (make built intelligence visible)
**Scope:** Design + audit only. No code changes. No fabricated data. All references are real `file:line`.
**Date:** 2026-06-16

---

## TL;DR

The backend recommendation engine is **genuinely elite** — quantified, classified, evidence-gated, prioritized by a transparent formula, with real recomputed before/after outcomes. The problem is **not generation, it is surfacing**: the richest outputs the engine produces (`why_ranking`, `needs_more_information`, the `/audit` quality proof, dedup/merge counts, and the full per-recommendation explainability) are **computed and then never shown** on the surfaces a pilot user actually lands on (the main dashboard hero and `/my-life`). The one page that does it justice — `/dashboard/recommendations` — is buried behind a "View all" link.

**The single biggest gap:** the dashboard hero (`MissionControl`) and `/my-life`'s "next best move" show only **title + why**. They drop the quantified impact, confidence, evidence, and the "why this is #1" that the engine already returns. A VC/exec/CPA glancing at the dashboard sees a to-do, not elite advice.

---

## 1. How recommendations are GENERATED (backend — real file:line)

### The engine

`apps/lifenavigator-core-api/app/services/recommendations_os.py` (666 lines) is the canonical Recommendation OS. Router: `app/routers/recommendations.py`.

Each recommendation is a first-class object written through one gate, `RecommendationOS.write()` (`recommendations_os.py:56-100`), with these real fields:

- `title`, `rec_type` (ACTION/RISK/OPPORTUNITY/DEPENDENCY/INFORMATION — `:28`), `category`, `source_module`, `priority`, `confidence`
- `current_state` → `target_state` → `delta_text` (the before/after framing — `:91`)
- `quantified_impact` (dict: `financial_impact_annual`, `success_delta_pts`, `coverage_gap`, `readiness_delta`, `unlocked_capabilities`, …)
- `evidence` (list of `{statement, source_table}`), `assumptions` (list of `{label, value}`)
- `recommended_action`, `estimated_benefit`, `estimated_effort`, `impacted_domains`
- `formula` + `rank_score` (the visible priority math — `:81-84`)
- `narrative` (current/target/delta/why/expected_impact/confidence/evidence/action — `:71-73`)

### Integrity guarantees (these are the moat)

- **No evidence → no recommendation.** `write()` returns `None` if `evidence` is empty (`recommendations_os.py:67-69`).
- **Visible prioritization formula:** `Impact × Confidence × Urgency × Evidence ÷ Effort` (`:74-84`), stored per-rec, then aged by decay (`:436-444`) and down-weighted only by learned dismiss/defer behavior (`:158-173`, `:478-481`) — never fabricated up.
- **Confidence floor:** below `_CONF_FLOOR = 0.25` a rec cannot rank; it renders as "needs more information" (`:26`, `:482-486`).
- **Real recomputation, not estimates:** the 401(k) and life-insurance recs run the actual plan at current vs. target and return before/after success probability with a `calculation_trace` (`_recompute_retirement` `:175-205`; insurance adequacy `:280-290`).
- **Dependency, not hand-waving:** when data is missing the engine emits a `DEPENDENCY` with `unlocked_capabilities` + `priority_reason` instead of a vague tip (e.g. missing 401(k) `:263-272`; estate `:303-316`; GI Bill `:367-379`).
- **Dedup/merge by finding** so the same issue isn't shown twice (`_dedup_by_finding` `:454-471`).
- **Self-audit:** `/audit` computes quantified-state %, personalized %, recomputed-delta %, generic-template count, duplicate/zero-confidence/metric-leak counts, plus reviewer gates (CFP/CPA/estate/physician/VSO/executive-AI) with pass/fail thresholds (`audit()` `:577-628`).

### What the API returns

- `GET /v1/recommendations/prioritize` (`recommendations_os.py:524-534`): `top_actions` (fully shaped via `_shape` `:488-502`), **`why_ranking`** (why #1 beat #2/#3, naming the deciding factor — `_why_first` `:504-522`), **`needs_more_information`**, `deduped_total`, `conflicts`.
- `GET /v1/recommendations/roadmap` (`:537-555`): `now` / `next` / `later` + `blocked_by` + `why_now` + `conflicts`.
- `GET /v1/recommendations/audit` (`:577`): the quality proof.

**Verdict on generation:** specific ✅, quantified ✅, actionable ✅, prioritized ✅, grounded ✅. This is the strongest part of the platform.

---

## 2. How recommendations are DISPLAYED (frontend — real file:line)

| Surface                         | File                                                                 | Reads                                            | What it shows                                                                                                                                                                                                                                                 | What it DROPS                                                                             |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Roadmap page** (the good one) | `apps/web/src/app/dashboard/recommendations/page.tsx`                | `/roadmap` via `api/recommendations/route.ts:20` | Now/Next/Later cards, current→target→delta (`:278-289`), `$/yr` + readiness (`:296-305`), formula inline (`:309-311`), full **Explainability** drawer with evidence/source-lineage/missing-data/assumptions/confidence/impact (`:104-251`), lifecycle buttons | `why_ranking.ranked_above` (per-card "why above #2"); `roadmap` doesn't carry it anyway   |
| **Dashboard hero**              | `apps/web/src/components/dashboard/MissionControl.tsx`               | `/api/platform/dashboard` (NOT prioritize)       | `next_best_action.title` + `.why` + a CTA (`:196-204`)                                                                                                                                                                                                        | **everything**: no `quantified_impact`, no `confidence`, no evidence, no "why this is #1" |
| **Dashboard module**            | `apps/web/src/components/dashboard/NeedsAttention.tsx`               | `/api/life/attention`                            | title, why, `$/yr` + confidence (`:76-82`), 3 alerts                                                                                                                                                                                                          | evidence, formula, target/delta, expected_benefit, recommended_action                     |
| **Flagship "My Life"**          | `apps/web/src/app/dashboard/my-life/page.tsx`                        | `/api/life/my-life`                              | next-best-move title/why/`$/yr`/confidence (`:124-145`), source label                                                                                                                                                                                         | `recommended_action`, `expected_benefit`, evidence, formula, "why" link to full rec       |
| **Executive Summary**           | `apps/web/src/components/dashboard/ExecutiveSummary.tsx`             | my-life                                          | vision + `ProvenanceBadge` (`:218`)                                                                                                                                                                                                                           | recommendation evidence/formula                                                           |
| **Life Graph (explainable)**    | `apps/web/src/components/lifeGraph/LifeGraphExplainabilityPanel.tsx` | workspace                                        | rec lineage, evidence, affected goals, confidence (`:151-205`)                                                                                                                                                                                                | — (good, but the page is unlinked; see Explainability doc)                                |

### Hard confirmations (greps that returned nothing)

- `why_ranking` / `why_number_one` / `ranked_above` / `needs_more_information` / `deduped_total`: **zero frontend consumers.**
- `recommendations/prioritize`: **zero frontend consumers** — every surface reads `/roadmap` or `/attention` instead, so the prioritization narrative the engine produces is never seen.
- `recommendations/audit`: **zero frontend consumers** — the quality proof is invisible.

---

## 3. Assessment against "elite advice" bar

A pilot user (VC / exec / founder / CPA) judges a recommendation on five things. Current state per surface:

| Dimension                          | Engine produces?                               | Shown on Roadmap page?                          | Shown on Dashboard/My-Life (where they land first)? |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| **The ask** (specific action)      | ✅ `recommended_action`                        | ✅ "Do: …" (`recommendations/page.tsx:291-295`) | ⚠️ title only                                       |
| **The why**                        | ✅ `description`/`narrative.why`               | ✅                                              | ✅                                                  |
| **Quantified impact**              | ✅ `$/yr`, success% before→after, coverage gap | ✅                                              | ⚠️ partial (`$/yr` only on some)                    |
| **The evidence**                   | ✅ `evidence[].statement` + `source_table`     | ✅ (in drawer)                                  | ❌ not shown                                        |
| **The confidence + ranking logic** | ✅ `confidence` + `formula` + `why_ranking`    | ✅ formula; ❌ why_ranking                      | ⚠️ confidence number only                           |

**Net:** the Roadmap page is ~90% of elite. The first-impression surfaces (dashboard hero, my-life) are ~40% — they read a different, thinner endpoint and discard the engine's best work.

---

## 4. Design: the elite recommendation moment

What a VC/exec/founder/CPA should feel when they see ONE recommendation — using only fields that already exist:

```
┌─────────────────────────────────────────────────────────────┐
│ [ACTION]  Increase your 401(k) from 6% to 9%        ●96% conf │  title + rec_type + confidence
│                                                               │
│ Now: 6%  →  Target: 9%   (+3%)                                │  current_state→target_state→delta
│                                                               │
│ +$4,200/yr captured match · retirement success 71% → 78%     │  quantified_impact (REAL recompute)
│                                                               │
│ Why this is your #1 move: highest priority score (2.9) —     │  why_ranking.why_number_one
│ higher impact than "Close your life-insurance gap" (0.8 vs    │  why_ranking.ranked_above
│ 0.5).                                                          │
│                                                               │
│ ▸ Why & evidence  ·  Based on: your 401(k) statement          │  evidence[].statement / source_table
│   Assumes: pre-tax traditional 401(k) (confirm w/ CPA)        │  assumptions
└─────────────────────────────────────────────────────────────┘
```

Every line above maps to a field the engine **already returns**. Nothing is invented. The only change is **surfacing**.

The defining differentiator vs. ChatGPT/a robo-advisor is the **"Why this is #1"** line (`why_ranking`) — it shows the system _reasoned about tradeoffs across the user's whole life_, not just answered a prompt. It is computed (`recommendations_os.py:504-522`) and shown nowhere. This is the cheapest, highest-impact win in the sprint.

---

## 5. Prioritized surfacing plan

### P0 — Make the first impression elite (highest leverage, all data exists)

1. **Point `MissionControl`'s "next best move" at the real recommendation.** It currently reads `/api/platform/dashboard` whose `next_best_action` is title+why only (`MissionControl.tsx:196-204`). Either enrich that endpoint's NBA from the OS, or have the hero additionally call `/api/recommendations` (roadmap `now[0]`) and render quantified impact + confidence + a "why this is #1". _Cheap win — the data and the formatting code already exist in `recommendations/page.tsx`._
2. **Surface `why_ranking` anywhere a top action appears.** The "Why this is your #1 move" line is fully computed and never shown. Add it to the Roadmap "Now" card and the dashboard hero. To get it, the roadmap consumer should also read `/prioritize` (which carries `why_ranking`) OR add `why_ranking` to the `/roadmap` payload (`recommendations_os.py:537-555` — it already computes `why_now` from the same `_why_first`, just not `ranked_above`).
3. **Enrich `/my-life` next-best-move** (`my-life/page.tsx:124-145`) with `recommended_action` + `expected_benefit` + a "Why & evidence ↗" link to `/dashboard/recommendations`. Backend already passes these in `my_life.py:171-177`; the page just doesn't render `recommended_action`/`expected_benefit`.

### P1 — Trust & differentiation

4. **Show `needs_more_information` as a value driver, not a gap.** `prioritize()` returns recs blocked by missing data with their `unlocked_capabilities`. Render a "Unlock more precise advice" strip (the Roadmap page already does this via `blocked_by` `:447-464`; bring it to the dashboard).
5. **Surface the `/audit` quality proof** somewhere a sophisticated user can find it (e.g. an "About these recommendations" expander): "100% quantified, 0 generic templates, recomputed outcomes" — this is exactly what a CPA/exec wants to see and it is computed in full (`audit()` `:577-628`).
6. **Promote conflicts.** The conflict engine ("these compete for the same dollars — sequence them") only renders on the Roadmap page (`recommendations/page.tsx:387-396`). A founder juggling priorities would value this on the dashboard.

### P2 — Polish

7. Add per-card "ranked above X because higher {factor}" chips from `why_ranking.ranked_above` on the Roadmap Next/Later cards.
8. Show `merged_from` count as "consolidated N related findings" prominently (already passed `:308`, shown small).
9. Make `/dashboard/recommendations` reachable in ≤1 click from the hero (currently behind "View all").

---

## 6. Blockers / risks

- **None code-breaking.** Every P0/P1 item is pure surfacing of existing fields.
- **Endpoint mismatch is the root cause:** first-impression surfaces read thinner aggregator endpoints (`/api/platform/dashboard`, `/api/life/attention`) instead of the rich `/prioritize`. Resolving P0 means either enriching those aggregators (`my_life.py`, the platform dashboard route) or fanning out one extra fetch — a product decision, not a technical blocker.
- **Honest-empty discipline must hold:** all the above must keep the existing empty states (e.g. `recommendations/page.tsx:398-402`, `MissionControl.tsx:96-165` activation state) — never show a fabricated rec to fill space.
