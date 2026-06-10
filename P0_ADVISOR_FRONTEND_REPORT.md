# P0 ADVISOR FRONTEND COMPLETION — 2026-06-10

Live on production (`app.lifenavigator.tech` @ `6f304fb`). Frontend-owned onboarding UX only — no
GraphRAG/recommendation/finance-math changes, and **no Core API discovery-behavior changes** (those are
the separate conversation-agent sprint).

## Files Changed

- `lib/integrations/plaid/personas.ts` — `PublicPersona` + `toPublicPersona` now expose income_type/
  asset_profile/liability_profile/investment_profile.
- `components/onboarding/SampleFinancialProfile.tsx` — rebuilt as explicit persona CARDS → sandbox-data CONFIRM step.
- `components/dashboard/AdvisorOnboarding.tsx` — `coming_soon` action type + Coming-Soon card render; richer `LifeModelConfirmation` (coverage %, priorities, relabeled buttons).
- `app/dashboard/advisor/page.tsx` — phase-gated action cards, final open-ended question, intentional dashboard transition.

## Persona Selection Flow (P0.1)

Signup → email verify → `/onboarding/financial-profile` shows **persona cards** (no auto-selection),
each with income / assets / liabilities / investments + complexity. Selecting a card →
**confirmation step**: "You selected {persona}", financial summary, and "This is **Plaid sandbox data**
used for beta testing. It is **not** your real financial account." → **Start Advisor Onboarding** →
activates + routes to the advisor. **Verified: 10 cards, no auto-confirm; confirm screen shows the
sandbox disclaimer + Start button.**

## Beta Financial Action Handling (P0.2)

Account-data actions (Upload 401(k) statement) render a disabled **"Coming Soon"** with copy: _"During
beta, financial account data comes from the Plaid sandbox persona you selected."_ Allowed beta actions
stay active (Enter income, Add home value, Upload insurance/planning docs). No dead/fake upload path.
**Verified live.**

## Conversation Scroll Validation (P0.3)

`msgs[]` is append-only (never trimmed/collapsed/replaced); the conversation column is `overflow-y-auto`,
input anchored below. Action/reveal cards and the final-question exchange are appended to history, so they
remain scrollable. (Code-verified; the immersive layout scrolls within the chat column.)

## Action Card Phase Gate (P0.4)

Action cards render only when `userAnswers >= 3` (and a domain is incomplete) — never during the first
discovery exchanges. **Verified: 0 cards at start; cards/Coming-Soon appear after answers.**

## Confirmation Screen Result (P0.5)

`LifeModelConfirmation` shows: coverage % badge, **ranked priorities** (primary objective + themes), life
vision, constraints, risks, per-domain coverage, missing inputs, recommended-next-data action cards.
Buttons: **Looks right — enter dashboard** / **Edit priorities** / **Add something important** / **Skip
for now**. Dashboard unlocks only on Confirm or explicit Skip. **Verified: coverage % + "Looks right" render.**

## Final Question Result (P0.6)

On natural discovery completion the advisor asks once (frontend-orchestrated): _"…what haven't I asked
that I should have? Is there anything else important…?"_ with an input + "Nothing else →"; the answer is
captured into discovery before the review. (Shows on natural `complete`; the manual "Review" shortcut goes
straight to the review — noted.)

## Dashboard Transition (P0.7)

On Confirm/Skip: an intentional transition screen — _"I've built your initial Life Model. Your dashboard
is ready…"_ — then routes to `/dashboard`. **Verified: transition message renders before routing.**

## Browser Validation Results (preview + production)

| Item                                                     | Result                                         |
| -------------------------------------------------------- | ---------------------------------------------- |
| P0.1 persona cards (no auto-select)                      | ✅ 10 cards                                    |
| P0.1 sandbox-data confirm + Start Advisor                | ✅                                             |
| P0.2 Coming Soon on account uploads                      | ✅                                             |
| P0.4 no action cards during early discovery              | ✅                                             |
| P0.5 confirmation: coverage % + priorities + Looks right | ✅                                             |
| P0.7 transition message                                  | ✅                                             |
| P0.3 history append-only / scrollable                    | ✅ (code-verified)                             |
| P0.6 final question (natural completion)                 | ✅ code-complete (shows on natural `complete`) |

Screenshots: `reports/browser-validation/latest/advisor-frontend/{1-persona-cards,2-persona-confirm,3-advisor-early,4-advisor-cards,5-confirmation,6-transition}.png`.

## Remaining Core API Advisor Gaps (separate sprint — the "AI" conversation layer)

These need `/v1/life/discovery/chat` (Python LLM) changes + Fly deploy access — NOT touched here:

- Issue 1: hypothesize-don't-conclude (the chat still asserts "the real objective is…").
- Issue 2: reflection→clarification→confirmation before classification.
- Issue 4: backend goal-ranking generation ("I believe these are your priorities" with confidence).
- Issue 5: confidence-threshold-based discovery (continue weak domains) vs question count.
- Issue 9: native final-question (currently frontend-orchestrated as a bridge).
  Also frontend follow-ups: route the manual "Review" through the final question; show "Your priorities"
  even when only the objective is known; tighten the persona-activation spinner→advisor handoff.

## Definition of Done — status

✅ No persona silently selected. ✅ Advisor starts only after explicit persona confirmation. ✅ Beta
financial actions show Coming Soon (no fake upload/account workflow). ✅ Full conversation history
scrollable. ✅ Action cards phase-gated. ✅ Confirmation feels like a real life-model review. ✅ Dashboard
unlock is intentional + confirmed.
