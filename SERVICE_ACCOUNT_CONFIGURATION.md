# SERVICE_ACCOUNT_CONFIGURATION.md — Phase 4

SA reused: `lifenav-model-runtime@gen-lang-client-0849161409.iam.gserviceaccount.com`.

## Roles (least privilege)

- `roles/aiplatform.user` — call Vertex models.
- `roles/serviceusage.serviceUsageConsumer` — quota/usage.
- `roles/iam.workloadIdentityUser` — **granted to the federated principalSet**, not a user/key:
  `principalSet://iam.googleapis.com/projects/763004283556/locations/global/workloadIdentityPools/lifenav-fly/attribute.app_name/lifenavigator-core-api`

## Verified

`get-iam-policy` shows exactly the binding above; **0 user-managed keys** on the SA. No approval was required (owner has IAM admin).
