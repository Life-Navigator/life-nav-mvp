# Explainability Layer — Audit & Coherence Design

**Sprint:** Experience Excellence (make built intelligence visible)
**Scope:** Design + audit only. No code changes. No fabricated data. Reuse existing assets only. Real `file:line`.
**Date:** 2026-06-16

---

## TL;DR

The platform has built **four separate, high-quality explainability systems** — but they are scattered, partially orphaned, and use **different vocabularies for the same idea**. A user cannot answer "why does the system believe this?" with one consistent gesture across the app.

The most painful finding: the **richest explainability UI in the codebase — `/life-graph/explainable`, with full recommendation→evidence→source lineage and per-node XAI (weighted factors, reasoning summary) — has ZERO navigation links anywhere in the app** (grep for `life-graph/explainable` in `src` returns nothing but the page itself). The sidebar "Life Graph" link (`Sidebar.tsx:433`) points at `/life-graph`, a _second, older_ graph page. The crown-jewel explainability surface is effectively dead.

The fix is not to build — it is to **unify the vocabulary, link the orphaned surface, and apply the one provenance taxonomy that already exists everywhere it belongs.**

---

## 1. Inventory: the explainability assets that already exist

### A. The provenance taxonomy (the spine — already authoritative)

`apps/lifenavigator-core-api/app/services/my_life.py:116-141` defines the User Truth Model ordering and assigns it per-item:

> `user_confirmed` > `user_stated` > `advisor_inferred` > `assumption`

with `source`, `confidence`, `updated_at` (`my_life.py:136-141`). The matching UI component already exists: **`apps/web/src/components/ui/ProvenanceBadge.tsx`** renders 8 provenance types (Confirmed / On record / From document / Linked account / Calculated / Suggested / Inferred / Assumed) with a source+confidence+last-updated tooltip (`ProvenanceBadge.tsx:24-80`).

**Problem:** `ProvenanceBadge` is imported in exactly **one** place — `ExecutiveSummary.tsx:218`, on the vision only (grep confirms). The taxonomy is the right spine; it is applied to ~1% of the items that have provenance.

### B. The recommendation evidence layer (per-rec lineage)

Every recommendation carries `evidence[{statement, source_table}]`, `assumptions`, `formula`, `confidence` (`recommendations_os.py:56-100`). Surfaced beautifully in the Roadmap page's **Explainability drawer** — "Why this matters / Data used / Source lineage / Missing data / Assumptions / Confidence + formula / Expected impact / Affected domains" (`recommendations/page.tsx:104-251`). This is excellent and real.

### C. The Life Graph explainable workspace (graph lineage + XAI)

`apps/lifenavigator-core-api/app/services/life_graph_workspace.py` builds a **real, no-fabrication** graph: every edge is a persisted edge or a shared-node connection, each tagged with `provenance` (`persisted_edge` / `shared_node` / `computed_connection`) and a `citationId` (`life_graph_workspace.py:178-209`). `recommendation_lineage()` (`:95-165`) emits `recommendation → evidence → source` nodes/edges plus per-rec **`xai`** = `{reasoningSummary, formula, weightedFactors}` (`:135-137`). Two consuming UIs:

- `/life-graph` (linked) → `LifeGraphExplainabilityPanel.tsx` ("Why you can trust this" header `:104-111`, score calculation, data sources, recommendation lineage).
- `/life-graph/explainable` (**orphaned**) → the newer `features/life-graph` canvas (`app/life-graph/explainable/page.tsx`), reading `/api/life-graph/workspace` with the full `xai`/lineage payload.

### D. The deterministic why-chain / audit-trail subsystem

A whole separate trust surface keyed off `recommendation_audit_trail`:

- `GET /api/recommendations/[id]/why` — builds a structured `WhyChain` deterministically (no LLM in the answer path), persists to `why_chains` (`api/recommendations/[id]/why/route.ts`).
- `GET /api/recommendations/[id]/audit-trail` — returns `why_chains` + `evidence_links` + `recommendation_assumptions` + `counterfactual_scenarios` in one round-trip (`api/recommendations/[id]/audit-trail/route.ts`).

### E. The discovery why_chain (objective provenance)

Discovery captures the user's own why-chain and resolves a root objective from it. `snapshot()` returns `objectives[].why_chain` (`life_discovery.py:844`) and `primary_objective.{confidence, reasoning, confirmed}` (`:833-836`). The `/dashboard/discover` page shows the surface-goal → root-objective resolution ("You said you want X — but your real objective is Y" `discover/page.tsx:11-15`).

---

## 2. The core problem: four vocabularies, one question

A user wanting "why does the system believe this?" meets four different visual languages:

| Asset                     | Trust word used                                    | Visual                                   |
| ------------------------- | -------------------------------------------------- | ---------------------------------------- |
| ProvenanceBadge (A)       | Confirmed / Inferred / Assumed                     | colored pill                             |
| Recommendation drawer (B) | Data used / Source lineage / Assumptions           | expandable sections                      |
| Life Graph panel (C)      | "Why you can trust this" / Data sources / Verified | dark XAI panel                           |
| Why-chain/audit (D)       | WhyChain / evidence_links / counterfactuals        | (no UI surfacing the route output found) |

They all express the **same** underlying idea (this claim rests on evidence of a certain provenance and confidence) but share no component, color, or word. A pilot user can't learn the trust language once and apply it everywhere.

Additional gaps:

- **`/life-graph/explainable` is unreachable** (no nav link — see TL;DR).
- **The `why`/`audit-trail` routes (D) have no visible consumer** for recommendations (grep for the routes in components returns nothing) — a fully built deterministic trust API that nothing calls.
- **Provenance is computed but not shown** on most items: objectives carry `confidence`/`confirmed`/`why_chain`; constraints, risks, alerts all carry a `source` (`my_life.py` attaches `source` to every section: `:134, :155, :164, :191, :195, :197`) — but only the vision renders a badge.

---

## 3. Design: one coherent "why does the system believe this?" experience

### Principle: one badge, one drawer, one taxonomy — everywhere

Make the **ProvenanceBadge + a uniform "Why & evidence" drawer** the single trust gesture across the app, driven by the **existing** `provenance_type` ordering (`user_confirmed > user_stated > advisor_inferred > assumption`, extended by the badge's 8 types).

```
Any claim / objective / recommendation / risk / constraint:

  <statement>   [Inferred ▾]        ← ProvenanceBadge (provenance_type + source + confidence tooltip)
                └─ on click/expand ─┐
                                    ▾
  Why & evidence
  • Based on:  <evidence.statement>            (source_table → this item)   ← recs already have this
  • Assumes:   <assumption.label>: <value>
  • Confidence: NN%   ·   updated <date>
  • See it in your Life Graph →                ← deep-link to the node in /life-graph/explainable
```

Every field above already exists. The drawer is **already implemented** for recommendations (`recommendations/page.tsx:104-251`) — the design is to **lift it into a shared component** and feed it the same `{provenance, evidence, assumptions, confidence}` shape that `my_life.py` and `recommendations_os.py` already emit.

### Making trust visible without overwhelming (the calibration)

- **Default state = a single badge.** Most users see only the colored provenance pill. It's quiet.
- **Color carries the load honestly:** green = confirmed (ProvenanceBadge `user_confirmed` `:25-28`), neutral = on-record/document/linked, blue = calculated, **amber = suggested/inferred/assumed** (`:45-56`). The amber group is the honesty signal — "we inferred this, you haven't confirmed it." This already exists; it just needs to be everywhere a claim is presented.
- **Depth on demand:** the full evidence/lineage/formula drawer only opens on click (it already works this way on the Roadmap page).
- **One deep destination:** "See it in your Life Graph" links the item to its node in `/life-graph/explainable`, where the full lineage (rec→evidence→source) and XAI weighted-factors already render.

### The provenance ladder as a first-class trust object

Surface the taxonomy itself once (e.g. a small legend or an "About trust" panel) so the user learns the four levels: **Confirmed → On record → Inferred → Assumed.** The ordering is already defined and assigned in `my_life.py:116-125`; today it's invisible.

---

## 4. Prioritized plan (reuse only — no new infra/models/agents)

### P0 — Unlock what's already built

1. **Link `/life-graph/explainable`.** Add a nav entry (or repoint `Sidebar.tsx:433` from `/life-graph` to `/life-graph/explainable`, or add a "Explain" tab). The richest trust UI in the app is currently dead. _Pure routing change._
2. **Apply `ProvenanceBadge` to every source-labeled item.** `my_life.py` already attaches `source` to vision, what-matters, readiness, next-action, constraints, alerts (`:134-197`). Render the badge on `/my-life` next to each section (currently only `<Src>` plain text `:55-57`) and on `NeedsAttention` alerts (which already show `Source: …` `:109`). Backend already returns the structured `provenance` object for vision (`my_life.py:136-141`); extend the same shape to the other sections (cheap — the `source` string is already there; add `provenance_type` from each section's known origin).

### P1 — Unify the gesture

3. **Extract the Roadmap Explainability drawer into a shared `<WhyEvidence>` component** (`recommendations/page.tsx:104-251`) and reuse it for objectives (`why_chain` + `reasoning` + `confidence` from `life_discovery.py:833-844`) and any badged claim. One drawer, one vocabulary.
4. **Wire the deterministic why/audit-trail routes (D) to a UI.** The `/api/recommendations/[id]/why` and `/audit-trail` endpoints return structured chains/evidence/assumptions/counterfactuals with governance verdicts — surface them in the shared drawer for recommendations that have an audit row.
5. **Deep-link items to their graph node.** Add "See it in your Life Graph →" from a recommendation/objective to its `rec:<id>` / node id in `/life-graph/explainable` (the node ids are deterministic — `life_graph_workspace.py:108` `rnode = f"rec:{rid}"`).

### P2 — Teach the trust language

6. **Surface the provenance ladder** as a small legend or "About trust" panel (Confirmed → On record → Inferred → Assumed), so users learn the four levels once. Ordering exists at `my_life.py:116-125`.
7. **Show the graph's `provenance` edge labels** (persisted_edge / shared_node / computed_connection — `life_graph_workspace.py:187,201,162`) as a quiet legend in the explainable canvas so an edge's basis is legible.

---

## 5. Blockers / risks

- **None code-breaking.** Every item is routing, component reuse, or rendering an already-returned field.
- **The duplicate Life Graph pages** (`/life-graph` vs `/life-graph/explainable`) are a product decision: pick one as canonical (recommend `/life-graph/explainable` — newer `features/life-graph` stack with full XAI) and retire/redirect the other to avoid two trust UIs drifting apart.
- **Provenance-type completeness:** to badge non-vision items, each section needs a `provenance_type` (not just a `source` string). For most this is deterministic from origin (readiness = `system_calculated`, document-derived = `document_extracted`, objective = `advisor_inferred` unless confirmed) — a small backend mapping, not new intelligence. Until added, badge only the items that already carry a real type (avoid guessing → keep the honest-empty rule).
- **Honesty must hold:** never upgrade an `assumption`/`advisor_inferred` item to look `confirmed` to make the UI prettier — the amber signal is the whole point.
