# Prompt 2B Runbook — what to do once credentials exist

Prompt 2A completed everything credential-independent. **Prompt 2 remains INCOMPLETE.** Its preview,
branch-protection, credential-rejection, and external-rollback exit gates are operationally unverified.

## Preconditions (all external)

| #   | Precondition                                     | Owner        | Evidence required                                  |
| --- | ------------------------------------------------ | ------------ | -------------------------------------------------- |
| P1  | Exposed credentials rotated                      | Security     | **live rejection of the old credential**, recorded |
| P2  | Preview Supabase/Qdrant/Neo4j/bucket provisioned | Platform Ops | resource ids, isolated from prod                   |
| P3  | Preview secrets as GitHub environment secrets    | Platform Ops | environment named `preview`                        |
| P4  | Branch protection enabled with the ten checks    | repo admin   | PR screenshot showing all ten                      |
| P5  | `gh` authenticated                               | Eng Lead     | draft PR URL                                       |

## Ordered steps

1. Verify P1 with an authentication attempt that **must be rejected**. Do not proceed on assumption.
2. Add a `preview` GitHub environment; attach P3 secrets. Never reuse production values.
3. Add a preview deploy job to `deploy-fly.yml`, gated on `pull_request`, targeting `-preview` apps.
4. **Write the production-identifier guard** (`PREVIEW_ENVIRONMENT_REQUIREMENTS.md` §3) and
   mutation-prove it by pointing preview config at a production id — it must fail.
5. Implement the seed command against preview stores only; verify counts.
6. Implement J1–J5 browser smoke against the preview URL.
7. **Exercise rollback outside production** — deploy a known-bad revision to preview, roll back,
   reconcile. Record it. This is the exit item most likely to be skipped.
8. Set `branch_protection_active: true` only after P4, with the PR link.

## Prompt 2 exit gate — current status

| Gate                                                 | Status                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fresh checkout runs the documented path              | ⚠️ **partial** — install works; no verification command; `pnpm test` red (F-1, F-2) |
| A PR produces an isolated preview                    | ❌ **blocked** — no preview exists                                                  |
| Security-critical checks block merging               | ❌ **blocked** — checks specified and validated; branch protection is admin-side    |
| No production secret or data used                    | ✅ **satisfied**                                                                    |
| Rollback documented and exercised outside production | ⚠️ documented, **not exercised**                                                    |
