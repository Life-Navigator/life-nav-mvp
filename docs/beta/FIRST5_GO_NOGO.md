# First-5 Launch Gate — GO / NO-GO Report

**Date:** 2026-07-01 · **Commit:** `31c6b7b` (main) · **Web:** https://lifenavigator.tech · **API:**
https://lifenavigator-core-api.fly.dev

## RECOMMENDATION: **NO-GO** — one blocker (private-beta gate is not active in production)

Everything else passed live. The single blocker is a founder/infra action (set the Vercel env). Once that's
done and re-verified, this is a **GO**.

---

## Part 1 — Private-beta env / allowlist gate → ❌ **FAIL (blocker)**

Tested behavior directly (behavior > config): created a throwaway **non-allowlisted** account and it reached
`/dashboard` with `/api/finance` returning **200** — it was **not blocked**. So `PRIVATE_BETA_ENABLED` is **not
set** on Vercel and the allowlist gate is inert (open). `beta1` also reaches the dashboard (correct), but so does
everyone.

- **Public signup IS closed** (I disabled it in Supabase earlier — direct GoTrue `/signup` returns
  `signup_disabled`), so no NEW accounts can be created. But the allowlist gate that blocks **existing**
  non-allowlisted accounts from the app requires the Vercel env, which isn't set.
- **Fix (founder):** set on the web project (Production), then redeploy:
  ```
  PRIVATE_BETA_ENABLED=true
  PRIVATE_BETA_ADMIN_EMAILS=timothy@riffeandassociates.com
  PRIVATE_BETA_ALLOWED_EMAILS=beta1@lifenav-beta.example.com,beta2@lifenav-beta.example.com,beta3@lifenav-beta.example.com,beta4@lifenav-beta.example.com,beta5@lifenav-beta.example.com
  PRIVATE_BETA_ALLOW_SYNTHETIC_DOMAIN=false
  INVITE_SIGNING_SECRET=<a long random secret, e.g. openssl rand -base64 48>
  ```
  I cannot set Vercel env from here (needs a Vercel API token). After it's set, re-run the block test:
  a non-allowlisted account should land on `/private-beta` and `/api/*` should return 403.

## Part 2 — Synthetic account access → ✅ **PASS**

All five beta accounts (password login, `BetaGate2026verify`): **login + dashboard load + "Synthetic beta
profile" banner** all confirmed live (beta1–beta5). RLS is structurally enforced (`auth.uid() = user_id` on every
persona table); no cross-user leakage path.

## Part 3 — Supabase persona reconciliation → ✅ **PASS**

Read-only SQL (by canonical UID):

- **No duplicates** (exactly 1 auth user per beta email).
- `is_synthetic=true` + correct persona for all 5 (family_foundation / young_professional / pre_retirement /
  new_parent / career_change); profile row present.
- **No raw-paragraph goals** (rawgoals=0); candidate goals normalized (3–5 each).
- Career + family facts present for all; health present for beta1/2/4, **absent for beta3 (pre_retirement,
  intentional gap)** and sparse for beta5.
- **Finance reconciliation — all match the briefs, all "Synthetic Beta Persona":** beta1 +$293,200 · beta2
  +$12,200 · beta3 +$2,020,000 · beta4 +$47,000 · beta5 −$18,000.

## Part 4 — Persona brief alignment → ✅ **PASS (1 fix applied)**

Reconciled briefs vs live data. **Found + fixed one contradiction:** beta2 net worth was documented as ~−$10K
but the seeded accounts compute to **+$12,200** (the −10K ignored the $22.2K cash). Corrected the brief + the
Plaid-mapping table + the "negative net worth" note. All other briefs match live values. Source labels accurate
(Synthetic Beta Persona, not Plaid). No brief promises a feature/number not in the product.

## Part 5 — Finance planning goals migration → ✅ **PASS**

`finance.financial_planning_goals`: table exists, **RLS enabled, 2 policies** (`users_own_fin_planning`
authenticated + `service_fin_planning` service_role), **20 rows** persisted by onboarding. Applied + write-path
proven in an earlier sprint; balances untouched.

## Part 6 — Founder manual smoke → ⏳ **Founder task (automated checks green)**

The per-account click-through is inherently the founder's manual pass. The automated-verifiable pieces are green
across recent sprints: dashboard fact-first + banner + no fake $0; My Life agrees with the dashboard; advisor
chat continuity (old chats reopen, no duplicate threads, no lost messages, graceful degrade); cross-agent
handoff; cross-domain → Opus; finance education → Flash; feedback endpoints exist. Recommend the founder do the
12-point per-account pass in `FIRST5_SYNTHETIC_ACCOUNT_GATE.md` after Part 1 is activated.

---

## Known residuals (accepted)

- **Opus latency/degrade** on personal-planning + cross-domain turns (~46–56s, some cross the 55s client
  deadline → "message saved, try again"). Accepted for first-5 per founder decision (don't change the timeout).
- Advisor turns are slow generally (model-bound); education is fast (~18s).

## GO checklist

| Requirement                        | Status                                   |
| ---------------------------------- | ---------------------------------------- |
| Exact allowlist active             | ❌ (Vercel env not set)                  |
| beta99 / random blocked            | ❌ (gate inert) — will pass once env set |
| Five beta accounts accessible      | ✅                                       |
| Persona data reconciled            | ✅                                       |
| No cross-user leakage              | ✅ (RLS)                                 |
| Finance planning migration applied | ✅                                       |
| Manual smoke passes                | ⏳ founder                               |
| Opus latency accepted              | ✅                                       |
| No critical trust defects          | ✅                                       |

**Smallest required fix to reach GO:** set the 5 Vercel env vars (Part 1) + redeploy, then re-run the block
test. Nothing else is blocking.
