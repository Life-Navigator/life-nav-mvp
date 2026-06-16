# Health & Education Stub Report (P0-5)

**Date:** 2026-06-16 · **Goal:** no stub shown as live, no fake health numbers, no fake forms. For the pilot, **honest beats fake** — and Health must never show unsafe placeholder behavior.

## Reachability model (verified)

The live nav for both sections is the **config-driven `DomainSidebar`** (`DomainLayout` + `components/domain/configs/{health,education}.ts`). The legacy `HealthSidebar.tsx` / `EducationSidebar.tsx` were **dead code** (only referenced by their own files + a comment in the layouts that says "replaces HealthSidebar"). The stub routes below were therefore **orphaned** — reachable only by typing the URL, never from rendered nav — except Courses, which is in the education config nav.

## Actions taken

### Deleted (orphaned stubs — direct-URL only; removes fake-data/fake-form/unsafe render paths)

| id    | Route / file                                                                                     | Why it was unsafe-for-pilot                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| HE-1  | `app/dashboard/healthcare/overview/` + `components/health/overview/`                             | `HealthScore` had its fetch commented out, always `setData(null)`, but the render path invented 0-100 health scores                                |
| HE-2  | (same dir) `VitalsTrends`                                                                        | always `setData(null)`; render path fabricated HR/BP/SpO2 + clinical green/yellow/red status — unacceptable next to a "not medical advice" product |
| HE-3  | `app/dashboard/education/overview/`                                                              | "Coming Soon" page with a fake email form that only `console.log`'d the address                                                                    |
| HE-4  | `app/dashboard/education/path/`                                                                  | learning-path list hardcoded `[]`; "Create/Browse" buttons were `console.log` no-ops                                                               |
| HE-5  | `app/dashboard/education/progress/`                                                              | bare inline "Coming Soon" page                                                                                                                     |
| HE-7  | `app/dashboard/healthcare/preventive/`                                                           | stub list `[]`; buttons linked into other stubs                                                                                                    |
| HE-8  | `app/dashboard/healthcare/appointments/`                                                         | "New Appointment" submit wrote to **local React state only** — a booked appointment silently vanished on refresh (a trust break for a physician)   |
| HE-9  | `app/dashboard/healthcare/records/`                                                              | medical-records stub advertising imaging/lab/visit management that didn't exist                                                                    |
| HE-10 | `components/domain/health/HealthSidebar.tsx`, `components/domain/education/EducationSidebar.tsx` | dead legacy sidebars — the only internal link source to HE-1/3/4/5/7/8/9                                                                           |

**14 files removed in total.** Before deleting, verified (a) none are in the config nav, (b) no _surviving_ page links to any of them (the only inbound links to `/records` were from the also-deleted preventive/appointments pages), and (c) `components/health/overview` is imported by nothing outside the deleted overview route. The config nav "Overview" entries point at the real `/dashboard/healthcare` and `/dashboard/education` pages (not the deleted `/overview` routes), so nav is unaffected.

### Fixed in place (the one nav-reachable offender)

| id   | Route / file                               | Fix                                                                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HE-6 | `app/dashboard/education/courses/page.tsx` | Removed the no-op "Add Course Manually" fake button (`console.log('Add course modal')`). Kept the honest "Coming Soon" banner, the **working** "Join Waitlist" (real `/api/waitlist`), and the real "Connect Learning Platform" link to `/dashboard/integrations`. The empty state is now fully honest. |

## Verified-clean (no action — already honest, real data)

`/dashboard/wellness`, `/dashboard/health-intelligence`, `/dashboard/healthcare` (real `/api/health/summary` + "not medical advice" boundary), `/dashboard/education` (real record counts), and all the in-nav tabs that use `HealthTabEmpty` / `EducationTabEmpty` (biometrics, fitness, nutrition, labs, medications, documents, analysis, recommendations, goals; degrees, skills, career-alignment, ROI-analysis — ROI explicitly gated behind required inputs, never faked — recommendations, goals, settings, documents). Healthcare/education **reports** use the real PDF pipeline.

## Verdict

**No fake health numbers, no fake forms, no stub-as-live reaches a pilot user through the live nav.** The unsafe health render paths and the data-losing appointment form are deleted; the one in-nav stub (Courses) is now an honest empty state with a working waitlist.
