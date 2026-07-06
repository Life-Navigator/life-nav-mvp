# IMPACT_SUMMARY_CARD.md — Phase 2

## Delivered + verified live

After an approved action, the chat shows a polished **✓ Update complete** card (replacing the old plain text):

- **Added to your life model (N)** — the real facts written, as chips, currency-formatted (e.g. "Purchase price: $675,000 · Down payment: $135,000 · Mortgage balance: $540,000").
- **This affects** — the impact areas as chips (Net worth · Liabilities · Cash reserves · Readiness · Retirement assumptions).
- "Your advisor and dashboard now reflect this." (true — confirmed facts feed the advisor citations + the dashboard "Recently learned" strip on next read).

## The honesty line (important)

The brief's example card shows "Readiness: 69 → 74". **I did NOT render that**, because it would be fabricated: I verified live that a `life.facts` write does **not** move the readiness index (69 → 69) — readiness is computed from **domain tables**, not `life.facts`. So the card states only what is TRUE: the life model grew (real facts) and the areas it touches. A real numeric readiness/recommendation delta would require the actions to also write the domain tables (see READINESS_DELTA.md / RECOMMENDATION_DELTA.md — the documented gap).

## Verified

Home-purchase action → card rendered with the 3 real facts (currency-formatted) + 5 impact chips. Screenshot captured.
