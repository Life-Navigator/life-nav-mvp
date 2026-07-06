# P0 ONBOARDING UPLOAD LOOP — Preselect + Return to Advisor — 2026-06-10

Live on production (`app.lifenavigator.tech` @ `00771c7`). Onboarding UX + routing/state only — no
GraphRAG / AI / recommendation / finance-math changes.

## Files Changed

- `src/app/dashboard/documents/page.tsx` — read `?domain&doc_type&return_to&reason&unlock`; preselect
  doc type; "Your advisor requested this document" banner (reason + unlocks); always-on PII warning;
  full grouped doc-type catalog; on successful upload redirect to `return_to` with
  `?uploaded=1&uploaded_domain=…(&uploaded_doc_id)`; honest pending state when 0 fields extracted.
- `src/app/dashboard/advisor/page.tsx` — on `?uploaded=1` show "Got it — your {domain} document was
  added", call `loadCoverage()`, and clean the URL (keep `?onboarding=1`).
- `src/components/dashboard/AdvisorOnboarding.tsx` — upload CTAs append `reason` (why_it_matters) +
  `unlock` (what_it_unlocks) to the documents href.
- `src/proxy.ts` — **gate fix:** exempt `/dashboard/documents` (alongside `/dashboard/advisor`) from the
  advisor-first redirect during onboarding. Without this the upload CTA bounced straight back to the
  advisor (dead-end) because the gate redirects all `/dashboard/*` while `onboarding_completed=false`.

## Query Parameters Supported

`domain`, `doc_type`, `return_to`, `reason`, `unlock` (read on the documents page).
Return params to advisor: `uploaded=1`, `uploaded_domain`, `uploaded_doc_id` (when the API returns one).

## Document Types Supported

- **Finance:** 401k_statement, pay_stub, tax_return, bank_statement, investment_statement, insurance_policy, mortgage_statement, social_security_estimate
- **Career:** resume, offer_letter, employment_contract
- **Education:** transcript, degree_plan, tuition_bill, acceptance_letter, financial_aid_letter
- **Health:** lab_report, insurance_card, medication_list
- **Family:** estate_plan, will, trust, beneficiary_document, life_insurance_policy
- **Other:** other (+ any unrecognized `doc_type` from the query is still shown selected)
  Upload always persists via the existing `/api/documents`; when 0 fields are extracted the UI shows
  "Document uploaded. We'll use it once processing finishes." (no hallucinated extraction).

## Upload Success Flow

Upload/extract → `/api/documents` (Core API) → result rendered → if `return_to` present, show
"Got it — taking you back to your advisor…" → redirect to
`/dashboard/advisor?onboarding=1&uploaded=1&uploaded_domain=<domain>(&uploaded_doc_id=<id>)`.

## Advisor Return Flow

Advisor reads `uploaded=1` on mount → success banner "Got it — your {domain} document was added. I've
refreshed what I know." → `loadCoverage()` re-fetches discovery coverage → URL cleaned to `?onboarding=1`.
The advisor remounts fresh (discovery-chat reopens from current state), so onboarding continues from the
next relevant question. No hallucinated extraction; pending uploads are acknowledged honestly.

## PII Warning Status

Always shown above the upload controls (kept verbatim): "Please avoid uploading documents with Social
Security numbers, full account numbers, or highly sensitive identifiers unless necessary. During beta,
use redacted documents when possible." Existing server-side PII safeguards in `/api/documents` are unchanged.

## Browser Validation Results (preview `00771c7` + production)

1. Persona → advisor (full-screen) ✅
2. Advisor shows upload action card (href `/dashboard/documents?domain=finance&doc_type=retirement_statement&return_to=…&reason=…&unlock=…`) ✅
3. Click upload CTA → **lands on /dashboard/documents** (gate no longer bounces) ✅
4. **doc_type preselected** (`retirement_statement` / `401k_statement`) ✅
5. **Request banner** ("Your advisor requested…" + Unlocks) + **PII warning** present ✅
6. Paste text + Extract → result → **redirect back to advisor** ✅
7. Advisor shows **"document was added"** banner; coverage refreshed; URL cleaned ✅
8. Production smoke: documents reachable + preselect + banner + PII ✅

- Screenshots: `reports/browser-validation/latest/upload-loop/{2-documents-preselected,3-upload-success,4-advisor-return}.png`
- (Test note: the banner header uses CSS `uppercase`; Playwright `innerText()` returns it uppercased — verified via the "Unlocks:" line which renders only in that banner.)

## Remaining Upload Loop Gaps

- **uploaded_doc_id:** `/api/documents` (Core API proxy) may not return a document id; the loop passes
  `uploaded_domain` + `uploaded=1` regardless (advisor refreshes coverage), and `uploaded_doc_id` only
  when present. Surfacing a real id is a Core API change.
- **Context-panel live refresh:** the advisor refreshes discovery _coverage_ on return; the chat context
  panel updates on the next turn (advisor remounts). A push refresh of the panel mid-session is a polish item.
- **Family manual-entry** still upload-only (no AddDataModal family domain).
- **Auto file→advisor:** the file-upload path also redirects on success (same effect); a per-doc-type
  drop zone is a future refinement.

## Definition of Done — status

✅ Advisor upload CTAs preselect the right document type. ✅ Documents page explains why it was requested
(+ unlocks + PII). ✅ Upload persists. ✅ Successful upload returns the user to the advisor. ✅ Advisor
acknowledges the upload. ✅ Coverage/context refreshes. ✅ No upload CTA dead-ends the user (gate exempts
the documents route during onboarding).
