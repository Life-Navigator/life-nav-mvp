# Security Actions Pending

**Date:** 2026-06-16 · Documentation only — **not** executed during the cutover (no rotation performed).

## Pending actions (before external pilot users are invited)

1. **Rotate the Supabase service-role + anon keys.** The dev keys in `/tmp/sweep_creds.txt` were used for live smoke (user minting) during this work and the service-role key was briefly printed in a prior session's output. Rotate in Supabase dashboard → Settings → API. (Tracked since `docs/pilot-p0/SECURITY_TOKEN_ROTATION_NOTE.md`, status `DEFERRED_UNTIL_AFTER_CURRENT_WORK`.)
2. **Rotate any temporary development credentials** issued during this program (Supabase PAT pasted earlier in the session; any short-lived Vertex `VERTEX_ACCESS_TOKEN` if it was ever set as a secret — confirmed **not** set on the Fly app today).
3. **Verify secrets management.** Fly secrets confirmed present (infra only): `SUPABASE_*`, `GEMINI_API_KEY`, `NEO4J_*`, `QDRANT_*`, `ALLOWED_ORIGINS`, `ENVIRONMENT`, `ADMIN_EMAILS`. No advisor/model flags set (defaults: Gemini Flash, router off, premium gated). Gemini key remains backend-only (not on Vercel) — confirm this still holds after the web deploy.
4. **Confirm no development credentials remain exposed.** Repo is clean (`git grep` finds no `sbp_`/service keys committed). Remove `/tmp/sweep_creds.txt` from the working machine after the smoke harnesses are no longer needed.

## Owner action

**Timothy** — rotate the Supabase keys (and any dev credentials) before inviting external pilot users. None of these block the cutover; the platform is functioning. Document completion here when done.

## Not done in this cutover (by design)

No keys were rotated during the cutover (rotation mid-cutover could break the running services). This file is the record; rotation is a separate, deliberate step.
