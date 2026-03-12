-- ==========================================================================
-- 038: Health Domain (Feature-Locked)
-- Tables created but access denied until is_health_enabled() returns true.
-- This allows the schema to exist for future use without exposing data.
-- ==========================================================================

-- Feature gate function — flip to TRUE when health features launch
CREATE OR REPLACE FUNCTION public.is_health_enabled()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$ SELECT false; $$;

-- Health records
CREATE TABLE IF NOT EXISTS health_meta.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- visit, diagnosis, medication, lab_result, procedure
  provider_name TEXT,
  facility TEXT,
  record_date DATE NOT NULL,
  description TEXT,
  notes_encrypted TEXT, -- encrypted via core.encrypt_text
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_records_user ON health_meta.health_records(user_id, record_date DESC);

ALTER TABLE health_meta.health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_records" ON health_meta.health_records
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_health_records" ON health_meta.health_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Health metrics (weight, BP, heart rate, etc.)
CREATE TABLE IF NOT EXISTS health_meta.health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- weight, blood_pressure, heart_rate, blood_sugar, sleep, steps, calories
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  secondary_value NUMERIC, -- e.g., diastolic for BP
  source TEXT, -- manual, apple_health, google_fit, fitbit, garmin
  recorded_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_metrics_user ON health_meta.health_metrics(user_id, metric_type, recorded_at DESC);

ALTER TABLE health_meta.health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_metrics" ON health_meta.health_metrics
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_health_metrics" ON health_meta.health_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Wearable connections
CREATE TABLE IF NOT EXISTS health_meta.wearable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- apple_health, google_fit, fitbit, garmin, whoop, oura
  status TEXT NOT NULL DEFAULT 'connected',
  last_synced_at TIMESTAMPTZ,
  device_name TEXT,
  device_model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE health_meta.wearable_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_wearables" ON health_meta.wearable_connections
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_health_wearables" ON health_meta.wearable_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Triggers
CREATE TRIGGER set_health_records_updated_at BEFORE UPDATE ON health_meta.health_records
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_wearable_conn_updated_at BEFORE UPDATE ON health_meta.wearable_connections
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
