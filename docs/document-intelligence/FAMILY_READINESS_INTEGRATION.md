# Family Readiness Integration — what an upload now updates

The bridge writes to the **user-owned `family.*` tables that `FamilyService` actually reads**, so an
upload moves family readiness instead of only registering document existence.

Bridge code: `app/services/documents.py:_bridge_family` (line ~443) and the `_upsert_*` helpers.
Real columns confirmed against `supabase/migrations/131_family_schema.sql` (no later ALTERs).

## Will → estate_plans + guardianship_plans

- `family.estate_plans.has_will = true` (real BOOLEAN column). This is the field `FamilyService`
  reads in `summary()` (`readiness.estate.has_will`) and `_compute_rows()` (the `estate_gap`
  recommendation). A will upload therefore closes the "missing will" part of the estate gap.
- `executor`, `beneficiaries`, `date` → **`estate_plans.metadata`** (JSONB). There is **no** executor
  or beneficiary column in 131, so they are recorded in metadata + as `life.facts` (`will.executor`,
  `will.beneficiaries`). FamilyService does **not** read metadata today (gap below).
- `guardian` (only if extracted) → `family.guardianship_plans.status = 'designated'` +
  `designated_guardian = <name>` (both real columns). FamilyService reads `guardianship.status` for
  the `guardianship_gap` recommendation, so naming a guardian via a will closes that gap.
- **Preserve user data:** if a `guardianship_plans` row already has `status='designated'` with a
  `designated_guardian`, the document does NOT overwrite it.

## Trust → estate_plans.metadata (+ life.facts)

- `estate_plans` has **no trust columns** (no `has_trust`, `trustee`, `grantor`, …). Per the
  no-invented-columns rule, trust attributes are written to `estate_plans.metadata` (incl.
  `metadata.has_trust=true`) and to `life.facts` (`trust.trustee`, `trust.grantor`, …). `has_will`
  is left untouched by a trust upload.

## Life Insurance → insurance_profiles

- `coverage_amount` → `family.insurance_profiles.life_coverage` (real NUMERIC column) +
  `source='document-intelligence'`. This is the exact field `FamilyService._context()` reads as
  `coverage`, which drives the `insurance_gap` and `survivor_scenario` recommendations and the
  protection summary. So a policy upload directly recalculates the protection gap.
- `policy_type`, `beneficiaries`, `premium`, `insurer`, `insured_person` → **`insurance_profiles.metadata`**
  (no real columns) + `life.facts`.
- **Preserve user data:** if an existing row has equal-or-higher `life_coverage` from a non-document
  source, the document value does NOT lower it.
- **No fabrication:** if no `coverage_amount` is extracted, no `insurance_profiles` row is written.

## What FamilyService reads (today)

`FamilyService._context()` (`app/domains/family.py:87`) reads: `dependents`, `insurance_profiles`
(`life_coverage`), `estate_plans` (`has_will`, `has_poa`, `has_beneficiaries`, `status`),
`guardianship_plans` (`status`, `designated_guardian`), `college_planning`, plus cross-domain income
and debts. The bridge writes precisely the columns this reader consumes.

## Still missing (honest gaps)

1. **FamilyService does not read `metadata`.** Executor, trust attributes, insurer, policy_type,
   premium, beneficiaries are persisted (metadata + life.facts) but are **not surfaced** by
   FamilyService until either (a) migration 131 gains real columns, or (b) FamilyService reads
   `metadata`/`life.facts`. Recommended follow-up: add `executor`, `has_trust` and an insurance
   `beneficiary`/`policy_type` column, then have the bridge populate them.
2. **`has_beneficiaries` / `has_poa` are not set by a will upload.** A will naming beneficiaries does
   not flip `has_beneficiaries` (we record the names in metadata/facts but do not assert the boolean
   without an explicit signal). This is deliberate conservatism, not a bug.
3. **Coverage currency** — only `life_coverage` is set; the document does not set `currency`
   (defaults to `USD` per the table default).
