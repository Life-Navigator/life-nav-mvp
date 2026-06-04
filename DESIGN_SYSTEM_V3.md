# DESIGN SYSTEM V3

**Date:** 2026-06-04
**North star:** Apple (restraint/craft) · OpenAI (calm intelligence) · Linear (precision/motion) · Stripe (clarity) · Morgan Stanley (gravitas).
**Adjectives:** premium · minimalist · futuristic · intelligent · calm · trustworthy.
**Anti-patterns to delete from V1:** loud cyan→sky gradients, generic "SaaS" rounded blobs, emoji, drop-shadow overload, freemium energy.

---

## 1. Color palette

Restraint first. One ink, warm neutrals, **one** confident accent, financial-trust support, semantic only where needed.

**Ink & neutrals (the 90%)**

- `ink/950 #0A0B0D` — primary text / dark surfaces
- `ink/800 #1C1E22` · `ink/600 #3A3D44` · `ink/400 #71757E` (secondary text)
- `paper/0 #FFFFFF` · `paper/50 #FAFAF8` (warm off-white canvas) · `paper/100 #F2F1EC`
- `line #E7E6E1` (hairlines) — borders are 1px, low-contrast, never heavy

**Accent — "Navigator Blue" (trust + intelligence, NOT neon cyan)**

- `accent/600 #2B59FF` (primary action) · `accent/700 #1E40D6` (hover) · `accent/50 #EEF2FF` (wash)
- Use sparingly: CTAs, key data, the "thinking" state. The page should read mostly monochrome.

**Money/gravitas support**

- `evergreen/600 #0E7C5A` (positive / growth) · `signal/amber #C77D20` (caution) · `signal/red #C0392B` (risk)
- A faint **"governed/verified"** teal-ink `#1F6F78` reserved for trust/audit motifs only.

**Dark mode:** true dark (`#0A0B0D` canvas), neutrals lifted, accent slightly brightened (`#5B7CFF`). Default to **light** for premium-calm; offer dark.

**Rule:** any screen uses ink + neutrals + **at most one** accent + (optionally) one semantic color. No multi-color gradients.

## 2. Typography

- **Display / headlines:** a refined grotesque or serif-grotesque with character — e.g. **"Söhne", "Neue Haas Grotesk", or "GT America"** (fallback: Inter Tight). Tight tracking, `1.05–1.1` line-height, weights 500–600 (not 700+ — confidence is quiet).
- **Body / UI:** **Inter** (or system) at 16–18px, `1.6` line-height, weight 400–450.
- **Numerals / data:** a **tabular** mono or font-feature `tnum` for all money/figures (financial credibility). e.g. "Söhne Mono" / "Geist Mono".
- **Scale (rem):** Display 4.0 / 3.0 / H1 2.25 / H2 1.75 / H3 1.375 / body 1.0 / small 0.875 / micro 0.75.
- **Measure:** body ≤ 68ch. Headlines ≤ 18 words. Generous paragraph spacing.

## 3. Spacing

- **8px base grid**; scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- **Air is the product.** Section padding 96–128px desktop. Hero breathes (≥ 33% empty).
- Component internal padding generous (cards 24–32px). Never crowd money figures.

## 4. Layout system

- **12-col grid**, 1200–1280px max content, 24px gutters; full-bleed bands for hero/trust/AI-architecture.
- **Vertical rhythm:** one idea per band, alternating canvas (`paper/0` ↔ `paper/50`) for gentle separation — no harsh dividers.
- **Asymmetry sparingly** for editorial sophistication (e.g., text 5 / proof 7).
- **Responsive:** content-first, single-column mobile, sticky CTA bar.

## 5. Cards

- **Surface:** `paper/0`, 1px `line` border, radius **14–16px**, shadow _barely there_ (`0 1px 2px rgba(10,11,13,.04), 0 8px 24px rgba(10,11,13,.04)`).
- **Hover:** lift 2px + border darkens one step + accent hairline; 160ms ease. No scale-bounce.
- **Advisor/"desk" cards:** a small monoline glyph, a name, one outcome sentence, a tiny live example in a recessed inset. Calm, not busy.
- **"Brief" cards (the hero/dashboard artifact):** look like a private memo — label row ("Today's brief · Governed"), a sentence, a quiet "why →".

## 6. Dashboards

- **Frame:** "Your office" — a calm command surface, not a metrics wall. Default view = **one headline insight + 3 supporting cards + one next action**, not 14 widgets.
- **Hierarchy:** the _insight_ is the hero; charts support it. Money totals in tabular numerals, large, single-accent.
- **Empty/first-run state is designed**, not blank (see Activation flow): a "preparing your office" state + the first brief.
- **Density toggle** (calm ↔ detailed) for power users.

## 7. Charts

- **Style:** Stripe/Linear precision — thin strokes (1.5px), no gridline clutter, muted axes, one accent line, single highlighted point with a value chip.
- **Scenario comparison:** two lines (ink + accent), shaded delta region, one annotated takeaway ("≈ $X / Y years"). The chart _concludes_ — never leaves the user to interpret.
- **No** pie charts for finance, no 3D, no rainbow categories (use ink shades + one accent).
- Always pair a chart with a one-sentence plain-language reading.

## 8. Animations

- **Principle:** motion = intelligence thinking, never decoration. Durations 120–240ms; easing `cubic-bezier(.2,.8,.2,1)`.
- **Hero "brief" types in** (a calm typewriter, ~30ms/char) — signals a mind at work.
- **Section reveal:** 12px rise + fade on scroll, staggered 60ms. Subtle.
- **AI Architecture diagram:** step-by-step build (data → graph → governed reasoning → answer), each node fades/connects on scroll.
- Respect `prefers-reduced-motion` (cut to fades).

## 9. Micro-interactions

- **Buttons:** 120ms color + 1px translate on press; accent ring on focus (a11y).
- **"Governed" badge:** a tiny check that draws on first view (250ms), then static.
- **Number roll-up:** money figures count up once on reveal (tabular, 600ms) — financial "wow".
- **Persona switch:** changing the sample profile cross-fades the dashboard numbers (the "watch the advice change" moment).
- **Copyable/auditable:** insights have a quiet "why" affordance that expands a why-chain inline.

## 10. Icons

- **Monoline, 1.5px stroke, 24px grid**, rounded joins — Linear/Phosphor character, custom-tuned. Single ink color; accent only for the active item.
- One **glyph per advisory desk** (Decision, Financial, Scenario, Career, Family) — a tiny consistent family.
- No filled/duotone/colorful icon sets. No emoji anywhere.

## 11. Illustration strategy

- **No stock illustrations, no 3D blobs, no mascots.** The "art" is the **product's own intelligence rendered as artifacts**: brief cards, the personal-graph diagram, scenario lines, a balance-sheet card.
- One signature visual: **"the personal graph"** — an elegant, sparse node-link motif (your goals/accounts/decisions) rendered in ink + accent, used in the AI Architecture section and as a faint hero backdrop. It _is_ the brand.
- Photography (if any): restrained, real, desaturated; people in thought, not stock-smiling. Used sparingly.

---

## Tokens (starter)

```
--ink-950:#0A0B0D; --ink-600:#3A3D44; --ink-400:#71757E;
--paper-0:#FFFFFF; --paper-50:#FAFAF8; --line:#E7E6E1;
--accent-600:#2B59FF; --accent-700:#1E40D6; --accent-50:#EEF2FF;
--pos:#0E7C5A; --warn:#C77D20; --risk:#C0392B; --verified:#1F6F78;
--radius:15px; --shadow:0 1px 2px rgba(10,11,13,.04),0 8px 24px rgba(10,11,13,.04);
--ease:cubic-bezier(.2,.8,.2,1);
```

## Implementation note

V1 uses Tailwind + cyan. Migration: define the tokens above as Tailwind theme extensions, replace `cyan-*` accents with `accent-*`, swap gradients for flat warm canvas, and adopt tabular numerals for money. The dashboard refactor (calm command surface) is the highest-leverage visual change for the "wow".
