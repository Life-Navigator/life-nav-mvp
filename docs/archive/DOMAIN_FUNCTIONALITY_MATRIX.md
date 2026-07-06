# DOMAIN FUNCTIONALITY MATRIX — Pilot Functional Completion — 2026-06-10

Deliverable 1. Audit of what each domain tab can actually DO today (Real Data / Data Entry / Documents /
Reports), after the framework rollout. Source: code audit of `/api/*` routes + the report engine + the
domain entry UIs. **Key finding: data-entry exists for Career/Education/Health(vitals); the report PDF
pipeline already works for finance/compensation/family/education/full; Family has NO entry endpoints.**

Legend: ✅ COMPLETE · ◐ PARTIAL · ○ EMPTY (honest shell) · ✗ BROKEN. Priority: P0 pilot-blocking, P1, P2.

## Cross-cutting capabilities (today)

- **Documents:** ✅ `/api/documents` (upload + register) proxies Core API for ALL domains + doc types.
- **Reports PDF:** ✅ `/api/reports/{type}/pdf` → Core API → WeasyPrint. Real types: `full, financial, compensation, family, education, decision`. (No `health` / dedicated `career`/`finance-only` type yet.)
- **Report hub:** ✅ `/dashboard/reports` already downloads all 6.

## CAREER (data-entry ✅, reports ✅ via compensation)

| Tab                     | Real Data              | Data Entry                   | Documents                  | Reports                            | Status                        | Pri |
| ----------------------- | ---------------------- | ---------------------------- | -------------------------- | ---------------------------------- | ----------------------------- | --- |
| Overview                | ✅ /api/career/summary | —                            | —                          | —                                  | ✅                            | —   |
| Experience              | ◐ (profile)            | ✅ PUT /api/career/profile   | —                          | —                                  | ◐ wire add UI to tab          | P1  |
| Skills                  | ◐                      | ✅ (profile)                 | —                          | —                                  | ◐                             | P1  |
| Certifications          | ◐                      | ✅ POST applications/resumes | ✅                         | —                                  | ◐                             | P1  |
| Compensation            | ◐                      | ✅ (profile: salary/target)  | —                          | —                                  | ◐ wire                        | P1  |
| Documents               | —                      | —                            | ✅ /api/data/career/upload | —                                  | ✅ (upload works; tab=honest) | P1  |
| Reports                 | —                      | —                            | —                          | ✅ **wired (compensation + full)** | ✅ **Phase 1**                | —   |
| Analysis/Goals/Settings | ○                      | —                            | —                          | —                                  | ○ honest                      | P2  |

## EDUCATION (data-entry ✅, reports ✅)

| Tab                   | Real Data                               | Data Entry                                | Documents                                  | Reports                         | Status         | Pri |
| --------------------- | --------------------------------------- | ----------------------------------------- | ------------------------------------------ | ------------------------------- | -------------- | --- |
| Overview              | ✅ aggregates records/certs/courses     | —                                         | —                                          | —                               | ✅             | —   |
| Courses               | ✅ GET                                  | ✅ POST/PUT/DELETE /api/education/courses | ✅                                         | —                               | ◐ wire tab     | P1  |
| Certifications        | ✅                                      | ✅ POST + Credly sync                     | ✅                                         | —                               | ◐              | P1  |
| Degrees               | ◐ (records)                             | ✅ POST /api/education/records            | ✅                                         | —                               | ◐              | P1  |
| Documents             | —                                       | —                                         | ✅ /api/data/education/upload (transcript) | —                               | ✅             | P1  |
| ROI Analysis          | ○ (honest: needs program/cost/timeline) | —                                         | —                                          | ✅ via education report         | ◐              | P1  |
| Reports               | —                                       | —                                         | —                                          | ✅ **wired (education + full)** | ✅ **Phase 1** | —   |
| Skills/Goals/Settings | ○                                       | —                                         | —                                          | —                               | ○ honest       | P2  |

## HEALTH (data-entry ◐ vitals, report ✗ no type)

| Tab                     | Real Data                           | Data Entry                                                | Documents | Reports                                 | Status     | Pri                     |
| ----------------------- | ----------------------------------- | --------------------------------------------------------- | --------- | --------------------------------------- | ---------- | ----------------------- |
| Overview                | ✅ /api/health/summary (beta-gated) | —                                                         | —         | —                                       | ✅         | —                       |
| Biometrics              | ◐                                   | ✅ POST /api/health-monitoring/manual-entry (vitals/body) | ✅        | —                                       | ◐ wire tab | P1                      |
| Fitness/Nutrition       | ◐                                   | ✅ daily_wellbeing entry                                  | ✅        | —                                       | ◐          | P1                      |
| Labs                    | ◐                                   | ✅ lab_result entry                                       | ✅ upload | —                                       | ◐          | P1                      |
| Medications             | ○                                   | ◐ external `/api/v1/health/*`                             | ✅ upload | —                                       | ◐          | P1                      |
| Documents               | —                                   | —                                                         | ✅        | —                                       | ✅         | P1                      |
| Reports                 | —                                   | —                                                         | —         | **✗ no `health` report type in engine** | ○ honest   | **P0 (build pipeline)** |
| Goals/Analysis/Settings | ○                                   | —                                                         | —         | —                                       | ○ honest   | P2                      |

## FAMILY (data-entry ✗ none, reports ✅)

| Tab                 | Real Data              | Data Entry        | Documents | Reports                      | Status         | Pri                 |
| ------------------- | ---------------------- | ----------------- | --------- | ---------------------------- | -------------- | ------------------- |
| Overview            | ✅ /api/family/summary | —                 | —         | —                            | ✅             | —                   |
| Members             | ○                      | **✗ no endpoint** | —         | —                            | ○              | **P0 (build CRUD)** |
| Dependents          | ◐ (count in summary)   | **✗ no endpoint** | —         | —                            | ○              | **P0**              |
| Beneficiaries       | ◐ (flag in summary)    | **✗ no endpoint** | ✅ upload | —                            | ○              | **P0**              |
| Emergency Contacts  | ○                      | **✗ no endpoint** | —         | —                            | ○              | P1                  |
| Estate/Guardianship | ◐ (flags in summary)   | ✗                 | ✅ upload | —                            | ○ honest       | P1                  |
| Trusted Advisors    | ○                      | ✗                 | —         | —                            | ○ honest       | P2                  |
| Documents           | —                      | —                 | ✅        | —                            | ✅             | P1                  |
| Reports             | —                      | —                 | —         | ✅ **wired (family + full)** | ✅ **Phase 1** | —                   |

## FINANCE (reference — already complete)

Overview/Accounts/Transactions/Assets/Investments/Retirement ✅ real data; Documents ✅; Reports ✅
(financial + full via the hub). Reference implementation.

## Phase plan (this sprint)

- **Phase 1 (DONE this turn):** wire Career/Education/Family **Reports tabs to the real PDF pipeline** + this matrix.
- **Phase 2:** wire Career + Education + Health **data-entry into their tabs** (endpoints already exist) — parallel agents per domain.
- **Phase 3 (P0):** build **Family CRUD endpoints** (members/dependents/beneficiaries/emergency-contacts) + the **`health` report type** in `report_engine.py` (Core API).
- **Phase 4:** Document Intelligence Matrix (D6) + Report Engine Audit (D7) — parallel audit agents.
- **Phase 5:** Master Life Report (D8, the `full` report already exists — productionize sharing) + Dashboard V2 plan (D9) + Pilot Scorecard (D10).

## Top P0s

1. Family CRUD endpoints (4) — Family is read-only today; no member/dependent/beneficiary entry.
2. Health report type — the only domain with NO real report (others wired in Phase 1).
3. Wire existing data-entry UIs into the standardized domain tabs (Career/Education/Health) so each tab is "real data entry," not a link-out.
