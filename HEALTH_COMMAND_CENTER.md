# Health Command Center — Sprint C

**Grounded finding.** A Health "Command Center" can be assembled almost entirely from data that already exists. Two live engines — `HealthIntelligenceService` (`apps/lifenavigator-core-api/app/services/health_intelligence.py`, exposed at `GET /v1/health/intelligence`) and `HealthService` (`apps/lifenavigator-core-api/app/domains/health.py`, exposed at `GET /v1/health/summary` and `/recommendations`) — together already produce a readiness score, lab-marker flags, supplements/medications, fitness & nutrition, sleep/activity summaries, and evidence-backed wellness recommendations. The job for Sprint C is **surfacing, not building**: route this existing intelligence into the canonical `/dashboard/healthcare` tabs (which today mostly render `HealthTabEmpty`), and give every section honest Empty / In-Progress / Complete states with zero dead ends. The only genuinely missing infra-free work is two thin Next.js proxies and removing three broken POST targets in the Add form.

---

## Command Center information architecture (reuse-first)

The canonical shell already exists: `DomainLayout` + `DomainOverview` from `@/components/domain/framework`, configured by `apps/web/src/components/domain/configs/health.ts`. Keep the shell; rewire the tabs.

| Command Center section        | Backing data (exists today)                              | Source file / endpoint                                        | Surfacing change                                                                                                 |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Health Readiness** (hero)   | `readiness.score` + `status` band                        | `health_intelligence.py:81`; `GET /v1/health/intelligence`    | Add a readiness ring to Overview hero; reuse `DomainOverview` `confidence_pct` slot.                             |
| **Risk Flags**                | outside-range lab markers                                | `health_intelligence.py:79,106-108`                           | Surface as Overview "needs attention" + Labs/Analysis tab. Never diagnose — show `ideal` range + clinician note. |
| **Sleep**                     | `avg_sleep_hours`, `nights_logged`, `target_sleep_hours` | `domains/health.py:96-99`; `GET /v1/health/summary`           | Overview metric card + Biometrics tab section.                                                                   |
| **Fitness**                   | `_fitness()` (weekly workouts, goal) + `workout_logs`    | `health_intelligence.py:115-121`                              | Fitness tab reads `/intelligence.fitness`.                                                                       |
| **Nutrition**                 | `_nutrition()` (calories/macros) + nutrition rec         | `health_intelligence.py:123-128`; `domains/health.py:238-252` | Nutrition tab reads `/intelligence.nutrition`.                                                                   |
| **Labs**                      | 8 markers vs reference ranges                            | `health_intelligence.py:97-113`; `REF`                        | Labs tab renders marker table (already coded in orphan page).                                                    |
| **Medications & Supplements** | record-only lists + clinician notes                      | `health_intelligence.py:84-87`                                | Medications tab reads `/intelligence`.                                                                           |
| **Body Composition**          | `body_metrics` table                                     | `migrations/119:121-129`                                      | Biometrics tab; needs a `body` read added to `_LISTS` (`health_domain.py:55`).                                   |
| **Preventative Care**         | (no backend)                                             | `components/health/preventive/*`                              | Honest "In progress" empty; do NOT fabricate screenings.                                                         |
| **Health Documents**          | `documents` schema extraction                            | `health_intelligence.py:56-63`                                | Documents tab shows extracted doc-types; upload deep-links to `/dashboard/documents?domain=health`.              |
| **Connected Sources**         | wearable-event API + alert engine                        | `api/health-monitoring/*`, `lib/health-monitoring/*`          | Honest "Connect a source" empty; manual entry is the live path today.                                            |
| **Goals**                     | `health_goals` table + `POST /v1/health/goal`            | `migrations/119:26-38`                                        | Goals tab: list (needs `goals` read proxy) + add via existing write.                                             |
| **Recommendations**           | evidence-backed wellness recs                            | `domains/health.py:135-165`; `GET /v1/health/recommendations` | Recommendations tab reads real recs (currently `HealthTabEmpty`).                                                |

---

## Per-section state machine (Empty / In-Progress / Complete)

Every section must define all three states. The shared `DomainEmptyState` (used by `HealthTabEmpty.tsx`) already gives a clean Empty pattern (missing list + unlocks + single next action). Extend the same component to read live data for In-Progress / Complete.

### Health Readiness

- **Empty:** "Add health info to see your readiness." → CTA `/dashboard/healthcare/add`. (`readiness.score` low, `in_place` empty.)
- **In-Progress:** ring at computed score, band yellow/orange, "X of 5 inputs in place" (`readiness.in_place` / `missing`).
- **Complete:** green band ≥80, "Your health picture is well-organized."

### Labs / Risk Flags

- **Empty:** `labs.note` "Upload a recent lab report to track your markers." → upload deep-link (`HealthTabEmpty` labs copy already correct).
- **In-Progress:** `within_range / tracked` marker table; outside-range chips amber with `ideal` + "discuss with your clinician" (`labs.note`).
- **Complete:** all tracked markers in range; medical-safety note persists. **Never** a green "all clear" without the boundary disclaimer (`_MEDICAL`, `health_intelligence.py:17`).

### Sleep / Fitness / Nutrition / Biometrics

- **Empty:** per-tab `note` ("Add a fitness plan…", "Add a nutrition log…") + Add CTA.
- **In-Progress:** show the metric(s) present + the wellness recommendation if fired (e.g. "Improve your sleep consistency", `domains/health.py:209`).
- **Complete:** metric meets target (`status: green`), trend if multiple logs.

### Recommendations

- **Empty:** "No recommendations yet — they appear as your health picture fills in." (already in `healthcare/page.tsx:186`).
- **In-Progress/Complete:** list real recs with `why_it_matters`, evidence, and the medical AdviceBoundary badge (every rec carries `governance_verdict`, `domains/health.py:162`).

### Documents

- **Empty:** PHI privacy warning (already in `HealthTabEmpty.tsx:106`) + upload CTA.
- **In-Progress/Complete:** list extracted doc-types from `_facts()` with "Re-upload / View" — no dead ends.

### Connected Sources / Preventative Care (honest gaps)

- **Empty only (no fabrication):** "Manual entry is available today; wearable sync is in progress." Manual-entry path links to Add. No fake device list, no fake screening schedule.

---

## Zero-dead-end checklist

1. **Fix broken Add submissions:** `healthcare/add/page.tsx:103-119` POSTs to `/api/v1/health/medications|appointments|vitals` — no matching backend writes (`health_domain.py` only has profile/goal/habit/check-in). Either add the proxies/writes or restrict the form to supported entities (insurance, goal, sleep check-in). Today these silently fail.
2. **Retire dead client:** `apps/web/src/lib/api/health.ts` calls 12 endpoints (`/overview`, `/vitals`, `/sleep`, `/goals`, …) that have **no route handlers**. Remove or point at the two real proxies.
3. **Promote the orphan page:** `/dashboard/health-intelligence` is not in `healthDomain.nav`. Fold its component into the **Analysis** tab (and/or a **Readiness** tab) so the readiness/lab intelligence is reachable.
4. **Add two thin proxies** (no infra): `/api/health/recommendations` → `GET /v1/health/recommendations`; `/api/health/goals` → `GET /v1/health/goals`. Mirror the existing `api/health/summary/route.ts` pattern exactly.
5. **Every Empty state** keeps the medical-safety footer (`HealthTabEmpty.tsx:119`) and a single, real CTA.

## Definition of done

- All 13 nav tabs render real data when present and a real Empty state when absent — **none** render a placeholder that ignores existing data.
- Readiness score + lab flags are visible from the canonical nav (not only the orphan route).
- Add form has zero failing submissions.
- No fabricated vitals, medications, screenings, or device data anywhere (honor the "No mock data — ever" rule).
- Medical-safety boundary present on every health surface (`_MEDICAL` / `medical_boundary`).
