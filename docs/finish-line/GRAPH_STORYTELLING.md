# Graph Storytelling — FINAL Plan (Finish Line)

**Sprint:** Finish Line. **Scope rule:** Design only — do NOT change code, do NOT commit.
Surface EXISTING data; no new models / agents / infra / DB; no fabrication; honest empty states only.

**Consolidates (does not duplicate):**

- `docs/experience-excellence/GRAPH_EXPERIENCE_REDESIGN.md` — original audit of both graph surfaces.
- `docs/pilot-polish/EXPLAINABLE_GRAPH_LAUNCH.md` — navigation repoint + the `GraphStoryHeader` launch.

This is the **final** plan to make the graph TELL A STORY, not display an ontology. Every node must
answer four questions: **Why is this here? What does it affect? What changed? What should I do?** —
using only data the backend already provides.

---

## 0. Verdict in one line

The graph is trustworthy (real edges + provenance + citations only) but it **reads as an ontology**:
nodes are colored by _domain_, the role the backend already knows (Vision / Objective / Risk /
Recommendation) is discarded, every label is always-on (noise), the camera lands nowhere, and the node
panel is a flat field dump. The fix is to _re-encode the role/importance/provenance the backend already
sends_ into shape, halo, label gating, camera anchor, and a "why / affects / changed / do" panel.
**No new infra or model — every input below already exists in the workspace contract.**

---

## 1. What exists today (real file:line)

### Surfaces

- Primary graph: `apps/web/src/app/life-graph/explainable/page.tsx:20` (nav now points here per
  `EXPLAINABLE_GRAPH_LAUNCH.md`). Fetches the workspace (`:34`), 5 view modes
  (`brain/network/timeline/sources/recommendations`, `:40-62`), semantic search (`:72-82`), drill +
  breadcrumb trail (`:84-105`). Honest empty state (`:164-181`), per-view empty state (`:183-187`).
- Story header: `features/life-graph/components/GraphStoryHeader.tsx` — **already shipped.** Explains
  _how_ the graph works ("every dot is real… every line we can cite") + real counts (nodes/edges/recs/
  sources, `:21-24`). It deliberately does NOT tell a per-user story yet (`:8-16`). It is dismissible
  (`:18-19,68-75`).

### Backend already provides the storytelling inputs (this is the key finding)

`apps/lifenavigator-core-api/app/services/life_graph_workspace.py` maps the REAL persisted graph and
**already emits role + importance + provenance + citations** — the frontend just ignores most of it:

- **Role / node `type`** (`workspace.py:22-47`, `_contract_type`): `Life Vision`/`Life Objective`/`Goal`
  → `goal`; `Risk`/`Constraint` → `risk`; `Opportunity` → `opportunity`; `Dependency` → `source`; hubs
  → `domain`; recommendations → `recommendation`, with `evidence` + `source` lineage nodes
  (`recommendation_lineage` `:95-165`). Contract enumerates 11 types (`features/life-graph/types.ts:1-12`).
- **Importance** (`workspace.py:34-40,55-58`): `Life Vision` **1.0**, `Life Objective` **0.9**,
  `Goal` 0.6, `Risk`/`Opportunity` 0.5, hub 0.7, recs by priority (`_PRIORITY_IMPORTANCE` `:40`).
- **Provenance + citations on edges** (`workspace.py:179-204`): `persisted_edge` / `shared_node` /
  `computed_connection`, each with `via` (human label of the shared node) + `viaId` + `citationId`.
- **Per-node lineage**: `dataUsed` (real source table + record id, `workspace.py:73-83`), recommendation
  `xai` (`reasoningSummary`/`formula`/`weightedFactors`, `:135-137`), `evidenceIds`, `impactedDomains`,
  `assumptions`, `missingData` (`:131-134`).
- **`description`** carries the rec's narrative "why" (`workspace.py:130,135`).

### What the frontend throws away (the bug)

- **`GraphNodeMesh.tsx`** colors **only by domain** (`domainColors` `:23-32`, `color` `:48`). It reads
  `importance` only into sphere _size_ (`:43,46`) and **never reads `node.type` at all.** A Vision
  (importance 1.0, the user's north star) and a low-confidence source node look like the same kind of
  thing — just different sizes/colors. Role is invisible.
- **Labels are always on** for every node (`GraphNodeMesh.tsx:80-100`) → a wall of text; the eye can't
  find the story. There is no progressive disclosure.
- **Camera** initializes at a fixed `[0,0,360]` and fits to the whole cloud (`LifeGraphCanvas.tsx:133`,
  `ControlsBridge.fit` `:100-104`). `CameraFocus` (`:58-76`) only moves on an explicit drill — on load
  the user lands on _nothing in particular_. The highest-importance node (the Vision, 1.0) is not the
  entry point.
- **`NodeDetailsPanel.tsx`** is a flat dump of ~10 equal sections (Score/Confidence/Importance,
  Relationships, Impacted, Data used, Weighted factors, Assumptions, Missing, Formula `:57-177`). It
  shows everything and emphasizes nothing — it does not answer Why / Affects / Changed / Do as a story.

---

## 2. The four questions every node must answer (mapped to existing data)

| Question                 | Existing data it comes from                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Why is this here?**    | `node.description` / `xai.reasoningSummary` (`workspace.py:130,135`); incoming edges + their `via`/`citationId`. |
| **What does it affect?** | Outgoing edges (`NodeDetailsPanel` already computes both directions, `:24-37`) + `impactedDomains` (`:96-111`).  |
| **What changed?**        | `node.lastUpdated` (`workspace.py:71`) + `metrics.lastUpdated` (`:219`). Surfaced in panel header.               |
| **What should I do?**    | Connected `recommendation` nodes (via edges) → link to `/dashboard/recommendations` (already in story header).   |

All four are already in the payload. The work is _encoding + framing_, not computation.

---

## 3. The encoding plan (P0/P1/P2)

### P0 — role-based shape/halo (stop coloring only by domain) + label gating

These are the changes that turn an ontology back into a story; both are local to existing components.

1. **Role-based geometry in `GraphNodeMesh.tsx`.** Add a `roleStyle(node.type)` map (the data is right
   there — `node.type`, currently unread). Keep domain as the _color_ (familiar) but encode **role as
   shape/treatment** so the eye reads _kind_ before _category_:
   - `goal` (Vision/Objective/Goal) → keep sphere, but a **distinct halo ring** whose intensity scales
     with `importance` (Vision 1.0 = brightest). Replace the current relevance-only halo
     (`GraphNodeMesh.tsx:67-77`) with `relevance || importance≥0.9`.
   - `risk` → angular/octahedron geometry + amber/rose emissive accent (warning read).
   - `opportunity` → upward accent / brighter emissive.
   - `recommendation` → a marked "action" treatment (e.g. ring/badge) so the _do-this_ nodes pop.
   - `source` / `evidence` → smaller, lower emissive, recede (they are lineage, not story).
   - `domain` (hubs) → neutral large anchor.
     Keep `domainColors` (`:23-32`) for hue; add role to shape/emissive/halo. **No data added.**
2. **Progressive label disclosure.** Today labels are always on (`GraphNodeMesh.tsx:80-100`). Gate them:
   show the label **only** when `importance ≥ 0.7` (Vision/Objective/hubs/high-pri recs) OR
   `selected || focused || relevance > 0.55` (the relevance signal already exists, `:67`). Everything
   else shows its label on hover/focus. Result: on load the user sees the _spine_ (north star →
   objectives → top risks/recs) labeled, and the lineage stays quiet until explored.

### P1 — narrative camera anchor + the "why / affects / changed / do" panel

3. **Camera anchors on the story, not the centroid.** On load, pick the **highest-importance node**
   (`max(node.importance)` — the Vision at 1.0, else top objective) and pass it as the initial
   `focusedId` so `CameraFocus` (`LifeGraphCanvas.tsx:58-76`) flies there, instead of the fixed
   `[0,0,360]` fit (`:133`). The page already owns `focusedId` state
   (`explainable/page.tsx:28,84-105`) — set it once from the workspace on first load. Add a one-line
   caption ("Starting at your north star: <label>") so the anchor reads as intentional, not random.
4. **Rebuild `NodeDetailsPanel.tsx` as a story, not a dump.** Reorder the existing sections into the
   four-question narrative (all data already gathered in the component):
   - **Why is this here?** → `description` / `xai.reasoningSummary` (`:61-63`) + the role label
     ("This is your north star" / "A risk to your plan" / "A recommended action") derived from
     `node.type`. Surface the strongest _incoming_ edge's `via`/`citationId` ("connected because …").
   - **What it affects** → outgoing relationships (already computed `:24-37`, direction `out`) +
     `impactedDomains` chips (`:96-111`). Lead with these instead of burying them.
   - **What changed** → `node.lastUpdated` as a human "Updated <date>" line in the header (`:49-55`).
   - **What to do** → if any connected node is a `recommendation`, render a "Do this" CTA linking to
     `/dashboard/recommendations`; otherwise the honest "no action attached yet."
   - Keep provenance per relationship (`provenanceLabel` `:5-9`, `via`/`citationId` `:83-88`) — that is
     the trust spine and must stay. Demote Score/Importance/Formula/Weighted-factors into a collapsible
     "Details / how this was computed" section so the story leads and the math is available, not first.

### P2 — make the story header per-user (when grounded) + view-mode framing

5. **`GraphStoryHeader` can become per-user** once a real `life_brief` rides on the workspace. The
   component already anticipates this (`GraphStoryHeader.tsx:11-16`: "if the workspace ever carries a
   real `life_brief` we can swap the static copy"). The same `life_brief.headline` the dashboard uses
   (`my_life.py:204-207`) could be passed through the workspace response so the graph opens with the
   user's own one-line story above the explainer. **Gated:** only when grounded; keep the static
   explainer + honest empty state otherwise. No fabrication.
6. **Frame the view modes as story lenses.** The 5 modes (`explainable/page.tsx:40-62`) are real
   filters; relabel in the sidebar so they read as questions ("What's connected?" = network, "What
   should I do?" = recommendations, "What's my evidence?" = sources) rather than ontology nouns.

---

## 4. Honest empty state (must hold)

- Empty graph keeps the existing honest state (`explainable/page.tsx:164-181`: "still forming… nothing
  here is ever fabricated"). The camera anchor (P1.3) must **no-op** when there are 0–1 nodes — don't
  fly to nothing.
- Per-view empty state stays (`:183-187`).
- Role encoding/labels degrade gracefully: a node with unknown `type` falls back to the current
  sphere + domain color (so the change is additive, never breaks an existing node).
- A node with no `description`/`xai`/recommendation shows the existing honest "No explanation recorded
  yet." (`NodeDetailsPanel.tsx:62`) and "no action attached yet" — never an invented why/action.

---

## 5. Why this is safe (no new infra/model)

Every input is already in the workspace contract (`features/life-graph/types.ts:54-117`) and already
populated by `life_graph_workspace.py` (`build_workspace` `:168-221`, `recommendation_lineage`
`:95-165`). The plan only _reads fields the frontend currently discards_ (`type`, `importance` for
role/label/camera; `via`/`citationId`/`impactedDomains`/`lastUpdated`/`description` for the panel). No
new endpoint, embedding, or DB column. The trust core (real edges + provenance + citations only,
`workspace.py:1-12`) is untouched.

---

## 6. Sequencing summary

- **P0 (highest impact, local to `GraphNodeMesh.tsx`):** role-based shape/halo using `node.type` +
  `importance`; gate always-on labels by importance/relevance. Turns the ontology back into a readable
  story spine.
- **P1:** narrative camera anchor on the highest-importance node (`LifeGraphCanvas` + `page.tsx`
  `focusedId`); rebuild `NodeDetailsPanel` into Why / Affects / Changed / Do (existing data, reordered).
- **P2:** per-user `GraphStoryHeader` headline (gated on grounded `life_brief` on the workspace);
  question-framed view-mode labels.
