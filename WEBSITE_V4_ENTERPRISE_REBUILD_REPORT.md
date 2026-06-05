# WEBSITE_V4_ENTERPRISE_REBUILD_REPORT.md

**Date:** 2026-06-04
**Scope:** Homepage rebuilt from scratch as a cinematic, enterprise-grade experience. New reusable site
component system. Auth/onboarding/dashboard/routes untouched.

---

## Approach — why CSS/SVG, not stock photos

A premium AI/fintech feel (OpenAI / Stripe / Linear / Mercury / Vercel) is built from **abstract, geometric,
gradient-rich, device-mockup** visuals — not photography. That's also the only way to guarantee zero broken
remote images and sharpness at any resolution. So every visual here is **rendered in markup/SVG**: device
mockups with a synthetic LifeNavigator dashboard, an animated gradient-mesh hero, a connected-data-nodes
graph, glass insight cards, and the trust-architecture diagram. (If you later want real executive/family
imagery, drop assets in `/public/brand/` and I'll slot them into the existing components.)

## New reusable components (`src/components/site/`)

| Component                                          | What it is                                                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HeroScene`                                        | Cinematic dark hero: animated **aurora** gradient mesh + engineering grid, headline, dual CTAs, and a 3D-tilted **product scene** (laptop dashboard + phone companion + 3 floating glass insight cards), with **scroll-linked parallax**. |
| `DeviceMockup` + `DashboardScreen` / `PhoneScreen` | Laptop/phone/tablet frames wrapping a **synthetic, photoreal-style dashboard** (net-worth SVG chart, metric cards, first-insight, grounded chat) — all markup.                                                                            |
| `FloatingInsightCard`                              | Glass card (dark/light) for product moments ("Grounded in your data", "Fail-closed AI").                                                                                                                                                  |
| `DataConnectionMap`                                | SVG: your six life domains feeding one decision-intelligence core, with animated dashed links.                                                                                                                                            |
| `TrustArchitectureVisual`                          | Central=HOW / Personal=WHAT / authoritative facts / refuse-when-unknown.                                                                                                                                                                  |
| `ScenarioCard`                                     | Premium domain card (gradient icon tile, hover glow/lift).                                                                                                                                                                                |
| `EnterpriseCTA`                                    | Full-bleed dark CTA band with aurora + grid.                                                                                                                                                                                              |
| `MotionSection`                                    | Scroll-reveal wrapper (IntersectionObserver fade/slide), reduced-motion safe.                                                                                                                                                             |

Plus cinematic CSS primitives in `globals.css`: `.aurora`, `.tech-grid`, `.glass` / `.glass-dark`,
`.text-gradient`, `.float`, animated `.dash` links, `.reveal` — all gated behind
`prefers-reduced-motion`.

## Page structure (all 11 sections, in order)

1. **Hero** — cinematic scene, "Decision Intelligence for Life", Request Beta Invite / Explore the Platform.
2. **Product dashboard** — large laptop mockup.
3. **Your data layer** — copy + `DataConnectionMap`.
4. **What it helps with** — six `ScenarioCard`s (Finance, Career, Education, Health, Family, Decisions).
5. **How it works** — four-step strip.
6. **Trust architecture** — `TrustArchitectureVisual`.
7. **Beta experience** — sample profiles (today) vs. real connected data (full product), clearly split.
8. **Security & privacy** — four pillars + Trust Center link.
9. **Pricing / beta access** — invite-only, free during preview.
10. **FAQ.**
11. **Final CTA** — `EnterpriseCTA`.

Nav + Footer use the official logo and the new IA.

## Motion

Parallax on the hero product scene + floating cards (scroll-linked, rAF-throttled); float loops on cards;
scroll-reveal on every section; animated aurora + dashed graph links. **All disabled under
`prefers-reduced-motion: reduce`.**

## Responsive / mobile

Mobile-first throughout: hero copy + laptop scale down, phone + side floating cards hide on small screens
(no clutter), grids collapse to one column, the nav has a working mobile menu. **Verify on a real device
after deploy** (I can't render here).

## Accessibility

Semantic landmarks, single `<h1>`, ordered headings, `<dl>` FAQ, `aria-label` on the data-map SVG and
logo/menu, decorative layers `aria-hidden`, reduced-motion fully honored. Follow-ups: focus-visible rings
audit, contrast check on `--brand-muted`, full SR pass.

## Verification

- ✅ `tsc --noEmit` clean on all new components + homepage.
- ⏳ `next build` (running) — report updated on completion.
- ⏳ Render + mobile: **needs your eyes on the deployed page** — I build blind.

## The standard

Per your instruction ("if it still looks like a basic SaaS template, keep improving"): this is a strong,
cinematic v4, but the final 10% (exact type scale, hero composition, real imagery if wanted) is best dialed
in against what you see live. Tell me what's not premium enough and I'll iterate — the component system is
built to make that fast.
