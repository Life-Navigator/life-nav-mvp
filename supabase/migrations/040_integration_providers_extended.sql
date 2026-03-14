-- Migration: Extend integration_tokens provider CHECK constraint to support LinkedIn and Credly
-- This adds 'linkedin' and 'credly' as valid providers for the core.integration_tokens table.

-- Drop and recreate the CHECK constraint on provider column
DO $$
BEGIN
  -- Remove old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'core'
      AND table_name = 'integration_tokens'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%provider%'
  ) THEN
    EXECUTE format(
      'ALTER TABLE core.integration_tokens DROP CONSTRAINT %I',
      (SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'core'
         AND table_name = 'integration_tokens'
         AND constraint_type = 'CHECK'
         AND constraint_name LIKE '%provider%'
       LIMIT 1)
    );
  END IF;

  -- Add updated constraint with linkedin and credly
  ALTER TABLE core.integration_tokens
    ADD CONSTRAINT integration_tokens_provider_check
    CHECK (provider IN ('google', 'microsoft', 'plaid', 'linkedin', 'credly'));
END $$;
