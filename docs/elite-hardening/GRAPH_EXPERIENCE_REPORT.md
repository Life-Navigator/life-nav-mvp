# Life Graph Experience — Elite Pilot Audit

**Verdict:** A beautiful force-graph shell wired to a thin data source; the moat ("clicking a node gives you the real WHY") is built in the _type system and panels_ but **not delivered on the route users actually open** — the live `/life-graph` strips all provenance/evidence/calculation before render. **Score: 5.5 / 10.**

---

## 0. The single most important finding: there are THREE graphs, and the nav points at the weakest one

| Route                                                             | Data source                                | Rich explainability?             | Linked in nav?                                |
| ----------------------------------------------------------------- | ------------------------------------------ | -------------------------------- | --------------------------------------------- |
| `/life-graph` (`app/life-graph/page.tsx`)                         | `/api/life-graph` → `transformLifeGraph()` | **No** — transform drops it      | **YES** (`components/layout/Sidebar.tsx:451`) |
| `/life-graph/explainable` (`app/life-graph/explainable/page.tsx`) | `/api/life-graph/workspace` (passthrough)  | **Yes** — full panel             | **No nav link found**                         |
| `/dashboard/life-graph` (`app/dashboard/life-graph/page.tsx`)     | `/api/life/graph`                          | minimal (type/domain/confidence) | not in main sidebar                           |

`components/layout/Sidebar.tsx:451`:

```
{ name: 'Life Graph', href: '/life-graph', icon: PuzzlePieceIcon, current: false },
```

The memory note "real-edges-only UI at /life-graph/explainable" is accurate about that _route_, but the pilot's nav sends elite users to `/life-graph`, which renders `LifeGraph3D` over `transformLifeGraph` output. That output is where the moat dies (see Issue #1). **An elite user clicking "Life Graph" in the sidebar does NOT get the explainable experience.**

---

## 1. What the graph actually renders + data source (cited)

### Live route `/life-graph` (the one in the nav)

- `app/life-graph/page.tsx:26` fetches `/api/life-graph`, renders `LifeGraph3D` (`components/lifeGraph/LifeGraph3D.tsx`) via `react-force-graph-3d@^1.29.1`.
- `app/api/life-graph/route.ts:45-49` fan-outs to Core API `/v1/life/graph` + `/v1/recommendations/roadmap` + `/v1/life/my-life`, then calls `transformLifeGraph` (`lib/lifeGraph/transform.ts`).
- Nodes are real persisted records (objectives, dependencies, risks). Node spheres sized by `importance` (`LifeGraph3D.tsx:165`), colored by `DOMAIN_META`, with a 1400-point ambient "brain" particle cloud and lights injected directly into the three scene (`LifeGraph3D.tsx:80-120`). It looks genuinely premium.
- Double-click → `onExpand` → focuses the 2-hop neighborhood (`app/life-graph/page.tsx:69-88`, `:46-65`). Decision nodes open `DecisionDrilldown` (real `/api/decision/graph`).

### The `/life-graph/explainable` route (the real moat, unlinked)

- `app/life-graph/explainable/page.tsx` → `LifeGraphCanvas` (`features/life-graph/components/LifeGraphCanvas.tsx`) using **raw `@react-three/fiber` + `drei` + `d3-force-3d`** (its own force sim, `buildLayout()` `:32-56`).
- `NodeDetailsPanel` (`features/life-graph/components/NodeDetailsPanel.tsx`) is the genuine article: per-edge provenance label (`:75`), `via`/`citationId` citation (`:83-88`), Data Used with source table + confidence (`:113-128`), Weighted factors (`:130-146`), Assumptions, Missing data, Formula. Edges render solid vs dashed by provenance in `GraphEdgeLine.tsx:33` (persisted vs computed). **This is exactly the moat the pitch claims — and it is the route nobody is routed to.**

---

## 2. Explainability — is the WHY delivered? (the moat claim)

**On the linked route: NO.** `transformLifeGraph` (`lib/lifeGraph/transform.ts:120-255`) builds nodes that carry only `id/label/type/domain/confidence/importance/score/description/sourceIds/lastUpdated` (`:158-171`). It **never populates** `dataUsed`, `xai` (formula / weightedFactors / reasoningSummary), `assumptions`, `missingData`, `calculation`, or `lineage` — grep confirms zero references to those fields in the transform. It returns `sources: []` (`:254`).

Downstream, the panels on `/life-graph` therefore render empty:

- `LifeGraphExplainabilityPanel.tsx:120` Data sources → `domainSources = sources.filter(...)` over an always-empty `sources` array → "No connected datapoints for this domain yet" for everyone.
- `LifeGraphNodePanel.tsx:128-147` Data tab → `node.calculation` is never set → "No computed inputs."
- `LifeGraphNodePanel.tsx:185-198` History tab → `node.lineage` never set → "No lineage trail recorded yet."
- The Sources tab (`LifeGraphNodePanel.tsx:149-166`) renders `node.sourceIds` but **hard-codes a green "Verified" badge** on every one (`:158-160`) regardless of whether the source is plaid, manual, or an unverified document. That's a trust-claim the data doesn't back.

So on the route an elite user reaches, clicking a node yields: a label, a domain pill, score/confidence/importance, connection count — and a column of "No data yet" panels. That is **intake-grade, not counsel-grade**, and it directly contradicts the "Why you can trust this — every node traces to real records" header (`LifeGraphExplainabilityPanel.tsx:104-110`) sitting above empty sections.

**On `/life-graph/explainable`: YES**, the WHY is fully wired — _if_ Core API `/v1/life-graph/workspace` returns the rich shape. That endpoint is a pure passthrough (`app/api/life-graph/workspace/route.ts:23`), so quality depends entirely on the backend, which this audit can't see from the web tier.

---

## 3. Real edges only? — TWO synthetic-edge violations on the linked route

`transformLifeGraph` injects edges and a node that are **not persisted relationships**:

1. **Synthetic structural edges to root** (`lib/lifeGraph/transform.ts:192-205`): any depth-1 node with no real edge gets a fabricated `rootId → node` link with `strength: 0.5`, `kind: 'structural'`. The code comment calls it "structural only," but it is still a drawn line the user reads as a relationship, and it carries **no provenance field and no citation** — unlike the explainable route which tags every edge `persisted_edge | computed_connection | shared_node`. This violates the no-mock / real-edges-only rule for the visible graph.
2. **Synthetic root node `__you__`** (`:132-145`) when no Life Vision exists. Defensible as a structural center, but it is then connected to every orphan via the fabricated edges above, manufacturing a hub-and-spoke that looks like discovered structure.
3. **Fabricated edge strength** (`:181`): `const strength = e.confidence ?? 0.6` then rendered as a literal label `${Math.round(strength*100)}%` (`:186`). A missing confidence is shown to the user as a confident "60%". That's a fabricated number on a trust surface.

The explainable route's `LifeGraphCanvas.tsx:36-39` is clean — it only simulates edges whose endpoints both exist and never invents links. The violation is isolated to the transform feeding the _linked_ route.

---

## 4. Sparse-graph experience (a real pilot user with little data)

- **Honest empty state exists and is good** on all three routes (`app/life-graph/page.tsx:164-177` "Your graph is still forming… Nothing here is fabricated"; explainable `:161-171`; dashboard `:230-245` with a "Continue discovery" CTA). No fake nodes are drawn when empty. This is genuinely well done.
- **But the partially-sparse case is where it breaks:** a user with, say, 4 objectives and no edges. On `/life-graph` the transform's orphan-wiring (`:192-205`) connects all 4 to `__you__`, so they get a tidy star — _looks_ meaningful but every spoke is synthetic. On the explainable route with no edges, `buildLayout` produces a charge-repelled cloud of disconnected dots with no structure — visually reads as "broken," and there's no "these aren't connected yet" affordance.
- The 1400-point brain particle cloud (`LifeGraph3D.tsx:88`) renders identically whether you have 2 nodes or 200, so a near-empty graph still _looks_ impressively dense — which is arguably dishonest ambiance.

---

## 5. Performance / UX / mobile / accessibility

- **Pins are correct:** `@react-three/drei@10.4.4`, `@react-three/fiber@9.6.1`, `three@^0.184.0`, `react@19.0.1`, `next@16.2.6` (`package.json:28-48`). Matches the memory note. Fiber 9 + drei 10 require React 19 / Node 20 — consistent.
- **No node-count cap.** Both renderers map every node/edge with no virtualization or LOD. `LifeGraphCanvas.tsx:53` runs `for (let i=0;i<220;i++) simulation.tick()` synchronously on the main thread on every `nodes/edges` change (`:123`) — for a dense elite graph (hundreds of nodes) this is a visible UI freeze on mount and on every view switch.
- **Two heavy 3D engines shipped.** `/life-graph` uses `react-force-graph-3d`; `/life-graph/explainable` uses raw fiber+drei+`d3-force-3d`. Both pull the full three.js bundle. Duplicated 3D stack = larger bundle and two code paths to maintain.
- **Mobile: effectively unusable.** No touch handling, no responsive breakpoints on the canvas components (grep found `md:`/`sm:` only in `GraphAnalyticsStrip`/`DecisionDrilldown`). The explainable layout is a fixed three-column flex (`explainable/page.tsx:110`, sidebar + canvas + 390px panel) that will overflow on any phone. `OrbitControls` (`LifeGraphCanvas.tsx:177`) has no touch-action guard.
- **Accessibility: none on the graph itself.** No `aria-*`, no `role`, no keyboard navigation of nodes, no focus management — a WebGL canvas with mouse-only interaction. The double-click-to-expand gesture (`LifeGraph3D.tsx:220-233`, 350ms window) has no keyboard or single-tap equivalent and is undiscoverable.
- **No `prefers-reduced-motion`** guard despite continuous particle animation + damped orbit + directional link particles (`LifeGraph3D.tsx:217-219`).
- `LifeGraph3D` measures size with a `ResizeObserver` (good, `:69-76`); the dashboard route uses a manual `resize` listener (`app/dashboard/life-graph/page.tsx:96-104`) — fine but inconsistent.

---

## 6. Does it connect to action? (dead-end or live?)

Partially live, and better than expected:

- Node → **Impact tab** lists recommendations that trace to the node (`LifeGraphNodePanel.tsx:168-183`), and the explainability panel shows recommendation lineage with expected impact + confidence (`LifeGraphExplainabilityPanel.tsx:151-205`). Real recs from `/v1/recommendations/roadmap`.
- Decision nodes → `DecisionDrilldown` → real `/api/decision/graph` (`DecisionDrilldown.tsx:61`). Good.
- **But the recs are display-only.** There's no "Act on this," "Add to plan," or deep-link from a graph rec into the recommendation/decision flow. The matching is also loose: `r.affectedGoals.includes(node.label) || r.domain === node.domain` (`LifeGraphNodePanel.tsx:55-60`) will attach every finance rec to every finance node — so "Impact" shows plausibly-wrong associations rather than true edges. It informs; it does not let you _do_.

---

## Five ranked issues (file:line + fix)

1. **The nav points at the non-explainable route; the moat route is unlinked.** `components/layout/Sidebar.tsx:451` → `/life-graph`, but the real explainability lives at `/life-graph/explainable`. **Fix:** repoint the nav to `/life-graph/explainable` (or make `/life-graph` render the explainable page) so users reach the version where clicking a node shows provenance/citations/data-used.

2. **`transformLifeGraph` discards all explainability, then panels claim "every node traces to real records."** `lib/lifeGraph/transform.ts:158-171` omits `dataUsed/xai/assumptions/calculation/lineage`; returns `sources: []` (`:254`); panels render empty under a trust header (`LifeGraphExplainabilityPanel.tsx:104-110`). **Fix:** map the Core API node's `table/record_id/source/confidence` into `dataUsed` + `sourceIds`, and surface `missingData` honestly; OR retire the transform path entirely in favor of the workspace passthrough.

3. **Synthetic, uncited edges drawn as real relationships.** `lib/lifeGraph/transform.ts:192-205` injects `root→orphan` links and `:181` fabricates `0.6` strength shown as "60%". Violates real-edges-only. **Fix:** stop drawing synthetic edges (or render them visually distinct + uncited like the explainable route's dashed `computed_connection`), and never label a missing confidence with a fabricated percentage.

4. **Hard-coded "Verified" badge on every source.** `LifeGraphNodePanel.tsx:158-160` stamps green "Verified" on all `sourceIds`. **Fix:** drive the badge from real source provenance (plaid/manual = verified; document/onboarding = unverified), matching the `EdgeProvenance` discipline already in `types.ts:28`.

5. **Main-thread force sim + no node cap = freeze on dense elite graphs; mobile/a11y absent.** `LifeGraphCanvas.tsx:53` (220 synchronous ticks per render), no virtualization, no touch/aria/keyboard, no `prefers-reduced-motion`. **Fix:** precompute layout in a web worker or off the render path, cap rendered nodes with a "+N more" affordance, add touch + keyboard node traversal, and gate animations on reduced-motion.

---

## Top 3 leverage upgrades — make the graph the signature wow-moment

1. **Make "click → the real WHY" the default, on the linked route.** The panels already exist; the data plumbing is the gap. Wire `dataUsed`, source provenance, and `missingData` end-to-end on whichever route is in the nav. The "holy shit it understands my whole life" moment is _specifically_ clicking your net-worth node and seeing "Plaid · Chase · 94% confidence · last synced 2d ago" with the formula that rolled it up. Today that returns "No data yet."

2. **Turn the graph into a launchpad, not a museum.** Every node panel should end with a real action: "Act on this recommendation," "Answer 1 question to raise this node's confidence" (drive off `missingData`), "Open decision brain." Replace the loose domain-match rec association (`LifeGraphNodePanel.tsx:55-60`) with true `recommendationIds` edges so the graph shows _exactly_ what each node drives. A graph that converts a click into a next step is the difference between a demo toy and the OS.

3. **Confidence as the visual language + honest sparse mode.** Use opacity/halo to encode _confidence_ (you have it, `transform.ts:163`), so low-trust nodes literally look fuzzy and the user feels the gaps. In the partially-sparse case, draw real edges only and add a quiet "these areas aren't connected yet — add X to link them" prompt instead of synthetic spokes or a disconnected dot-cloud. This makes the graph trustworthy _and_ a guided onboarding surface.

---

## What's genuinely excellent

- **The trust architecture in the type system is real and elite-grade.** `features/life-graph/types.ts:28` `EdgeProvenance = persisted_edge | computed_connection | shared_node`, with `via`/`viaId`/`citationId` on every edge — and `GraphEdgeLine.tsx:33` actually renders persisted-vs-computed as solid-vs-dashed. This is the correct moat design.
- **The `NodeDetailsPanel` (explainable route) is the product vision delivered:** provenance label, citation, data-used-with-source-table, weighted factors, assumptions, missing-data, formula — all with honest empty states (`NodeDetailsPanel.tsx:61-178`).
- **Honest empty states everywhere** — no fake nodes when the user has no data; explicit "Nothing here is fabricated" copy.
- **Visual craft is high:** brain particle cloud, additive-blend halos on important/selected nodes, selection torus ring, double-click neighborhood focus with camera lerp (`LifeGraph3D.tsx:122-139`, `LifeGraphCanvas.tsx:58-76`). It reads as a premium, intentional artifact, not a default force-graph.
- **Dependency pins are disciplined and correct** (drei 10.4.4 / fiber 9 / React 19), matching the documented Node-20 constraint.
