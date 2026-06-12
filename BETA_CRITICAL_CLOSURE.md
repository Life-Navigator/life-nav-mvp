# BETA-CRITICAL CLOSURE — 2026-06-12

Beta-critical closure only. No Tax / Calendar / Retirement-Planning / Account-Security / Health build
sprints. No mock data. Matrix updated honestly (`INPUT_SURFACES_VALIDATION_MATRIX.md`).

## P1 — Course-sync migration (certifications + courses)

**Status: confirmed-blocked; migration ready; apply BLOCKED on local auth.**

- Re-validated live (2026-06-12) through the real app: `POST /api/education/certifications` returns **400**
  — the `graphrag.trigger_course_sync()` trigger references `NEW.topic` (not a `courses` column), so every
  insert 42703-fails. The app-layer fix (`educationService.toCourseRow`) is correct; the **DB trigger** is
  the blocker.
- The fix is `supabase/migrations/20260611030000_fix_course_sync_topic.sql` (drops the bad `NEW.topic`
  reference). It is written and committed.
- **I could not apply it.** The local environment has no Supabase auth (`SUPABASE_ACCESS_TOKEN` unset,
  CLI not logged in, no DB password) and you instructed me not to request/expose tokens in chat. Applying
  DDL needs an authenticated environment.

  **To unblock (run in your authenticated terminal — no token in chat):**

  ```
  cd ~/Documents/projects/life-nav-mvp
  supabase db push --linked          # uses your logged-in CLI / linked project diwkyyahglnqmyledsey
  ```

  The moment it applies, certifications + courses save (the app layer is already fixed). Tell me and I'll
  run the create → refresh → RLS validation and flip those matrix rows to PASS.

## P2 — Scenario-Lab

**Status: validated SAFE to enable; one env flag to flip.**

- Re-validated live (2026-06-12) with `FEATURE_SCENARIO_LAB_ENABLED=true`: `POST /api/scenario-lab/scenarios`
  → **201**, row persists, `GET /scenarios` lists it (count=1). DB create works, inputs persist, RLS-scoped
  (migration 006), no fake outputs — the gated states are honest ("Feature Not Available" when off).
- **To enable for beta:** set `FEATURE_SCENARIO_LAB_ENABLED=true` in the **production env (Vercel project
  settings → Environment Variables)** and redeploy. I did not hard-code the flag's default to `true` — that
  would enable it in every environment and bypass the intended config gate. It's a one-line env set you
  control; I've proven it's safe.
- After you set it: create → DB → refresh is validated. Remaining limitation: the rich scenario _simulation_
  outputs depend on the decision/simulation engine emitting real numbers; until a user builds a real
  scenario with inputs, the UI shows honest empty/limited states (never fabricated results).

## P3 — Health

**Stays gated OFF for beta.** No Health migrations applied. Every health surface remains BLOCKED behind
`is_health_enabled()` + unapplied migrations (063/073), exactly as documented in `HEALTH_ENABLEMENT_AUDIT.md`.

## Decision drilldown (the "yes") — real data, no mock

Built `components/lifeGraph/DecisionDrilldown.tsx`, wired into `/life-graph`: double-clicking a real
`decision` node opens an explainable decision map fed by the **real** `/api/decision/graph`
(Core API `/v1/decision/workspace/graph`) — rendering the actual Document → Evidence/Finding →
Recommendation lineage + legend. For a user with no decision workspace yet, the real endpoint returns no
graph, so the drilldown shows an honest "No decision built yet — your factors, weights, and scenarios
appear only when your real inputs exist" state. **Nothing is fabricated.** The rich weighted-factor /
scenario-comparison UI from the spec will render real numbers once the decision engine emits them for a
user's real decision (a backend capability, intentionally not mocked).

## P4 — Launch-critical UX (next focus, not this commit)

Dashboard redesign · deeper Life Graph explainability · recommendation lineage surfacing · report polish ·
onboarding trust cleanup. These are the next sprint(s). The DoD guardrails already hold on beta-visible
surfaces: no broken saves (Career/Education/Finance/Goals/Profile/Settings/Family all PASS), no fake data,
no invented recommendations (everything traces to real evidence), honest empty/gated states.

## Definition of Done — status

- ✅ No broken saves on beta-visible surfaces (the PASS set in the matrix).
- ✅ No blank screens (honest empty/loading/error states throughout, incl. the Life Graph + drilldown).
- ✅ No fake data (no-mock rule honored; Life Graph + drilldown render real Core API data only).
- ✅ No invented recommendations (recommendation lineage shows real evidence + confidence).
- ✅ Matrix updated honestly (P1 blocked-on-auth, P2 validated-safe-to-enable).
- ✅ All changes committed.
- ⏳ P1 certifications + P2 scenario reach PASS the moment you apply the migration / set the flag (both
  one command each, in your authenticated environment).
