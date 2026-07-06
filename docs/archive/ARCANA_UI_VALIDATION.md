# ARCANA_UI_VALIDATION.md — Phase 7

Live Playwright, prod, real onboarded user, full-width dashboard.

## Verified (promotion / cross-domain turn)

| Check                                           | Result                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Chat remains conversational (no report headers) | ✅ "Your promotion significantly boosts your financial capacity, with a new base salary of $192,000…" |
| Evidence visible behind "Why?" (not dumped)     | ✅ drawer: "What I weighed" + "From what you've shared" + Sources                                     |
| Citations visible                               | ✅ source chips + Sources list (label · value · confidence)                                           |
| Risks visible                                   | ✅ rose chips: income loss / no estate plan / outliving assets / sequence risk                        |
| Goals/source visible                            | ✅ chips: Career Goal · Education Goal · Finances · Family · Document                                 |
| No report formatting / markdown wall            | ✅ clean prose + chips + collapsible drawer                                                           |

## Harness notes (honest)

- The advisor LLM turn takes ~20–30s; the chips/drawer render once the answer arrives (polled up to 60s).
- At narrow viewports the responsive nav drawer overlays the chat (mobile layout) — verified at full width where the sidebar is persistent.
- Unit tests (`CommandCenter.test.tsx`) assert the source chip + "Why?" drawer deterministically (7/7 pass).

## Domains

The component is domain-agnostic — the same chips/drawer render for health/career/education/finance/family (data-driven). Cross-domain promotion turn exercised all chip types (finance + family + career + education).
