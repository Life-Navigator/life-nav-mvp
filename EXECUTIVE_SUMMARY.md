# EXECUTIVE_SUMMARY.md — Advisor Action Loop

## Shipped + verified live

Arcana can now help users **update their life model through approval-gated actions** — the feature that turns it from a premium conversation into a premium product.

**5 actions** (promotion, new child, home purchase, degree enrollment, health goal): detect → impact preview → collect fields → **approve** → write via `IngestionService.submit_life_fact` (MCP path) → result summary → surfaces on next read.

## Proof

- **Backend**: `advisor_actions.py` + `POST /v1/life/advisor/action/{detect,apply}` + 7 tests (610 total pass).
- **Frontend**: `ActionCard` in CommandCenter (impact chips + editable fields + Approve/Cancel) + auth proxy.
- **Live**: full promotion loop through the UI (card → approve → "✓ Updated your promotion…"); all 5 actions via API; **14 facts persisted in life.facts** across 5 domains, all `confirmed` + `submitted_by=arcana-action-loop`.

## Guarantees

No silent writes · approval required · MCP/IngestionService only (tenant-scoped, provenance-stamped, idempotent) · no direct DB access · no autonomous agent / generic framework.

## Honest scope

- Dashboard/recommendations reflect changes **on next read** (writes persist immediately; surfaces recompute on load) — not a live cross-page push from chat. Small follow-up.
- Actions write the canonical `life.facts` (what the dashboard + advisor read). Per-domain structured rows are a deeper mapping, intentionally out of scope.

## Deliverables

ADVISOR_ACTION_LOOP · PROMOTION/NEW_CHILD/HOME_PURCHASE/EDUCATION/HEALTH_GOAL_ACTION_VALIDATION · MCP_WRITE_AUDIT · INVESTOR_DEMO_VALIDATION · this summary.

---

# FINAL STATUS: ADVISOR_ACTION_LOOP_READY

The full demo arc is real and verified: ask → natural answer → evidence/citations → action card → approve → life model updates (provenance-stamped, gated). Arcana is now more than a chatbot.

---

# Instant Impact Sprint — Completion + Domain Write Gap Decision

## Status: **INSTANT_IMPACT_READY** (domain-write gap is real but non-blocking)

The Impact Summary Card works and is honest, and is shippable for the pilot.

### Root cause (why readiness/recommendations don't move from an action)

Three disconnected layers: (1) `life.facts` — what actions write; (2) domain **write** tables that manual endpoints target; (3) domain **read/readiness** tables the scorers actually read. Readiness/recommendations are computed from layer 3, actions write layer 1 → no score movement. And the two actions whose write endpoints already exist (Home Purchase, Health Goal) write **layer-2 tables the scorers don't read** (`finance.assets`/`asset_loans`, `health_goals`), so wiring them wouldn't help. Full evidence: `DOMAIN_WRITE_GAP_AUDIT.md`.

### Decision: **Option A — `life.facts`-only for pilot** (`DOMAIN_WRITE_DECISION.md`)

Safe, honest, already works. The "call existing endpoints" shortcut is a mirage. Optional single fast-follow for one _real_ numeric delta: **New Child → `family.dependents`** behind a flag (~0.5–1 day) — the only action whose readiness-read table is a trivial insert. Do **not** force Home Purchase net-worth (re-opens the double-count bug) or fake a health log.

### Final answers

1. Card working? **Yes.** 2. Only real changes? **Yes.** 3. No fake readiness delta? **Yes.** 4. No fake recommendation delta? **Yes.** 5. Facts visible to advisor? **Yes.** 6. Visible on dashboard next read? **Yes.** 7. Domain writes for real readiness: `family.dependents`, `career_profiles`+`compensation_records`, `education_records`, `finance.financial_accounts` — **not** the manual endpoints' tables. 8. Build before pilot? **No** (optional New Child fast-follow). 9. Safest next move? **Ship Option A; defer domain writes.** 10. Honest & compelling? **Yes.**

### New deliverables this sprint

`DOMAIN_WRITE_GAP_AUDIT.md` · `DOMAIN_WRITE_DECISION.md` · `ACTION_LOOP_REFRESH_VALIDATION.md` · `INVESTOR_IMPACT_VALIDATION.md` · `FINAL_PILOT_GAP_AUDIT.md` · (plus the 5 existing deltas, left intact).

---

# Vertex ADC Live Validation (2026-06-23)

## Status: VERTEX_MODEL_LIVE_VERIFIED (auth + routing). Advisor quality: mixed.

The key-free Vertex path is **proven live** on LifeNav (`gen-lang-client-0849161409`), `us-central1`, `gemini-2.5-pro`, ADC:

- ✅ Gemini 2.5 Pro callable via Vertex ADC (live `PONG`); **no API key** (ADC bearer, `aiplatform.googleapis.com`, no `?key=`).
- ✅ Every advisor turn proves `provider=vertex_gemini` + `model=gemini-2.5-pro` on the response/telemetry.
- ✅ **No silent fallback** — fallbacks log `advisor_model_fallback` (provider/model/reason); ADC-absent failures raise + log.
- ✅ **Workout prompt → concrete plan** (the original failure, now fixed: 500-cal deficit, 3×/week, knee-safe).
- ⚠️ **Finance** falls back: gemini-2.5-pro writes computed personal $ figures (20%-down=$100k, closing 2-5%) the number gate correctly blocks — excellent answer, killed by the trust spine. Finance-specific actionability gap.
- ⚠️ **Health** passes when it answers, but the medical-advice regex intermittently over-blocks.

No deploy performed. Deliverables: VERTEX_ADC_LIVE_VALIDATION · MODEL_RUNTIME_PROOF · WORKOUT_PROMPT_REPLAY · FINANCE_HEALTH_MODEL_VALIDATION.

## Next decision (informed by the live run)

Gemini 2.5 Pro is strong on coaching/qualitative (workout, health) but its finance answers are blocked by the number gate, not by quality. Turning on **Claude via Vertex** would face the _same_ gate, so it is **not** a fix for the finance gap on its own. The finance gap is closed by a gate-policy decision (allow labeled benchmark %/ratios in a personal context) — separate from the model choice. Recommend: (a) approve the finance-gate refinement, then (b) optionally A/B Claude on finance/health for qualitative lift.

---

# Vertex WIF Production Deploy (2026-06-24)

## Status: PRODUCTION LIVE on keyless Workload Identity Federation

The advisor's production model auth now runs on **Vertex AI + Gemini 2.5 Pro via Workload Identity Federation** — **no API key, no service-account key** (org policy blocks both; WIF satisfies it).

### Proven live in the Fly machine

Fly OIDC (`/.fly/api`) → GCP STS → impersonate `lifenav-model-runtime` → Gemini 2.5 Pro → `VERTEX_OK` (`provider=vertex_gemini`). healthz green; rolling deploy healthy.

### Built/created

- WIF pool `lifenav-fly` + OIDC provider `fly-oidc` (issuer `https://oidc.fly.io/timothy-riffe`, audience `lifenav-vertex-prod`, app-scoped attribute condition).
- SA bound via `roles/iam.workloadIdentityUser` to the app principalSet; 0 keys.
- Runtime `external_account` bootstrap + Fly-OIDC token minting (`vertex_auth.py`); 657 tests.
- Deployed core-api (image `deployment-01KVY5JHT5…`); WIF env set; Claude hybrid OFF.

### Security

Keyless, least-privilege, no secrets in git or on disk, loud fallback. SA key creation blocked by org policy (correct) — WIF is the compliant answer.

### Remaining

- Full authenticated UI/domain smoke + screenshots (model path verified; per-surface walk pending).
- Reconcile branch → main (clean FF) for Vercel/web.
- Opus 4.8: enable later after quota + streaming + seeded benchmark.

10 deliverables: ENVIRONMENT_DISCOVERY, AUTH_VERIFICATION, WIF_CONFIGURATION, SERVICE_ACCOUNT_CONFIGURATION, VERTEX_RUNTIME_CONFIGURATION, FLY_CONFIGURATION, CLAUDE_HYBRID_VERIFICATION, PRODUCTION_SMOKE_REPORT, SECURITY_AUDIT, EXECUTIVE_SUMMARY.

---

# Advisor Supervision Sprint (2026-06-25) — compliance moved to a repair loop

## Status: SUPERVISED_ADVISOR_READY

Replaced "muzzle gate → dumb fallback" with "strong answer → validator supervises → structured 2-attempt repair → safe answer". The validator is unchanged in WHAT it blocks (trust floor intact); it now also explains HOW to fix, and the model revises before any fallback.

- `classify_issues()` → structured per-issue repair instructions (label scenario / drop un-computable payment / reframe verdict / derive-or-remove).
- Orchestrator: ≤2 guided repairs, re-validated each time; all content failures repairable (advice/verdict included); only malformed output isn't.
- **Live prod replay: 6/6 ENHANCED** incl. "Can I afford a $500k home" (was always fallback) — self-repaired. 680 tests pass.
- Trust floor verified intact: fabricated payment/DTI/tax/net-worth, clinical/legal directives, named products, ungrounded relationships still blocked.
- Tradeoff: repaired turns ~59-77s (extra generation); streaming masks first-text.

12 deliverables: ADVISOR_SUPERVISION_PIPELINE_AUDIT, VALIDATOR_ROLE_DEFINITION, VALIDATION_FAILURE_SCHEMA, ADVISOR_REPAIR_LOOP_IMPLEMENTATION, ADVISOR_PROMPT_REDESIGN, FINANCE/HEALTH/LEGAL_REPAIR_LOOP_VALIDATION, SUPERVISED_RESPONSE_UX_REPORT, SUPERVISION_TEST_REPORT, SUPERVISED_ADVISOR_LIVE_REPLAY, EXECUTIVE_SUMMARY.
