# PILOT RISK REPORT — 20 Elite Users on Real Data

**Date:** 2026-06-16
**Scope:** Code-level + operational audit for launching LifeNavigator to 20 elite pilot users
(VCs, executives, advisors, attorneys, physicians) on **real personal/financial data**.
**Author:** automated audit (Claude). Every claim cites `file:line` or config; nothing invented.

---

## OVERALL VERDICT

> **GO-WITH-CONDITIONS.** The trust spine (number-grounding, advice gate, deterministic health-safety net,
> medical gate) is genuinely strong and provably wired in before any model call. RLS posture is mature
> (670 policies, security-invoker views applied). The risk for this audience is **not** fabricated financial
> numbers — that is well-defended — it is **credibility leaks**: a fully-fake "placeholder response" chat that
> is a reachable, sidebar-promoted destination; the absence of any visible legal/medical/financial disclaimer
> on the main advisor surface; and operational fragility (api-gateway cold starts, ~9s latency, a manually
> minted Vertex token that expires hourly if premium Opus is switched on). Fix the four P0s below and this is
> safe for a 20-person private pilot.

---

## P0 MUST-FIX BEFORE PILOT (short, concrete)

1. **Kill or gate the fake "placeholder response" chat.** `apps/web/src/app/dashboard/roadmap/chat/page.tsx:208-212`
   returns the hardcoded string _"This is a placeholder response. The AI chat functionality will be implemented
   soon."_ via a `setTimeout`. It is **not** an orphan: `apps/web/src/app/dashboard/layout.tsx:18` treats
   `/dashboard/roadmap/chat` as a first-class _immersive_ route (collapses the sidebar). An attorney or VC who
   lands here sees a toy. Violates the hard "No mock data — ever" rule. **Action:** remove the route, or point it
   at the real `/v1/chat` orchestrator and delete the simulated branch.
2. **Add a visible advice disclaimer to the advisor surface.** `apps/web/src/app/dashboard/advisor/page.tsx` and
   `apps/web/src/components/advisor/*` render **no** disclaimer, AdviceBoundary, or "not financial/legal/medical
   advice" text (grep returns zero hits in those files). The backend enforces boundaries server-side, but the
   primary counsel UI for physicians/attorneys/advisors shows none. **Action:** render a persistent footer/banner
   ("General guidance, not financial, legal, tax, or medical advice — consult a licensed professional"), mirroring
   `medical_safety.py:33` (`DISCLAIMER`).
3. **Rotate the Supabase PAT / service-role key that was pasted in a prior session.** No `sbp_` token or live JWT
   is committed (`git grep` clean; `.env.example` files hold only `eyJ...` placeholders). But the memory note that
   a PAT was pasted into a session means it lived in plaintext outside the repo. **Action:** rotate the Supabase
   service-role key + any PAT before exposing real elite data; confirm the new key is set on Fly/Vercel/Supabase
   only (never `NEXT_PUBLIC_`).
4. **Decide the premium-model posture and lock it.** `apps/lifenavigator-core-api/app/services/advisor_llm.py:253`
   authenticates Vertex Claude with a _short-lived `VERTEX_ACCESS_TOKEN` (gcloud token)_ — expires ~1h. It is
   behind `USE_VERTEX_CLAUDE` (default off; prod = Gemini). **Action:** for the pilot, leave premium routing OFF
   (Gemini only) **or** wire a service-account refresh before enabling. Do not promise elite users "Opus-grade"
   answers on a token that dies in an hour.

---

## RISK REGISTER

Severity P0 (block) / P1 (fix-soon) / P2 (track). Likelihood H/M/L. Blast radius = who/what is hit.

### Trust & Safety

| #   | Sev      | Likelihood | Blast radius           | Risk                                                                                                                                                                                                                         | Evidence                                                                                                                                                                                                                                                                                                                      | Mitigation / Owner-action                                                                                                                                                           |
| --- | -------- | ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | — (PASS) | —          | —                      | **Fabricated financial numbers**                                                                                                                                                                                             | `advisor_validator.py:179-184` gates every visible number against `context.allowed_numbers` ∪ verified derivations; `advisor_math.py:102-144` re-evaluates each derivation via restricted AST (no `eval`), rejecting non-user operands or wrong math. Folded across ALL user-visible fields (`advisor_validator.py:160-169`). | **None needed.** Strongest part of the system. Keep regression tests green.                                                                                                         |
| T2  | — (PASS) | —          | —                      | **Medical/legal/tax/product advice leaking**                                                                                                                                                                                 | `advisor_validator.py:68-82` `_ADVICE` regex hard-blocks diagnosis/dosing/legal directives/specific securities; `medical_safety.py:59-93` blocks dosing/diagnosis, escalates emergencies before any model call.                                                                                                               | None needed. Verify `_ADVICE` covers tax-loss-harvesting phrasing elite users may probe.                                                                                            |
| T3  | P2       | M          | One user, health query | **Health-urgent path misses when domain mis-classified.** `orchestrator.handle()` only runs the medical gate when `"health" in domains` (`agents/orchestrator.py:131`). A chest-pain message classified non-health skips it. | `agents/orchestrator.py:131-140` vs the always-on `advisor_orchestrator` net (`advisor_orchestrator.py:322,353`).                                                                                                                                                                                                             | The advisor path runs `detect_health_urgent` unconditionally (good). Make `/v1/chat` orchestrator run `detect_health_urgent` on **every** turn regardless of domain classification. |
| T4  | P2       | L          | Reputational           | **Validator rejects to a generic fallback** (not a leak, a quality dip). Repair-retry exists (`advisor_orchestrator.py:260-279`) but a hard reject still drops to deterministic text.                                        | `advisor_orchestrator.py:254-279`                                                                                                                                                                                                                                                                                             | Acceptable; monitor `validator_result` in `analytics.advisor_turns`.                                                                                                                |

### Data Integrity

| #   | Sev | Likelihood | Blast radius                        | Risk                                                                                                                                                                                                                                                                                                                                                    | Evidence                                                                                                                    | Mitigation / Owner-action                                                                                                                                                                                        |
| --- | --- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | P1  | L          | Cross-user data leak (catastrophic) | **RLS gap on any new/un-migrated table.** 670 `CREATE POLICY` across 104 migration files; the 43-view leak was closed via `security_invoker` (`114_authenticated_views_security_invoker.sql`, also applied in `119/127/131/160`). Residual risk = a table shipped without RLS or a service-role read in the web tier.                                   | 42 files in `apps/web/src` reference `SERVICE_ROLE`/`supabaseAdmin` (grep count). No `DISABLE ROW LEVEL SECURITY` anywhere. | **Owner-action:** before pilot, run a live `pg` audit: every table in user-facing schemas has `rowsecurity=true` AND ≥1 policy. Audit each of the 42 service-role call sites for a `user_id`/`tenant_id` filter. |
| D2  | P2  | L          | Reputational (one user)             | **Contradictory net-worth figures.** Net-worth unification holds at the component level — `NetWorthSummary.tsx:5-8` and the dashboard read the canonical summary (`/api/finance/canonical-summary`). But 12+ files still touch `net_worth`/`netWorth`; long-tail pages (`life-trajectory`, `scenarios`, `cash-vs-financing`) may compute independently. | `components/financial/accounts/NetWorthSummary.tsx:5-23` (canonical); broad `net_worth` grep across `dashboard/*`.          | Spot-check that every surface a pilot user can reach shows the **same** net-worth number. Route stragglers through canonical-summary.                                                                            |

### Availability

| #   | Sev | Likelihood | Blast radius             | Risk                                                                                                                                                                                                                                                                             | Evidence                                                                                | Mitigation / Owner-action                                                                                                              |
| --- | --- | ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | P1  | M          | All users, first request | **api-gateway cold start.** `apps/api-gateway/fly.toml:38` `auto_stop_machines = "stop"` + `min_machines_running = 1` — a stopped machine cold-starts on first hit. core-api is better: `apps/lifenavigator-core-api/fly.toml:34` uses `"suspend"` + `min_machines_running = 1`. | fly.toml configs above                                                                  | Set api-gateway to `"suspend"` (or `min_machines_running = 2`) for the pilot window so elite users never hit a multi-second cold boot. |
| A2  | P1  | M          | All users                | **~9s advisor latency + intermittent chat 502.** Known from prior eval/smoke memory; retry-once is wired (`advisor_orchestrator.py:239-247`) and a provider-failure model-fallback exists.                                                                                       | `advisor_orchestrator.py:239-247`; memory: advisor-eval P0 (~9s), beta-smoke 502 caveat | Set expectation in onboarding ("takes a few seconds to reason"); keep streaming path (`converse_stream`) as default; monitor 5xx.      |
| A3  | P1  | M          | All users                | **Gemini cost cap / prepay-credit blocker.** $4/day cap and a Gemini prepay-credit blocker were prior live blockers; the alias bug (`gemini-default`) that caused a 429 wall was fixed.                                                                                          | memory: beta20 economic + chat blocker (429 alias fixed; $4/day cap; prepay blocker)    | Confirm Gemini billing has prepaid credit + the daily cap is high enough for 20 active elite users before launch; alert on 429.        |

### Privacy & Security

| #   | Sev      | Likelihood           | Blast radius                 | Risk                                                                                                                                                                                                                                                                                     | Evidence                                                                                          | Mitigation / Owner-action                                                                          |
| --- | -------- | -------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| P1s | P0       | H (already occurred) | Full-DB compromise if leaked | **Supabase PAT/service-role pasted in a prior session.**                                                                                                                                                                                                                                 | memory: PAT-rotation note; `git grep sbp_` clean (not in repo, but lived in plaintext outside it) | **ROTATE** before pilot (see P0 #3).                                                               |
| P2s | — (PASS) | —                    | —                            | **Gemini key on Vercel / client bundle.** The web Gemini provider (`lib/models/providers/gemini.ts:65`) loads via server-side `getSecret('GEMINI_API_KEY')` — non-`NEXT_PUBLIC`, so not bundled to the browser; it's a BYOM provider chain, not the main advisor path (LLM runs on Fly). | `lib/secrets/manager.ts:23-27`; `lib/models/providers/gemini.ts:65,79`                            | None — verify Vercel env does not define `NEXT_PUBLIC_GEMINI_*`.                                   |
| P3s | P2       | M                    | One user                     | **Auth dead-ends.** All routes exist (`/auth/{magic,confirm,callback,login,register}`); PKCE email-verify fixed in `536f9dc`; landing CTA → `/auth?mode=magic` (`app/page.tsx:529`) resolves. Residual = magic-link delivery (Resend SMTP, 100/hr).                                      | route listing under `app/auth/`; commit `536f9dc`; memory: magic-link beta auth (Resend LIVE)     | Send each of the 20 invites manually + confirm receipt; keep `generate_link` admin fallback ready. |

### No-Mock-Data Compliance

| #   | Sev      | Likelihood | Blast radius             | Risk                                                                                                                                              | Evidence                                                                                                                       | Mitigation / Owner-action                                                                       |
| --- | -------- | ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| M1  | P0       | H          | Every user who opens it  | **Fake placeholder chat** (see P0 #1).                                                                                                            | `dashboard/roadmap/chat/page.tsx:208-212`; reachable via `dashboard/layout.tsx:18`                                             | Remove or wire to real backend.                                                                 |
| M2  | P2       | M          | Users who navigate there | **`ComingSoon` placeholder pages** at `dashboard/roadmap/comprehensive`, `dashboard/roadmap/insights`, `dashboard/finance/investment-calculator`. | grep: `import ComingSoon from '...placeholders/ComingSoon'` in those `page.tsx`                                                | Honest "coming soon" is acceptable IF not linked from primary nav; verify they're not promoted. |
| M3  | — (PASS) | —          | —                        | **MissionControl sample roadmap** is honestly labeled.                                                                                            | `components/dashboard/MissionControl.tsx:160` "This is illustrative — upload your own document to generate your real roadmap." | None. Good pattern.                                                                             |

### Legal / Compliance Posture

| #   | Sev | Likelihood | Blast radius               | Risk                                                                                                                                                                                | Evidence                                                           | Mitigation / Owner-action                                                                                        |
| --- | --- | ---------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| L1  | P0  | H          | Regulated-profession users | **No disclaimer on advisor UI** (see P0 #2). Disclaimers exist only in health/family configs (11 hits, e.g. `medical_safety.py:33`, `wellness/page.tsx`), none on the main advisor. | grep: zero disclaimer hits in `dashboard/advisor/page.tsx`         | Add persistent disclaimer.                                                                                       |
| L2  | P2  | L          | Trust perception           | **Data-handling expectations.** `/trust` and `/security` marketing pages exist and resolve.                                                                                         | route check: `app/trust/page.tsx`, `app/security/page.tsx` present | Ensure these accurately describe real data handling (no SOC2 claims not yet earned); elite users will read them. |

---

## KNOWN-ACCEPTABLE FOR A 20-PERSON PRIVATE PILOT (consciously accepted)

- **~9s advisor latency** (A2): acceptable with an expectation-set message; this is reasoning time, not a hang.
- **`ComingSoon` placeholder pages** (M2): acceptable IF not linked from primary nav — honest "coming soon" is
  not fabrication.
- **Validator-to-generic-fallback dips** (T4): the system degrades to safe deterministic text, never to a
  fabricated number. Quality dip, not a trust breach.
- **Premium Opus OFF / Gemini-only** (P0 #4 chosen direction): acceptable; advisor quality on Gemini is the
  benchmarked production baseline. Do NOT enable Vertex Claude on the expiring token.
- **In-memory usage ledger** (`model_router.py:106-117`): default router is OFF in prod, so the non-durable
  ledger is not in the live path; acceptable for the pilot.
- **api-gateway minor cold start** IF set to `suspend` (A1 mitigated): sub-second resume is acceptable.

---

## SINGLE WORST-CASE EMBARRASSMENT — and how close we are

**Scenario:** A VC or attorney, in the first 15 minutes, navigates from the dashboard into the immersive
"roadmap chat", types a real question about their finances or a legal structuring question, and receives:
_"This is a placeholder response. The AI chat functionality will be implemented soon."_ — on a product pitched
as an AI life advisor, with their real money on screen. They screenshot it.

**How close are we:** **One click away.** The route is live, the placeholder string is hardcoded
(`dashboard/roadmap/chat/page.tsx:208-212`), and the layout actively _promotes_ it as a premium immersive
surface (`dashboard/layout.tsx:18`). This is the highest-likelihood, highest-blast-radius failure in the audit
and is **P0 #1**. The financial-fabrication disaster everyone fears is, by contrast, well-defended and unlikely.

A secondary embarrassment: the same user asks the (real) advisor a clearly out-of-scope legal/tax question,
gets a careful deferral — but sees **no disclaimer anywhere on screen** (P0 #2 / L1), undercutting the very
trust posture the marketing `/trust` page promises.

---

## BOTTOM LINE

The hard engineering — number grounding, advice gating, health-safety, RLS — is real and load-bearing. The
gap is the last mile of polish that elite users judge instantly: one fake chat, one missing disclaimer, one
rotated secret, one model-posture decision. Close those four and launch.
