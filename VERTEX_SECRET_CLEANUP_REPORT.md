# VERTEX_SECRET_CLEANUP_REPORT.md — Phase 8

## Local credential hygiene (verified this environment)

- No SA key materials present locally: `/tmp/lifenav-model-runtime.json`, `*.b64`, `/tmp/gcp-sa.json` → **none** (the owner hasn't generated a key yet; the runtime materializes `/tmp/gcp-sa.json` only inside the Fly container).
- **No credential files tracked in git** (`git ls-files` clean of `*sa.json`/`*.b64`/`credentials.json`).
- `.gitignore` now blocks `*-sa.json`, `gcp-sa.json`, `lifenav-model-runtime*.json`, `service-account*.json`, `*.b64`.

## Owner cleanup checklist (after Phase 3 upload)

```bash
shred -u /tmp/lifenav-model-runtime.json /tmp/lifenav-model-runtime.b64 2>/dev/null \
  || rm -f /tmp/lifenav-model-runtime.json /tmp/lifenav-model-runtime.b64
history -c 2>/dev/null   # if the base64 was ever echoed
```

- Confirm the key exists ONLY in Fly's encrypted secret store (`flyctl secrets list` shows the name, never the value) and the container tmpfs.
- The materializer never logs the secret (only `project_id`).

## Rotation plan

- **Cadence:** rotate the SA key every 90 days, or immediately on suspected exposure.
- **Procedure:** create a new key → `fly secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON=<new b64>` → `flyctl deploy` → `gcloud iam service-accounts keys delete <OLD_KEY_ID> --iam-account=lifenav-model-runtime@…`.
- **Eliminate rotation:** migrate to Workload Identity Federation (VERTEX_CREDENTIAL_STRATEGY.md) — no key, nothing to rotate.

## Status: local hygiene clean; owner cleanup + rotation documented for post-upload.
