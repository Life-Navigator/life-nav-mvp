# Security Token Rotation Note

**Status:** `DEFERRED_UNTIL_AFTER_CURRENT_WORK`
**Owner:** Timothy
**Date raised:** 2026-06-16

## Context

A Supabase token was **intentionally provided** to the development assistant for the current development work. It was supplied on purpose for active development and is **not** an accidental leak in the codebase. (The repository is clean — a `git grep` for the token prefix returns nothing; it lived only in the working session, not in committed source.)

This note exists to record the rotation obligation so it does not get lost, while explicitly **not** blocking the current P0 code fixes.

## Decision

- **Do NOT rotate the token during this sprint.** It is still in use for current development work.
- This is recorded as `DEFERRED_UNTIL_AFTER_CURRENT_WORK`.

## Rotation requirements (before pilot)

- [ ] The token **must be rotated before the pilot goes live.**
- [ ] The token **must be rotated before any external users are invited.**
- [ ] Rotation **must not block** the current P0 code fixes (this sprint).
- [ ] After rotation, update the secret wherever it is consumed (Supabase dashboard → Settings → API; and any Fly/Vercel/local env that holds it). Use env only — never inline.

## Handling rules (in force now)

- Do not print the token.
- Do not expose the token in code, logs, docs, or PRs.
- Do not search logs in a way that would print the token.
- Reference it only via environment variables.

## Owner action

**Timothy** to rotate/revoke the token in the Supabase dashboard once current development work concludes and before the first external pilot user is invited, then re-issue the new secret to the runtime environments via env (not inline).
