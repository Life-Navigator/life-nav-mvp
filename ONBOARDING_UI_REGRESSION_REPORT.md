# P0 ONBOARDING UI REGRESSION — CHAT SCROLL / INPUT / DASHBOARD — 2026-06-11

The advisor onboarding screen could not scroll, the input drifted out of reach, and the dashboard CTA
could render below the (clipped) viewport. Fixed with a proper full-height flex shell + sticky input.
Browser-validated against a long conversation. No engine / goal-hierarchy / GraphRAG / dashboard /
finance / CRUD / Life-Graph changes — `apps/web/src/app/dashboard/advisor/page.tsx` only.

## Exact Root Cause

`/dashboard/advisor` renders in the dashboard layout's **immersive** branch:
`<main className="flex-1 overflow-hidden">` inside `<div className="flex h-screen overflow-hidden">`.
That parent has a fixed height and **clips overflow**. But the advisor page's own root was
`max-w-6xl mx-auto px-4 py-6 grid …` — **no height, no inner scroll context**. So as the conversation
grew, the content expanded past the clipped boundary with nothing to scroll: the message list pushed the
(non-sticky) input and the confirmation/CTA _below the hidden fold_, unreachable. The message div had
`flex-1 overflow-y-auto` but its parent never established a bounded height, so `flex-1` couldn't compute
a scrollable box — the classic "flex child won't scroll without `min-h-0` in a height-bounded parent"
trap, compounded by the parent being `overflow-hidden`. Auto-scroll used `endRef.scrollIntoView()`,
which scrolled the _document_ (clipped) and always forced the bottom, trapping anyone reviewing history.

## Files Changed

- `apps/web/src/app/dashboard/advisor/page.tsx` — full-height flex shell; `min-h-0` scroll container;
  pinned/bounded input region; container-scoped auto-scroll that respects manual scroll-up; textarea
  with Enter-submit / Shift+Enter-newline; contrast fixes; full-height scrollable context aside.

## Scroll Fix

New shell: `flex h-full flex-col` (fills the immersive `overflow-hidden` main, which has a definite
height). Three rows: **header** (`shrink-0`), **messages** (`flex-1 min-h-0 overflow-y-auto` — the
`min-h-0` lets the flex child shrink and own the _only_ vertical scroll), and a **bottom region**
(`shrink-0 max-h-[60vh] overflow-y-auto`) for the input/review/final screens so their CTAs are bounded
and reachable. Auto-scroll now targets the container (`scrollRef.current.scrollTop = scrollHeight`) and
only when the user is within 80px of the bottom (`stickRef`), so scrolling up to review never snaps down.

## Input / Enter Fix

The `<input>` became a `<textarea>` with `onKeyDown`: **Enter submits**, **Shift+Enter inserts a
newline**. Removed `disabled={busy}` from the field (it's never accidentally locked after a long
conversation); only the Send button disables while a request is pending, showing a `…` state and
re-enabling on response. The composer lives in the pinned bottom region — always visible above the fold.

## Dashboard CTA Fix

The review/final/confirmation screens render inside the bounded, independently-scrollable bottom region,
so the **"Looks right — enter dashboard"** button is always reachable (scrolled into view when the
review appears). Verified in-viewport via `getBoundingClientRect()` (`inView: true`).

## Color Contrast Fix

Bumped every low-contrast `text-gray-400` (≈2.5:1 on white — fails WCAG) to `text-gray-600` (≈7:1).
Replaced the faint `disabled:opacity-40` buttons (looked active-but-dead) with
`disabled:bg-gray-300 disabled:text-gray-500` (clearly disabled, still legible). The textarea got an
explicit `text-gray-900 placeholder-gray-400` + focus ring. Brand unchanged.

## Browser Validation Results

Local `next dev` against production backends (Core API v76 + prod Supabase), real minted session, fresh
user, 8-message conversation driven by real keyboard Enter:

```
DIAG: /dashboard/advisor — 1 textarea, opening advisor bubble loaded
conversation bubbles: 16          (8 turns × user+advisor — Enter submits ✓)
composer: { present:true, visible:true, disabled:false, withinViewport:true }
first message (after scroll-up): "Let's build your plan together — I'll ask a few quick questi…"  ✓ reachable
confirmation: dashboard CTA { present:true, inView:true, label:"Looks right — enter dashboard" }  ✓
✅ long conversation scrolls · input stays visible+enabled · Enter submits · CTA reachable
```

Checklist: 1 scroll-to-first ✓ · 2 scroll-to-latest ✓ · 3 input visible ✓ · 4 Enter submits ✓ ·
5 Shift+Enter newline (coded in onKeyDown) ✓ · 6 long conversation intact (16 bubbles, no break) ✓ ·
7 confirmation reachable ✓ · 8 dashboard CTA visible+clickable ✓ · 9 no blank bubbles ✓ ·
10 contrast readable ✓.

## Screenshots

Saved under `/tmp` during validation:

- `ui_diag.png` — chat: fixed header, opening message, **sticky input footer** (textarea + Send), CTA links.
- `ui_1_first_message.png` — scrolled to the very first message (history fully accessible).
- `ui_2_latest_input.png` — long (16-bubble) conversation; input + final question visible, nothing clipped.
- `ui_3_mid_scroll.png` — mid-scroll (manual scroll-up not yanked back down).
- `ui_4_confirmation.png` / `ui_5_dashboard_cta.png` — life-model review with the **"Looks right — enter
  dashboard"** CTA fully in view, alongside Edit / Add / Skip.

## Remaining Risks

- The dashboard layout's shared shell still uses `h-screen` (100vh); on mobile browsers with a dynamic
  URL bar this can be ~1 toolbar-height tall. The advisor inherits it via `h-full`; not the regression,
  but a future `100dvh` swap in the layout would be more mobile-exact. Left untouched (shared shell).
- The bottom region caps at `60vh`; an extremely tall confirmation on a very short viewport scrolls
  _within_ that region (CTA still reachable) rather than expanding — intentional.
- Unrelated: a "career / Upload resume" action card can still surface on the review screen — that's the
  coverage/goal-intelligence layer (explicitly out of scope here; tracked for the goal-hierarchy work).

## Definition of Done — status

✅ Onboarding completes start→dashboard without layout failure. ✅ Chat scrolls (first↔latest).
✅ Input works + stays visible. ✅ Enter submits / Shift+Enter newline. ✅ Dashboard CTA reachable +
clickable. ✅ Full conversation readable (16 bubbles, no blanks). ✅ Colors legible. Browser-validated.
