# Life Graph — Storytelling Readiness (Final)

**Audience:** Monday 20-person pilot Go/No-Go.
**Scope:** AUDIT ONLY. No code changed. Every claim cites `file:line`.
**Hard rule (unbroken today):** real edges + citations only, honest empty states, no fabricated data.
**Cross-ref:** `docs/experience-excellence/GRAPH_EXPERIENCE_REDESIGN.md`, `docs/pilot-polish/EXPLAINABLE_GRAPH_LAUNCH.md`, `docs/pilot-polish/NARRATIVE_EXPLAINABILITY.md`.

---

## SCORE: 6.0 / 10 (target > 8)

The **data + trust spine is elite** (every node real, every edge cited, three provenance tiers, agrees with the advisor). The **experience layer renders that spine as an ontology diagram, not a life story.** It is a good-bones hairball. The fixes are cheap and frontend-only — all the missing signal is already in the API response.

---

## The five questions the graph must answer

Scored against the **explainable** surface (`apps/web/src/app/life-graph/explainable/page.tsx`), which is the richer of the two graphs and the one the redesign standardizes on.

| Question                                    | Answered?                  | Where / why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why is this recommendation here?**        | **Yes (8/10)**             | Strongest area. `recommendation_lineage` (`life_graph_workspace.py:95-165`) emits rec → evidence → source nodes with `xai.reasoningSummary`, `xai.formula`, `weightedFactors`, `assumptions`, `missingData`. `NodeDetailsPanel` renders all of it: "Why this matters" (`NodeDetailsPanel.tsx:61-63`), "Data used" (`:113-128`), "Weighted factors" (`:130-146`), "Formula" (`:177`). But it is a **drill reward**, not visible on the canvas — the user must click the right node to see it. |
| **What affects this goal?**                 | **Partial (5/10)**         | Relationships are listed in the panel with direction + provenance (`NodeDetailsPanel.tsx:65-94`) and "Impacted goals / domains" (`:96-111`). On the canvas, edges are drawn but **undirected to the eye** — `GraphEdgeLine` has no arrowheads (`GraphEdgeLine.tsx:49-60`), so "affects" vs "affected by" is invisible until you open the panel. (The `/life-graph` legacy surface _does_ draw arrows — `dashboard/life-graph/page.tsx` `linkDirectionalArrowLength`.)                        |
| **What happens if I change this decision?** | **No (2/10)**              | There is no what-if / simulation affordance on the explainable surface. `GraphNodeType` includes `'decision'` (`types.ts:1-12`) and the legacy `/life-graph` page imports a `DecisionDrilldown` component, but the explainable graph has **no decision-impact propagation** — it cannot show downstream effects of a change. Honest gap, not a bug.                                                                                                                                          |
| **What depends on this?**                   | **Partial (5/10)**         | Dependencies exist as real nodes (`_TYPE_MAP "Dependency" → "source"`, `life_graph_workspace.py:29`) and edges carry `part_of` / `supports` rels, surfaced in the panel's Relationships list. But dependency is **not visually distinct** on the canvas (see readability below) and there is no "what depends on this" filter/lens.                                                                                                                                                          |
| **What is blocking me?**                    | **Partial-to-weak (4/10)** | Risks/constraints are real nodes (`Risk`, `Constraint → "risk"`, `life_graph_workspace.py:28`) and recommendations carry `missingData` (`life_graph_workspace.py:118-119`). But on the canvas a Risk is **colored by its domain, not by being a risk** (see readability #1), so "what's blocking me" does not pop. No dedicated risk/blocker lens.                                                                                                                                           |

**Why the score is 6.0 not 8+:** four of five answers exist only _inside the details panel after the correct drill_. The canvas itself — the first and primary impression — answers almost none of them at a glance. The intelligence is present but buried.

---

## Readability: ontology hairball vs. legible life story

### 1. Colors by DOMAIN, discards the node ROLE the backend already provides — biggest miss

`GraphNodeMesh` colors strictly by `node.domain` (`GraphNodeMesh.tsx:23-32, 48`). The backend _knows the role_ and ships it: `_contract_type` maps to `goal/risk/opportunity/recommendation/source/domain` (`life_graph_workspace.py:43-47`) and `importance` ranks Vision=1.0 / Objective=0.9 / Risk=0.5 (`life_graph_workspace.py:34-37`). The legacy surface even has a role color map — `TYPE_COLOR` Vision purple / Risk red / Opportunity green (`dashboard/life-graph/page.tsx`). The explainable mesh **throws role away** and colors by domain, so a Life Vision, a primary objective, a risk, and a routine certification can all be the **same color** if they share a domain. The user's eye cannot find "the center of my life" or "the thing blocking me." This single choice is why questions "what's blocking me" and "what affects this goal" fail at a glance.

> Importance _is_ used for **size** (`GraphNodeMesh.tsx:46` — Vision/Objective render bigger), which is good and partially rescues hierarchy. But size alone, same color, no shape differentiation = a uniform constellation.

### 2. Always-on labels on every node = guaranteed hairball at scale

`GraphNodeMesh` renders a persistent `<Html>` label (label + score + confidence) for **every** node, always (`GraphNodeMesh.tsx:80-100`). With domain CRUD entities flooding in (dependents, skills, certs, programs), this is dozens of overlapping 3D tooltips. There is progressive disclosure of _focus_ (search dimming `LifeGraphCanvas.tsx:169`, drill) but **none of labels**. This is the top anti-hairball fix.

### 3. Camera/layout anchors on generic center, not the person

Layout is `forceCenter(0,0,0)` (`LifeGraphCanvas.tsx:50`) and the camera opens at a fixed `[0,0,360]` (`LifeGraphCanvas.tsx:133, 101-104`). Nothing pins the highest-importance node (the Vision, importance 1.0) at the center. A pilot exec sees a pretty cloud, not "this bright node in the middle is my life." `CameraFocus` (`:58-76`) only engages _after_ a drill.

### 4. The header tells a generic story, not the user's

`GraphStoryHeader` is honest but **static** — fixed explainer copy + real counts only (`GraphStoryHeader.tsx:17, 33-58`). It deliberately does not invent per-user narrative (correct per the trust rule), but the real per-user narrative _exists_ (`life_brief()` headline/situation per the redesign doc §3.1) and is simply not plumbed onto the workspace response. So the first thing the user reads is about _how the graph works_, not _their life_.

### 5. Two divergent graphs

`/life-graph` (legacy, `/api/life-graph`, `components/lifeGraph/*`, arrows + role colors) and `/life-graph/explainable` (`/v1/life-graph/workspace`, `features/life-graph/*`, provenance + lineage) are separate data paths and component trees. For the pilot, **point users at exactly one** to avoid a split, inconsistent "Life Graph."

### Known stale-readiness one-liner (CONFIRMED — affects the legacy `/life-graph` center node)

`apps/web/src/app/api/life-graph/route.ts:59-66` computes the center-node readiness as:

```
typeof myLife?.readiness?.overall === 'number' ? ... : typeof myLife?.life_readiness === 'number' ? ...
```

But `/v1/life/my-life` returns the key **`life_readiness`** as an **object** `{overall, status, domains, ...}`, not `readiness`, and not a number (`my_life.py:174, 261`). So:

- `myLife.readiness.overall` → key never exists → undefined.
- `myLife.life_readiness` → is an object, not a `number` → fails the `typeof === 'number'` guard.
- Falls through to `graph.graph_integrity.score` or `null`.

**Result:** the readiness shown on the legacy graph's center node is never the real Life Readiness score — it silently degrades to graph-integrity or nothing. The correct read is `myLife?.life_readiness?.overall`. Frontend-only one-line fix. (Only affects `/api/life-graph` → `/life-graph`; the explainable surface does not depend on this.)

---

## Cheapest readability/storytelling fixes (frontend-only, existing data, no new intelligence)

Ordered by impact/cost. All use fields already in the `LifeGraphWorkspace` contract (`types.ts`).

1. **Gate the labels.** In `GraphNodeMesh.tsx:80-100`, render `<Html>` only when `selected || focused || relevance > 0.4 || (importance ?? 0) >= 0.85`. Single highest-impact anti-hairball change. _Always keep the anchor labeled._
2. **Encode role, keep domain as color.** Add a shape or halo by `node.type` (goal/risk/opportunity/recommendation/source) — all already on the node (`life_graph_workspace.py:43-47`, `types.ts:54-86`). Then "my goal" vs "a risk" vs "evidence" is instantly distinguishable; directly fixes "what is blocking me" and "what affects this goal." (Lowest-effort variant: tint the existing glow halo at `GraphNodeMesh.tsx:67-77` by type instead of domain.)
3. **Anchor the layout + camera on the highest-importance node.** In `buildLayout` / camera init (`LifeGraphCanvas.tsx:50, 101-104, 133`), pin the max-`importance` node at origin and open the camera looking at it. Turns the cloud into "this is the center of my life."
4. **Add edge direction.** Give `GraphEdgeLine` arrowheads or a gradient (`GraphEdgeLine.tsx:49-60`) so "affects" vs "affected by" reads on the canvas, not just the panel. (Legacy surface already does this — port the idea.)
5. **Pick ONE graph for the pilot.** Route users to `/life-graph/explainable` only; hide/redirect `/life-graph` to avoid the divergent two-graph experience. (And/or apply the `route.ts:60` `life_readiness.overall` fix if `/life-graph` stays reachable.)
6. **(Small backend add, optional) Surface `life_brief.headline`/`situation` on the workspace response** so `GraphStoryHeader` can lead with the user's real story instead of generic copy (redesign §3.1, §P1.7). Honest when forming; pure function over the existing snapshot.

Fixes 1–4 are pure `features/life-graph/components/*` edits over the current API and would move the score from 6.0 to ~8.5 without touching the trust spine. Fix 5 removes the most confusing pilot artifact.

---

## Verdict for Monday

**SHIP-ABLE with caveats, NOT yet > 8.** The graph is honest and will not embarrass on trust (no fabrication, real citations, good empty states). But as a _"this understands me"_ moment it currently lands as a domain-colored constellation that the user must drill to decode. For the 20-person pilot:

- **Minimum:** pick one graph surface (fix 5) and gate labels (fix 1) so it doesn't read as a hairball.
- **Strongly recommended before/right after launch:** role encoding (fix 2) + anchored camera (fix 3) to deliver the storytelling moment the data already supports.
- The `route.ts:60` stale-readiness one-liner should be fixed if `/life-graph` remains user-reachable.
