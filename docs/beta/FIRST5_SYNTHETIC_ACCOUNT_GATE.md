# Private First-5 Synthetic Account Verification Gate

**Purpose:** create + verify five isolated, synthetic beta accounts; the founder distributes an account to a
tester ONLY after it passes the automated gate **and** the founder's manual UI pass. No open signup, no real
user data, no real Plaid/document connections.

## Accounts (synthetic, test-only)

| #   | email                          | persona            | display |
| --- | ------------------------------ | ------------------ | ------- |
| 1   | beta1@lifenav-beta.example.com | family_foundation  | Avery   |
| 2   | beta2@lifenav-beta.example.com | young_professional | Jordan  |
| 3   | beta3@lifenav-beta.example.com | pre_retirement     | Sam     |
| 4   | beta4@lifenav-beta.example.com | new_parent         | Riley   |
| 5   | beta5@lifenav-beta.example.com | career_change      | Casey   |

Each is created with auth `user_metadata.is_synthetic = true` + `persona` → the dashboard shows a persistent
**"Synthetic beta profile — test data only"** banner (renders whenever `is_synthetic` is set; gate-confirmed
True for all five).

**Access = magic link (the established beta auth), NOT password.** The harness sets a password only so the
automated gate can run (service-role checks); testers/founder sign in via a Supabase magic/invite link
(admin `generate_link`). Supabase rejects password-grant/login for these admin-created synthetic addresses and
non-routable TLDs (`.test`) — so verify login via magic link, not a password form.

## Run the gate

```
# in-machine on Fly (has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
python3 scripts/beta/verify_synthetic_accounts.py
```

It (re)creates the five accounts, seeds synthetic finance accounts, runs onboarding (syncs domain facts +
normalized goals), and prints a PASS/FAIL report.

## Automated gate results (2026-06-29)

All five accounts: **PASS** —

- `is_synthetic_flag` ✓ (banner shows), `onboarding_runs` ✓
- `career_facts` ✓ · `any_domain_facts` ✓ · `health_facts` ✓ (4/5; beta3 stated no body metrics — correct)
- `finance_accounts_present` ✓ (Financial Overview loads with synthetic balances)
- `canonical_goals_count` 3–5 ✓ · `no_raw_paragraph_goal` ✓ (Active Goals show normalized goals, no raw text)

**Isolation (Part 6) — RLS-enforced (structural proof):** `financial_accounts`, `career_profiles`,
`education_records`, `family_profiles`, `investment_holdings`, `life.candidate_goals`, and the chat/advisor
threads all carry `auth.uid() = user_id` RLS policies (294 such clauses across migrations). Every web/API
endpoint scopes to the session user; a user JWT cannot read another user's rows. (A live cross-user JWT probe
was blocked by a Supabase password-grant quirk on admin-created accounts — not a product gap; verify in the
manual pass via two browser sessions.)

**Real-data guardrails (Part 7):** Plaid "Connect Bank" is disabled ("Coming Soon"); finance account data comes
from the synthetic persona (AdvisorOnboarding banner); the synthetic-beta banner states real connections are
disabled/warning-gated. **Feedback (Part 8):** `/api/feedback/pilot` + `/api/feedback/bug` + `/api/feedback/nps`
exist and tie to the account.

## Founder manual pass (per account, before sending)

Log in (reset password first) and confirm:

1. **Banner** shows "Synthetic beta profile".
2. **Dashboard** — Financial Overview correct; domain cards fact-first; Active Goals show the persona's goals;
   no contradictory empty states; no raw paragraph.
3. **Advisors** — Life + domain advisors answer with the persona's context; **cross-agent handoff** works
   (e.g., ask the Career advisor a finance question → Finance answers in-thread); no advisor re-asks known facts.
4. **My Life / Life Brief** — agrees with the dashboard; highest-priority issue is sensible. _(See open item.)_
5. **Isolation** — open beta1 and beta2 in two browsers; neither sees the other's data/threads/goals.
6. **Guardrails** — Plaid/document real-data entry is disabled or clearly warns "synthetic beta".
7. **Feedback** — submit a test bug/NPS; confirm it records.

## Distribution rule

Send an account to a tester ONLY after: automated gate PASS + founder manual pass + password reset.

## Open items (do NOT distribute as "complete" until resolved or accepted)

- **Allowlist enforcement:** `proxy.ts` gates onboarding, not an invite allowlist. Confirm public signup is
  actually closed (or add an allowlist check) before relying on "no open signup."
- **Finance planning facts:** `finance.financial_planning_goals` table is missing (404) — apply
  `supabase/migrations/20260626000100_finance_planning_goals.sql` so finance planning targets persist (account
  balances are unaffected; they load from the synthetic persona).
- **My Life / Life Brief / Domain readiness** still read `readiness.py` + the discovery snapshot, not the
  shared `domain_summary` — they can disagree with the dashboard cards (separate P0 to unify).
- **5% body-fat safety flag** not yet implemented (health goal framing).

## Allowlist activation (server-side, deployed)

Enforced in `proxy.ts` (active Next-16 middleware) via `lib/auth/betaAccess.ts`. To CLOSE public access set on
Vercel (web project): `PRIVATE_BETA_ENABLED=true`, `PRIVATE_BETA_ADMIN_EMAILS=<founder email>` (optionally
`PRIVATE_BETA_ALLOWED_EMAILS=<reviewer emails>`). The five `@lifenav-beta.example.com` synthetic accounts are
allowed by default. Blocked authenticated users → `/private-beta` (pages) or `403 {"error":
"private_beta_access_required"}` (APIs); blocked attempts log a masked email + reason only. Tested (9 unit +
integration). **Live activation requires setting the env (not done from here).**
