# Graph Storytelling Spec — Turning the Life Graph from Display into Explanation

> **Sprint G — Life Graph Storytelling** · LifeNavigator Elite Experience Sprint V2
> Scope: surfacing-first, no new infrastructure / DBs / models. Reuse existing edges + provenance + narrative.

## Grounded finding

The explainable Life Graph at `apps/web/src/app/life-graph/explainable/page.tsx` is already **trust-correct and data-rich** — every node is a real persisted record and every edge is backed by a persisted edge, a computed shared-node connection, or a recommendation→evidence→source lineage (`apps/lifenavigator-core-api/app/services/life_graph_workspace.py`). The problem is that it presents **engineering-first**: the first things a user sees are a node/edge count (`page.tsx:118-122`), an analytics strip of `Avg confidence`, `Verified edges %`, and `Strongest link` (`GraphAnalyticsStrip.tsx:54-67`), and a static explainer paragraph about _how the graph works_ (`GraphStoryHeader.tsx:33-39`). None of that tells the user anything about **their own life** in 10 seconds. The single biggest gap: a fully-composed, grounded life narrative **already exists** (`/api/life/my-life` → `life_brief` with `headline / situation / tension / stakes / next_move / goals_held / watching / could_change`, rendered on the dashboard by `LifeBrief.tsx`) and `GraphStoryHeader.tsx:13-15` literally documents the intent to use it — _"if the workspace ever carries a real life_brief we can swap the static copy for it"_ — but the graph never fetches it. We can make the graph _explain the user's life_ using data that is already computed, with zero new infra.

---

## What EXISTS (built, often hidden)

| Capability                                                                                                   | Where it lives                                                                                  | Surfaced in graph today?              |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| Real nodes: vision, objectives, goals, risks, opportunities, constraints, dependencies                       | `life_discovery.py:1010-1081` (`personal_graph`)                                                | Yes (as dots)                         |
| Domain entities: Family/Career/Education/Health hubs + entities                                              | `life_discovery.py:1030-1071`                                                                   | Yes (as dots)                         |
| Provenance-tagged edges (persisted / computed / shared_node)                                                 | `life_graph_workspace.py:177-204`                                                               | Yes, but only in node panel           |
| Recommendation → evidence → source lineage + XAI weighted factors + assumptions + missing data               | `life_graph_workspace.py:95-165`; rendered `NodeDetailsPanel.tsx:113-177`                       | Yes, on click only                    |
| Semantic search focus (real embeddings, normalized relevance)                                                | `query_focus` `life_graph_workspace.py:240-265`; `query-focus/route.ts`                         | Yes (search box)                      |
| **Composed life narrative** (`headline/situation/tension/stakes/next_move/goals_held/watching/could_change`) | `/api/life/my-life` → `life_brief`; `LifeBrief.tsx:31-42`                                       | **NO — never fetched here**           |
| **Per-domain graph integrity / completeness**                                                                | `_graph_integrity` `life_discovery.py:1083+`; returned in `personal_graph` as `graph_integrity` | **NO — dropped by `build_workspace`** |
| View modes: brain / network / timeline / sources / recommendations                                           | `page.tsx:40-62`, `GraphSidebar.tsx:13-24`                                                      | Yes                                   |

## What is genuinely MISSING

- A **narrative entry layer** on the graph (no story headline, no "here's what your graph says about you").
- A **guided "learn something in 10s"** reveal — the user must already know graph theory to extract meaning.
- A **risk/opportunity spotlight** — risks and opportunities are colored dots indistinguishable from goals at a glance.
- **graph_integrity passthrough** — `build_workspace` discards the already-computed completeness map.

---

## The storytelling model: four layers, progressively revealed

The graph should answer four questions in order, each unlocking the next. **Every word of narrative comes from real data; nothing is invented.**

### Layer 0 — Entry narrative (0–3 seconds): "What does my life say right now?"

Replace the static "This is your life, connected" explainer in `GraphStoryHeader.tsx` with the **real `life_brief`** that the dashboard already renders.

- Fetch `life_brief` from `/api/life/my-life` (same source as `LifeBrief.tsx`) alongside `fetchLifeGraphWorkspace()` in `page.tsx:32-37`.
- Show the **headline** (the user's life story in one line) + **next_move** (the single most important action) as the graph's opening sentence.
- Keep the existing real counts (`{nodes} things · {edges} connections`) as a secondary trust line, not the lead.
- **Trust gate:** if `life_brief.ready === false`, fall back to the existing static explainer copy verbatim (already honest). Never fabricate a story. This is exactly the swap `GraphStoryHeader.tsx:13-15` anticipated.

> 10-second payoff: the user reads _their own_ situation and next move before touching anything.

### Layer 1 — Spotlight reveal (3–6 seconds): "What needs my attention?"

The data to rank attention already exists per node: `type` (`risk` / `opportunity` / `goal`), `confidence`, `importance` (`life_graph_workspace.py:34-58`), and recommendation `priority` → `importance` (`life_graph_workspace.py:40,129`).

- On load, **auto-focus the camera** on the highest-importance risk or the top-priority recommendation using the existing `cameraApi` (`page.tsx:30, 143-147`) — reuse `cameraApi.current?.fit()` plus a focus-on-node call (the drill path at `page.tsx:84-90` already centers a node).
- Render up to **3 spotlight chips** in the story header: top risk, top opportunity, top recommendation. Each chip is a real node; clicking it triggers the existing `drill(node)` (`page.tsx:84`).
- Chip copy = node `label` + a verb derived from `type` ("Risk: …", "Opportunity: …", "Do next: …" from recommendation `title`). No new text generation.

> 10-second payoff: the graph points at the one thing that matters, instead of presenting a uniform constellation.

### Layer 2 — Guided tour / layered domain reveal (6–10 seconds): "How does it all connect?"

Reuse the existing **view modes** (`GraphView` in `types.ts`, `page.tsx:40-62`) as a _guided_ sequence rather than a flat menu.

- A small **"Show me" stepper** in the story header walks the user through: `goals → risks & opportunities → recommendations → data sources`. Each step just calls the existing `setView(...)` and camera-fit; no new layout code.
- Surface the **dropped `graph_integrity`** map (Layer-2 trust signal): pass it through `build_workspace` (it is already in the `personal_graph` return) and render per-domain completeness bars in the sidebar (`GraphSidebar.tsx`) so the user sees "Career 80% mapped · Health 0% mapped" — an honest In-Progress signal that drives the user to add data.

> 10-second payoff: the user understands the structure (goals at the center, evidence at the edges) without reading docs.

### Layer 3 — Drill-down explanation (on demand): "Why do you believe this?"

This layer is **already fully built** in `NodeDetailsPanel.tsx` — relationships with provenance (`:65-94`), data used + source table (`:113-128`), weighted factors / XAI (`:130-146`), assumptions (`:148-159`), missing data (`:161-175`), formula (`:177`). Storytelling change is framing only:

- Reorder the panel so **"Why this matters"** (`:61-63`) and the recommendation `next move` lead, and the raw confidence/importance metrics move below the fold.
- Rename section headers from system language to human language: "Data used" → "Built from your", "Weighted factors" → "How we weighed it", "Persisted edge" → "Confirmed connection" (`provenanceLabel` map `NodeDetailsPanel.tsx:5-9`).

> Payoff: the existing explainability becomes a _narrative of belief_, not a debug dump.

---

## Honest state definitions (graph storytelling)

| State           | Condition                                                                           | What the user sees                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Empty**       | `workspace.nodes.length === 0` (`page.tsx:164`)                                     | Keep existing honest empty card (`page.tsx:164-181`) + a one-line "Nothing here is ever fabricated." Entry narrative suppressed.                 |
| **In-Progress** | Nodes exist but `life_brief.ready === false`, or any domain `graph_integrity < 100` | Static explainer (current copy) as headline + per-domain completeness bars + "Add your [domain] to complete the picture" CTA. No invented story. |
| **Complete**    | Nodes exist AND `life_brief.ready === true`                                         | Real `headline` + `next_move` lead, spotlight chips, guided stepper, full drill-down.                                                            |

Per-view honesty already handled: `visible.nodes.length === 0` shows "Nothing to show in this view yet." (`page.tsx:183-187`) — keep, but link to the relevant CTA (e.g. recommendations view empty → `/dashboard/recommendations`).

---

## Reuse map (no new infra)

| Storytelling need | Existing thing to reuse                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Entry narrative   | `/api/life/my-life` `life_brief` (already powering `LifeBrief.tsx`)                                    |
| Spotlight ranking | node `type` / `importance` / `confidence` (`life_graph_workspace.py:34-58`) + rec `priority`           |
| Auto-focus camera | `GraphCameraApi` / `cameraApi` (`page.tsx:30,143-147`) + `drill()` (`page.tsx:84`)                     |
| Guided tour       | existing `GraphView` view modes (`page.tsx:40-62`)                                                     |
| Completeness bars | `graph_integrity` (already computed `life_discovery.py:1083+`, just pass it through `build_workspace`) |
| Why-we-believe    | `NodeDetailsPanel.tsx` (XAI/provenance already rendered)                                               |
| Search highlight  | `query_focus` real embeddings (`life_graph_workspace.py:240-265`)                                      |

## Trust invariants (must not break)

1. No narrative when `life_brief.ready === false` — fall back to the static, honest explainer (`GraphStoryHeader.tsx`).
2. No edge is drawn that isn't already in `build_workspace`'s provenance-tagged output — storytelling never adds inferred relationships.
3. Spotlight/ordering uses only fields already on the node; no client-side scoring that implies new judgment.
4. Empty/In-Progress states never fabricate; they drive the user to add real data.

## Definition of done

- [ ] `GraphStoryHeader` reads real `life_brief` (headline + next_move) with honest `ready:false` fallback.
- [ ] Up to 3 real spotlight chips (top risk/opportunity/recommendation) that drill on click.
- [ ] Auto-focus camera on the single most important node on first load.
- [ ] Guided "Show me" stepper reusing existing view modes.
- [ ] `graph_integrity` passed through `build_workspace` and rendered as honest per-domain completeness.
- [ ] Node panel reframed: "Why this matters" + next move lead; system jargon humanized.
- [ ] A new user with an empty graph and a returning user with `ready:true` both see correct, non-fabricated states.
