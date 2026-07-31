# LifeNavigator Cloud Beta — Beta Contract

**Date:** 2026-07-30 · **Branch:** `graphrag/data-contract-remediation` · **HEAD:** `22f90f22`
**Authoritative technical review:** `FINAL_TECHNICAL_DESIGN_REVIEW.md` (`da8c7428`)
**Planning only. No production code written in this prompt.**

---

## 0. The finding that reframes this plan

**A beta already launched.** `docs/beta/FIRST5_GO_NOGO.md` records a **GO** decision on 2026-07-01
against `31c6b7b`, live at `https://lifenavigator.tech`, with five seeded synthetic personas, an
invite-key-only signup gate, and captured tester feedback in `POST_FIRST5_TRIAGE.md`.

This is not a greenfield beta plan. It is a **second, wider beta** on a product that has already met
real users once.

**And the product is not thin. It is very wide:**

| Measure                | Count                                       |
| ---------------------- | ------------------------------------------- |
| Web pages              | **189**                                     |
| API routes             | **320**                                     |
| `/dashboard` subroutes | **138**                                     |
| Web test files         | 116                                         |
| **Browser E2E specs**  | **2** (`auth.spec.ts`, `dashboard.spec.ts`) |

**The beta blocker is not missing features. It is surface area versus proof.** 138 dashboard subroutes
are covered by two E2E specs. Every instinct to "build for beta" should be resisted; the work is to
**narrow to five journeys and prove them**, and to decide honestly what the other ~130 routes are for.

---

## 1. Primary beta persona

**Individual-first.** Derived from evidence, not assumption: `docs/beta/personas/` contains five
individual personas — `young_professional`, `career_change`, `new_parent`, `pre_retirement`,
`family_foundation`. All five are individuals managing their own life decisions.

`/employer` and `/portal` routes exist, indicating a B2B surface. **They are out of beta scope.** The
prompt's warning applies directly: do not invent enterprise workflows for an individual-first product.

> **Primary beta persona:** an individual navigating a consequential life transition (new child, career
> change, approaching retirement) who wants advice grounded in _their own_ situation rather than generic
> guidance.

---

## 2. The beta promise — one sentence

> **LifeNavigator answers questions about your actual life using evidence you can open and verify, and
> tells you plainly when it does not know.**

Three clauses, each falsifiable:

- _"your actual life"_ → personalized retrieval, tenant-bound, from data the user connected
- _"evidence you can open and verify"_ → citations resolving to sources the user may access
- _"tells you plainly when it does not know"_ → **zero fabrication on known-absent queries** — the
  differentiator, and the hardest gate

**What the promise excludes:** autonomous action, financial/legal/medical advice as a licensed
professional, and any claim that the graph is complete.

---

## 3. The five canonical journeys

No more than five. Everything outside them is P2 or out of scope.

| #      | Journey                    | Entry                  | Goal                                            | Success criterion                                            |
| ------ | -------------------------- | ---------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| **J1** | First-use onboarding       | invite key redeemed    | account + consent + enough context to be useful | reaches J2 without help                                      |
| **J2** | First knowledge connection | onboarded, empty graph | connect or upload one real source               | source visible, state accurate, ingestion reaches `ready`    |
| **J3** | First grounded answer      | ≥1 source ready        | ask a real question, get a cited answer         | ≥1 resolvable citation, or an honest "insufficient evidence" |
| **J4** | Return use                 | ≥1 day later           | see what changed and continue                   | completes the return loop unaided                            |
| **J5** | Privacy, control, support  | any time               | see/export/delete data; get help                | truthful state; no engineering intervention                  |

**J3 is the promise.** J1, J2 exist to reach it. J4 makes it a product. J5 makes it shippable.

---

## 4. What the technical review obligates

From `FINAL_TECHNICAL_DESIGN_REVIEW.md`:

| Debt                                   | Beta disposition                                                         |
| -------------------------------------- | ------------------------------------------------------------------------ |
| **D-1** credentials unrotated          | **P0.** Blocks all write-enabled work. Owner action                      |
| **D-2** transactions in graph          | **P2.** A 2-4 year scaling cliff, not a beta blocker at 268 tenants      |
| **D-3** provenance granularity         | **P1 (partial).** J3 needs citations; full provenance is ADR-002-blocked |
| **D-4** manifest policy fidelity (C-2) | **P1.** Latent with one principal; no second agent in beta scope         |
| **D-5** `golden.json` absent           | **P0.** Without it the zero-fabrication promise is unmeasurable          |
| **D-6** traversal never run in prod    | **P1.** J3 must work without it                                          |
| **D-7** ANOM-1 tenant divergence       | **P0.** Unexplained store divergence + real users = unacceptable         |
| **D-8** evaluation coverage blindness  | **P0.** Same gate as D-5                                                 |
| **D-9** vector-layer trust filter      | **P1.** Poisoning vector once users upload documents                     |

**Two P0s are decision-blocked, not effort-blocked**: D-5/D-8 need ADR-004; D-9 needs ADR-005 + CONF-A.
This is the central tension of the plan and is made explicit rather than smoothed over.

---

## 5. Explicit non-goals

Beyond the pack's scope-discipline list, these are excluded **on evidence**:

| Excluded                          | Evidence                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Enterprise/employer workflows     | All 5 personas are individuals; `/employer`, `/portal` unexercised in beta    |
| Graph traversal in user answers   | Never run against production; may add nothing (shallow star, avg degree 2.56) |
| Central/collective knowledge      | `ln_central` is **empty** — 0 points                                          |
| Multi-agent                       | Blocked on ADR-003; no second principal in beta                               |
| ~130 non-journey dashboard routes | Not on a canonical journey. **See §6**                                        |

---

## 6. The uncomfortable question this contract forces

**138 dashboard subroutes exist. Five journeys need perhaps 15.**

The remaining ~120 are one of three things, and the team must say which **before** Prompt 3 builds
navigation around them:

1. **On a journey** → keep, prove with E2E
2. **Real but off-journey** (e.g. 7 calculators, career sub-surfaces) → keep, **hide from beta nav**,
   mark P2
3. **Scaffolding that looks complete** → the dangerous category. A route that renders but does not work
   is worse for a beta user than a route that does not exist

Classifying these is **P0-BLOCK-1**. Not because building them matters, but because **beta support cost
scales with reachable surface, not with useful surface.** A tester who wanders into a half-built route
files a bug the team must triage.

---

## 7. Beta gates — falsifiable

Launch only when all are true on the release candidate:

| #   | Gate                      | Threshold                                             | Source                                  |
| --- | ------------------------- | ----------------------------------------------------- | --------------------------------------- |
| G1  | Cross-tenant leakage      | **0**                                                 | Sprint 1 invariants + E2E probes        |
| G2  | Known-absent fabrication  | **0**                                                 | ADR-004 golden set (**does not exist**) |
| G3  | J1→J3 completion, unaided | ≥ 80% of cohort                                       | pilot telemetry                         |
| G4  | Citations resolve         | 100% of cited sources openable by that user           | E2E                                     |
| G5  | Ingestion success         | ≥ 95%, failures actionable                            | pipeline telemetry                      |
| G6  | Credential closure        | rejection proof for every exposed credential          | ADR-007                                 |
| G7  | ANOM-1                    | classified, 0 unclassified tenants                    | OQ-9                                    |
| G8  | Deletion truthfulness     | proven, or UI states the limitation honestly          | ADR-007 / D-1                           |
| G9  | Accessibility             | 0 serious/critical on J1–J5                           | axe + manual                            |
| G10 | p95 answer latency        | within documented threshold (baseline **unmeasured**) | load test                               |

**G2 and G7 cannot be met today.** G2 is decision-blocked (ADR-004 `Needs Revision`); G7 is a 1–2 day
read-only investigation with no owner.

---

## 8. Beta scope: cohort and duration

| Parameter | Value                                | Rationale                                    |
| --------- | ------------------------------------ | -------------------------------------------- |
| Cohort    | **5 internal + 15 external**, staged | First-5 ran at 5; 20 is one step, not a leap |
| Entry     | invite-key only                      | `PRIVATE_SIGNUP_GATE.md` already built       |
| Duration  | 4 weeks minimum observation          | J4 needs a week to be real                   |
| Expansion | only on data                         | no unresolved P0/P1                          |

---

## 9. Honest limitations of this contract

1. **I could not exercise the running application.** No `.env.local`, no credentials (session
   credentials were shredded; production credentials are correctly unavailable). Journey completion
   rates in `BETA_JOURNEY_MATRIX.md` are therefore marked **UNMEASURED**, not estimated. Establishing
   them is the first task of Prompt 2.
2. **The First-5 beta's outcomes are documented but not independently verified** by me. `POST_FIRST5_TRIAGE.md`
   is treated as evidence of what testers reported, not as proof of current behaviour.
3. **Two P0s are blocked on ADR decisions I am not authorized to make** (ADR-004, ADR-005).
   Prompt 7's ADR gate exists for exactly this and must not be worked around.
