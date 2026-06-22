# Life Graph — GO / NO-GO for Investor-Demo Quality

> **Sprint H — Graph Product Decision** · LifeNavigator Elite Pilot Sprint
> Scope: assess the _actual_ Life Graph implementation against the investor-demo bar, then decide GO (ship the graph as a demo hero) or NO-GO (replace the hero with a premium Coming Soon that teases the real edges/provenance). No new infra, no new models, no feature inflation.

---

## Verdict (one line)

**NO-GO** on exposing the current 3D graph as an investor-demo _hero_. The data spine is genuinely world-class and must be teased, but the _presentation_ reads as an engineering visualization (counts, "Verified edges %", a force-directed sphere constellation) — not as "I learned something about my life in 10 seconds." Ship a premium **Life Map** Coming-Soon hero that teases the real edges + provenance, and keep the working graph reachable as a secondary "explore the live graph" surface for the curious. (Implementation in `GRAPH_PILOT_DECISION.md`.)

---

## What was assessed (grounded, real code)

| Layer              | File                                                              | State                                                                                            |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Primary graph page | `apps/web/src/app/life-graph/explainable/page.tsx`                | Built, nav-exposed (`Sidebar.tsx:435`, `LifeGraphSidebar.tsx:51`)                                |
| Legacy graph page  | `apps/web/src/app/life-graph/page.tsx`                            | Built, _also_ reachable by URL (`Sidebar.tsx:434` comment)                                       |
| 3D canvas          | `apps/web/src/features/life-graph/components/LifeGraphCanvas.tsx` | r3f + drei `Stars` + `d3-force-3d` simulation, 220 ticks                                         |
| Node render        | `GraphNodeMesh.tsx`                                               | Emissive spheres, domain colors, HTML labels (`distanceFactor=110`)                              |
| Story header       | `GraphStoryHeader.tsx`                                            | **Static explainer copy** — life_brief swap anticipated (`:13-15`) but NOT wired                 |
| Analytics strip    | `GraphAnalyticsStrip.tsx`                                         | "Nodes·Links / Recommendations / Evidence / Avg confidence / Verified edges % / Strongest link"  |
| Backend            | `app/routers/life_graph.py` → `services/life_graph_workspace.py`  | Real persisted nodes, provenance-tagged edges, rec→evidence→source lineage, real-embedding focus |

---

## The data spine is EXCELLENT (this is the moat, and it is real)

This is not flattery — it is the reason we tease rather than bury:

1. **Zero fabrication, by construction.** `build_workspace` (`life_graph_workspace.py:168-221`) only emits a node if it is a real persisted record and only draws an edge if it is (a) a persisted edge, (b) a computed shared-node connection, or (c) a recommendation→evidence→source lineage row. The frontend layout _filters_ links whose endpoints don't both exist (`LifeGraphCanvas.tsx:36-39`). Empty graph → empty workspace → honest empty card (`page.tsx:164-181`).
2. **Advisor/graph agreement.** It reuses `derive_graph_relations` — the _same_ relation core as the Hybrid Advisor (`life_graph_workspace.py:8, 19, 171`). "If the advisor cannot cite an edge, the graph cannot draw it." That is a defensible, investor-grade trust claim.
3. **Provenance + citations on every edge** (`persisted_edge` / `shared_node` / `computed_connection`, with `via`, `viaId`, `citationId`, `evidenceIds`).
4. **Real explainability per node** — XAI weighted factors, assumptions, missing-data, source table, formula (`recommendation_lineage` `:95-165`; rendered in `NodeDetailsPanel.tsx`).
5. **Real semantic search**, not client guessing — `query_focus` embeds the query and each node with the _same_ model and scores by cosine, normalized (`life_graph_workspace.py:240-265`).

**This spine clears the investor bar for _substance_. The problem is entirely _presentation_.**

---

## Why it is NO-GO as a demo hero (honest gaps)

### 1. It presents as engineering, not life

The first things on screen are a node/edge count (`page.tsx:118-122`), then a strip of `Avg confidence`, `Verified edges %`, `Strongest link` (`GraphAnalyticsStrip.tsx:54-67`), then a _static_ paragraph about **how the graph works** (`GraphStoryHeader.tsx:33-39`). An investor sees a debug telemetry bar before they see a single sentence about the user's actual life. The "learn something in 10s" payoff is absent.

### 2. The V2 storytelling spec was written but NOT implemented

`GRAPH_STORYTELLING.md` (Sprint G) defined the fix: lead with the real `life_brief` headline + next_move, add spotlight chips, auto-focus the camera on the top risk, pass through `graph_integrity` completeness bars. **None of it shipped** — `GraphStoryHeader.tsx` is still the static "This is your life, connected." copy; the only `life_brief` reference is the doc comment at `:13-15` describing the _intended_ swap. So the storytelling layer that would make it demo-ready exists on paper only.

### 3. Visual quality is "competent generic knowledge-graph," not signature

The scene is emissive spheres on a `Stars` backdrop with a force-directed layout (`LifeGraphCanvas.tsx:41-55`, `GraphNodeMesh.tsx:52-77`). It looks like every other 3D graph demo. Two concrete failure modes at demo time:

- **Sparse new-user / fresh-pilot account** → a handful of dots floating in space. Looks empty and unconvincing.
- **Dense account** → force-directed hairball with overlapping HTML labels (`GraphNodeMesh.tsx:80-100`, no label de-collision). Looks chaotic.
  Neither end of the data range reliably looks _premium_. We cannot guarantee the demo account lands in the narrow "looks great" middle.

### 4. Two competing graphs are both reachable

`/life-graph/explainable` (primary) and `/life-graph` (legacy, different components, different API `/api/life-graph`) are both live; legacy "stays reachable by direct URL" (`Sidebar.tsx:434`). An investor clicking around can land on the weaker one. Demo surfaces must be singular.

### 5. Interaction is unguided

OrbitControls + double-click-to-drill (`LifeGraphCanvas.tsx:171,177`) assume the viewer knows graph UIs. A live investor demo where the presenter fumbles orbit/zoom on a hairball is a credibility risk, not a wow.

---

## Investor-bar scorecard

| Dimension                  | Bar                         | Current                                             | Pass?    |
| -------------------------- | --------------------------- | --------------------------------------------------- | -------- |
| Trust / no-fabrication     | Must be defensible          | World-class (provenance, citations, advisor-parity) | **PASS** |
| "Learn something in 10s"   | Lead with the user's life   | Leads with counts + how-it-works copy               | **FAIL** |
| Visual signature           | Looks unmistakably premium  | Generic force-directed spheres                      | **FAIL** |
| Robust across data density | Great when sparse AND dense | Empty-looking sparse / hairball dense               | **FAIL** |
| Guided / presenter-safe    | No fumbling                 | Free orbit, double-click drill                      | **FAIL** |
| Single canonical surface   | One graph                   | Two reachable graphs                                | **FAIL** |

**5 of 6 demo dimensions fail. The one that passes (trust) is exactly what we tease in the Coming-Soon hero.**

---

## Could it reach the bar before the pilot? (effort honesty)

Closing all five gaps means: implement the entire Sprint-G storytelling layer (life_brief lead, spotlight, auto-focus, completeness, guided tour), add label de-collision + a curated demo layout, retire/redirect the legacy graph, and tune the scene for both sparse and dense accounts — then QA it live on the actual demo account. That is a multi-day visual-design + frontend effort with real demo-risk if rushed. **It is not a safe bet to land at investor-hero quality before the pilot.** The teaser path delivers the _wow of the idea_ with near-zero risk and lets the graph mature behind it.

---

## Decision

**NO-GO** for graph-as-hero. **GO** for a premium **Life Map** Coming-Soon hero that teases the real edges + provenance (the substance we _do_ have), with the working `/life-graph/explainable` kept as an opt-in "explore the live graph" link for the technically curious. See `GRAPH_PILOT_DECISION.md` for exactly what ships; `GRAPH_FUTURE_VISION.md` for the destination this teaser points at.
