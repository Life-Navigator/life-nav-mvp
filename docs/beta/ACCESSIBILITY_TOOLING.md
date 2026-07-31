# Accessibility Tooling

**Added in R-3 slice 3C.** The repository previously had **none** — no `jest-axe`, no `@axe-core/*`,
nothing axe-related in Playwright. Gate I of the beta audit was unmeasurable by automation.

## Dependencies (pnpm, lockfile committed)

| Package                        | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `jest-axe` + `@types/jest-axe` | component-level axe on the existing Jest/jsdom runner |
| `@axe-core/playwright`         | browser-level axe on the existing Playwright setup    |

No new test runner was introduced. Jest and Playwright are unchanged.

## Helpers

**`src/test/axe.ts`** — `expectNoSeriousA11yViolations(container)`. Fails on **serious/critical**
only; minor and moderate are surfaced but not blocking.

**`e2e/axe-helper.ts`** — Playwright equivalent, scoped to WCAG 2.0/2.1 A and AA tags.

## What automated axe proves — and does not

**Proves:** no automatically detectable serious/critical WCAG violations in the rendered DOM.

**Does not prove:** keyboard operability, focus order, screen-reader comprehensibility, or that the
workflow is usable by a real assistive-technology user. Automated tooling catches roughly a third of
real accessibility problems.

**This is not WCAG certification.** The reporting workflow is additionally covered by explicit
focus-entry, focus-trap, Escape, focus-restoration and label/announcement tests, because those are
precisely the behaviours axe cannot see. Manual screen-reader verification remains outstanding.

## Playwright status

The helper and configuration are implemented and type-check. **No browser accessibility test was
run** — there is no authenticated target available without credentials. Any future result produced
against mocked routes is **mocked-browser evidence**, never deployed-browser evidence.

## CI

Component axe runs inside the existing `Unit Tests` job via the standard Jest suite. No new job is
required; the assertions live in the component tests themselves.
