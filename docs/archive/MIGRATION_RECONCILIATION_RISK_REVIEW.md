# MIGRATION_RECONCILIATION_RISK_REVIEW.md — Phase 6

Evidence base: Phase 1 inventory, Phase 2 object verification, Phase 5 dry-run. Prod = `diwkyyahglnqmyledsey`.

## 1. Can repair be done safely?

**Yes.** `supabase migration repair` writes only to `supabase_migrations.schema_migrations`; it runs **no DDL and touches no data**, and is reversible (`--status reverted`). The only failure mode is marking a migration applied whose objects are actually absent — prevented by gating every repaired ID on Phase-2 object verification. Tier A (165/166/167) is trivially safe. Tier B (160/164/timestamped) is safe on verified IDs. The 105–160 band must be object-verified before repair.

## 2. Can targeted apply be done safely?

**Yes, for 165/166/167.** They are fully idempotent (`IF NOT EXISTS` everywhere, guarded constraint, `DROP POLICY IF EXISTS` before create), additive-only (new columns/tables), self-contained (no dependency on any unrecorded migration), and their one external dependency (`documents.document_fields`) exists. Applied in a single transaction with `ON_ERROR_STOP`, the worst case is a clean rollback. **Not safe via `supabase db push`** — that cascades to 105+ (Q5).

## 3. Are any migrations partially applied?

**One.** `20260617120000_integration_audit`: schema `core` exists, but `core.integration_audit_log` and `core.log_integration_event()` do **not**. This is the single partial/inconsistent state in the system → **BLOCKED_NEEDS_REVIEW**, excluded from this sprint. Also note `20260613010000_cleanup_archetype_risks` is a **data-cleanup** migration with no schema footprint — its "applied" state can't be proven by object existence; treat as REPAIR_HISTORY with owner acknowledgement.

## 4. Are any objects inconsistent?

**No structural inconsistencies** beyond integration_audit's partial state. 165/166/167 objects are cleanly absent (no orphan columns/tables/policies to collide with). All "already-applied" migrations from 160+ had **all** required objects present (tables + columns + functions + indexes checked), not just tables.

## 5. Is there any destructive operation?

- **In the chosen plan (repair + targeted apply of 165/166/167): NO.** Repair is metadata-only; the apply is additive (no DROP, no DELETE, no column change). 165's backfill is an idempotent `UPDATE … WHERE review_status='extracted' AND confidence<0.6` on a column it just created — bounded, non-destructive.
- **In the REJECTED `db push` path: YES.** It would re-run `159_deprecate_orphaned_truth_tables` (drops) and `149/150/158` force-RLS against live tables. This is the reason `db push` is barred.

## 6. Is rollback documented?

**Yes** (TARGETED_APPLY Phase 4): `DROP TABLE` for 166/167, `DROP COLUMN`/`DROP CONSTRAINT` for 165, then `migration repair --status reverted 165 166 167`. Safe because the objects are brand-new with no production data. Repair rollback: `--status reverted <id>` (metadata-only).

## 7. Is there a safe apply path?

**Yes — exactly one:**

1. (Optional but recommended) Tier-B repair so history = reality and future `db push` is safe.
2. Transactional dry run of 165→166→167 (`BEGIN … ROLLBACK`) to confirm clean.
3. Transactional apply of 165→166→167 (`BEGIN … COMMIT`).
4. `migration repair --status applied 165 166 167`.
5. Run post-apply validation queries.
6. Leave `integration_audit` for a separate decision.

## Residual risks & mitigations

| Risk                                                                                  | Likelihood                     | Mitigation                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| Someone runs `supabase db push` without repairing first                               | Med (it's the obvious command) | This report + DRY_RUN bars it; do Tier-B repair to neutralize permanently          |
| Repairing a 105–160 ID whose objects are NOT actually present                         | Low                            | Object-verify each before repair; don't bulk-repair unverified                     |
| 165 apply against a `document_fields` table with surprising existing constraint names | Very low                       | Guarded by `IF NOT EXISTS` + constraint-existence `DO` block                       |
| `integration_audit` left partial indefinitely                                         | Med                            | Tracked as BLOCKED_NEEDS_REVIEW; not launch-blocking                               |
| Working-tree 165/166/167 are **uncommitted** (on no branch)                           | High for process hygiene       | Commit them to the branch before/with apply so prod state is reproducible from git |

## Verdict

The reconciliation has a **safe, non-destructive, reversible path** for the mission-critical migrations (165/166/167). The only hazards are (a) using `db push` — explicitly barred — and (b) the quarantined `integration_audit` partial. Both are contained.
</content>
