-- ==========================================================================
-- 073: Wearable Monitoring + Non-Diagnostic Alerts
--
-- wearable_connections + wearable_metrics already exist in 038_health_locked.
-- This migration adds the alert-rule engine surface:
--
--   * health_monitoring_preferences  — per-user alert prefs / quiet hours
--   * health_alert_rules             — declarative rules (built-in + custom)
--   * health_alert_events            — fired events with non-diagnostic copy
--
-- All under the is_health_enabled() gate with service-role bypass.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS health_meta.health_monitoring_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start_local TEXT,                       -- 'HH:MM'
  quiet_hours_end_local TEXT,
  min_severity_to_notify TEXT NOT NULL DEFAULT 'info'
    CHECK (min_severity_to_notify IN ('info','watch','warn','urgent')),
  share_alerts_with_physician BOOLEAN NOT NULL DEFAULT FALSE,
  physician_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE health_meta.health_monitoring_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hmp_gate" ON health_meta.health_monitoring_preferences
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "hmp_service" ON health_meta.health_monitoring_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_hmp_updated_at
  BEFORE UPDATE ON health_meta.health_monitoring_preferences
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


CREATE TABLE IF NOT EXISTS health_meta.health_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,                             -- 'rhr_up_sleep_down','bp_trend_worsening','weight_sudden_drop',...
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  thresholds JSONB NOT NULL DEFAULT '{}',             -- rule-specific config
  cooldown_minutes INT NOT NULL DEFAULT 720,          -- 12h default — avoid spam
  severity TEXT NOT NULL DEFAULT 'watch'
    CHECK (severity IN ('info','watch','warn','urgent')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, rule_key)
);
CREATE INDEX IF NOT EXISTS idx_har_user_active
  ON health_meta.health_alert_rules(user_id, is_active);
ALTER TABLE health_meta.health_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "har_gate" ON health_meta.health_alert_rules
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "har_service" ON health_meta.health_alert_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_har_updated_at
  BEFORE UPDATE ON health_meta.health_alert_rules
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


CREATE TABLE IF NOT EXISTS health_meta.health_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES health_meta.health_alert_rules(id) ON DELETE SET NULL,
  rule_key TEXT NOT NULL,
  severity TEXT NOT NULL
    CHECK (severity IN ('info','watch','warn','urgent')),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Non-diagnostic copy ONLY. Engine never writes a diagnosis here.
  headline TEXT NOT NULL,
  body TEXT,
  recommended_next_step TEXT,                          -- e.g. 'Consider contacting your physician.'
  -- Snapshot the underlying metrics that triggered the alert for replay/audit.
  trigger_metrics JSONB NOT NULL DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  shared_with_physician_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hae_user_time
  ON health_meta.health_alert_events(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hae_user_unacked
  ON health_meta.health_alert_events(user_id)
  WHERE acknowledged_at IS NULL AND dismissed_at IS NULL;
ALTER TABLE health_meta.health_alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hae_gate" ON health_meta.health_alert_events
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "hae_service" ON health_meta.health_alert_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_hae_updated_at
  BEFORE UPDATE ON health_meta.health_alert_events
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
