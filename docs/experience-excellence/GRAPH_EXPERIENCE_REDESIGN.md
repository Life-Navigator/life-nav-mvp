# 3D Life Graph — Experience Audit & Redesign

**Sprint:** Experience Excellence (make built intelligence visible, useful, beautiful, memorable)
**Scope:** Design + audit only. No code changes here. Cheap surfacing wins are flagged.
**Hard rule:** No mock/fabricated data, ever. Honest empty states only. **Real edges + citations only.**

---

## 1. What actually exists today (real file:line)

There are **two** Life Graph surfaces, both real, both edges-only with provenance.

### 1.1 Pages

- **`/life-graph`** — `apps/web/src/app/life-graph/page.tsx:14`. Full 3D "brain" with sidebar, node panel,
  explainability panel, analytics strip, decision drilldown, breadcrumbs. Fetches `/api/life-graph`
  (`:26`). Empty state is honest and well-written (`:164-177`): _"Your graph is still forming… Nothing here
  is fabricated."_ Loading state `:109-120`, error state `:122-134`. Top bar shows Life Readiness + node
  count (`:140-159`).
- **`/life-graph/explainable`** — `apps/web/src/app/life-graph/explainable/page.tsx:19`. The provenance-first
  graph this sprint references. Fetches the workspace (`:33`), supports 5 view modes
  (`brain/network/timeline/sources/recommendations`, `:39-61`), semantic search via `queryLifeGraph`
  (`:71-81`), drill + breadcrumb trail (`:83-104`), node-details panel (`:194`). Honest empty state
  (`:161-171`) and per-view empty state (`:173-177`).

### 1.2 Data (backend — real, edges-only, provenance-tagged)

- **Router:** `apps/lifenavigator-core-api/app/routers/life_graph.py`
  - `GET /v1/life-graph/workspace` (`:38`) — real persisted nodes + provenance edges + recommendation
    lineage + metrics. Never 500s the canvas; empty graph is a valid state (`:45-50`).
  - `POST /v1/life-graph/query-focus` (`:53`) — real embedding-based semantic relevance per node id; no
    match / no embeddings → `{}` (`:59-69`).
- **Workspace builder:** `apps/lifenavigator-core-api/app/services/life_graph_workspace.py` —
  _the trust core._ Header docstring (`:1-12`): _"It invents NOTHING: every node is a real persisted record
  and every edge is backed by a real persisted edge or a real computed connection (shared node)… if the
  advisor cannot cite an edge, the graph cannot draw it."_
  - Node mapping `_map_node` (`:61`) with real source lineage (`table` + `record_id` → `dataUsed`, `:73-83`).
  - Edges in three honest tiers: **persisted** (`provenance="persisted_edge"`, `:179-190`), **computed via
    shared node** (`provenance="shared_node"`, with the `via` citation, `:192-204`), and **recommendation →
    evidence → source lineage** (`recommendation_lineage`, `:95-165`) — every rec carries evidence nodes,
    source nodes, assumptions, missing-data, and a weighted-factor XAI block (`:113-137`).
  - Real semantic focus via cosine over Gemini embeddings (`query_focus`, `:240-265`), bounded to 120 nodes
    for cost (`_MAX_FOCUS_NODES`, `:39`), normalized so the top match ≈ 1.0 (`:262`).
- **Graph source:** `apps/lifenavigator-core-api/app/services/life_discovery.py:934` `personal_graph()` —
  builds nodes/edges from **persisted** rows only (active objectives, `:937-944`):
  - **Life Vision** (purple, `:947`), **Life Objective** (indigo + confidence, `:949`), then Goal (blue),
    Dependency (amber), Risk (red), Opportunity (green), Constraint (rose) (`:950-953`).
  - Domain population: real CRUD entities (Family/Career/Education/Health) become nodes attached to a
    **domain hub** with `part_of` edges, and hubs link to objectives via `supports` edges (`:954-994`).
    Only discrete entity tables, _"so the graph doesn't flood"_ (`:956`).
  - Stored `life_graph_edges` filtered to endpoints that exist (`:997-999`). Legend at `:1004`.

### 1.3 Rendering (the legibility-critical layer)

- **Canvas:** `apps/web/src/features/life-graph/components/LifeGraphCanvas.tsx:113`. A d3-force-3d layout
  (`buildLayout`, `:32-56`) with charge `-180` and link distance scaled by strength (`:47`), 220 ticks
  (`:53`). Only simulates links whose **both** endpoints exist (`:37-39`) — no fabricated connections.
  Renders every edge (`:141-160`) and every node (`:162-173`) into a `<Canvas>` with stars + brain shell.
- **Node mesh:** `apps/web/src/features/life-graph/components/GraphNodeMesh.tsx:34`. **Colors by _domain_**
  (`:23-32,48`) — finance green, career purple, etc. Size by importance + relevance + selection
  (`:46`). **Every node renders a persistent HTML label** (`<Html>` at `:80-100`) showing label + score +
  confidence — _always on, for every node._

---

## 2. Honest assessment — legible "this understands me," or a hairball?

### What is genuinely excellent (do not break)

- **The trust model is the moat and it is real.** Edges-only, three provenance tiers, citations on every
  edge, advisor-and-graph-agree-on-relationships (`life_graph_workspace.py:1-12,179-204`). This is rare and
  defensible. The empty states are honest and on-brand (`page.tsx:164-177`, `explainable/page.tsx:161-177`).
- **Real semantic search** that returns `{}` rather than guessing (`life_graph.py:59-69`).
- **Recommendation lineage** that shows _why_ a recommendation exists, down to the source table
  (`life_graph_workspace.py:95-165`).

### Where it fails the "this understands me" moment

1. **It colors by ontology domain, not by narrative role.** `GraphNodeMesh` colors by `domain`
   (`:23-32,48`), so the Life Vision, the primary objective, a risk, and a routine certification can all be
   the _same color_ if they share a domain. The user's eye has no way to find "the center of my life."
   The backend _knows_ the role — `personal_graph` colors Vision purple / Objective indigo / Risk red, etc.
   (`life_discovery.py:947-953`) and the workspace preserves `type` (goal/risk/opportunity/recommendation/
   source) and `importance` (Vision=1.0, Objective=0.9, `life_graph_workspace.py:34-37`) — **but the
   frontend throws the role away and colors by domain instead.** This is the single biggest legibility miss.

2. **Persistent labels on every node = guaranteed hairball at scale.** `GraphNodeMesh` always renders an
   HTML label (`:80-100`). With domain CRUD entities flooding in (dependents, skills, certs, programs,
   supplements — `life_discovery.py:957-968`), this is dozens of overlapping always-on tooltips in 3D
   space. There is **no progressive disclosure of labels** (only of _focus_, via search dimming and drill).

3. **It opens as an abstract "brain," not the person's story.** The layout is a force-directed cloud
   centered on `(0,0,0)` (`LifeGraphCanvas.tsx:50`). Nothing anchors the camera or the layout on the Life
   Vision / primary objective. A non-technical exec sees a pretty constellation, not _"this is my life, and
   that bright node in the middle is what I'm working toward."_ The narrative that would make it land —
   `life_brief()` (`life_discovery.py:416`), `dominant_narrative`, `primary_objective` — exists and is
   **not surfaced on the graph at all.**

4. **Two graphs, divergent.** `/life-graph` (`/api/life-graph`) and `/life-graph/explainable`
   (`/v1/life-graph/workspace`) are separate data paths and separate component trees
   (`components/lifeGraph/*` vs `features/life-graph/*`). A user (and the team) must reconcile two "Life
   Graphs." This dilutes the moment and doubles maintenance.

**Verdict:** the _data and trust layer is elite_; the _experience layer renders it as an ontology diagram,
not a life story._ It is closer to a hairball-with-good-bones than a "this understands me" moment — but the
fix is almost entirely **frontend layout/encoding over the existing API**, no new data.

---

## 3. Design — make the graph a "this understands me" moment

**Principle:** narrative-anchored layout, role-encoded visuals, progressive disclosure, real edges +
citations only. Reuse `/v1/life-graph/workspace` and `personal_graph` as-is. Standardize on the
**explainable** surface.

### 3.1 Narrative-centered layout (the core change)

- **Anchor the camera and the layout on the user's center.** Use the highest-`importance` node — the Life
  Vision (importance 1.0) or, absent a vision, the primary objective (0.9) — already provided by the
  workspace (`life_graph_workspace.py:34-37,55-58`). Pin it at the origin and let the force layout radiate
  outward, instead of an undifferentiated `forceCenter(0,0,0)` (`LifeGraphCanvas.tsx:50`).
- **Open with a one-line "this is you" header** above the canvas, sourced from `life_brief.headline` +
  `situation` (`life_discovery.py:442,449`) — already composed, already honest when forming
  (`:431-440`). The `/v1/life-graph/workspace` response would carry it (it already calls `personal_graph`;
  `life_brief` is a pure function over the snapshot). _Surfacing win, no new intelligence._

### 3.2 Encode role, not just domain

- **Shape/halo by node `type`** (goal/objective/risk/opportunity/recommendation/evidence/source) which the
  workspace already sends (`life_graph_workspace.py:43-47`), and keep **domain as the color**. Then a user
  instantly distinguishes "my goal" from "a risk" from "a piece of evidence" — the role the backend already
  knows (`life_discovery.py:947-953`) but the mesh discards.
- **Size by `importance`** (already in the contract, `:55-58`; mesh already uses it, `GraphNodeMesh.tsx:46`)
  so Vision/Objective visibly dominate. Good — keep and lean into it.

### 3.3 Progressive disclosure (kills the hairball)

- **Labels only for: the anchor, selected/focused nodes, search hits, and the top-N by importance.**
  Today every node is labeled always (`GraphNodeMesh.tsx:80-100`). Gate the `<Html>` label on
  `selected || focused || relevance > X || importance ≥ threshold`. Everything else is a glowing node you
  _drill into_ — the drill + breadcrumb flow already exists (`explainable/page.tsx:83-104`).
- **Default view = "brain" but pre-focused on the anchor**, not the full flood. The view modes
  (`sources`, `recommendations`, `network`, `timeline`, `:39-61`) become progressive lenses, not the
  first thing thrown at the user.
- **Cluster domain CRUD entities under their hub by default**; expand on hub click. The hub nodes + `part_of`
  edges already exist (`life_discovery.py:974-994`) — collapse the children visually until the user drills.

### 3.4 Keep the trust spine exactly as-is

- Real edges only, three provenance tiers, citations (`life_graph_workspace.py:179-204`). The
  `NodeDetailsPanel` (`explainable/page.tsx:194`) showing `dataUsed` / evidence / `via` citation is the
  payoff of a drill — keep it and make it the _reward_ for progressive disclosure.
- Honest empty state unchanged (`explainable/page.tsx:161-171`).

### 3.5 Consolidate to one graph

- Standardize on `/life-graph/explainable` + `/v1/life-graph/workspace` (richer: provenance, lineage,
  semantic focus). Redirect `/life-graph` to it or migrate the better bits (decision drilldown) over, and
  retire the duplicate `/api/life-graph` path + `components/lifeGraph/*` tree. One graph, one moment.

---

## 4. Prioritized plan

### P0 — make it legible and narrative-anchored (frontend only, existing API)

1. **Gate node labels** (progressive disclosure) in `GraphNodeMesh.tsx:80-100` on
   selected/focused/search-hit/high-importance. _Single highest-impact anti-hairball fix._
2. **Encode role:** shape or halo by node `type`, color stays domain (`GraphNodeMesh.tsx:48`). Uses fields
   already in the contract.
3. **Anchor layout + camera** on the highest-importance node (`LifeGraphCanvas.tsx:50,buildLayout`) instead
   of generic center.
4. **Narrative header** over the canvas from `life_brief.headline`/`situation`
   (`explainable/page.tsx` header at `:114-136`). _Pure surfacing of an existing, honest function._

### P1 — progressive depth

5. **Collapse domain CRUD children under hubs** by default; expand on hub drill (data already hub-structured,
   `life_discovery.py:974-994`).
6. **Reframe view modes as lenses** triggered from the narrative, not the default flood
   (`explainable/page.tsx:39-61`).
7. **Surface `life_brief` on the workspace response** so the graph and the dashboard tell the same story
   (add to `life_graph.py:38` response from the existing snapshot; `life_brief` is pure).

### P2 — consolidation & polish

8. **Merge the two graphs** onto `explainable` + `/v1/life-graph/workspace`; retire `/api/life-graph` and
   `components/lifeGraph/*`. One canonical surface.
9. **Re-anchor camera transitions on drill** so drilling _into_ a node feels like zooming into a chapter of
   the story (camera focus already exists, `LifeGraphCanvas.tsx:58-76`).

---

## 5. Blockers / things to verify before building

- **Confirm `life_brief` is reachable from the workspace path** without a second round-trip: `life_graph.py`
  already calls `life.personal_graph` (`:46`); it would also need the `snapshot` to compose `life_brief`
  (`life_brief` takes a snapshot, `life_discovery.py:416`). Both come from the same service — verify it's a
  cheap add, not a new query storm.
- **Verify label gating doesn't hide the anchor** — the one node that must always be labeled is the
  Vision/primary objective.
- **Two-graph merge needs a decision on the decision-drilldown feature** (`page.tsx:197-199`,
  `DecisionDrilldown`), which only exists on the `/life-graph` surface today. Port it before retiring that
  page, or it's a regression.
- No new data, no new model/agent work is required for P0–P1 — all fields (`type`, `importance`, `domain`,
  provenance, `life_brief`) already exist. This is an **encoding + layout + surfacing** sprint, exactly the
  brief.
