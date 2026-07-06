# P0 ONBOARDING COMPLETION — Action Cards + Life-Model Confirmation — 2026-06-10

Live on production (`app.lifenavigator.tech` @ `67606cf`). Frontend + state only — no GraphRAG / AI /
recommendation / finance-math changes. Action cards are DERIVED client-side from existing discovery
signals (coverage missing[] or the advisor panel's missing_areas).

## Files Changed

- **NEW** `src/components/dashboard/AdvisorOnboarding.tsx` — `DOMAIN_ACTIONS` catalog, `ActionCard`,
  `LifeModelConfirmation`, types (`AdvisorAction`, `CoverageDomain`).
- `src/app/dashboard/advisor/page.tsx` — fetch discovery-coverage; derive action cards; render cards
  during discovery; render the confirmation screen on complete/review; wire `AddDataModal`; require
  Confirm/Skip before unlock.
- `src/app/api/onboarding/advisor-complete/route.ts` — accept `confirmed`; record `end_state`
  (`confirmation_completed` | `explicit_skip` | `completed`) in the event (state distinction, no schema churn).

## Advisor Action Payload Shape

```ts
interface AdvisorAction {
  domain: 'finance' | 'career' | 'education' | 'health' | 'family';
  type: 'upload_document' | 'quick_form' | 'manual_entry' | 'continue_discovery' | 'skip_for_now';
  title: string;
  why_it_matters: string;
  what_it_unlocks: string;
  estimated_time: string; // e.g. "2 min"
  primary_cta_label: string;
  href?: string; // upload/form route (e.g. /dashboard/documents?domain=…&doc_type=…&return_to=/dashboard/advisor?onboarding=1)
  modalDomain?: 'financial' | 'health' | 'career' | 'education'; // manual-entry → AddDataModal
}
```

Cards are derived: `missingDomainKeys.slice(0,2).flatMap(k => DOMAIN_ACTIONS[k].slice(0,2)).slice(0,4)` —
so each surfaced domain offers BOTH an upload and a manual-entry path (never upload-only).

## Domain Prompt Rules Implemented

- **Finance:** Upload 401(k) statement · Enter income · Add home value · Upload insurance policy
- **Career:** Upload resume · Enter current & target role
- **Education:** Upload transcript · Enter education goal
- **Health:** Enter health goals · Upload lab report (with "avoid sensitive identifiers" note)
- **Family:** Upload estate / insurance documents
  Triggered when a domain is incomplete (coverage <100% or in the advisor's `missing_areas`).

## Upload/Form Routes Wired

- **Upload** CTAs → real `/dashboard/documents` page (verified href:
  `/dashboard/documents?domain=finance&doc_type=retirement_statement&return_to=%2Fdashboard%2Fadvisor%3Fonboarding%3D1`).
  No dead buttons.
- **Manual-entry** CTAs → existing `AddDataModal` (domains financial/health/career/education), which
  persists to canonical tables. Verified opening live: "Add Financial Data — Choose how you'd like to add
  your financial data…". Coverage refreshes when the modal closes.
- Family manual entry has no AddDataModal domain yet → surfaced as an upload (estate/insurance docs); not a dead-end.

## Confirmation Screen Result

`LifeModelConfirmation` renders before unlock: **"Here's what I understand about you"** with Life vision,
Primary objective, Constraints, Risks, per-domain Coverage %, Missing inputs, and Recommended-next-data
action cards. Controls: **Confirm & enter dashboard** (`advisor-complete {confirmed:true}`), **Edit answers**
(returns to chat), **Skip for now** (`advisor-complete {skip:true}`). The dashboard is reached ONLY via
Confirm or explicit Skip — both persist `onboarding_completed=true`.

## Onboarding State Fields

- `profiles.setup_completed` — persona activated (set ONLY by activate-persona).
- `profiles.onboarding_completed` — gate-unlocking flag, set by advisor-complete (confirm or skip).
- `user_events` (onboarding_completed) `event_metadata.end_state` — `confirmation_completed` vs
  `explicit_skip` vs `completed` (distinguishes the end-states without overloading one boolean / a migration).
- (Persona-selected, advisor-started, discovery-in-progress are observable from `setup_completed` +
  discovery coverage; a dedicated `onboarding_stage` column is a possible future hardening — see gaps.)

## Browser Validation Results (preview `67606cf` + production)

1. Fresh user `/dashboard` → `/onboarding/financial-profile` ✅
2. Persona → `/dashboard/advisor?onboarding=1` (full-screen) ✅
3. Answered questions → coverage rises (28%→82% earlier run) ✅
4. **Action cards present** (Upload statement · Enter income · Upload resume · Enter roles) ✅
5. **Manual-entry CTA opens AddDataModal** (persists canonical) ✅
6. **Upload CTA href → /dashboard/documents** (not dead) ✅
7. **Confirmation screen** "Here's what I understand about you" + Confirm ✅
8. Confirm → `onboarding_completed=true`, dashboard accessible, no crash ✅
9. Production smoke: action cards + review + confirmation all present ✅

- Screenshots: `reports/browser-validation/latest/onboarding-complete/{1-advisor-first,2-action-card,3-form-modal,4-confirmation,5-dashboard}.png`

## Remaining Onboarding Gaps

- **Documents page deep-linking:** upload CTAs pass `domain`/`doc_type`/`return_to`, but the documents
  page does not yet pre-select the doc type from the query or auto-return to the advisor after upload
  (it accepts the upload, but the user navigates back manually). Honest, not a dead-end; wiring
  query→preselect + return_to redirect is the next polish.
- **Family manual-entry:** no `AddDataModal` domain for family (dependents/spouse) — currently upload-only.
- **Granular `onboarding_stage` column:** end-states are recorded as events, not a first-class column; a
  dedicated stage enum would make resumability/analytics first-class.
- **Confirmation "Edit" per-section:** "Edit answers" returns to the chat; per-field inline edit is a future refinement.

## Definition of Done — status

✅ Advisor does more than ask chat questions (action cards). ✅ Prompts relevant uploads/forms.
✅ No dead CTA (upload→documents, manual→modal). ✅ User can provide missing info during onboarding
(AddDataModal persists). ✅ User reviews the life model before unlock. ✅ Unlock requires confirm or
explicit skip. ✅ Dashboard reflects confirmed onboarding (life_objectives + coverage feed cards / My Discovery).
