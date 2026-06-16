# Advice Disclosure Report (P0-3)

**Date:** 2026-06-16 · **Goal:** intelligent, context-aware advice disclosure — NOT a blanket disclaimer under every message (which would ruin the experience).

## What was built

A single reusable component + a small, testable level-computation helper. No backend changes, no new endpoints.

- **`src/lib/advice/disclosure.ts`** — `DisclaimerLevel` (`none | subtle | explicit | formal`), the tier copy constants, and `levelFromText()` / `levelFromThemes()`. Matching is word-boundary + case-insensitive; **EXPLICIT wins over SUBTLE**; stems of 5+ chars allow suffixes (so "budget"→"budgeting", "retire"→"retirement") while short tokens (ira, etf, tax) require a full-word boundary so we never trip on "irate"/"taxonomy".
- **`src/components/advice/AdviceDisclaimer.tsx`** — renders **nothing** at `none`; a single muted line at `subtle`; a calm amber note at `explicit`/`formal`. Never alarming, never repeated.

## The four tiers

| Tier         | When                                                                                    | Copy                                                                                                    | Where                                                          |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **none**     | onboarding, discovery, clarification, goal capture, low-risk coaching                   | (nothing rendered)                                                                                      | default everywhere                                             |
| **subtle**   | general financial / benefits / education / career planning                              | "Use this as decision support, not a substitute for a licensed professional."                           | chat + advisor                                                 |
| **explicit** | investment, insurance, retirement, tax, estate/legal-adjacent, medical/health-sensitive | "This is planning guidance based on what you've shared, not legal, tax, medical, or investment advice." | chat + advisor                                                 |
| **formal**   | reports, PDFs, advisor-ready/CPA-facing outputs                                         | (full report governance text)                                                                           | **already implemented** in the report/PDF engine — not re-done |

## Where it's mounted

1. **`/dashboard/chat`** (`app/dashboard/chat/page.tsx`) — tier computed from the latest user message (or the text being typed) via `levelFromText`; rendered under the composer hint. Empty conversation → nothing shown.
2. **`/dashboard/advisor`** (`app/dashboard/advisor/page.tsx`) — tier computed from the advisor's context-panel `top_themes` + `top_risks` via `levelFromThemes`, rendered just below the message stream. **Stays silent during early discovery** (no domain themes yet) and escalates only once finance/health/legal/tax/estate themes surface — preserving the "feels like an advisor, not a form" experience.

## Why no disclaimer on `/conversation`

`/conversation` now redirects to `/dashboard/advisor` (see CHAT_SURFACE_AUDIT, P0-2), so it inherits the advisor's disclosure. No separate mount needed.

## Existing disclaimers we deliberately did NOT duplicate

- **Reports / PDFs (FORMAL):** the core-api report engine and PDF renderer already emit contextual, per-section governance/disclaimer text. Untouched.
- **Domain dashboard pages:** finance/health/family/education/career/military/decision pages already render backend-sourced `disclaimer_text` (e.g. estate "consult a licensed attorney", health "not medical advice"). Untouched.
- **Sidebar AI assistant (CHAT-1):** already shows "General information, not financial, tax, or legal advice." Untouched.

The new component fills the only gap: the two open conversational surfaces.

## Tests

`src/lib/advice/__tests__/disclosure.test.ts` — 7 cases covering none/subtle/explicit, EXPLICIT-wins-over-SUBTLE, word-boundary safety ("irate" ≠ "ira"), and theme-based escalation. All pass.

## Verdict

**Disclosure appears only when appropriate.** Discovery and low-risk coaching stay clean; high-stakes finance/health/legal/tax topics get a calm, non-alarming note; reports keep their existing formal governance. No blanket disclaimer anywhere.
