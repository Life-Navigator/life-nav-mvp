# Elite Platform Scorecard

**Sprint:** Elite Platform Hardening ("Holy Shit UX") · **Date:** 2026-06-16 · **Audience standard:** a 20-person private pilot of VCs, investors, executives, financial advisors, attorneys, physicians, and power-users.

**Method (honest caveat):** This is a **code-level audit** — nine subagents read the actual implemented `apps/web` screens, components, and `lifenavigator-core-api`/worker services and graded against an elite bar. Every finding is cited to `file:line` in its source report. We did **not** render pixels or run a live click-through with real pilot users; visual polish and perceived latency are inferred from code, not measured on a device. Treat scores as engineering-grounded judgment, not user research.

---

## Scores at a glance

| #   | Workstream                | Score                  | One-line verdict                                                                                                                 |
| --- | ------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | First 15 Minutes          | **6.5**                | Premium, honest onboarding undermined by a silent dead-end on the primary landing CTA; the "wow" is buried last.                 |
| 2   | Dashboard Excellence      | **6.0**                | Trust-disciplined cockpit with a strong server-rendered hero, dragged down by stub domain pages and consumer chrome.             |
| 3   | Recommendation Excellence | **6.5**                | Genuinely elite engine (evidence-gated, formula-ranked) crippled by 3 competing engines and an **orphaned provenance layer**.    |
| 4   | Report Excellence         | **7.0**                | Core-API report engine is boardroom-grade; dead duplicate path + missing Share UI + overpromising copy.                          |
| 5   | Graph Experience          | **5.5**                | The real moat (explainable provenance graph) exists but the nav points at the **wrong route**; live route strips explainability. |
| 6   | Personalization           | **6.5**                | Strong inference, anonymous surface — the product _knows_ the user but rarely _says so_; resets across sessions.                 |
| 7   | Life-Model Completeness   | **5.5**                | Broad, finance-deep catalog; **no equity-comp model**, thin estate, and the cross-domain graph is a star, not a web.             |
| 8   | Executive Demo            | **6.5**                | Demos beautifully on a pre-warmed account; stalls if you run the advisor cold or switch personas live.                           |
| 9   | Pilot Risk                | **GO-WITH-CONDITIONS** | Trust spine is load-bearing and real; risk is credibility leaks + last-mile polish, not fabricated numbers.                      |

**Composite (workstreams 1–8): 6.25 / 10.** Translation: a **fundamentally trustworthy, architecturally serious platform** that does not yet _feel_ elite because its best assets are unwired, unsurfaced, or buried — and a handful of dead-ends would embarrass us in front of exactly this audience.

---

## The five cross-cutting themes

These recur across every report and are where the leverage is. Fixing the **theme** fixes many findings at once.

### Theme 1 — The moat is built but invisible (highest leverage)

The differentiators we claim — provenance, explainability, evidence-grounding, governed sharing — **exist in code but are not wired to the surface the user sees**:

- The **explainable life graph** (provenance label + citation + data-used + weighted factors + formula) is fully built in `NodeDetailsPanel.tsx`, but the nav links to `/life-graph` (the non-explainable route), and that route's `transformLifeGraph` strips all explainability and returns `sources: []` (GRAPH §2–3).
- The recommendation **why-chains / counterfactuals / evidence / audit-trail routes** are built and non-trivial but **no component calls them** (RECOMMENDATION §3).
- A complete **governed, redacted, audited ShareService** exists on the backend; there is **zero Share UI** despite copy that says "use Share" (REPORT §5).

**Implication:** we are paying the engineering cost of the moat and getting none of the demo/trust credit. This is the single biggest gap between what we _have_ and what a VC will _see_.

### Theme 2 — Fragmentation: one capability, several competing implementations

- **3 recommendation engines** (`recommendations_os.py`, `lib/finance/recommendations.ts`, Next-Dollar Optimizer) — the home dashboard and the Recommendations page can disagree about your #1 action (RECOMMENDATION §2).
- **3 graph implementations**; nav points at the weakest (GRAPH §1).
- **2 report systems** — the real Core-API one and an orphaned scenario-lab React-PDF worker with no deploy wiring (REPORT §2,4).
- **2 signup paths** — the live unified `CreateForm` and a dead/contradictory standalone `RegisterForm` (FIRST_15 §3).

**Implication:** coherence is the issue, not content quality. Collapsing each to one canonical path removes whole classes of "it contradicts itself" embarrassment.

### Theme 3 — Dead-ends and stubs shown to real users (no-mock-data violations)

The project's hard rule is _honest empty states, never fabricate_. Mostly upheld — but the exceptions are exactly where a skeptic clicks:

- **Landing CTA dead-end:** "Request Beta Invite" → magic mode → `signInWithOtp({shouldCreateUser:false})`; new users get a fake "Check your email" with **no email sent** because errors are swallowed (FIRST_15 §2).
- **Placeholder chat:** `/dashboard/roadmap/chat` returns a hardcoded "This is a placeholder response… implemented soon," promoted as an immersive route (PILOT_RISK P0 #1).
- **Health Overview can never show data** — `HealthScore` + `VitalsTrends` have fetch commented out and always `setData(null)` (DASHBOARD §5).
- **Education Overview** is a "Coming Soon" page with a fake email form that only `console.log`s (DASHBOARD §4).

**Implication:** these are not polish items; each is a one-click credibility loss with a physician/attorney/VC.

### Theme 4 — A personalized engine behind an anonymous surface

The substance is personalized (advisor reasons from the user's own numbers + last 6 turns; recs branch on real persona signals). The _surface_ is generic:

- The advisor literally **cannot say the user's name** — `UserContext` carries only id/email/role (PERSONALIZATION §6).
- Greeting is `Welcome back, {name}` with no time-of-day and can render the raw email (PERSONALIZATION §5).
- **No cross-session memory** in the UI — a fresh `conversationId` is minted every load, so no "last week you said…" (PERSONALIZATION §9).
- A real `recent_intelligence` feed is computed and then **never rendered** (PERSONALIZATION §7).

**Implication:** the cheapest "I didn't expect it to know that" wins are _surfacing_ what we already compute, not building new intelligence.

### Theme 5 — Finance-deep, life-shallow (for _this_ cohort specifically)

The pilot cohort has equity comp, private assets, trusts, dependents, multiple entities. The model:

- Has **no equity-compensation model** (RSU/options/vesting/strike absent) — net worth silently excludes equity, which is _wrong for exactly this audience_ (LIFE_MODEL §3).
- Estate is **3 booleans** (has_will/has_poa/has_beneficiaries) — no trust/titling/trustee/beneficiary→asset mapping (LIFE_MODEL §4).
- The "life graph" is a **star topology** (user→HAS_X); cross-domain edges (dependent→529→education goal) are documented extension points, **not emitted** (LIFE_MODEL §5).

**Implication:** the platform under-claims rather than fabricates (the right call), but an elite user will feel "it doesn't really get my situation" until equity comp + cross-domain edges land.

---

## The one genuinely excellent thing (do not break it)

**The model-agnostic trust spine is real, load-bearing, and ahead of the market.** Number-grounding (`advisor_validator.py:179-184`) + a deterministic AST math verifier (`advisor_math.py:102-144`) + the advice-scope gate + the health-safety net all run **before any model call reaches the user** (`advisor_orchestrator.py:322,353`). Net-worth unification **held** across all four finance surfaces. RLS is mature (670 policies; the 43-view leak closed via `security_invoker`). Reports are evidence-grounded with source tables, assumptions, confidence, and a reproducible content hash. **This is the moat. Every fix below is about making it visible and removing the things that undercut it.**

---

## Consolidated P0 — must fix before the pilot

Deduplicated across all nine reports, ranked by (credibility blast radius × likelihood a pilot user hits it):

| P0  | Issue                                                                               | Evidence                                                                               | Fix                                                                                                                         |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Landing CTA dead-ends new users** (fake "check your email", no email sent)        | `UnifiedAuthExperience.tsx:228-244`, `page.tsx:529`                                    | Route the primary CTA to the real create/register path; stop swallowing the OTP error.                                      |
| 2   | **Placeholder chat response** shipped on a promoted route                           | `roadmap/chat/page.tsx:211`, `dashboard/layout.tsx:18`                                 | Remove the route or wire it to the real advisor; nothing hardcoded user-facing.                                             |
| 3   | **No advice disclaimer** on the advisor UI                                          | 0 grep hits in `dashboard/advisor/page.tsx`                                            | Persistent "not financial/legal/medical/tax advice" banner.                                                                 |
| 4   | **Rotate the Supabase PAT / service-role key** pasted in a prior session            | (repo clean; key lived in plaintext outside repo)                                      | Rotate before any real elite data is loaded.                                                                                |
| 5   | **Always-null health stubs + fake education form** shown as real pages              | `HealthScore.tsx:29-35`, `VitalsTrends.tsx:46-52`, `education/overview/page.tsx:13-35` | Replace with honest empty states or unlink from nav until wired.                                                            |
| 6   | **Graph nav points at the non-explainable route** (moat invisible + faceplant risk) | `Sidebar.tsx:451`, `transform.ts:158-205,254`                                          | Repoint nav to `/life-graph/explainable`; wire provenance/data-used end-to-end; verify the workspace endpoint is populated. |
| 7   | **Premium-model auth posture** (Vertex token expires ~1h)                           | `advisor_llm.py:253`                                                                   | Keep premium Opus OFF for the pilot (Gemini-only default) **or** wire a service-account refresh.                            |

> Items 1, 5, and 6 are also no-mock-data / coherence violations; items 2–4 and 7 are the pilot-risk P0s. Closing these seven is the gate.

## Consolidated P1 — fix during the pilot (high leverage, not blocking)

1. **Wire the moat to the surface** (Theme 1): graph provenance click-through, recommendation why/counterfactual routes, the Share flow. _This is the biggest perceived-quality jump available._
2. **Collapse the duplicates** (Theme 2): one recommendation engine so home and roadmap agree; one report system; one signup path.
3. **Personalize the surface** (Theme 4): plumb the user's name to the advisor + dashboard; fact-aware time-of-day greeting; render the already-computed `recent_intelligence` as a "since you were last here" strip; persist `conversationId` for cross-session memory.
4. **Reduce demo fragility** (EXEC_DEMO): pre-warmed seeded demo account; advisor stream timeout + graceful error; don't route fresh persona activation straight into the slow advisor; bump api-gateway `auto_stop` from `stop` to `suspend`.
5. **One full-width quantified next-best-action hero** replacing the three stacked readiness rings (DASHBOARD §6, §10).

## P2 — before enterprise / scale

- Equity-comp + private-asset model into net worth; promote estate to real entities; **emit cross-domain graph edges** (LIFE_MODEL top-3).
- Date-anchored "why now" urgency on recommendations (RECOMMENDATION §8).
- Graph performance: node cap + move the 220-tick force-sim off the main thread; mobile/accessibility pass (GRAPH §7–8).
- Retire the orphaned scenario-lab report worker and the dead `RegisterForm`.

---

## Bottom line

LifeNavigator is **not** a generic SaaS wrapper — under the hood it is a trust-disciplined, evidence-grounded, multi-domain platform whose core engineering (trust spine, RLS, evidence-grounded reports, net-worth unification) is genuinely ahead of most Series-A products. It scores **6.25/10 against an elite bar** today for one reason: **its best work is invisible, duplicated, or buried, and a few dead-ends sit exactly where a skeptic clicks.**

The path to "holy shit" is therefore **not more intelligence** — it is **surfacing the moat, collapsing the duplicates, killing the dead-ends, and putting the user's name on the screen.** Close the seven P0s to launch; ship the P1 "wire the moat to the surface" work during the pilot, and the same platform jumps from 6.25 to genuinely elite without a single new model.
