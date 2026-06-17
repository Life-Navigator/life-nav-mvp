# Email & Calendar Governed-Context Policy

**Sprint:** MCP, Data Submission, Email & Calendar Integration
**Status:** Policy / enforceable spec. Grounded in real code (file:line). READ-ONLY doc — no code changed.
**Scope:** How Arcana / LIOS may use email- and calendar-derived data once a user connects Google or Microsoft.

This is a binding policy. Every rule below names _where in the codebase it is (or must be) enforced_. Where the
enforcement point does not yet exist, it is marked **[GAP — enforce here]** so the sprint can wire it.

---

## 0. The two anchors this policy hangs on

### A. Provenance taxonomy (the User Truth Model)

The platform already has a strict provenance ordering. It is implemented today in the My Life service:

> `apps/lifenavigator-core-api/app/services/my_life.py:118` — _"Provenance (User Truth Model): confirmed > stated > inferred > assumed."_

The four tiers and their literal string values (`apps/lifenavigator-core-api/app/services/my_life.py:120-127`):

| Tier        | string             | Meaning                                        |
| ----------- | ------------------ | ---------------------------------------------- |
| 1 (highest) | `user_confirmed`   | The user explicitly confirmed this fact.       |
| 2           | `user_stated`      | The user authored/said this directly.          |
| 3           | `advisor_inferred` | The system inferred it (e.g. from onboarding). |
| 4 (lowest)  | `assumption`       | Working assumption, not established.           |

The per-item provenance object the UI consumes is shaped at `my_life.py:138-143`:
`{ provenance_type, source, confidence, updated_at }`. Assumptions carried on recommendations use the
`{"assumption_text", "confidence", "user_confirmed": False, "source": ...}` shape seen across the domains
(e.g. `app/domains/finance.py:504-506`, `app/domains/career.py:258-259`, `app/domains/health.py:197-199`).

### B. "No mock data — ever"

Hard platform rule (auto-memory `no-mock-data-ever`): every surface is wired to real data; empty states are
honest; we never fabricate. Email/calendar context is held to the same standard — if it isn't really in the
user's mailbox/calendar, it does not appear as a fact.

---

## 1. Connection is explicit and user-initiated

**Rule.** No email or calendar data may be read until the user has personally completed the OAuth consent flow
for that provider. There is no silent/implicit connection.

**Enforced today at:**

- The OAuth _initiation_ route requires an authenticated session before it will even build the auth URL:
  `apps/web/src/app/api/integrations/oauth/google/route.ts:19-24` (`supabase.auth.getUser()` → 401 if no user)
  and again for POST at `:104-110`.
- Consent is forced every time: `prompt: 'consent'` and `access_type: 'offline'`
  (`oauth/google/route.ts:95-97`; service default `google/oauth.ts:172-173`).
- CSRF is bound to the user's browser via a signed state nonce in an httpOnly cookie
  (`oauth/google/route.ts:65-82`; verified on callback at `oauth/callback/google/route.ts:36-45`;
  Microsoft equivalent `oauth/callback/microsoft/route.ts:43-49`).
- Connection state is recorded as `connected` only after a successful token upsert
  (`supabase/migrations/011_mvp_integrations_auth.sql:124-158`).

**Rule for Arcana/LIOS:** before any email/calendar tool runs, the agent MUST check that
`public.integrations.status = 'connected'` for the provider (rows written by
`core.upsert_integration_token`, migration `011:126-158`). If not connected → the agent says so honestly
("Connect Gmail to let me use your calendar for this") and does **not** invent data. **[GAP — enforce here:**
the email/calendar MCP tool wrapper must gate on this status before calling the provider API. No such tool
exists in `apps/lifenavigator-core-api/app/routers` yet.]

---

## 2. Email/calendar-derived facts are CANDIDATE until confirmed

**Rule.** Anything extracted from an email body or a calendar event is, by default, **`advisor_inferred`**
(tier 3) — never `user_confirmed` or `user_stated`. It is a _candidate fact_. It may be promoted to:

- `user_stated` only if the user types/says it directly in chat, or
- `user_confirmed` only if the user explicitly confirms it ("Yes, that's my mortgage payment").

A fact whose only source is "I read it in your inbox" is an **inference about** the user, not a statement **by**
the user — so it maps to `advisor_inferred` at most. The one exception: a fact the user themselves authored in
the source (e.g. an event _they created_ titled "Quit job 2026-09") may be treated as `user_stated`, by analogy
to the `authored → user_stated` branch at `my_life.py:122-123`.

**Enforced at:** the same provenance-assignment code path that My Life uses
(`my_life.py:120-127`). Email/calendar ingestion MUST write the per-item provenance object
(`my_life.py:138-143` shape) with `provenance_type` no higher than `advisor_inferred`, plus
`confidence < 1.0`, and `user_confirmed: false` on any derived assumption (matching the domain assumption
shape, e.g. `finance.py:504`). **[GAP — enforce here:** ingestion writer for email/calendar facts is not yet
implemented; it must set this tier at write time, not at render time.]

**Concrete enforcement test the sprint should add:** an integration test asserting that no email/calendar-sourced
fact is persisted with `provenance_type in ('user_confirmed','user_stated')` unless the user confirmation flag is
set. (Mirror the provenance-points-at-the-fact assertion style in
`apps/lifenavigator-core-api/tests/test_recommendation_evidence.py:46`.)

---

## 3. Provenance IDs must be attached (email_id / calendar_event_id)

**Rule.** Every email/calendar-derived fact MUST carry the source identifier so it can be traced and re-verified:

- email facts → `email_id` (Gmail message id / Graph message id)
- calendar facts → `calendar_event_id`

This mirrors how the explainable life graph requires real provenance + a citation id on every edge
(`apps/lifenavigator-core-api/app/services/life_graph_workspace.py:147-201`,
`app/routers/life_graph.py:4,42`) — no edge renders without provenance, and email/calendar facts get the same
treatment. The `core.integration_tokens.metadata` JSONB column (migration `011:18`) and the
`public.integrations.metadata` JSONB (`011:142-146`) exist for connection-level provenance; per-fact source ids
belong on the fact rows themselves.

**Enforced at:** the email/calendar ingestion writer. **[GAP — enforce here]** — store `email_id` /
`calendar_event_id` on every derived fact/assumption row; reject writes that lack it. The provenance object at
`my_life.py:138-143` should be extended with `source_ref: {kind: 'email'|'calendar', id: <id>}`.

**Why it matters:** without the source id, a derived fact can never be re-checked against the live mailbox, which
violates "No mock data — ever" the moment the underlying email is deleted or the claim drifts.

---

## 4. Sensitive data is summarized carefully; no unsupported claims

**Rule.** Email and calendar content is high-sensitivity (legal, medical, financial, relationships). When Arcana
surfaces it, it MUST:

1. Summarize, not dump raw bodies. Do not quote full email text into chat or store it verbatim beyond what is
   needed for the derived fact.
2. Make **no claim the source does not support.** If the email says "your appointment is Tuesday," the agent may
   not infer _why_ the appointment exists. This is the existing "no unsupported claims" discipline already applied
   to risks/opportunities and the north star (auto-memory `dashboard-trust-grounding`; generic-label gates in
   `my_life.py` around the `grounded_risks/grounded_opps` filter at `my_life.py:104-105`).
3. Respect the same domain guardrails: health-derived email/calendar facts inherit the wellness-not-medical
   stance (`app/domains/health.py:198-199`); finance-derived facts inherit "planning only" framing
   (`app/domains/family.py:222`, `app/domains/finance.py`).

**Enforced at:** the agent validator layer (hybrid advisor: rules guardrail → LLM leads → validator gates,
auto-memory `hybrid-advisor-layer`). The validator MUST reject any email/calendar-grounded assistant turn that
asserts a fact not present in the attached `source_ref`. **[GAP — enforce here:** add an email/calendar-source
check to the existing validator gate.]\*\*

---

## 5. NO writes to the user's email or calendar without explicit per-action approval

**Rule (hard).** Arcana/LIOS may **never** send an email, reply, delete, create/modify/delete a calendar event,
or otherwise mutate the user's external account without an explicit, per-action user approval at the moment of
the action. "The user connected Gmail" is consent to **read** within granted scopes — it is **not** standing
consent to **act**.

**Current scope reality (file:line):** the OAuth scope catalog already includes _write/send_ scopes —
`gmailSend`, `gmailCompose`, `gmailModify`, `gmail` (full), and `calendarEvents` / `calendar` (full)
(`apps/web/src/lib/integrations/google/oauth.ts:23-26, 18-19`). The default bundles are conservative
(`SCOPE_BUNDLES.calendar` is read + events, `gmail` is readonly + send — `google/oauth.ts:103-106`), but the
machinery to _act_ exists. That makes this rule load-bearing.

**Enforcement requirements:**

- **Prefer read-only scopes at connect time.** For pilot, request `calendarReadonly` and `gmailReadonly`
  bundles only; do not request `gmailSend`/`calendar` write scopes unless a feature truly needs them. This is a
  choice made in the bundles passed to the initiation route (`oauth/google/route.ts:29-30,41-46`).
- **No write path may execute on the LLM's say-so.** The platform's standing rule is "LLM never writes DB"
  (auto-memory `hybrid-advisor-layer`); extend it: _the LLM never writes the user's external account either._
  Any send/modify must be a deterministic, separately-authorized action with a fresh user click.
- **[GAP — enforce here]** there is currently no send/calendar-write route under
  `apps/web/src/app/api/integrations/` and no such tool in core-api. When one is added it MUST require a
  per-action confirmation token and MUST be excluded from any autonomous/agentic loop.

Streaming UX note: the advisor already only _simulates_ typing of already-approved text and never auto-executes
(auto-memory `arcana-streaming-ux`). Email/calendar actions follow the same "approve, then act" model.

---

## 6. Token handling rules that this policy depends on

(Full audit in `INTEGRATION_SECURITY_REPORT.md`.) Summary the agent layer relies on:

- Access/refresh tokens are encrypted at rest with AES-256 (`core.encrypt_text`, pgcrypto `pgp_sym_encrypt`,
  migration `009_mvp_ingestion_pipeline.sql:23-36`).
- Tokens are read only via a service-role-only RPC (`core.get_integration_token`, migration
  `051_token_retrieval.sql:6-55`), never by the browser.
- OAuth client secrets are server-only (`process.env.GOOGLE_CLIENT_SECRET` /
  `MICROSOFT_CLIENT_SECRET` in route handlers only — no `NEXT_PUBLIC_` variant exists).

The agent must obtain provider data through a server-side, service-role-scoped path — never by handling raw
tokens in any client-reachable code.

---

## 7. Enforcement checklist for the sprint

- [ ] Email/calendar MCP tool gates on `public.integrations.status='connected'` before any provider call (Rule 1).
- [ ] Ingestion writer tags every derived fact `provenance_type ≤ advisor_inferred`, `user_confirmed=false` (Rule 2).
- [ ] Every derived fact carries `source_ref {kind,id}` (email_id / calendar_event_id); writes without it are rejected (Rule 3).
- [ ] Validator rejects assistant turns asserting facts absent from the attached source (Rule 4).
- [ ] Connect with read-only scopes for pilot; no send/calendar-write route in any agentic loop (Rule 5).
- [ ] Integration test: no email/calendar fact persisted at `user_confirmed`/`user_stated` without confirmation flag (Rule 2).
