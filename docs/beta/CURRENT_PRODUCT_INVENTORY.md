# Current Product Inventory

**Date:** 2026-07-30 · `HEAD 22f90f22` · **Method:** repository inspection.
**The application was NOT exercised** — no `.env.local`, no credentials. Every "works / partial /
absent" judgement below is **structural**, derived from code presence, not from a completed user run.
Establishing behavioural truth is Prompt 2's first task.

---

## 1. Scale

| Surface                 | Count                                       |
| ----------------------- | ------------------------------------------- |
| Web pages (`page.tsx`)  | **189**                                     |
| API routes (`route.ts`) | **320**                                     |
| `/dashboard` subroutes  | **138**                                     |
| Web test files          | 116                                         |
| **Browser E2E specs**   | **2** — `auth.spec.ts`, `dashboard.spec.ts` |
| core-api tests          | 977                                         |
| ingestion-worker tests  | 85                                          |

**The ratio that matters: 138 dashboard subroutes, 2 E2E specs.** Backend test coverage is genuinely
strong; _user-journey_ coverage is almost absent.

---

## 2. Route families — classification required before Prompt 3

| Family                                                                                                                                                              | Routes         | Beta disposition                         | Rationale                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `finance`                                                                                                                                                           | 19             | **Partial-keep** — J2/J3 evidence source | Plaid is the most mature connector; 1,583 live financial vectors |
| `healthcare`                                                                                                                                                        | 18             | **Hide**                                 | PHI surface; no beta journey requires it                         |
| `career`                                                                                                                                                            | 16             | **Partial-keep**                         | 2 of 5 personas are career-transition                            |
| `family`                                                                                                                                                            | 14             | **Partial-keep**                         | 2 of 5 personas (`new_parent`, `family_foundation`)              |
| `education`                                                                                                                                                         | 13             | **Hide**                                 | No beta journey                                                  |
| `roadmap`                                                                                                                                                           | 8              | **Candidate for J4**                     | The return-loop surface — see §5                                 |
| `calculators`                                                                                                                                                       | 8              | **Hide**                                 | Useful, entirely off-journey                                     |
| `settings`                                                                                                                                                          | 5              | **Keep** — J5                            |                                                                  |
| `life-decisions`, `scenario-lab`, `reports`, `next-dollar-optimizer`, `life-trajectory`, `compare-futures`, `military`, `metrics`, `pilot-analytics`, `wellness`, … | ~25 singletons | **Classify individually**                | The dangerous category — see §6                                  |
| `advisor`, `chat`                                                                                                                                                   | 2              | **Keep** — J3 core                       |                                                                  |
| `my-life`, `my-discovery`, `readiness`                                                                                                                              | 3              | **Candidate for J4**                     |                                                                  |

**~120 of 138 dashboard routes are not on a canonical journey.** Hiding is not deleting — it is
removing them from beta navigation so testers cannot wander into unproven surface.

---

## 3. Authentication and account lifecycle

**Present (9 pages):** `auth`, `auth/login`, `auth/register`, `auth/magic`, `auth/callback`,
`auth/session`, `auth/forgot-password`, `auth/password-reset`, `auth/error`.

**Plus:** invite-key redemption (`POST /api/auth/redeem-invite`), documented in `PRIVATE_SIGNUP_GATE.md`
as a two-layer gate — the code layer is deployed; **the GoTrue signup-disable layer is a founder
action** and its current state is unverified.

| Capability                          | Structural state                          |
| ----------------------------------- | ----------------------------------------- |
| Login / magic link / OAuth callback | present                                   |
| Password reset                      | present                                   |
| Invite-key signup                   | present (code layer)                      |
| Public signup disabled              | **UNVERIFIED — the linchpin of the gate** |
| Session expiry / reauth             | present, unexercised                      |
| Account closure                     | **absent** — no route found               |

---

## 4. Onboarding

**12 routes**, including two parallel paradigms: `onboarding/converse` (chat-led) and
`onboarding/questionnaire` + `onboarding/sections/*` (form-led), plus `hub`, `interactive`, `review`,
`financial-profile`.

**Finding:** two onboarding paradigms coexist. Prior memory records an onboarding-loop defect that was
fixed and 64 users backfilled. **Which path a beta user takes is not determinable from code alone** and
must be resolved in Prompt 4 — shipping both to beta testers doubles the support surface for one
journey.

---

## 5. Return-use candidates (J4)

`roadmap` (8), `my-life`, `my-discovery`, `readiness`, `dashboard` root. Prior work records a Life Brief
composer + dashboard card. **No single canonical return surface is identifiable from structure**;
Prompt 9 must pick one. `POST_FIRST5_TRIAGE.md` #1 records a real tester gap here — advisor-led
short-term goal setting — which is direct evidence for what J4 should be.

---

## 6. The dangerous category

Routes that **render but may not work end to end**. From structure alone these are indistinguishable
from complete features, and a beta tester cannot tell either. Candidates: `scenario-lab`,
`compare-futures`, `next-dollar-optimizer`, `life-trajectory`, `military`, `pilot-analytics`,
`life-graph`.

**This is the single largest beta support risk**, and it is unresolvable without exercising the app.
**P0-BLOCK-1.**

---

## 7. Backend and stores (verified live, 2026-07-30)

| Component                              | State                                                         |
| -------------------------------------- | ------------------------------------------------------------- |
| `lifenavigator-core-api` (Fly)         | deployed; 977 tests                                           |
| `lifenavigator-ingestion-worker` (Fly) | deployed; 85 tests; **sole graph writer**, CI-enforced        |
| `lifenavigator-api-gateway` (Fly)      | **orphaned-but-live**, zero callers, holds a service-role key |
| Neo4j (personal)                       | 2,506 nodes / 3,208 edges / 268 tenants                       |
| Qdrant `life_navigator`                | 2,218 points, 3072-dim, 100% `personal` scope                 |
| Qdrant `ln_central`                    | **0 points — empty**                                          |
| Supabase Postgres                      | live; RLS-enforced                                            |
| `GRAPH_GROUNDING_ENABLED`              | **false** — graph traversal is off in production              |

**J3 must therefore work on vector retrieval alone.** Graph traversal is not available and may never
prove its value.

---

## 8. Ingestion

Rust worker: queue → normalize → ontology map → Neo4j + Qdrant. Document Intelligence supplies
extraction with page/section/char-span provenance, confidence bands, and a human review loop.

| Capability                          | State                                         |
| ----------------------------------- | --------------------------------------------- |
| Plaid financial sync                | most mature; 1,583 live vectors               |
| Document upload + extraction        | present, with review loop                     |
| Google / Microsoft email + calendar | pages exist; **blocked on OAuth credentials** |
| **User-visible ingestion status**   | **the gap** — Prompt 6's entire purpose       |

---

## 9. What already works, is partial, is absent, is blocked

**Works (structurally + backend-tested):** auth surface; invite gate (code layer); Plaid ingestion;
document extraction with provenance; advisor chat; single-writer + tenant-binding invariants
(CI-enforced, mutation-proven); domain contract; ontology catalog + drift gates.

**Partial:** onboarding (two paradigms); citations/evidence UX; return loop; ingestion status;
settings/privacy; E2E coverage (2 specs for 189 pages).

**Absent:** account closure; user-facing ingestion state model; export/deletion orchestration proven
across four stores; retrieval golden set; beta support console; production tracing/APM.

**Blocked on decisions I cannot make:** zero-fabrication measurement (ADR-004 `Needs Revision`);
vector trust filtering (ADR-005 + CONF-A); provenance completeness (ADR-002, OQ-2); graph traversal in
answers (ADR-008); gateway retirement (ADR-009, OQ-7).

**Blocked on owner action:** D-1 credential rotation with rejection proof; GoTrue signup-disable
verification; branch protection for the invariant CI gate; **26 unpushed commits with no remote
branch.**
