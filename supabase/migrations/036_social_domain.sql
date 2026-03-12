-- ==========================================================================
-- 036: Social Domain
-- Social network connections, metrics, follower insights
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- linkedin, twitter, instagram, tiktok, github, youtube
  username TEXT,
  profile_url TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_social" ON public.social_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.social_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  followers INT,
  following INT,
  posts INT,
  engagement_rate NUMERIC,
  impressions INT,
  reach INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, metric_date)
);

CREATE INDEX idx_social_metrics_user ON public.social_metrics(user_id, metric_date DESC);

ALTER TABLE public.social_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_metrics" ON public.social_metrics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER set_social_conn_updated_at BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
