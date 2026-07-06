# Post-First-5 Triage

Feedback captured during the founder manual pass + first-5 testers. Not pre-launch scope unless explicitly
promoted to a launch blocker. Launch candidate is frozen at `dfd11aa`.

---

## #1 — Advisor-led short-term goal setting (milestones → big goals) · **feature (needs to be built)**

**Source:** founder manual pass (beta accounts).

**The gap.** On the beta accounts, `/dashboard/my-discovery` shows per-domain coverage + "Continue X discovery →"
which correctly opens the domain advisor chat (composer + goal chips like "Set emergency fund target"). But:

- Setting a goal there is **chip/tag-based and doesn't persist a tracked short-term goal**, and
- it **doesn't advance the domain's coverage** (the "missing inputs" never clear), so the experience feels
  aimless and **"never completes" / stuck** even though navigation works.

**What it should be.** In a **chat with the domain advisor**, the user sets **short-term / milestone goals that
ladder up to their big goals** — the advisor proposes concrete, grounded targets, the user approves, the goal is
**saved + tracked**, and **coverage visibly advances** so goal-setting moves you forward.

**Proposed build (reuses existing infra — no new architecture):**

1. **Advisor flow:** when a domain has open gaps, the advisor proposes 1–3 concrete short-term goals/targets in
   chat (grounded in the deterministic finance engine + the domain's missing discovery inputs), as
   **approval-gated cards** — extend the existing **Advisor Action Loop** (detect → ActionCard → approve → apply).
2. **Persist on approval:** short-term finance goals → `finance.financial_planning_goals` (already migrated);
   non-finance milestones → `life` goals / `candidate_goals`. No silent writes.
3. **Coverage progression:** `discovery_coverage` counts a saved planning goal toward that domain's missing
   inputs → coverage advances → the domain can reach "complete." This directly fixes the "never completes" feel.
4. **Laddering:** link each short-term goal to its big goal so the UI shows "toward: <big goal>".
5. **UI:** My Discovery + dashboard show the saved short-term goals + updated coverage; "Continue discovery"
   deep-links into the advisor **pre-seeded with a goal-setting prompt** for that domain (not a blank chat).

**Estimate:** one focused sprint (backend action + persistence + coverage integration + advisor prompt + UI
cards). Model-agnostic; validator/guardrails unchanged.

**Decision needed:** build now (gate first-5) — OR first post-first-5 sprint. _Founder leaning: needs-to-be-built._

---

## #2 — Mobile capture-api (voice / document / meal / body) · **parked on a branch**

**Source:** repo readiness analysis. The Rust/axum mobile-capture service was built once but never committed
(source lost; only build artifacts remained). It only serves the **mobile** app's capture features, and mobile
is not in the first-5 beta.

**Disposition:** removed from `main` (nothing was tracked there — deleted the 1.2GB untracked build-artifact
husk). The full recovered **design spec** is preserved on branch **`feat/capture-api-postbeta`**
(`apps/lifenavigator-capture-api/README.md`) — start there after the beta. Go-live blockers were: Supabase key
rotation, Fly app + secrets, and the `nutrition_logs`/`body_metrics` vs `health_meta` schema question.

---

## Fixed during the manual pass (already shipped, not deferred)

- **My Discovery crash** on the `deprioritized` status — fixed (`dfd11aa`); page now renders all 5 distinct
  domain cards.
- **beta2 brief net worth** −$10K → +$12K to match live data.
