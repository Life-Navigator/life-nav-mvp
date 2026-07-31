# Preview Environment Requirements — specification only

**Nothing was provisioned. No rollback was exercised. No evidence of either is claimed.**

## Existing infrastructure (statically inspected)

| Artifact                               | State                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `apps/lifenavigator-core-api/fly.toml` | real; `GRAPH_GROUNDING_ENABLED = "false"`; 31 secrets by name           |
| `deploy-fly.yml`                       | deploys 3 Fly apps on push to `main` only                               |
| Vercel (web)                           | deploys from a separate repo/project per deployment topology            |
| Supabase migrations                    | `validate-migrations` (unconditional) + `deploy-migrations` (main only) |
| **Preview environment**                | **does not exist** — no per-PR isolated stack                           |

## Required isolated resources

| Resource          | Requirement                                   | Must NOT                            |
| ----------------- | --------------------------------------------- | ----------------------------------- |
| Postgres/Supabase | dedicated preview project                     | share a project ref with production |
| Qdrant            | dedicated collection **or** cluster, 3072-dim | write to `life_navigator`           |
| Neo4j             | dedicated database                            | use the `personal` production DB    |
| Object storage    | dedicated bucket                              | share the production bucket         |
| Fly apps          | `-preview` suffixed                           | reuse production app names          |
| Model provider    | separate key with its own budget              | share the production key            |

## Production-identifier guard — implementable now, in Prompt 2B

A CI check asserting no preview config references a production identifier:
`lifenavigator-core-api` (bare), the production Qdrant cluster id `85497db5-…`, the Neo4j database
`4f61c985`, or `lifenavigator.tech`. **Not written here** — it needs the preview config to exist to
test against, and a guard with nothing to guard is decoration.

## Prepared but unexercised

- **Seed:** deterministic synthetic personas exist (`docs/beta/personas/`, 5) and prior tooling created
  synthetic accounts. A seed command must target the preview stores only.
- **Smoke:** the five canonical journeys (`BETA_JOURNEY_MATRIX.md`). No E2E covers J1–J5 yet.
- **Teardown:** must delete preview stores on PR close; unimplemented.
- **Rollback:** Fly `flyctl releases rollback`; Vercel promote-previous; migrations expand/contract.
  **None exercised.** Exercising it outside production is a Prompt 2B exit item.

## Minimum credentials/admin actions for Prompt 2B

| #   | Action                                                        | Owner        |
| --- | ------------------------------------------------------------- | ------------ |
| 1   | Rotate exposed credentials; **prove old ones rejected** (D-1) | Security     |
| 2   | Provision preview Supabase project                            | Platform Ops |
| 3   | Provision preview Qdrant collection/cluster                   | Platform Ops |
| 4   | Provision preview Neo4j database                              | Platform Ops |
| 5   | Issue preview-scoped secrets as GitHub environment secrets    | Platform Ops |
| 6   | Enable branch protection with the ten required checks (B-17)  | repo admin   |
| 7   | Authenticate `gh` (or open the draft PR manually)             | Eng Lead     |

**Items 2–5 are the whole of Prompt 2B's blocking set.** Until they exist, "a PR produces an isolated
preview" cannot be satisfied or honestly claimed.
