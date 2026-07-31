# Beta Journey Matrix

**Date:** 2026-07-30. Five canonical journeys traced across UI → API → jobs → stores → model → telemetry.

**Completion rates are `UNMEASURED`, not estimated.** The application could not be exercised (no
`.env.local`, no credentials). Fabricating a percentage would be exactly the failure this platform
exists to prevent, one layer up. Measuring them is Prompt 2's first task.

---

## J1 · First-use onboarding

|                |                                                                        |
| -------------- | ---------------------------------------------------------------------- |
| **Entry**      | Invite key issued by founder; user lands on `/private-beta` or `/auth` |
| **Goal**       | Account + consent + enough context to reach J2                         |
| **Completion** | **UNMEASURED**                                                         |

**Steps:** redeem invite → create account → verify email → accept terms/privacy (versioned) → onboarding
path → minimum profile → routed to first-value action.

**Services:** `apps/web` `/auth/*`, `/onboarding/*`; `POST /api/auth/redeem-invite`; ~12 onboarding API
routes; Supabase Auth + Postgres (RLS); core-api discovery/advisor; ingestion worker (chat capture →
`life.facts`).

**Missing states:** invite already redeemed · invite expired · **public signup not actually disabled**
(the gate's linchpin, unverified) · abandonment/resume across devices · duplicate account · consent
version change mid-flow.

**Security/compliance:** consent version + timestamp must persist; tenant binding must be _verified_,
not inferred; no unnecessary data collection.

**Success criteria:** synthetic user completes unaided; onboarding resumes without duplication;
reaches J2 within the beta target.

**Risks:** **two onboarding paradigms coexist** (`converse` vs `questionnaire`/`sections`) — shipping
both doubles support surface for one journey. **Prompt 4 must pick one.**

---

## J2 · First knowledge connection

|                |                                   |
| -------------- | --------------------------------- |
| **Entry**      | Onboarded, empty graph            |
| **Goal**       | Connect or upload one real source |
| **Completion** | **UNMEASURED**                    |

**Steps:** choose source → authorize (least privilege) → select scope → initial sync → see accurate
state → reach `ready`.

**Services:** `/dashboard/settings` + connector UI; Plaid; document upload → object storage; ingestion
worker → Neo4j + Qdrant; Document Intelligence extraction + review loop.

**Missing states:** per-item progress · partial success · quarantine/malware · duplicate detection ·
revocation stopping future sync · **user-visible ingestion state model (absent — Prompt 6)**.

**Security:** connector tokens encrypted, scoped, revocable, **never client-side or in logs**; signed
time-bounded object access; MIME/content validation.

**Success criteria:** connects without operator help; UI reports scope and state accurately; failures
actionable and retryable.

**Recommended beta scope:** **one excellent connector (Plaid) + secure direct upload.** Google/Microsoft
are blocked on OAuth credentials and would add two unproven paths.

---

## J3 · First grounded answer — **the promise**

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Entry**      | ≥1 source `ready`                                    |
| **Goal**       | Real question → useful, tenant-safe, grounded answer |
| **Completion** | **UNMEASURED**                                       |

**Steps:** ask → plan/route → retrieve (vector; **graph traversal is OFF**) → fuse (RRF, `fusion.py:81`)
→ filter → generate → render with citations → open a citation → verify.

**Services:** `/dashboard/advisor`, `/dashboard/chat`; core-api grounding/semantic (`planner`,
`traversal`, `fusion`, `engine`); Qdrant; Neo4j (read-only, traversal disabled); model routing; Gemini
via Fly.

**Missing states:** insufficient evidence · partial evidence · stale evidence · permission-revoked
source · model provider degraded · **known-absent fabrication measurement (no golden set)**.

**Security:** every personalized retrieval tenant-bound on both endpoints (**CI-enforced,
mutation-proven**); manifest policy fail-closed; no cross-tenant path.

**Success criteria:** ≥1 resolvable citation **or** an honest "insufficient evidence"; **zero
fabrication on known-absent**; zero cross-tenant leakage; useful without graph traversal.

**Risks:** **G2 (zero fabrication) is unmeasurable today** — ADR-004 is `Needs Revision`. This is the
single most important beta gate and it currently has no instrument. `ln_central` is empty, so there is
no central-knowledge channel; "central vs personal evidence" is a distinction beta cannot yet
demonstrate with data.

---

## J4 · Return use

|                |                                            |
| -------------- | ------------------------------------------ |
| **Entry**      | ≥1 day later; source data may have changed |
| **Goal**       | See what changed, continue                 |
| **Completion** | **UNMEASURED**                             |

**Steps:** return → see what changed / needs attention / continue → act on a suggestion → **approve**
(never autonomous) → see it reflected.

**Services:** `/dashboard` root, `roadmap` (8 routes), `my-life`, `my-discovery`, `readiness`; advisor
action loop → `IngestionService` → `life.facts`; ingestion sync.

**Missing states:** nothing changed · changed but not yet processed · suggestion pending approval ·
suggestion rejected · source removed since last visit.

**Governed loop (must be enforced, not assumed):**
`advisor suggestion → human approval → life fact → future coverage`. **No autonomous graph mutation.**
Track advisor-inferred vs external-evidence graph growth; alert on abnormal ratio.

**Success criteria:** coherent return workflow; suggestions remain proposals; changed evidence
reflected without silently rewriting history.

**Risks:** **no canonical return surface exists** — 5 candidates, none clearly primary.
`POST_FIRST5_TRIAGE.md` #1 (advisor-led short-term goal setting) is real tester evidence for what J4
should be, and is the best available signal.

---

## J5 · Privacy, control, support

|                |                                  |
| -------------- | -------------------------------- |
| **Entry**      | Any time                         |
| **Goal**       | See/export/delete data; get help |
| **Completion** | **UNMEASURED**                   |

**Steps:** view connected sources → disconnect → export → request deletion → get support.

**Services:** `/dashboard/settings` (5 routes); export/deletion orchestration across **Postgres +
Qdrant + Neo4j + object storage**; support console (**absent**).

**Missing states:** export in progress/ready/expired · deletion pending/partial/complete · **partial
deletion failure** · account closure (**no route exists**).

**Security/compliance:** deletion must span all four stores. **A deletion clearing the graph but leaving
the embedding is a breach with a success message** — the same silent-success class as a filter matching
zero rows.

**Success criteria:** user sees and controls connected data; **deletion is proven across stores, or the
UI states the limitation truthfully.** Never a false success.

**Risks:** provenance-complete deletion is ADR-002-blocked. **ANOM-1 (17-tenant divergence) may itself
be evidence of incomplete prior deletion** — OQ-9 bucket 5. If so, this is a live compliance finding,
not a beta nicety.

---

## Cross-journey dependencies

```
J1 ──► J2 ──► J3 (the promise)
              │
              ├──► J4  (needs J3 to have produced something)
              └──► J5  (needs J2 to have connected something)
```

| Shared dependency        | Journeys       | Beta risk                                   |
| ------------------------ | -------------- | ------------------------------------------- |
| Tenant isolation         | all            | **CI-enforced** ✅                          |
| Ingestion pipeline       | J2, J3, J4, J5 | user-visible state absent                   |
| Citations/evidence       | J3, J5         | resolvability unproven                      |
| Deletion across 4 stores | J5             | unproven; ANOM-1 may indicate prior failure |
| Golden set               | J3 gate        | **does not exist**                          |
| Model provider           | J3, J4         | single provider; degradation path untested  |
