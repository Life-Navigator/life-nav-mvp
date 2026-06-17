# Explainable Graph Launch

**Sprint:** Pilot Polish — make Arcana's intelligence VISIBLE.
**Scope:** Frontend-only. Surface EXISTING data; no new models/agents/infra/DB; no fabricated data;
honest empty states only. Owns the navigation/Sidebar and the Life Graph pages only.

---

## 1. Problem

The most advanced graph experience already exists at
`apps/web/src/app/life-graph/explainable/page.tsx:19` — backed by the real
`GET /v1/life-graph/workspace` endpoint, with real edges + provenance + citations + the full
recommendation→evidence→source lineage and per-node XAI. But users could not reach it:

- The primary sidebar pointed "Life Graph" at the **older** `/life-graph` page —
  `apps/web/src/components/layout/Sidebar.tsx:433` (`href: '/life-graph'`).
- The old page's own sidebar also pointed back at `/life-graph` —
  `apps/web/src/components/lifeGraph/LifeGraphSidebar.tsx:51`.

So the provenance-first graph (the thing that proves the product is real) was effectively hidden,
and there were two competing "Life Graph" destinations.

This launch repoints navigation to the explainable graph, gives it a short storytelling header so a
first-time user understands _why_ they are looking at it, and keeps an honest empty state. No
backend, model, or data change.

---

## 2. Changes (exact file:line)

### 2.1 Navigation — make the explainable graph the primary destination

- **`apps/web/src/components/layout/Sidebar.tsx:431-433`** — repointed the primary "Life Graph" nav
  entry from `/life-graph` to `/life-graph/explainable` (added an explanatory comment). This is the
  main, ≤12-item operating-system nav, so this is the change that actually moves users.
  - Side effect (correct): `isItemActive` uses `pathname.startsWith(href)`
    (`Sidebar.tsx:623-628`), so the nav highlights on `/life-graph/explainable` and intentionally
    does **not** highlight on the de-emphasized old `/life-graph` page.
- **`apps/web/src/components/lifeGraph/LifeGraphSidebar.tsx:51`** — the old page's own sidebar
  "Life Graph" link now also points at `/life-graph/explainable`, so anyone who lands on the old
  page is routed to the primary graph on their next click.

The old page (`apps/web/src/app/life-graph/page.tsx`) is **left in place, de-emphasized** (no nav
points to it; reachable only by direct URL). It was not deleted, per scope.

### 2.2 Storytelling / "Why am I seeing this?" header

- **New component:** `apps/web/src/features/life-graph/components/GraphStoryHeader.tsx`
  - A dismissible header that tells a STORY, not an ontology. It answers:
    - **Why am I seeing this?** — "Every dot is something real we know about you…"
    - **What is connected?** — "Every line is a relationship we can actually _cite_: if we can't
      back a connection with your data, we don't draw it."
    - **What should I do?** — "Click any node to see exactly what data it's built from" + a
      "See what to do next →" link to `/dashboard/recommendations`.
  - **No fabricated per-user text.** The workspace response has **no `life_brief` field**
    (`LifeGraphWorkspace` = `nodes`, `edges`, `metrics` only — `features/life-graph/types.ts:107-117`),
    so the copy is a fixed explainer. The only per-user values are **real counts read off the
    workspace**: `metrics.totalNodes`/`totalEdges` (with `nodes.length`/`edges.length` fallback) and
    derived counts of `type==='recommendation'` and `type==='source'` nodes. If a real `life_brief`
    is ever added to the workspace response, swap the static copy for it — wiring point is documented
    in the component header comment.
- **Wired in:** `apps/web/src/app/life-graph/explainable/page.tsx`
  - Import at `:13` (`GraphStoryHeader`).
  - Rendered only when `hasGraph` is true, between the page header and the analytics strip
    (the `{hasGraph && <GraphStoryHeader workspace={workspace!} />}` line just before the
    `GraphAnalyticsStrip`). It never renders over the empty state, so the empty state stays clean.

### 2.3 Honest empty state

- **`apps/web/src/app/life-graph/explainable/page.tsx`** — the existing `workspace.nodes.length === 0`
  block was already honest; tightened the copy to match the platform's "no mock data" voice and made
  it actionable: "Your life graph is still forming… Nothing here is ever fabricated." + a "Talk to
  your advisor" CTA to `/dashboard/advisor` (the action that actually builds the graph).
- The existing loading state (`Loading your Life Graph…`), error state, and per-view empty state
  (`Nothing to show in this view yet.`) are unchanged and remain honest.

No data is invented in any state: counts and lineage come straight from the real workspace response.

---

## 3. Verification

- `pnpm -C apps/web type-check` — see report (run on completion).
- Manual: sidebar "Life Graph" → `/life-graph/explainable`; story header shows real node/connection
  counts; with an empty workspace, the honest empty state + advisor CTA render and the story header
  does not.

---

## 4. Prioritized residual (P1 — deeper legibility redesign)

These are the higher-effort legibility wins from
`docs/experience-excellence/GRAPH_EXPERIENCE_REDESIGN.md` (still frontend-only, still on the
existing API — `:205` confirms no new data/model work needed). Deliberately **out of scope** for
this pilot-polish pass; ship after the launch above proves the entry point.

1. **Role-based node encoding** — encode `type`/`domain`/`importance` (already on every node,
   `features/life-graph/types.ts:54-86`) into visual role (shape/size/color), so a goal vs. a source
   vs. a recommendation reads at a glance. Ref: redesign `:112`, `:165` (P0 in that doc).
2. **Progressive label disclosure** — gate node labels on importance/zoom to kill the hairball;
   today there is "no progressive disclosure of labels" (redesign `:90`, `:136-143`, `:167`). The
   5 view modes become progressive _lenses_ rather than the only control.
3. **Narrative camera anchor** — anchor the initial camera/layout on the user's most important node
   (e.g. their north-star goal / highest-importance node) so the graph opens on a story beat instead
   of a uniform cloud. Ref: redesign `:112` (narrative-anchored layout), `:176` (P1 — progressive
   depth) and `:152` (drilldown as the reward of disclosure).

These build directly on the visible entry point this launch creates; none require backend changes.
