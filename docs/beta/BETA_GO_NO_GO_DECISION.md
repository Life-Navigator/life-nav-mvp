# Beta Launch — Go / No-Go Decision

**Audited commit:** `5fbdef00` (branch `graphrag/data-contract-remediation`)
**Deployed web:** `https://lifenavigator.tech` — HTTP 200, Vercel `dpl_8ctNCH5UraEWCN37rVLLC5s4SAqA`
**Deployed API:** `https://lifenavigator-core-api.fly.dev` — `/healthz` 200, `/readyz` 200
**Auditor:** independent Product / AI-Safety / Security / SRE audit · **Date:** 2026-07-30

---

# DECISION: **NO-GO**

**Not because a defect was verified. Because the audit could not be performed.**

**Zero of ten hard pre-beta gates were verified against deployed behavior.** The audit's own posture
rule is explicit: _"Do not mark a capability complete because code, documentation or a route exists.
Exercise the deployed behavior."_ I could not exercise it — **no credentials exist in this
environment**; the session credentials were shredded at the end of the preflight task and production
credentials are correctly unavailable.

Six gates (A, B, E, F, I, J) require an authenticated session. **None could be attempted.**

## Why this is NO-GO and not CONDITIONAL GO

`CONDITIONAL GO` requires _"core safety and isolation gates pass."_ Gate A (tenant isolation) is the
single gate whose failure is an automatic NO-GO, and it is **UNMEASURED**. Issuing a conditional
approval on an unverified isolation gate would be precisely the failure this platform's whole
governance programme exists to prevent: **a green result that is green because nothing ran.**

The audit instruction says _"Do not treat unmeasured as failed, but do not treat it as passed."_
This decision treats it as neither. It reports that **the beta cannot be approved by an audit that did
not happen** — and names the small, concrete set of access required to complete it.

**This is a reversible NO-GO.** Nothing here says the platform is unsafe. It says the platform is
**unverified**, and the gap is roughly one working session with credentials.

---

## Gate results

| Gate                             | Result                       | Basis                                                                                           |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| **A** Auth & tenant isolation    | **UNMEASURED**               | requires authenticated cross-tenant probes                                                      |
| **B** Core product usability     | **UNMEASURED**               | requires completing the journeys as a user                                                      |
| **C** AI response reporting      | **PARTIAL**                  | mechanisms exist; **no categorized advisor-response report**; reconstruction payload unverified |
| **D** Product feedback & support | **PARTIAL**                  | 5 feedback surfaces + tables exist; review queue/ownership unverified                           |
| **E** AI safety & grounding      | **UNMEASURED**               | requires running the 11 scenarios against the deployed advisor                                  |
| **F** Data control & privacy     | **PARTIAL**                  | consent/terms routes exist; behavior unverified                                                 |
| **G** Operational containment    | **PARTIAL — strongest gate** | real flag + cohort infrastructure (below)                                                       |
| **H** Deployment confidence      | **PARTIAL**                  | version identifiable; **audited commit is NOT deployed**                                        |
| **I** Accessibility              | **UNMEASURED**               | never measured, on record                                                                       |
| **J** Performance & reliability  | **PARTIAL**                  | API p50 0.12–0.27s measured; user-journey latency unmeasured                                    |

**0 PASS · 0 FAIL · 5 PARTIAL · 5 UNMEASURED**

---

## What the audit DID establish (real evidence)

**Deployment is live and healthy.** `/readyz` returns all four dependencies true —
`{"supabase":true,"qdrant":true,"neo4j":true,"gemini":true}` — in 0.124s. This is a **deep** readiness
check, not a shallow one, and it is the single strongest operational signal found.

**Containment infrastructure genuinely exists (Gate G).** `supabase/migrations/090_beta_ops_feedback_meter.sql`
creates `ops.feature_flags`, `ops.user_feature_flag_overrides`, `ops.beta_invites`, `ops.cohorts`,
`ops.user_cohorts`, `ops.llm_usage_meter`. That is per-user flag override, invitation control, cohort
gating and spend metering — the mechanisms Gate G asks for. **Not exercised**, but present and
purpose-built.

**`GRAPH_GROUNDING_ENABLED = "false"`** (`fly.toml:43`) — graph retrieval is off in production, so the
unverified traversal path is not in the beta blast radius.

**Architectural invariants are enforced in CI** — tenant binding on both endpoints, single graph
writer, read-only Python clients, no raw relationship literals; all mutation-proven. This is genuine
Gate A _code-level_ assurance, but it is **not** the deployed cross-tenant probe Gate A requires.

**Feedback exists but is not response-level.** `analytics.py:40` captures pilot feedback
(thumbs/trust/usefulness/recommendation_quality/advisor_comparison/nps/comment) and
`analytics.advisor_turns` holds turn telemetry. Routes exist for `bug`, `nps`, `pilot`,
`recommendation`, `simulation`. **No route or table captures a categorized report against a specific
advisor response** across the seven required categories.

---

## Automatic no-go conditions

| #                 | Condition                                | Status                                                                                         |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1                 | Cross-tenant data exposure               | **UNVERIFIED — not disproven**                                                                 |
| 4                 | Problematic responses cannot be reported | **AT RISK** — no categorized response-level report found                                       |
| 5                 | Reports cannot be reconstructed          | **UNVERIFIED** — `advisor_turns` exists; linkage to model/prompt/retrieval version unconfirmed |
| 11                | Deployment version cannot be identified  | **NOT MET** — version is identifiable ✅                                                       |
| 2,3,6,7,8,9,10,12 | —                                        | **UNVERIFIED**                                                                                 |

**None is verified as met.** That is why this is "audit not performable" rather than a substantive
failure finding. Condition 4 is the one most likely to become a real blocker on inspection.

---

## Gate H finding worth acting on regardless

**The audited commit is not the deployed commit.** `5fbdef00` sits on an unmerged branch;
`origin/main` HEAD is `91922cbd`. Whatever is deployed was built from main, **not** from the audited
tree. Any beta must audit the actual release candidate — auditing a branch and launching main is a
governance gap independent of everything above.

---

## Exact access required to complete this audit

| #   | Need                                             | Purpose                       | Blocks gates     |
| --- | ------------------------------------------------ | ----------------------------- | ---------------- |
| 1   | **2 synthetic beta accounts, different tenants** | cross-tenant probes; journeys | A, B, E, F, I, J |
| 2   | Confirmation of the deployed commit/version      | audit the real RC             | H                |
| 3   | Read access to a feedback/report record          | verify reconstruction payload | C, D             |
| 4   | Named beta incident owner                        | no-go condition 10            | G                |

**Item 1 is the whole blocker.** Two synthetic logins convert five UNMEASURED gates into measured ones.
No production customer data is needed or wanted.

---

## Recommended cohort — once gates pass

**5 internal dogfood users first**, then **10–15 external**, invite-only via the existing
`ops.beta_invites` gate. Expansion only on evidence: zero cross-tenant findings, primary journey
completable unaided, and every advisor response reportable and reconstructible.

## Deliberately left for beta discovery

Confusing labels · minor visual and responsive defects · imperfect-but-safe recommendations · the ~120
off-journey dashboard routes (hide, don't fix) · noncritical route duplication · recoverable
integration errors · post-beta functionality gaps. These are exactly what a beta is for and none
requires pre-launch work.
