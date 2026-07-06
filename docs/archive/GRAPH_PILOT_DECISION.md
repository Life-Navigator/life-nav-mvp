# Life Graph — What Ships for the Pilot

> **Sprint H — Graph Product Decision** · LifeNavigator Elite Pilot Sprint
> Companion to `GRAPH_GO_NO_GO.md` (verdict: NO-GO on graph-as-hero) and `GRAPH_FUTURE_VISION.md` (the destination).
> **Hard rules honored:** reuse existing components/data only. No new DB, no new infra, no new models. Honest states. No fabrication.

---

## The shipping decision

Ship a **premium "Life Map" Coming-Soon hero** that _teases the real edges + provenance we already have_, and demote the working 3D graph to a clearly-labeled, opt-in **"Explore the live graph (beta)"** surface. The hero is what an investor sees; the live graph is what a curious investor can choose to open. This presents our genuine moat (cited, no-fabrication relationships) at its best while the engineering visualization matures behind it.

This is **not** a fake "Coming Soon." It is a real preview built from real data — it just curates the presentation instead of dropping the viewer into a raw force-directed canvas.

---

## A. The Life Map hero (what investors see)

A single, designed landing surface at `/life-graph` (replacing the legacy page — see §C) with three bands, all populated from data we already compute:

### Band 1 — The narrative lead (real, not invented)

- Headline + one-line situation + the single next move, read from the **already-built `life_brief`** (`/api/life/my-life` → `life_brief`, the same source `LifeBrief.tsx` already renders on the dashboard).
- **Trust gate (reuse the existing one):** if `life_brief.ready === false`, fall back to the existing honest static explainer copy from `GraphStoryHeader.tsx:33-39` verbatim. Never fabricate a story. This is exactly the swap the code already anticipates (`GraphStoryHeader.tsx:13-15`).

### Band 2 — The "real edges + provenance" teaser (the moat, made legible)

A small, curated set (3–5) of the user's **actual** edges rendered as readable "connection cards," not as a 3D scene. Each card is one real edge from the workspace response (`/api/life-graph/workspace` → `edges[]`), showing:

- `source.label` → relationship `label` → `target.label` (e.g. "Emergency fund — _strengthens_ → Family security")
- A **provenance badge** humanized from the existing `provenance` field: `persisted_edge → "Confirmed connection"`, `shared_node → "Connected via {via}"`, `computed_connection → "Impacts {domain}"`.
- A **"Why we believe this"** line from the edge's `citationId` / `evidenceIds` (the lineage already in `recommendation_lineage`).
- Pick the cards by ranking the existing workspace edges by `strength` (desc) and taking the top few — no new scoring, no new judgment.

> This is the 10-second payoff: an investor reads three _cited, non-fabricated_ statements about the user's life and understands the moat without orbiting a hairball.

### Band 3 — The "this is a glimpse" CTA

- A single line: _"This is a small slice of your Life Map. The full interactive map is coming."_
- Two real CTAs: **"Explore the live graph (beta)"** → `/life-graph/explainable` (the working canvas, honestly labeled), and **"See what to do next"** → `/dashboard/recommendations` (reuse the existing link from `GraphStoryHeader.tsx:59-64`).

### Honest states (reuse existing definitions)

| State       | Condition                                   | Hero shows                                                                                                 |
| ----------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Empty       | `workspace.nodes.length === 0`              | Existing honest empty card copy (`page.tsx:164-181`) + "Nothing here is ever fabricated." No teaser cards. |
| In-Progress | Nodes exist, `life_brief.ready === false`   | Static explainer headline + whatever real edge cards exist + completeness CTA. No invented story.          |
| Ready       | Nodes exist AND `life_brief.ready === true` | Full narrative lead + real edge teaser cards + CTAs.                                                       |

---

## B. The live graph stays — honestly labeled, opt-in

Keep `apps/web/src/app/life-graph/explainable/page.tsx` exactly as built (it is trust-correct and works). Changes are framing only, all reuse:

- Reachable from the hero's "Explore the live graph (beta)" CTA and by direct URL — **not** the default landing surface for the demo.
- Add a small **"Beta — engineering preview"** chip in its header so a curious investor who opens it has the right expectation. (One badge; no logic change.)
- Demote the engineering telemetry: in `GraphAnalyticsStrip.tsx`, move `Verified edges %` / `Strongest link` / `Avg confidence` behind a "Details" toggle so the live view leads with `Nodes·Links / Recommendations / Evidence` and the debug stats are opt-in. (Pure reorder/hide; values stay real.)

No 3D rewrite, no layout engine change, no new dependency — the canvas (`LifeGraphCanvas.tsx`), node mesh, edge lines, and `query_focus` search all stay as-is.

---

## C. Retire the duplicate graph (demo-safety)

Two graphs are reachable today: `/life-graph` (legacy, `page.tsx` + `components/lifeGraph/*` + `/api/life-graph`) and `/life-graph/explainable` (primary, `features/life-graph/*` + `/v1/life-graph`). For the pilot:

- **Repurpose `/life-graph`** as the new **Life Map hero** (§A).
- Point both nav entries (`Sidebar.tsx:435`, `LifeGraphSidebar.tsx:51`) at `/life-graph` (the hero), which itself links to `/life-graph/explainable` for the live view.
- The legacy `LifeGraph3D` stack can be left in place but unlinked, or deleted later — it is no longer a nav target. One canonical demo surface.

---

## Implementation note (reuse map — no new infra)

| Need                        | Reuse                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Narrative lead              | `/api/life/my-life` `life_brief` (already powers `LifeBrief.tsx`)                                      |
| `ready:false` fallback copy | existing static text in `GraphStoryHeader.tsx:33-39`                                                   |
| Real edge teaser cards      | `/api/life-graph/workspace` → `edges[]` + `nodes[]` (already built by `build_workspace`)               |
| Provenance badges           | existing edge `provenance` / `via` / `citationId` / `evidenceIds` fields                               |
| Edge ranking for the teaser | existing `strength` field (sort desc, take top N — no new scoring)                                     |
| Empty / honest states       | existing empty card `page.tsx:164-181`, existing trust copy                                            |
| CTAs                        | existing `/dashboard/recommendations` link, existing `/life-graph/explainable` route                   |
| Live graph (unchanged)      | `LifeGraphCanvas.tsx`, `GraphNodeMesh.tsx`, `GraphEdgeLine.tsx`, `NodeDetailsPanel.tsx`, `query_focus` |

**New backend: none.** **New model calls: none** (the hero reads two endpoints that already exist). **New deps: none** (the hero is DOM/CSS cards, not r3f — it actually _removes_ the demo's reliance on the 3D scene rendering well).

---

## Trust invariants (must not break)

1. No teaser card for an edge that isn't in `build_workspace`'s provenance-tagged output. The hero never invents a relationship the live graph wouldn't draw.
2. No narrative when `life_brief.ready === false` — fall back to the honest static explainer.
3. Provenance badges only relabel the _existing_ `provenance` value; they never upgrade `shared_node`/`computed_connection` to "Confirmed."
4. Empty state never fabricates teaser cards — it shows the existing honest empty card.

## Definition of done (pilot)

- [ ] `/life-graph` renders the Life Map hero (narrative lead + real edge teaser cards + CTAs) from `life_brief` + `/v1/life-graph/workspace`, with the `ready:false` static fallback.
- [ ] Teaser cards are real edges, ranked by `strength`, with humanized provenance badges and a citation line.
- [ ] Empty / In-Progress / Ready states all correct and non-fabricated.
- [ ] `/life-graph/explainable` carries a "Beta — engineering preview" chip; debug stats moved behind a "Details" toggle.
- [ ] Both nav entries point at the hero; no second graph is a default nav target.
- [ ] Live on the actual demo account: hero looks premium whether the account is sparse or dense (the card layout is density-invariant — that is the point).
