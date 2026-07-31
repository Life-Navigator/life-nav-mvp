# Required Checks — branch protection specification

**Branch protection is NOT active.** Enabling it needs repository-admin permission (B-17) and cannot
be claimed from the repository. `artifacts/ci/required_checks.json` holds `branch_protection_active:
false`, and a test fails if that is flipped without admin-side evidence.

## The ten checks to require on `main`

Use these names **exactly** — GitHub matches a required check by display name.

```
Architectural Invariants      ← the one that must never skip
Secrets Scan
Validate Migrations
Validate Ontology
Verify Governance Coverage
Lint
Type Check
Unit Tests
Dependency Audit
Build
```

## Do NOT require these

| Check                    | Why not                                                 |
| ------------------------ | ------------------------------------------------------- |
| `Test core-api`          | path-filtered; skipping a _required_ check is ambiguous |
| `Check ingestion-worker` | path-filtered                                           |
| `Test api-gateway`       | path-filtered                                           |
| `E2E Tests`              | needs secrets; would block fork PRs permanently         |

## Admin steps (not performed)

1. Settings → Branches → Branch protection rules → `main`
2. Enable **Require status checks to pass before merging**
3. Enable **Require branches to be up to date before merging**
4. Add the ten names above, exactly
5. Verify by opening a PR touching `apps/lifenavigator-core-api` and confirming all ten report
6. Only then set `branch_protection_active: true` in the manifest, with the PR link as evidence

## What protects the contract meanwhile

`test_required_checks.py` fails when a required job is **renamed**, **removed**, becomes
**conditional**, or **acquires a secret dependency** — the four ways branch protection silently
detaches. Proven by mutation: CI-MUT-2 (rename) and CI-MUT-3 (conditional) both go red.
