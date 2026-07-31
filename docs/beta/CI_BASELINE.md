# CI Baseline — inventory and gaps

**Date:** 2026-07-30 · Machine-readable: `artifacts/ci/required_checks.json` ·
Enforced by: `apps/lifenavigator-core-api/tests/test_required_checks.py` (34 tests)

## Workflow inventory

| Workflow             | Triggers           | Jobs                           | Permissions                |
| -------------------- | ------------------ | ------------------------------ | -------------------------- |
| `ci.yml`             | push, pull_request | 13                             | **`<default>` — gap CI-3** |
| `deploy-fly.yml`     | push, pull_request | 7 (3 test, 3 deploy, 1 filter) | `contents: read` ✅        |
| `security-audit.yml` | schedule, dispatch | 2                              | **`<default>` — gap CI-3** |
| `advisor-eval.yml`   | workflow_dispatch  | 1                              | `contents: read` ✅        |
| `stale.yml`          | schedule           | 1                              | scoped ✅                  |

## Critical property → enforcing job

| Property                     | Job                               | Conditional?            | Secrets? |
| ---------------------------- | --------------------------------- | ----------------------- | -------- |
| Formatting / static analysis | `Lint`, `Type Check`              | no                      | no       |
| Unit tests (web)             | `Unit Tests`                      | no                      | no       |
| **Architectural invariants** | **`Architectural Invariants`**    | **no**                  | **no**   |
| Tenant isolation             | inside `Architectural Invariants` | no                      | no       |
| Generated-manifest drift     | `Check ingestion-worker`          | **YES — path-filtered** | no       |
| core-api integration         | `Test core-api`                   | **YES — path-filtered** | no       |
| Worker tests                 | `Check ingestion-worker`          | **YES — path-filtered** | no       |
| Migration validation         | `Validate Migrations`             | no                      | no       |
| Secret scanning              | `Secrets Scan`                    | no                      | no       |
| Dependency scanning          | `Dependency Audit`                | no                      | no       |
| Browser smoke                | `E2E Tests`                       | on PR/main              | **yes**  |
| Build/package                | `Build`                           | no                      | yes      |

## Gap status (updated 2026-07-30, Prompt 2A.1)

| Gap                                   | Status                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| **CI-1** unpinned mutable action refs | ✅ **CLOSED** — all 3 pinned to immutable SHAs; contract now asserts **zero** mutable refs |
| **CI-3** default workflow permissions | ✅ **CLOSED** — every workflow declares `permissions:`; contract asserts zero missing      |
| CI-2 manifest drift path-filtered     | open, mitigated + regression-guarded                                                       |
| CI-4 no unconditional worker job      | open                                                                                       |
| CI-5 deploy gating                    | no action needed                                                                           |

### Pins applied (B-19)

| Action          | Was       | Now                                                                                                                                                                                                 |
| --------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| trufflehog      | `@main`   | `@6f3c981e…` (v3.96.0)                                                                                                                                                                              |
| setup-flyctl ×3 | `@master` | `@ed8efb33…` (v1.6)                                                                                                                                                                                 |
| rust-toolchain  | `@stable` | `@e97e2d8c…` (v1) **+ explicit `toolchain: stable`** — for this action the branch name doubles as the toolchain selector, so a naive SHA pin would have silently changed which Rust version CI used |

## Gaps (original)

**CI-1 · Unpinned third-party actions on MUTABLE refs — HIGH.**
`trufflesecurity/trufflehog@main`, `superfly/flyctl-actions/setup-flyctl@master`,
`dtolnay/rust-toolchain@stable`. A compromised upstream executes in CI with repository access on the
next run. **Now guarded**: `test_known_unpinned_actions_are_declared_not_discovered` fails if a new
one appears _or_ if one is fixed and left stale in the list. Pinning to SHAs is a separate reviewable
change, deliberately not bundled here.

**CI-2 · Manifest drift gate is path-filtered — MEDIUM.**
`manifest_on_disk_matches_the_registry` lives in the worker job, gated on
`apps/ingestion-worker/**` plus the manifest path. Mitigated (the manifest path _is_ in the filter, and
the Python reader is covered by `test-core-api`), and now regression-guarded by
`test_manifest_path_is_covered_by_the_worker_filter`.

**CI-3 · Two workflows inherit default permissions — MEDIUM.** `ci.yml`, `security-audit.yml`.
Guarded so the set cannot grow; fixing the two existing is a reviewable change.

**CI-4 · No unconditional worker test job — LOW.** Worker tests only run when worker paths change.

**CI-5 · Deploy jobs correctly gated** to `push` + `main` and are not required checks. No action.

## Checks that can silently skip

`Test core-api`, `Test api-gateway`, `Check ingestion-worker` — all path-filtered. **None is proposed
as a required check**, precisely because a required check that skips creates an ambiguous merge state.
The unconditional `Architectural Invariants` job covers the invariant subset regardless of paths.

## Duplicate / conflicting

None found. `Dependency Audit` (ci.yml, per-PR) and `Dependency Security Audit` (security-audit.yml,
scheduled) overlap in intent but differ in trigger and severity threshold — complementary, not
conflicting.
