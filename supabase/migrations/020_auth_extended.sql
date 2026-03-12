-- ==========================================================================
-- 020: Extended Auth & Profile Fields
-- Adds pilot access, billing, usage tracking, security audit, device tracking
-- ==========================================================================

-- Extend profiles with fields previously in DGX backend User model
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
  -- Pilot access
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'civilian',
  ADD COLUMN IF NOT EXISTS waitlist_position INT,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pilot_notes TEXT,
  -- Billing
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'freemium',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  -- Usage tracking
  ADD COLUMN IF NOT EXISTS daily_chat_queries INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS queries_used_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_query_reset TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_pilot ON public.profiles(pilot_role, pilot_enabled);

-- Sync email from auth.users on profile creation
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it conflicts, then create
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Security audit log (for GDPR/financial compliance)
CREATE TABLE IF NOT EXISTS core.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_time ON core.security_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON core.security_audit_log(action, created_at DESC);

ALTER TABLE core.security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_view_own_audit" ON core.security_audit_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_audit_full" ON core.security_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Login attempts for lockout (stored in core schema, service_role only)
CREATE TABLE IF NOT EXISTS core.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON core.login_attempts(email, created_at DESC);

ALTER TABLE core.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_login_attempts" ON core.login_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lockout check function
CREATE OR REPLACE FUNCTION core.check_lockout(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
  failed_count INT;
BEGIN
  SELECT COUNT(*) INTO failed_count
  FROM core.login_attempts
  WHERE email = p_email
    AND success = FALSE
    AND created_at > NOW() - INTERVAL '15 minutes';
  RETURN failed_count >= 5;
END;
$$;

-- Record login attempt
CREATE OR REPLACE FUNCTION core.record_login_attempt(
  p_email TEXT,
  p_success BOOLEAN,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO core.login_attempts (email, success, ip_address, user_agent)
  VALUES (p_email, p_success, p_ip, p_user_agent);

  -- Clean up old attempts (older than 24 hours)
  DELETE FROM core.login_attempts
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- MFA recovery codes (Supabase Auth handles TOTP, but not recovery codes)
CREATE TABLE IF NOT EXISTS core.mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE core.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_recovery" ON core.mfa_recovery_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Purchases / billing history
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_user ON public.purchases(user_id, created_at DESC);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_purchases" ON public.purchases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Query usage log
CREATE TABLE IF NOT EXISTS public.query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query_type TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  model TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_query_logs_user ON public.query_logs(user_id, created_at DESC);

ALTER TABLE public.query_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_queries" ON public.query_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_queries" ON public.query_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
