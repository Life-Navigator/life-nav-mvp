# Report Excellence Report — Elite Pilot Hardening

**Verdict (1 line):** The core-api report engine is genuinely boardroom-grade — branded WeasyPrint PDFs, real evidence-grounded data, citations, disclaimers, reproducible hashing — but it's undermined by a duplicate/abandoned scenario-lab PDF path, missing Share UI, and copy that overpromises features not yet shipped. **Score: 7/10.**

---

## What report surfaces actually exist (cited, real state)

There are **two parallel report systems** in this repo, and that's the central problem.

### System A — Core-API Universal Report Engine (the real, elite one)

- **Entry (frontend):** `apps/web/src/components/domain/framework/DomainReports.tsx:29` -> `GET /api/reports/{type}/pdf`.
- **Proxy route:** `apps/web/src/app/api/reports/[type]/pdf/route.ts:23` — JWT-authed, streams PDF from `${CORE_API}/v1/reports/{type}/pdf`. No fabrication.
- **Backend route:** `apps/lifenavigator-core-api/app/routers/reports.py:53` — builds a `ReportDefinition`, renders via `render_report_pdf`.
- **Engine:** `apps/lifenavigator-core-api/app/services/report_engine.py` — `UniversalReportEngine.build()` (line 93) composes 7 types: full, financial, education, decision, compensation, family, health (`REPORT_TYPES`, line 38).
- **Renderer:** `apps/lifenavigator-core-api/app/services/pdf_renderer.py` — branded WeasyPrint HTML/CSS->PDF; bespoke advisor-grade "Life Briefing" for full/financial (`_full_html`, line 155) + generic renderer for the rest.
- **Charts:** `apps/lifenavigator-core-api/app/services/charts.py:26` — real pure-Python SVG (bar/radar/range/line/timeline/goal), built only from cited series. No invented data.
- **Sharing backend:** `apps/lifenavigator-core-api/app/services/sharing.py:21` — governed share tokens, audience-aware redaction (advisor/cpa/attorney/parent/spouse), consent ledger + access audit log.

This system leads full/financial reports with an Executive Briefing (`_advisor_executive_section`, report_engine.py:196): readiness score, primary objective, prioritized recommendations with evidence + assumptions + confidence + source tables, top risks/opportunities, a 90-day Now/Next/Later plan, appendix. Navy->indigo gradient cover with big readiness score (pdf_renderer.py:113-121). Disclaimers present and domain-appropriate (attorney disclaimer on Family, `family/reports/page.tsx:28`). Reproducible: same inputs -> same `content_hash` (report_engine.py:62, timestamp neutralization at 33-36).

### System B — Scenario-Lab PDF (@react-pdf/renderer) — functional but orphaned

- **Renderer:** `apps/web/src/lib/scenario-lab/pdf/renderer.tsx` — complete 6-page executive PDF (cover, exec summary, key assumptions w/ source column, Monte-Carlo P10/P50/P90, roadmap, risk & resilience).
- **Trigger:** `apps/web/src/components/scenario-lab/ReportsTab.tsx:87` -> `POST /api/scenario-lab/reports/generate` (`.../generate/route.ts:24`) enqueues a `PDF` job.
- **Worker:** `apps/web/src/workers/scenario-lab-worker.ts:363` (`processPDFJob`) calls `renderScenarioReportPDF` (line 539).
- **PROBLEM:** worker has no deployment wiring — no script in `apps/web/package.json`, no `fly.toml` reference (grep-confirmed). Jobs likely never run in prod; the UI polls forever (`ReportRow.tsx:36`).

### Domain report pages (all real, link to System A)

- `app/dashboard/reports/page.tsx` (6 cards), `career/reports/page.tsx`, `education/reports/page.tsx`, `family/reports/page.tsx` — all use `DomainReports` -> System A, with honest "on the roadmap" notes.

### Not a report surface

- `app/dashboard/download/page.tsx` — desktop-app waitlist; mock (`:50-54` console.log + simulated success). Out of scope but stubbed.

---

## 5 ranked issues (file:line + fix)

**1. [P0] Orphaned scenario-lab PDF path enqueues jobs no worker runs in prod.**
`ReportsTab.tsx:87` + `apps/web/src/workers/scenario-lab-worker.ts` (no package.json/fly wiring). User clicks "Generate Report", sees `alert("queued")` (ReportsTab.tsx:101), waits forever.
Fix: deploy the worker, OR retire System B and point Scenario Lab at System A `decision` report (`/api/reports/decision/pdf`), which already renders scenarios from `decision.decisions`.

**2. [P0] Reports hub promises "Share" but there is no Share UI.**
`app/dashboard/reports/page.tsx:64-66`. Backend `POST /v1/reports/{type}/share` (reports.py:73) + full ShareService exist, but zero share UI in `app/dashboard`.
Fix: Add a Share button calling `/api/reports/{type}/share` with audience picker; surface link + expiry. Redaction/audit/consent already built.

**3. [P1] alert() for report status is not pilot-grade UX.**
`ReportsTab.tsx:101`. Fix: inline toast/status row; rely on existing `ReportRow` polling.

**4. [P1] Hub lists 6 types; backend supports 7 (health missing from hub).**
`reports/page.tsx:8-39` (no health) vs `REPORT_TYPES` (report_engine.py:38; route.ts:11 allows it). A working branded Health report is invisible. Fix: add health card or drop it from `REPORT_TYPES`; share one type list.

**5. [P2] Compensation report can silently degrade to "engine not wired."**
`report_engine.py:282-284` — if `self._comp is None`, renders a one-line "Not available / engine not wired" PDF. Career advertises Compensation as flagship (`career/reports/page.tsx:11-17`). Fix: startup assertion that advertised types resolve a real engine; render honest empty state instead of "engine not wired."

---

## Top 3 leverage upgrades

**1. Ship the Share flow.** The "forward to my CFO/attorney" moat — governed, redacted, audited — is already built on the backend. A small UI turns a PDF download into a defensible feature. Highest leverage.

**2. One-page "Executive Cover" tuned for forwarding.** The Life Briefing cover (pdf_renderer.py:170-180) is strong. Add user name, one-sentence headline verdict, and a short-link/QR to the live shared view. Make page 1 standalone-forwardable.

**3. Unify on System A; retire System B.** Two engines is a trust hazard (React-PDF path has no per-domain disclaimers, no Share, no reproducible hash, no live worker). Route all report generation — including Scenario Lab — through core-api.

---

## What's genuinely excellent

- **Evidence-grounded, no-mock discipline is real.** Every figure traces to a source_table; recs carry evidence + assumptions + confidence (report_engine.py:196-279); honest empties everywhere (pdf_renderer.py:228) instead of fabricated numbers.
- **Reproducibility.** content_hash with timestamp/ordering neutralization (report_engine.py:33-64) — "same inputs -> same report," a credibility feature advisors care about.
- **Branding & typography.** Navy->indigo gradient cover, big readiness score, pill status chips, evidence cards, monospace source tags, per-page footer disclaimers (`_full_css`). Boardroom-grade, not a CSV dump.
- **Narrative arc is correct.** Full/financial: situation (Life Model + Readiness) -> analysis (Recommendations + Evidence) -> next steps (90-Day Plan) -> appendix.
- **Disclaimers contextual** — mixed-domain on Full (report_engine.py:442), attorney on Family, "not admissions/financial/legal advice" on Education (pdf_renderer.py:440).
- **Governed sharing architecture** (redaction + consent ledger + access audit) is more sophisticated than most Series-A products. It just needs a UI.
