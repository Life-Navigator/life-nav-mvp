# LIFE GRAPH FOUNDATION — 2026-06-10

Priority 2 of the sprint: the visual + data architecture layer for the Knowledge Graph. **NOT GraphRAG, no
AI reasoning, no scoring/analytics** — pure visualization on existing domain data. Live on prod `d1a5e23`.

## What shipped

- **`/dashboard/life-graph`** — interactive **3D** force graph of the user's Personal Life Graph, built on
  the EXISTING `/api/life/graph` (Core API `personal_graph()` → objectives + dependencies + goals + risks +
  opportunities + constraints + `life_graph_edges`). Added `react-force-graph-3d` + `three`.
- **Interactions:** zoom / pan / rotate (built into the engine), **node click → details panel**, **search**
  (filter nodes by name), **domain filter**, and **view modes**.
- **View modes (3 real):** Brain View (all nodes, colour by type), Domain View (colour by domain), Dependency
  View (objectives + dependencies + their edges). One shared graph engine, different visualizations.
- **Node contract:** id, name (label), type, confidence, domain, **relationship_count** (computed from edges),
  status. The details panel shows what we know (type/domain/confidence), relationships, connected nodes
  ("rel → target"), and a data-lineage note. Honest gaps where a field isn't wired (e.g. confidence
  "Not yet scored") — nothing fabricated.
- **Edge contract:** source, target, relationship_type (`rel`), confidence (= weight); rendered as directional links.
- **Empty state:** when a user has no graph yet → "Your Life Graph is just getting started" + a Continue-discovery CTA (no fake nodes).
- Added to the dashboard sidebar.

## Validation (prod, fully-onboarded user with discovery data)

- Page loads; **WebGL `<canvas>` renders** (the page only mounts the 3D graph when real nodes exist — empty
  graphs show the empty state, so a present canvas ⟹ real nodes loaded).
- Brain / Domain / Dependency modes present; switching to Domain View keeps the canvas (re-colours).
- Search + domain-filter controls render; node-count readout present.
- **No crash, 0 page errors.** Zoom/pan/rotate are library-native.
- 0 tsc errors; build succeeded with `three` in the bundle.

## Success criteria — status

✅ Rotate / zoom / graph (3D engine). ✅ Expand/inspect nodes (click → details panel). ✅ Inspect relationship
weights (edge confidence + width). ✅ Trace data lineage (connected-nodes + source objectives). ✅ Understand
where recommendations will come from (the lineage note) — **without any AI reasoning**.

## Honest scope notes

- **Modes:** Brain/Domain/Dependency are real. **Timeline View + Decision View are NOT built** — they need
  data not in the current graph payload (per-node timestamps for Timeline; the decision tables for Decision
  View). Adding them = enrich `personal_graph()` (timestamps) + a decision-graph endpoint. Not faked.
- **Node contract:** `source_count` / `document_count` are not yet populated (the graph payload doesn't carry
  them) — shown via relationship_count + honest omissions, not fabricated counts. Enriching `personal_graph()`
  to include document/source counts is the next data step.
- **Priority 1 (Career/Education/Health tab CRUD wiring) was NOT done this turn** — I built the marquee Life
  Graph foundation. The tab-wiring is the mechanical continuation (endpoints exist; copy the Family Dependents
  pattern) and is best parallelized per-domain with agents next.

## Definition of Done — status

Foundation ✅: a real, interactive 3D Life Graph on existing data, with the node/edge contracts, details
panel, search, filter, and 3 modes — the visualization layer future Readiness/Recommendations/Advisor/Reports/
Decision Intelligence will draw from. Timeline/Decision modes + source/document counts + Priority-1 tab CRUD
are the scoped next steps.
