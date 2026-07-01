# First-5 Launch Gate — GO / NO-GO Report

**Date:** 2026-07-01 · **Commit:** `31c6b7b` (main) · **Web:** https://lifenavigator.tech · **API:**
https://lifenavigator-core-api.fly.dev

## RECOMMENDATION: **GO** — all gates pass live (updated 2026-07-01, post-activation)

The private-beta env was set on Vercel and the gate is now active + re-verified live. All parts pass. The only
remaining item is the founder's own 12-point per-account manual click-through (Part 6), which is a human pass.

---

## Part 1 — Private-beta env / allowlist gate → ✅ **PASS (activated + re-verified)**

Set the 5 env vars on the Vercel project **life-nav-mvp-web** (serves lifenavigator.tech), Production target:
`PRIVATE_BETA_ENABLED=true`, `PRIVATE_BETA_ADMIN_EMAILS=timothy@riffeandassociates.com`,
`PRIVATE_BETA_ALLOWED_EMAILS=beta1..beta5@lifenav-beta.example.com`, `PRIVATE_BETA_ALLOW_SYNTHETIC_DOMAIN=false`,
`INVITE_SIGNING_SECRET` (generated in-script, never logged). Redeployed (READY). **Re-ran the block test live:**

- non-allowlisted account → **`/private-beta`**, dashboard denied, **`/api/*` returned 403** ✓
- `beta1` (allowlisted) → `/dashboard`, `/api/*` returned 200 ✓

Exact allowlist active, synthetic-domain wildcard OFF, public signup closed (Supabase `disable_signup`).
Effective private-beta closure confirmed live.

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
| Exact allowlist active             | ✅ (Vercel env set + redeployed)         |
| beta99 / random blocked            | ✅ (non-allowlisted → /private-beta+403) |
| Five beta accounts accessible      | ✅                                       |
| Persona data reconciled            | ✅                                       |
| No cross-user leakage              | ✅ (RLS)                                 |
| Finance planning migration applied | ✅                                       |
| Manual smoke passes                | ⏳ founder                               |
| Opus latency accepted              | ✅                                       |
| No critical trust defects          | ✅                                       |

**Status: GO.** The gate is active and verified live. Before sending accounts, the founder should do the
12-point per-account manual pass (Part 6) and confirm the "Continue" experience feels right; nothing technical
is blocking.
