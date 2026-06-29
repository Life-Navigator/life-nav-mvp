# First-5 Persona → Account Assignments (founder-facing)

Private. No passwords, magic links, or secrets here. Accounts accessed via magic link (the beta auth).
Personas are **persisted in the database** (seeded + onboarded through the real pipeline), not mock data.

| Account (synthetic)            | persona_key        | display | scenario                                        | primary test focus                                                                    | intentional gaps                 |
| ------------------------------ | ------------------ | ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| beta1@lifenav-beta.example.com | family_foundation  | Avery   | wedding → home → family + promotion + health    | onboarding sequencing, dashboard cards, Active Goals, cross-agent handoff, Life Brief | —                                |
| beta2@lifenav-beta.example.com | young_professional | Jordan  | debt/emergency-fund/invest + Senior promotion   | budgeting, prioritization, career growth, cert ROI                                    | no family/estate facts           |
| beta3@lifenav-beta.example.com | pre_retirement     | Sam     | retire at 65, nest-egg, healthcare, estate      | retirement-readiness language, risk framing, investment honesty, boundaries           | **no health metrics (expected)** |
| beta4@lifenav-beta.example.com | new_parent         | Riley   | college fund, life insurance, family protection | family protection, insurance/estate prompts, budget pressure                          | —                                |
| beta5@lifenav-beta.example.com | career_change      | Casey   | teaching → data science, debt, cert             | career/education handoff, credential ROI, runway                                      | sparse health                    |

**Expected dashboard highlights:** each shows its own Financial Overview (synthetic balances), fact-first
domain cards, and Active Goals captured from onboarding. **Expected advisor behavior:** answers grounded in the
persona's facts; cross-agent handoff (Career→Finance etc.); never re-asks captured facts.

**Synthetic flag:** every account has `user_metadata.is_synthetic = true` + `persona` → dashboard shows the
"Synthetic beta profile" banner (the banner reads this on `auth.getUser()`).

**Feedback to ask each tester:** What felt accurate? Confusing? Too generic? Unsafe? What would make this worth
paying for?

## Verification state (2026-06-29)

- **Persisted, not mock:** the gate harness seeds + runs onboarding through the real pipeline; per-persona DB
  facts are read back via `domain_summary` / `canonical_goals` (the same user-scoped services the app uses) —
  distinct per persona (e.g., beta3 has **no** health facts by design; goal counts vary 3–5). No production
  endpoint falls back to mock persona data (audited — `domain_summary`/`discovery_coverage`/dashboard show
  honest empty states when a domain is empty).
- **Isolation:** RLS (`auth.uid() = user_id`) on all persona tables.
- **Caveat:** the Supabase admin `?email=` listing is unreliable for ad-hoc re-resolution (can return the first
  user / paginate), so re-verify a specific account by its **UID from creation**, not by email re-query. The
  `user_metadata` flags are best read via the single-user admin GET (the list endpoint may omit them).

See per-tester briefs in `docs/beta/personas/*.md` and the gate in `docs/beta/FIRST5_SYNTHETIC_ACCOUNT_GATE.md`.
