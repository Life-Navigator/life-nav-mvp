# First-5 Beta — Final Launch Gate Report

**Date:** 2026-06-30 · **Recommendation: NO-GO until the 4 founder/infra steps below are completed** (the code

- docs are done and deployed; the remaining gates are actions I cannot perform from the build environment).

## What is DONE (code + docs, deployed)

- **Access gate (code):** exact-account allowlist enforced in `proxy.ts` via `lib/auth/betaAccess.ts`; no domain
  wildcard (gated behind `PRIVATE_BETA_ALLOW_SYNTHETIC_DOMAIN`, default false). `/private-beta` page + 403 on
  APIs. 20 unit/integration tests.
- **Finance source honesty (code):** new `SYNTHETIC = "Synthetic beta persona"` label; `_acct_source()` labels
  Plaid only with a real marker, synthetic-beta seeds distinctly, never falsely Plaid; dashboard renders
  "Synthetic Beta Persona". Seed harness now marks `metadata.source="synthetic_beta"` + coherent beta1/beta2
  numbers. +9 source-label tests.
- **My Life / readiness / family split:** done last sprint (browser-verified).
- **Docs:** `FIRST5_PLAID_PERSONA_MAPPING.md` (synthetic finance + per-persona expected ranges + source labels),
  5 tester briefs updated to match seeded finance, `cleanup_and_verify_first5.sql` extended with Section 16
  (finance/source reconciliation + expected-range PASS/WARN/FAIL), this report.
- **Tests:** backend 768 pass; web tsc + eslint clean.

## Founder/infra steps that REMAIN (the actual gate — I cannot do these from here)

### 1. Activate the private-beta env on Vercel (Part 1) — BLOCKS launch

Set on the web project (Production), then redeploy:

```
PRIVATE_BETA_ENABLED=true
PRIVATE_BETA_ADMIN_EMAILS=timothy@riffeandassociates.com
PRIVATE_BETA_ALLOWED_EMAILS=beta1@lifenav-beta.example.com,beta2@lifenav-beta.example.com,beta3@lifenav-beta.example.com,beta4@lifenav-beta.example.com,beta5@lifenav-beta.example.com
PRIVATE_BETA_ALLOW_SYNTHETIC_DOMAIN=false
```

Until set, the gate is **inert (open)** by design. I cannot set Vercel env from the build env (the Vercel MCP
requires your OAuth and does not expose env-var writes).

### 2. Apply the finance planning migration (Part 4) — BLOCKS planning-goal persistence

Apply `supabase/migrations/20260626000100_finance_planning_goals.sql` (Supabase SQL editor or `supabase db
push`). Reviewed: additive, idempotent, RLS `auth.uid()=user_id` + service_role, **never touches accounts/
balances** — safe. I have no DDL path (no `DATABASE_URL`/Management PAT).

### 3. Run the read-only verification SQL (Parts 2/6/7) — BLOCKS persona sign-off

Run `scripts/beta/cleanup_and_verify_first5.sql` in the Supabase SQL editor. Confirm Section 14 (per-persona
PASS, health `EXPECTED_GAP` only for beta3) and Section 16 (source = "Synthetic Beta Persona", net-worth/cash/
debt ranges PASS). **Resolve duplicates** (Section 3/5) via a separate reviewed cleanup script before sending.
Required because the GoTrue admin API can't resolve beta email→UID from outside the DB (documented caveat).

### 4. Live smoke + founder manual pass (Parts 5/6/9) — BLOCKS send

After #1: confirm founder access ✓, an approved beta magic-link login ✓ (banner + persona + advisor + My Life),
`beta99@lifenav-beta.example.com` → `/private-beta` + API 403, random email blocked. Then the per-account
manual checklist in `FIRST5_SYNTHETIC_ACCOUNT_GATE.md`. Magic-link login can't be scripted from here.

## Re-seed note (Part 3)

Existing beta accounts were seeded before the `synthetic_beta` marker + coherent beta1/beta2 numbers. To get the
"Synthetic Beta Persona" label and the documented ranges, **re-run the seed harness** (needs canonical UIDs from
step 3). Family at-a-glance metrics (members/pets/beneficiaries) also depend on that re-seed persisting.

## Honest caveats

- The beta finance is **synthetic-seeded, not Plaid** — labeled "Synthetic Beta Persona" (the sprint's "Plaid
  persona" framing is reconciled to reality; no fake Plaid labels).
- Per-UID persona verification + duplicate cleanup remain blocked on a working admin path (Supabase dashboard /
  Management PAT / `DATABASE_URL`).
- Section 16 ranges assume the **re-seeded** numbers; existing un-re-seeded accounts may FAIL net-worth (beta1
  was −$117K before the 401k addition) and WARN on source label (no synthetic marker yet).

## GO / NO-GO

**NO-GO** to sending testers right now. **GO** once steps 1–4 pass (env active, migration applied, SQL all-PASS
after re-seed + duplicate cleanup, live smoke + founder manual pass green). Everything in my control is done,
tested, and deployed.
