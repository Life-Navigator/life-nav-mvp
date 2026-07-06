# ARCANA_MARKDOWN_REMOVAL_REPORT.md — Phase 3

## Removed from default advisor chat (verified live across 5 domains)

- `**The tradeoffs:**` section — moved to `reasoning.tradeoffs` (structured).
- `**What we know:**` section — moved to `reasoning.what_we_know`.
- `**My read:**` header — the recommendation now renders as a natural paragraph.
- `**What would change this:**` section — moved to `reasoning.what_we_still_need`.
- The verbose inline disclaimer — removed (the chat UI shows a persistent compliance footer: "General information, not financial, tax, or legal advice").
- The `**bold question**` + `_why italics_` — the question is now plain prose.

## Kept

- The model's full structured reasoning (now DATA, not prose) — for an expandable drawer.
- Citations / provenance.
- The single follow-up question.
- All validator trust checks + safety fallback.

## Verified (live, prod, 5 domains)

finance / health / promotion / estate / family — all return `conversational (no headers) = True`, `citations = 25`, `reasoning present = True`.
