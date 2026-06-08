-- 123_ln_central_reference.sql — central job-market reference schema (Career X1).
--
-- `ln_central`: NON-user-specific reference facts (occupations, roles, skills, comp bands,
-- market demand). These are read by the Compensation Engine + cited BY VALUE into per-user
-- :Evidence — NEVER linked cross-tenant (LIFENAVIGATOR_ONTOLOGY_STANDARD). No user_id anywhere.
--
-- Access model: read-only for authenticated/anon (shared public reference); service_role
-- writes (ingestion). RLS enabled with a read-true SELECT policy (NOT user-scoped — this is
-- shared reference data, not personal). NO real external data ingested here — tables only.

CREATE SCHEMA IF NOT EXISTS ln_central;

-- 1. occupations (BLS OEWS / O*NET occupation taxonomy)
CREATE TABLE IF NOT EXISTS ln_central.occupations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), occupation_code TEXT NOT NULL, soc_code TEXT,
  title TEXT NOT NULL, description TEXT,
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 2. roles (market roles mapped to occupations)
CREATE TABLE IF NOT EXISTS ln_central.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), occupation_code TEXT, title TEXT NOT NULL,
  seniority TEXT, industry TEXT,
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 3. role_aliases (synonyms / job-title variants -> role)
CREATE TABLE IF NOT EXISTS ln_central.role_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), role_id UUID, alias TEXT NOT NULL,
  source_name TEXT, source_dataset TEXT, as_of_date DATE, confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 4. skills_reference (O*NET skills taxonomy)
CREATE TABLE IF NOT EXISTS ln_central.skills_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, category TEXT, onet_id TEXT,
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 5. credentials_reference (degrees/certs/licenses the market rewards)
CREATE TABLE IF NOT EXISTS ln_central.credentials_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, credential_type TEXT, issuer TEXT,
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 6. industries (NAICS)
CREATE TABLE IF NOT EXISTS ln_central.industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), naics_code TEXT, name TEXT NOT NULL,
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 7. compensation_bands (OEWS wage percentiles by occupation x geography x industry)
CREATE TABLE IF NOT EXISTS ln_central.compensation_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), occupation_code TEXT, role_id UUID,
  industry TEXT, geography TEXT, seniority TEXT,
  p10 NUMERIC(14,2), p25 NUMERIC(14,2), p50 NUMERIC(14,2), p75 NUMERIC(14,2), p90 NUMERIC(14,2),
  currency TEXT DEFAULT 'USD',
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 8. market_demand_snapshots (growth / saturation / openings)
CREATE TABLE IF NOT EXISTS ln_central.market_demand_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), occupation_code TEXT, role_id UUID, geography TEXT,
  growth_rate NUMERIC(7,4), saturation NUMERIC(7,4), openings BIGINT,
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 9. hiring_trends (time series of a demand metric)
CREATE TABLE IF NOT EXISTS ln_central.hiring_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), role_id UUID, occupation_code TEXT, geography TEXT,
  period TEXT, metric TEXT, value NUMERIC(18,4),
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 10. geography_reference (metro/state + cost index)
CREATE TABLE IF NOT EXISTS ln_central.geography_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), geo_code TEXT NOT NULL, name TEXT NOT NULL,
  geo_type TEXT, cost_index NUMERIC(7,3),
  source_name TEXT, source_url TEXT, source_identifier TEXT, source_dataset TEXT,
  as_of_date DATE, confidence NUMERIC(4,3), license_notes TEXT, refresh_frequency TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 11. source_provenance (registry of every source feeding ln_central)
CREATE TABLE IF NOT EXISTS ln_central.source_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source_name TEXT NOT NULL, source_url TEXT,
  source_identifier TEXT, license_notes TEXT, refresh_frequency TEXT, last_refreshed DATE,
  notes TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 12. labor_market_datasets (ingested dataset versions)
CREATE TABLE IF NOT EXISTS ln_central.labor_market_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), dataset_name TEXT NOT NULL, source_name TEXT,
  version TEXT, as_of_date DATE, row_count BIGINT, notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Indexes (occupation_code, role_id, geography, source_name)
CREATE INDEX IF NOT EXISTS idx_lc_occ_code ON ln_central.occupations(occupation_code);
CREATE INDEX IF NOT EXISTS idx_lc_roles_occ ON ln_central.roles(occupation_code);
CREATE INDEX IF NOT EXISTS idx_lc_aliases_role ON ln_central.role_aliases(role_id);
CREATE INDEX IF NOT EXISTS idx_lc_skills_name ON ln_central.skills_reference(name);
CREATE INDEX IF NOT EXISTS idx_lc_creds_name ON ln_central.credentials_reference(name);
CREATE INDEX IF NOT EXISTS idx_lc_ind_naics ON ln_central.industries(naics_code);
CREATE INDEX IF NOT EXISTS idx_lc_bands_occ_geo ON ln_central.compensation_bands(occupation_code, geography);
CREATE INDEX IF NOT EXISTS idx_lc_bands_role ON ln_central.compensation_bands(role_id);
CREATE INDEX IF NOT EXISTS idx_lc_demand_occ_geo ON ln_central.market_demand_snapshots(occupation_code, geography);
CREATE INDEX IF NOT EXISTS idx_lc_trends_role ON ln_central.hiring_trends(role_id, period);
CREATE INDEX IF NOT EXISTS idx_lc_geo_code ON ln_central.geography_reference(geo_code);
CREATE INDEX IF NOT EXISTS idx_lc_prov_source ON ln_central.source_provenance(source_name);
CREATE INDEX IF NOT EXISTS idx_lc_datasets_source ON ln_central.labor_market_datasets(source_name);

-- RLS: read-only shared reference (authenticated/anon SELECT) + service_role write.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'occupations','roles','role_aliases','skills_reference','credentials_reference','industries',
    'compensation_bands','market_demand_snapshots','hiring_trends','geography_reference',
    'source_provenance','labor_market_datasets'
  ] LOOP
    EXECUTE format('ALTER TABLE ln_central.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE ln_central.%I FORCE ROW LEVEL SECURITY', t);
    -- read-only for authenticated + anon (shared reference, NOT user-scoped)
    EXECUTE format($p$DROP POLICY IF EXISTS read_%1$s ON ln_central.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY read_%1$s ON ln_central.%1$I FOR SELECT TO authenticated, anon USING (true)', t);
    -- writes: service_role only (ingestion)
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON ln_central.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON ln_central.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT ON ln_central.%I TO authenticated, anon', t);   -- read-only (no INSERT/UPDATE/DELETE grant)
    EXECUTE format('GRANT ALL ON ln_central.%I TO service_role', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA ln_central TO authenticated, service_role, anon;

-- NO triggers, NO graph sync here. Citation into per-user evidence is by VALUE (the engine
-- copies a band/figure + its source into the user's :Evidence node) — never a cross-tenant edge.
