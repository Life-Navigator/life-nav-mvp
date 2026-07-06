# MIGRATION_RECONCILIATION_EXECUTIVE_SUMMARY.md — Phase 7

**Prod DB:** Supabase `diwkyyahglnqmyledsey` (confirmed). **Audit-only — nothing applied, repaired, or deployed.**

## The situation in one paragraph

Production migration **history is badly drifted**: `schema_migrations` records only `161/162/163` from 150 onward, while the actual schema contains the objects for ~25+ "missing" migrations (160, 164, and all timestamped ones — verified present at the object level). Three migrations are **genuinely missing** — `165` (document-field provenance), `166` (field conflicts), `167` (resume imports) — and these are exactly what the document-intelligence / provenance / conflict / resume features need. One migration, `integration_audit`, is **partially applied** and quarantined. A naive `supabase db push` is **dangerous** and must not be run.

## The 8 questions

**1. Which migrations should be repaired?**
History-only fix (no DDL) for the present-but-unrecorded set: **`160`, `164`** and the 8 verified timestamped migrations (`20260610000000`, `20260611010000/020000/030000`, `20260613000000/010000`, `20260616120000/140000/160000`, `20260617130000`). Recommended follow-up: the `105–160` band, after per-ID object verification.

**2. Which migrations should be applied?**
**`165`, `166`, `167`** — in that order, via direct transactional SQL (all idempotent, additive, self-contained).

**3. Which should not be touched?**
`161/162/163` (already consistent). `143b/146b/148b` (CLI-skipped bad filenames). And **do not run `supabase db push`**.

**4. What exact commands will be run (on approval)?**

```bash
# (a) Preview — transactional dry run (rolls back, applies nothing)
psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 \
  -c 'BEGIN;' -f supabase/migrations/165_document_field_provenance.sql \
  -f supabase/migrations/166_field_conflicts.sql \
  -f supabase/migrations/167_resume_imports.sql -c 'ROLLBACK;'

# (b) Apply — same three, committed
psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 \
  -c 'BEGIN;' -f supabase/migrations/165_document_field_provenance.sql \
  -f supabase/migrations/166_field_conflicts.sql \
  -f supabase/migrations/167_resume_imports.sql -c 'COMMIT;'

# (c) Record history
supabase migration repair --status applied 165 166 167 --linked

# (d) Recommended: reconcile the drifted history (Tier B) so db push is safe henceforth
supabase migration repair --status applied 160 164 \
  20260610000000 20260611010000 20260611020000 20260611030000 \
  20260613000000 20260613010000 20260616120000 20260616140000 20260616160000 \
  20260617130000 --linked
```

(Needs `SUPABASE_DB_URL` — the pooler connection string incl. DB password — for psql. Alternatively run 165/166/167 through the Management API query endpoint with the access token, then step (c).)

**5. What is the risk?**
**Low.** Chosen path is metadata repair + additive, idempotent, transactional apply with documented rollback. No drops, no data loss, no `db push`. The only real hazard (the 105+ push cascade) is explicitly barred.

**6. What is rollback?**
`DROP TABLE` (166/167) + `DROP COLUMN`/`DROP CONSTRAINT` (165), then `migration repair --status reverted 165 166 167`. Repairs are metadata-only and reversible. Objects are new with no prod data, so rollback is clean.

**7. What features are unlocked?**
Document-field **provenance** (page/section/char-span + confidence + confirm/edit/reject review loop), **conflict detection** (contested facts flagged with both sources, never silently overwritten), and **resume import** (staged reviewable items → domain tables). These are the doc-intelligence trust features currently 404/inert because their tables don't exist.

**8. Is it safe to proceed?**
**Yes — for repair + targeted apply of 165/166/167.** `integration_audit` is **not** safe to bundle (partial state, idempotency unconfirmed, not required) → separate decision. `supabase db push` is **not** safe → barred.

## Pre-flight notes for the operator

- **Commit 165/166/167 first.** They are currently **uncommitted working-tree files on no branch** — commit them so production schema is reproducible from git.
- Provide `SUPABASE_DB_URL` (pooler + DB password) for psql, or approve the Management-API apply route.
- Rotate the Supabase access token after the session (it was shared in plaintext).

---

# FINAL STATUS: **READY_FOR_APPROVAL**

Safe, reversible, non-destructive path verified for `165/166/167` (apply) + drifted-history (repair). `db push` rejected; `integration_audit` quarantined. Awaiting explicit go before any mutation.
</content>
