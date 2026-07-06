# VERTEX_SERVICE_ACCOUNT_SETUP.md — Phase 1

Owner-run (gcloud CLI token is currently expired in this env; re-auth first: `gcloud auth login`). Project `gen-lang-client-0849161409`, region `us-central1`, SA `lifenav-model-runtime`.

## Detect-and-reuse, then create if absent

```bash
gcloud config set project gen-lang-client-0849161409
SA="lifenav-model-runtime@gen-lang-client-0849161409.iam.gserviceaccount.com"

# Reuse if it already exists; else create
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 \
  || gcloud iam service-accounts create lifenav-model-runtime \
       --display-name="LifeNavigator Model Runtime"

# Least-privilege roles
gcloud projects add-iam-policy-binding gen-lang-client-0849161409 \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding gen-lang-client-0849161409 \
  --member="serviceAccount:$SA" --role="roles/serviceusage.serviceUsageConsumer"
```

## Verify

```bash
gcloud projects get-iam-policy gen-lang-client-0849161409 \
  --flatten="bindings[].members" \
  --filter="bindings.members:lifenav-model-runtime" \
  --format="table(bindings.role)"
```

Expect `roles/aiplatform.user` + `roles/serviceusage.serviceUsageConsumer`. Nothing broader (least-privilege).
