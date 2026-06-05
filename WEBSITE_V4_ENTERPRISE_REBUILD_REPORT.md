# Website Enterprise Rebuild Report — LifeNavigator

**Scope:** Ground-up rebuild of the homepage + beta marketing experience.
**Brand:** LifeNavigator — _Decision Intelligence for Life_
**Date:** 2026-06-05
**Result:** ✅ `type-check` passes · ✅ `next build` passes (0 errors) · ✅ all existing routes 200

---

## 1. Why the previous version failed

The v4.1–v4.3 site was already dark and cinematic, but it still read as _generic premium SaaS_. Three root causes:

1. **No distinctive typeface.** Everything — including every headline — rendered in the default UI font (Geist). `.font-display` only nudged letter-spacing. This is the single biggest "Tailwind template" tell.
2. **Flat, low-energy motion.** Animations existed but were subtle and uniform; nothing felt _alive_ or reactive.
3. **Product visuals lacked depth and realism.** Device mockups were thin (a sparse dashboard, no reflections, no "live" signals), so the scene didn't convince in 5 seconds.

This rebuild attacks all three directly, then re-composes the page with a stronger editorial rhythm.

---

## 2. The single highest-leverage change: typography

Introduced an **editorial display serif — `Newsreader`** (`next/font/google`, weights 400/500/600 + italic), wired as `--font-display` in `layout.tsx` and mapped to `.font-display` in `globals.css`. Geist remains the UI/body face.

- Every large headline is now serif; the accent clause is **serif italic + gradient** (e.g. _"Decision Intelligence **for Life.**"_, _"one **private graph.**"_).
- This serif/sans pairing is the Mercury/Stripe-press signal — it instantly differentiates from generic SaaS without tipping into "old corporate" (Newsreader is a contemporary, optically-refined face).
- Applied site-wide, so `/product`, `/how-it-works`, and `/trust` inherit the same upgrade cohesively.

Also fixed stale metadata (was "NexLevel … Secure Life Management") → correct LifeNavigator title, description, OG, and keywords.

---

## 3. New cinematic primitives (`globals.css`)

| Primitive                     | Effect                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `.grain`                      | Fixed SVG film-grain over the whole stage — kills the flat-gradient look that reads as a template. |
| `.hairline`                   | Gradient section dividers (teal-cored) replacing flat 1px borders.                                 |
| `.edge-glow`                  | Masked gradient border that gives panels a lit top-edge (glassmorphism depth).                     |
| `.conic-halo` + `.spin-slow`  | Slowly rotating conic glow behind the data-graph core and hero.                                    |
| `.shimmer`                    | Periodic light sweep across glass cards → "live" feel.                                             |
| `.pulse-dot`                  | Pulsing status dots for "Grounded / streaming" chips.                                              |
| `.draw`                       | Stroke draw-on animation for the connected-graph links.                                            |
| `.btn-primary` / `.btn-ghost` | Premium buttons with inner light, teal glow, and lift.                                             |
| `.stagger`                    | Staggered child reveal inside scroll sections.                                                     |

Every animation is gated behind `prefers-reduced-motion: no-preference` and explicitly disabled under `reduce`.

---

## 4. Components — rebuilt / upgraded (`src/components/site/`)

All shared prop contracts were kept **backward-compatible** so `/product`, `/how-it-works`, `/trust`, `/beta` continue to work unchanged.

- **`HeroScene`** — rebuilt. Mixed serif/sans headline, **pointer-reactive spotlight** + gentle 3D scene tilt, scroll parallax on the device + floating cards, trust microcopy row ("Grounded in your data · No invented facts · Central governance + personal context"), and a domain trust strip. Premium CTAs ("Request Beta Invite" / "Explore Platform").
- **`DeviceMockup`** — rebuilt for fidelity. Realistic browser chrome with URL bar, full left rail + beta-profile widget, net-worth hero metric with sparkline, allocation donut, metric chips, a **top recommendation card**, and a **grounded chat exchange with a cited figure**. Added side glints, an edge-glow bezel, and a teal floor reflection. Phone screen now shows live goal progress bars. (`DashboardScreen`, `PhoneScreen`, default `variant` export all preserved.)
- **`DataConnectionMap`** — rotating conic halo, glowing core, draw-on links, and **traveling pulses** flowing from each domain into the Decision-Intelligence core. (`tone` / `className` preserved.)
- **`TrustArchitectureVisual`** — edge-glow cards + a "One grounded, governed answer" convergence row between the HOW / WHAT layers. (`className` preserved.)
- **`FloatingInsightCard`** — added shimmer + edge-glow. (API preserved.)
- **`ScenarioCard`** — hover lift, icon scale, top-edge sheen, radial hover glow.
- **`EnterpriseCTA`** — serif headline, edge-glow frame, refreshed CTAs.
- **`ParallaxBackdrop`** — extra depth orb + the global film-grain layer.

---

## 5. Homepage composition (`src/app/page.tsx`)

Re-sequenced into a deliberate editorial rhythm (all sections meet the brief):

1. **Hero** — full-screen cinematic scene (laptop + phone + floating insight cards + spotlight).
2. **Stats credibility band** — 6 domains / 0 invented facts / 100% isolation / <3 min.
3. **Your connected data layer** — **Apple/Linear-style bento**: large data-graph tile + grounded-chat tile + Plaid read-only accounts tile.
4. **Built for real life** — cinematic photo collage.
5. **Decision domains** — six `ScenarioCard`s (finance, career, education, health, family, decisions).
6. **Feature rows** — finance and career/education, with imagery.
7. **How it works** — 4 numbered steps on a glowing hairline track.
8. **Trust architecture** — HOW vs WHAT → one grounded answer.
9. **Vision quote** — serif pull-quote.
10. **Beta sample profiles** — three persona cards (Young Professional, Dual-Income Family, Career Switcher) with sample stats, plus the "real data via Plaid" full-product callout.
11. **Security & privacy** — four-card grid + Trust Center link.
12. **FAQ** — accessible native `<details>` accordion (no JS, animated +/− toggle).
13. **Final CTA** — `EnterpriseCTA`.

Beta-vs-full-product positioning is explicit throughout: **beta = safe sample profiles; full product = real connected data via Plaid.**

---

## 6. Acceptance criteria

| Criterion                                     | Status                                                            |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Official LifeNavigator logo                   | ✅ via `brand/Logo` `Mark` (in nav, mockups, chat bubbles)        |
| Full-screen cinematic hero                    | ✅ `HeroScene`                                                    |
| Dark premium background w/ depth              | ✅ parallax orbs + grid + grain + vignette                        |
| Laptop / mobile / floating cards / data graph | ✅ all present                                                    |
| Parallax scrolling                            | ✅ scroll + pointer parallax                                      |
| Subtle motion                                 | ✅ float, shimmer, pulse, draw-on, spotlight, reveal              |
| Glassmorphism cards                           | ✅ `glass-dark` + `edge-glow`                                     |
| High-end gradients                            | ✅ aurora, conic, gradient text                                   |
| Realistic dashboard UI (not empty cards)      | ✅ dense, cited dashboard + phone                                 |
| Mobile-first responsive                       | ✅ all grids collapse; heavy scene decoration is `sm/md/lg`-gated |
| Premium within 5 seconds                      | ✅ serif hero + cinematic device scene above the fold             |

**Not broken:** auth, onboarding, dashboard, beta invite flow, and all existing routes — verified: `/`, `/product`, `/how-it-works`, `/trust`, `/beta` all return **200** from a production server. Shared component APIs unchanged.

---

## 7. Verification

```
pnpm --filter @life-navigator/web type-check   # EXIT 0
pnpm --filter @life-navigator/web build        # EXIT 0, 0 errors, / prerendered static
# runtime smoke (next start):
#   /              200  → title + hero copy + premium classes present in SSR HTML
#   /product       200
#   /how-it-works  200
#   /trust         200
#   /beta          200
```

## 8. Files changed

- `src/app/layout.tsx` — Newsreader display font + corrected metadata
- `src/app/globals.css` — `.font-display` → serif + new cinematic primitives
- `src/app/page.tsx` — full homepage recomposition
- `src/components/site/HeroScene.tsx` — rebuilt
- `src/components/site/DeviceMockup.tsx` — rebuilt (richer, realistic)
- `src/components/site/DataConnectionMap.tsx` — animated/glowing
- `src/components/site/TrustArchitectureVisual.tsx` — upgraded
- `src/components/site/FloatingInsightCard.tsx` — shimmer + edge-glow
- `src/components/site/ScenarioCard.tsx` — richer interactions
- `src/components/site/EnterpriseCTA.tsx` — serif + edge-glow
- `src/components/site/ParallaxBackdrop.tsx` — extra depth + grain

## 9. Optional next steps

- Replace Unsplash photography (`site/media.ts`) with branded `/public` art for full ownership.
- Add a real `/public/og-image.png` (referenced in metadata) for richer link unfurls.
- Consider a short autoplaying product loop (muted webm) in the hero for even more motion.
