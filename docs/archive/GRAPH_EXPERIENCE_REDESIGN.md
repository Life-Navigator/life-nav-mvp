# Life Graph Experience Redesign — From Engineering Console to Understanding

> **Sprint G — Life Graph Storytelling** · LifeNavigator Elite Experience Sprint V2
> Surfacing-first. No new databases, infrastructure, or models. All redesign reuses existing endpoints and components.

## Grounded finding

The explainable Life Graph (`apps/web/src/app/life-graph/explainable/page.tsx`, backed by `/v1/life-graph/workspace` → `life_graph_workspace.build_workspace`) is one of the most trustworthy surfaces in the product — every node is persisted, every edge carries provenance (`persisted_edge` / `computed_connection` / `shared_node`, `life_graph_workspace.py:177-204`), and recommendations carry full evidence + XAI lineage (`life_graph_workspace.py:95-165`). But the **information architecture is inverted for a consumer**: the page leads with a developer's mental model — a node/edge counter (`page.tsx:118-122`), an analytics strip of `Avg confidence` / `Verified edges %` / `Strongest link` (`GraphAnalyticsStrip.tsx:54-67`), a five-mode technical view switcher (`GraphSidebar.tsx:13-24`), and a static paragraph about _how the graph works_ (`GraphStoryHeader.tsx:33-39`). The richest consumer-facing intelligence — the composed `life_brief` narrative (`LifeBrief.tsx`, `/api/life/my-life`) and per-domain `graph_integrity` (`life_discovery.py:1083+`) — exists but is never read by this page. This redesign rebalances the IA so the user _understands their life in 10 seconds_, demotes the engineering telemetry, and surfaces already-computed narrative and completeness — without building anything new.

---

## IA: before → after

### Before (current layout, `page.tsx:109-207`)

```
┌───────────┬───────────────────────────────────────────────┬──────────────┐
│ SIDEBAR   │ HEADER: "Life Knowledge Graph"                 │ NODE DETAILS │
│ (techy    │   N nodes · M connections   [search box]       │ (rich, but   │
│  view     ├───────────────────────────────────────────────┤  empty until │
│  modes +  │ STORY HEADER: static "how the graph works"     │  you click)  │
│  badges)  ├───────────────────────────────────────────────┤              │
│           │ ANALYTICS STRIP: avg confidence / verified % /  │              │
│           │   strongest link / zoom buttons                │              │
│           ├───────────────────────────────────────────────┤              │
│           │ 3D CANVAS (dots + lines)                        │              │
└───────────┴───────────────────────────────────────────────┴──────────────┘
```

Lead message: _"here is a graph data structure."_ Time-to-understanding: requires interpretation.

### After (rebalanced; same components, reordered + fed real narrative)

```
┌───────────┬───────────────────────────────────────────────┬──────────────┐
│ SIDEBAR   │ STORY HEADER (LEAD): real life_brief headline   │ WHY WE       │
│ (renamed  │   + next_move  ·  [▸ top risk][opp][do-next]    │ BELIEVE THIS │
│  human    ├───────────────────────────────────────────────┤ (reframed    │
│  views +  │ GUIDED STEPPER: Goals ▸ Risks ▸ Recs ▸ Sources  │  node panel: │
│  domain   ├───────────────────────────────────────────────┤  "why this   │
│  complete-│ 3D CANVAS — auto-focused on the #1 node         │   matters"   │
│  ness     │   [search box overlay top-right]               │   leads)     │
│  bars)    ├───────────────────────────────────────────────┤              │
│           │ TELEMETRY (collapsed): nodes/edges/confidence  │              │
└───────────┴───────────────────────────────────────────────┴──────────────┘
```

Lead message: _"here is what your life says, and the one thing to do next."_ Time-to-understanding: ≤10s.

---

## Interaction design

1. **Auto-focus on load.** Reuse `cameraApi` (`page.tsx:30`) — after `fetchLifeGraphWorkspace` resolves, fit the view then center the single highest-importance risk or top-priority recommendation (ranking fields already on each node, `life_graph_workspace.py:34-58,129`). The drill path `drill(node)` (`page.tsx:84-90`) already does the camera-center + select; call it once on first paint.
2. **Spotlight chips drill, don't just decorate.** Each chip → `drill(node)`; the existing breadcrumb trail (`GraphBreadcrumbs.tsx`, `page.tsx:84-97`) already records the journey, so back/jump navigation is free.
3. **Guided "Show me" stepper** reuses the five existing view modes as an ordered tour (`setView`, `page.tsx:40-62`) instead of a flat sidebar list. The sidebar remains for power users.
4. **Search becomes "ask the graph."** `query_focus` already returns real embedding relevance (`life_graph_workspace.py:240-265`); reframe the placeholder from "Search goals, risks…" to "Ask: what affects my retirement?" and dim non-relevant nodes (the `nodeRelevance` map is already wired through to the canvas, `page.tsx:78,193`).
5. **Telemetry on demand.** Move `GraphAnalyticsStrip` metrics into a collapsible "Graph health" disclosure; keep the zoom/fit/reset controls always visible (they are interaction, not telemetry).

## Visual design

- **Encode meaning, not just domain.** Today color = domain only. Add a **shape/halo by `type`**: risks get an amber/red warning halo, opportunities a green halo, the vision/objective nodes a larger radius (importance already drives size potential via `node.importance`). Pure visual layer over existing `LifeGraphCanvas` / `GraphNodeMesh.tsx`; no data change.
- **Dim by relevance** during search using the existing `nodeRelevance` values (`page.tsx:193`) — strong matches glow, others recede.
- **Provenance legend** (persisted = solid line, computed/shared = dashed) so edge trust is visible at a glance; `edge.provenance` is already on every edge.
- **Demote numbers:** confidence/verified-% rendered as small muted text in the collapsed health panel, not as the headline.

## Honest states (per surface)

| Surface                                 | Empty                                                                       | In-Progress                                                                                                               | Complete                                              |
| --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Whole page** (`page.tsx:158-187`)     | Keep current empty card + "Talk to your advisor" CTA (`:164-181`).          | Nodes exist, `life_brief.ready=false` or domains <100% integrity → static explainer + completeness bars + "add data" CTA. | Real `headline`+`next_move` lead, spotlight, stepper. |
| **Story header**                        | Suppressed.                                                                 | Static "how the graph works" copy (current, honest).                                                                      | Real `life_brief`.                                    |
| **Spotlight chips**                     | None.                                                                       | Show only chips that have a real node (omit missing categories).                                                          | Up to 3 chips.                                        |
| **Per-view** (`page.tsx:183-187`)       | "Nothing to show in this view yet." + link to the matching dashboard route. | same                                                                                                                      | nodes render.                                         |
| **Node panel** (`NodeDetailsPanel.tsx`) | "Select a node…" (`:41-45`).                                                | per-section empties already honest (`:91-175`).                                                                           | full lineage.                                         |
| **Sidebar completeness**                | hidden when no nodes.                                                       | "Career 80% · Health 0% mapped" from `graph_integrity`.                                                                   | all domains complete.                                 |

All empty/in-progress copy explicitly reinforces _"Nothing here is ever fabricated"_ — already the page's voice (`page.tsx:171`).

---

## Backend touch (surfacing only, no new infra)

- **Pass `graph_integrity` through `build_workspace`** (`life_graph_workspace.py:168-221`). It is already computed and returned by `personal_graph` (`life_discovery.py:1077-1081`) but dropped in the mapping. Add it to the workspace `metrics` or a `domains` field — pure passthrough, no new query.
- **No change to `/v1/life-graph/query-focus`** — embeddings relevance already correct.
- **`life_brief`** is fetched client-side from the existing `/api/life/my-life` route the dashboard already calls; the graph page just consumes the same endpoint. No backend change.

## Files in scope

| File                                                                  | Change                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/src/app/life-graph/explainable/page.tsx`                    | Reorder layout; fetch `life_brief`; auto-focus; stepper; collapse telemetry.      |
| `apps/web/src/features/life-graph/components/GraphStoryHeader.tsx`    | Render real `life_brief` with `ready:false` fallback + spotlight chips.           |
| `apps/web/src/features/life-graph/components/GraphAnalyticsStrip.tsx` | Wrap metrics in a collapsible "Graph health"; keep camera controls.               |
| `apps/web/src/features/life-graph/components/GraphSidebar.tsx`        | Human-label views; add per-domain completeness bars from `graph_integrity`.       |
| `apps/web/src/features/life-graph/components/NodeDetailsPanel.tsx`    | Reorder: "Why this matters" + next move lead; humanize section/provenance labels. |
| `apps/web/src/features/life-graph/components/GraphNodeMesh.tsx`       | Type-based halo/shape + relevance dimming (visual only).                          |
| `apps/web/src/features/life-graph/components/GraphEdgeLine.tsx`       | Solid vs dashed by `edge.provenance`.                                             |
| `apps/lifenavigator-core-api/app/services/life_graph_workspace.py`    | Pass `graph_integrity` through `build_workspace`.                                 |

## Definition of done

- [ ] A first-time user with an empty graph sees the honest empty card with one clear CTA and zero dead ends.
- [ ] A returning user with `life_brief.ready=true` reads their real headline + next move within 10 seconds of load, before any interaction.
- [ ] The camera auto-focuses the single most important node on first paint.
- [ ] Spotlight chips, stepper, and search all drive the existing canvas/camera/view machinery — no new state stores.
- [ ] Engineering telemetry (counts, confidence %, verified %) is present but demoted to a collapsible panel.
- [ ] Per-domain completeness bars render from `graph_integrity`; 0% domains read as honest In-Progress, not failure.
- [ ] Every edge's provenance is visually distinguishable; no inferred edges are ever introduced.
- [ ] `pnpm typecheck` / existing life-graph tests pass; no new endpoints, tables, or models added.
