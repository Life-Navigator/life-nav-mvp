-- ==========================================================================
-- 035: Calendar & Email
-- Cached email messages and calendar events from Gmail/Outlook
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- google, microsoft, apple
  calendar_id TEXT NOT NULL,
  calendar_name TEXT,
  color TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_synced BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT, -- incremental sync token from provider
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, calendar_id)
);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_cal_conn" ON public.calendar_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  calendar_id TEXT,
  summary TEXT,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT DEFAULT 'confirmed', -- confirmed, tentative, cancelled
  attendees JSONB DEFAULT '[]',
  recurrence JSONB,
  conference_url TEXT,
  is_organizer BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, external_id)
);

CREATE INDEX idx_cal_events_user_time ON public.calendar_events(user_id, start_time);
CREATE INDEX idx_cal_events_conn ON public.calendar_events(connection_id);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_events" ON public.calendar_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- google, microsoft
  external_id TEXT NOT NULL,
  thread_id TEXT,
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  snippet TEXT, -- preview text
  labels TEXT[] DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
  date TIMESTAMPTZ NOT NULL,
  body_preview TEXT, -- first ~500 chars of body
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, external_id)
);

CREATE INDEX idx_emails_user_date ON public.email_messages(user_id, date DESC);
CREATE INDEX idx_emails_thread ON public.email_messages(user_id, thread_id);
CREATE INDEX idx_emails_unread ON public.email_messages(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_emails" ON public.email_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email sync state (tracks sync position per provider)
CREATE TABLE IF NOT EXISTS public.email_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  history_id TEXT, -- Gmail history ID or Microsoft deltaLink
  last_synced_at TIMESTAMPTZ,
  total_messages INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_sync" ON public.email_sync_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER set_cal_connections_updated_at BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_cal_events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_emails_updated_at BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_email_sync_updated_at BEFORE UPDATE ON public.email_sync_state
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
