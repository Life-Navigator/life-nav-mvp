# MIGRATION_REPAIR_PLAN.md — Phase 3

**For migrations whose objects already exist in prod but are absent from migration history.** `migration repair` writes only to `supabase_migrations.schema_migrations` — **it runs no DDL and touches no data**. Reversible with `--status reverted`.

> ⚠️ Nothing here is executed. Commands are for review/approval only.

## Why repair is needed

The history baseline is effectively `163` with everything from `105` unrecorded. Until history matches reality, **any** `supabase db push` (now or for a future migration 168) will try to re-apply 50+ already-applied migrations. Repair is the mechanism that makes history truthful and `db push` safe again.

## Tier A — minimal (required to record this sprint's apply)

After 165/166/167 are applied (Phase 4), record them:

```bash
supabase migration repair --status applied 165 166 167 --linked
```

Evidence: objects created by Phase 4 apply. Rollback: `--status reverted 165 166 167`. Risk: **none** (history-only).

## Tier B — full reconciliation (strongly recommended follow-up; not required to ship 165–167)

Repair-mark every migration verified **present-but-unrecorded** so history = reality. Run only the IDs whose objects were confirmed to exist.

**160 + the 8 verified timestamped migrations (objects confirmed in Phase 2):**

```bash
supabase migration repair --status applied \
  160 164 \
  20260610000000 20260611010000 20260611020000 20260611030000 \
  20260613000000 20260613010000 20260616120000 20260616140000 20260616160000 \
  20260617130000 --linked
```

- `160`, `164` — tables/columns confirmed present.
- 8 timestamped — tables/columns/functions confirmed present.
- `20260613010000_cleanup_archetype_risks` — a **data-cleanup** migration (no schema objects). Repair-marking is correct (it logically "ran" via the same path that built the rest), but flag for owner: confirm the cleanup's effect is present or accept it as a no-op. See risk review Q3.

**105–160 band (objects exist per dry-run, NOT re-verified object-by-object here):**

```bash
# Verify each exists, THEN repair. Derive the exact list from `supabase migration list --linked`
# (every row with a Local entry but blank Remote, EXCLUDING 165/166/167 and 20260617120000).
supabase migration repair --status applied 105 106 107 108 109 110 117 118 119 120 121 122 \
  123 124 125 126 127 128 129 130 131 132 133 134 135 136 137 138 139 140 141 142 143 144 145 \
  146 147 148 149 150 151 152 153 154 155 156 157 158 159 --linked
```

⚠️ This band includes `149/150/158` (force-RLS) and `159` (deprecate-orphaned) — repair-marking them is safe (no DDL), but do it **only after** confirming their objects/effects are present. This band is **out of scope for the doc-intelligence goal** and should be its own reviewed step.

## Do NOT repair

- `165`, `166`, `167` **before** applying them (objects don't exist — marking them applied would hide a real gap). Apply first, repair after.
- `20260617120000_integration_audit` — objects genuinely missing; see TARGETED_APPLY / risk review. Never mark applied while its table+function are absent.
- `143b_documents_exposure`, `146b_platform_exposure`, `148b_reco_exposure` — non-timestamp filenames the CLI **skips**; not repairable by version and not part of the push set. DO_NOT_TOUCH.

## Rollback implication

`migration repair` is fully reversible (`--status reverted <id>`) and changes no schema. The only "risk" is marking something applied whose objects are actually absent — mitigated by the Phase-2 object verification gating every ID above.
</content>
