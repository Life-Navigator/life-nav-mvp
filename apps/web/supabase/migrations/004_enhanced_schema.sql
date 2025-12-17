-- ============================================================================
-- Life Navigator - Enhanced Supabase Schema
-- ============================================================================
-- This migration adds missing tables for a production-ready life management app
-- Run AFTER 003_cleanup_and_reset.sql
-- ============================================================================

-- ============================================================================
-- ACTIVITY LOGS (User Engagement Tracking)
-- ============================================================================
-- Track user engagement for analytics (non-sensitive events only)
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,  -- 'goal_created', 'habit_completed', 'login', 'feature_used', etc.
  event_category TEXT NOT NULL CHECK (event_category IN ('auth', 'goal', 'habit', 'achievement', 'social', 'navigation', 'ai')),

  -- Context (non-sensitive)
  resource_type TEXT,  -- 'goal', 'habit', 'achievement'
  resource_id UUID,
  metadata JSONB DEFAULT '{}',  -- Additional non-sensitive context

  -- Session context
  session_id UUID,
  device_type TEXT CHECK (device_type IN ('web', 'ios', 'android', 'desktop')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_event ON public.activity_logs(event_type, created_at DESC);
CREATE INDEX idx_activity_logs_category ON public.activity_logs(event_category);

-- ============================================================================
-- HABITS (Daily/Weekly Habit Tracking)
-- ============================================================================
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,  -- Optional link to goal

  -- Habit details
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'check-circle',
  color TEXT DEFAULT 'green',

  -- Frequency
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'weekdays', 'weekends', 'custom')),
  custom_days JSONB DEFAULT '[]',  -- [0,1,2,3,4,5,6] for custom (0=Sunday)
  target_count INT DEFAULT 1,  -- Times per period (e.g., 3 times per week)

  -- Time preferences
  preferred_time TIME,
  reminder_enabled BOOLEAN DEFAULT FALSE,
  reminder_time TIME,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'completed')),
  order_index INT DEFAULT 0,

  -- Streak tracking (denormalized for fast reads)
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_completions INT DEFAULT 0,
  last_completed_at DATE,

  -- Gamification
  xp_per_completion INT DEFAULT 10,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_habits_user ON public.habits(user_id);
CREATE INDEX idx_habits_status ON public.habits(status) WHERE status = 'active';
CREATE INDEX idx_habits_goal ON public.habits(goal_id);

-- ============================================================================
-- HABIT COMPLETIONS (Daily Check-ins)
-- ============================================================================
CREATE TABLE public.habit_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,

  -- Completion details
  completed_date DATE NOT NULL,
  completion_count INT DEFAULT 1,  -- For habits with target_count > 1
  completed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional context
  notes TEXT,
  mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'bad', 'terrible')),

  UNIQUE(user_id, habit_id, completed_date)
);

CREATE INDEX idx_habit_completions_user_date ON public.habit_completions(user_id, completed_date DESC);
CREATE INDEX idx_habit_completions_habit ON public.habit_completions(habit_id, completed_date DESC);

-- ============================================================================
-- REMINDERS (User-Scheduled Reminders)
-- ============================================================================
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Reminder details
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'bell',

  -- Linked resource (optional)
  resource_type TEXT CHECK (resource_type IN ('goal', 'habit', 'custom')),
  resource_id UUID,

  -- Schedule
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('one_time', 'recurring')),
  scheduled_at TIMESTAMPTZ,  -- For one-time
  recurrence_rule TEXT,  -- iCal RRULE format for recurring
  next_occurrence TIMESTAMPTZ,

  -- Delivery
  delivery_channels JSONB DEFAULT '["push"]',  -- ["push", "email", "sms"]

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  is_snoozed BOOLEAN DEFAULT FALSE,
  snoozed_until TIMESTAMPTZ,

  -- Completion tracking
  last_triggered_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_user ON public.reminders(user_id);
CREATE INDEX idx_reminders_next ON public.reminders(next_occurrence) WHERE status = 'active';
CREATE INDEX idx_reminders_resource ON public.reminders(resource_type, resource_id);

-- ============================================================================
-- USER DEVICES (Push Notification Management)
-- ============================================================================
CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Device identification
  device_id TEXT NOT NULL,  -- Unique device identifier
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  device_name TEXT,  -- User-friendly name (e.g., "Tim's iPhone")

  -- Push notification tokens
  push_token TEXT,
  push_token_type TEXT CHECK (push_token_type IN ('fcm', 'apns', 'web_push')),
  push_enabled BOOLEAN DEFAULT TRUE,

  -- Device info
  os_version TEXT,
  app_version TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_user_devices_user ON public.user_devices(user_id);
CREATE INDEX idx_user_devices_push ON public.user_devices(push_token) WHERE push_enabled = TRUE;

-- ============================================================================
-- INTEGRATIONS (Connected Service Status)
-- ============================================================================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Integration type
  provider TEXT NOT NULL CHECK (provider IN (
    'plaid', 'google_calendar', 'apple_calendar', 'outlook_calendar',
    'apple_health', 'google_fit', 'fitbit', 'garmin', 'whoop', 'oura',
    'linkedin', 'github', 'google_drive', 'dropbox'
  )),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected', 'error', 'expired')),
  error_message TEXT,
  error_code TEXT,

  -- Sync status
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_frequency_minutes INT DEFAULT 60,

  -- Permissions/Scopes
  scopes JSONB DEFAULT '[]',

  -- Metadata (non-sensitive - no tokens here!)
  metadata JSONB DEFAULT '{}',  -- e.g., { "account_count": 3, "institution_name": "Chase" }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider)
);

CREATE INDEX idx_integrations_user ON public.integrations(user_id);
CREATE INDEX idx_integrations_provider ON public.integrations(provider, status);

-- ============================================================================
-- GOAL MILESTONES (Display Metadata)
-- ============================================================================
-- Lightweight milestone data for UI - detailed data in Cloud SQL
CREATE TABLE public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  cloud_sql_id TEXT,  -- Reference to detailed milestone in Cloud SQL

  -- Display info
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'flag',
  order_index INT DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  target_date DATE,
  completed_at TIMESTAMPTZ,

  -- Gamification
  xp_reward INT DEFAULT 25,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goal_milestones_goal ON public.goal_milestones(goal_id, order_index);
CREATE INDEX idx_goal_milestones_user ON public.goal_milestones(user_id);

-- ============================================================================
-- TAGS (Flexible Categorization)
-- ============================================================================
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  color TEXT DEFAULT 'gray',
  icon TEXT,

  -- Usage tracking
  usage_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_tags_user ON public.tags(user_id);

-- Junction table for taggable resources
CREATE TABLE public.resource_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,

  resource_type TEXT NOT NULL CHECK (resource_type IN ('goal', 'habit', 'reminder')),
  resource_id UUID NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tag_id, resource_type, resource_id)
);

CREATE INDEX idx_resource_tags_resource ON public.resource_tags(resource_type, resource_id);
CREATE INDEX idx_resource_tags_tag ON public.resource_tags(tag_id);

-- ============================================================================
-- CHALLENGES (Time-Limited Gamification Events)
-- ============================================================================
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Challenge details
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT DEFAULT 'purple',

  -- Challenge type
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('habit', 'goal', 'streak', 'community', 'special')),

  -- Requirements
  criteria_type TEXT NOT NULL,  -- 'complete_habits', 'maintain_streak', 'reach_xp', etc.
  criteria_value JSONB NOT NULL,  -- { "count": 7, "habit_category": "health" }

  -- Rewards
  xp_reward INT DEFAULT 500,
  achievement_id UUID REFERENCES public.achievements(id),
  badge_url TEXT,

  -- Timing
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,

  -- Visibility
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  participant_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_challenges_active ON public.challenges(is_active, start_date, end_date);
CREATE INDEX idx_challenges_type ON public.challenges(challenge_type);

-- User participation in challenges
CREATE TABLE public.user_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,

  -- Progress
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  progress_value JSONB DEFAULT '{}',  -- Current progress toward criteria
  progress_percent INT DEFAULT 0,

  -- Completion
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(user_id, challenge_id)
);

CREATE INDEX idx_user_challenges_user ON public.user_challenges(user_id);
CREATE INDEX idx_user_challenges_challenge ON public.user_challenges(challenge_id);

-- ============================================================================
-- AI SESSIONS (Conversation Metadata)
-- ============================================================================
-- Track AI assistant usage (metadata only, no message content)
CREATE TABLE public.ai_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Session info
  session_type TEXT NOT NULL CHECK (session_type IN ('chat', 'goal_planning', 'reflection', 'coaching', 'analysis')),
  title TEXT,  -- Auto-generated or user-set title

  -- Stats
  message_count INT DEFAULT 0,
  duration_seconds INT,
  tokens_used INT,

  -- Context
  related_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  related_habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,

  -- Rating
  user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_sessions_user ON public.ai_sessions(user_id, started_at DESC);
CREATE INDEX idx_ai_sessions_type ON public.ai_sessions(session_type);

-- ============================================================================
-- ANNOUNCEMENTS (In-App Changelog & News)
-- ============================================================================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  announcement_type TEXT NOT NULL CHECK (announcement_type IN ('feature', 'update', 'maintenance', 'promotion', 'tip')),

  -- Display
  icon TEXT,
  color TEXT DEFAULT 'blue',
  image_url TEXT,
  action_url TEXT,
  action_label TEXT,

  -- Targeting
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'pilot', 'investor', 'admin', 'new_users')),
  min_app_version TEXT,

  -- Visibility
  is_active BOOLEAN DEFAULT TRUE,
  is_dismissable BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,  -- Higher = more prominent

  -- Timing
  publish_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON public.announcements(is_active, publish_at, expires_at);
CREATE INDEX idx_announcements_audience ON public.announcements(target_audience);

-- User announcement dismissals
CREATE TABLE public.user_announcement_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,

  read_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,

  UNIQUE(user_id, announcement_id)
);

CREATE INDEX idx_announcement_reads_user ON public.user_announcement_reads(user_id);

-- ============================================================================
-- ONBOARDING RESPONSES (Personalization Data)
-- ============================================================================
CREATE TABLE public.onboarding_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Question tracking
  question_key TEXT NOT NULL,  -- 'primary_goal', 'life_areas', 'experience_level', etc.
  question_version INT DEFAULT 1,

  -- Response
  response_value JSONB NOT NULL,  -- Flexible to store single values, arrays, or objects

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, question_key)
);

CREATE INDEX idx_onboarding_responses_user ON public.onboarding_responses(user_id);

-- ============================================================================
-- QUICK NOTES (Fast Capture)
-- ============================================================================
CREATE TABLE public.quick_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'note' CHECK (note_type IN ('note', 'idea', 'task', 'reflection')),

  -- Optional linking
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,

  -- Status
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Voice input
  is_voice_note BOOLEAN DEFAULT FALSE,
  audio_url TEXT,
  transcription_status TEXT CHECK (transcription_status IN ('pending', 'completed', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_notes_user ON public.quick_notes(user_id, created_at DESC);
CREATE INDEX idx_quick_notes_pinned ON public.quick_notes(user_id) WHERE is_pinned = TRUE;

-- ============================================================================
-- WAITLIST & REFERRALS (Pilot Program Management)
-- ============================================================================
CREATE TABLE public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Contact (can be pre-signup)
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,

  -- Source tracking
  referral_code TEXT,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source TEXT,  -- 'organic', 'social', 'referral', 'ad_campaign'
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Status
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'signed_up', 'churned')),
  position INT,

  -- Invitation
  invited_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  signed_up_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Engagement
  priority_score INT DEFAULT 0,  -- Higher = invite sooner
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_waitlist_status ON public.waitlist_entries(status, position);
CREATE INDEX idx_waitlist_referral ON public.waitlist_entries(referral_code);
CREATE INDEX idx_waitlist_referred_by ON public.waitlist_entries(referred_by);

-- Referral tracking for existing users
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Referral details
  referral_code TEXT NOT NULL UNIQUE,
  referral_link TEXT,

  -- Stats
  clicks INT DEFAULT 0,
  signups INT DEFAULT 0,
  conversions INT DEFAULT 0,  -- Users who became active

  -- Rewards
  rewards_earned JSONB DEFAULT '[]',  -- [{ "type": "xp", "amount": 500, "date": "..." }]
  total_xp_earned INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_user ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) for new tables
-- ============================================================================

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Activity logs: Users can only access their own
CREATE POLICY "Users can view own activity" ON public.activity_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Habits: Full CRUD for own habits
CREATE POLICY "Users can manage own habits" ON public.habits
  FOR ALL USING (auth.uid() = user_id);

-- Habit completions: Full CRUD for own completions
CREATE POLICY "Users can manage own habit completions" ON public.habit_completions
  FOR ALL USING (auth.uid() = user_id);

-- Reminders: Full CRUD for own reminders
CREATE POLICY "Users can manage own reminders" ON public.reminders
  FOR ALL USING (auth.uid() = user_id);

-- Devices: Full CRUD for own devices
CREATE POLICY "Users can manage own devices" ON public.user_devices
  FOR ALL USING (auth.uid() = user_id);

-- Integrations: Full CRUD for own integrations
CREATE POLICY "Users can manage own integrations" ON public.integrations
  FOR ALL USING (auth.uid() = user_id);

-- Milestones: Full CRUD for own milestones
CREATE POLICY "Users can manage own milestones" ON public.goal_milestones
  FOR ALL USING (auth.uid() = user_id);

-- Tags: Full CRUD for own tags
CREATE POLICY "Users can manage own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id);

-- Resource tags: Users can tag their own resources
CREATE POLICY "Users can manage own resource tags" ON public.resource_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tags WHERE id = resource_tags.tag_id AND user_id = auth.uid()
    )
  );

-- Challenges: Anyone can view active challenges
CREATE POLICY "Anyone can view challenges" ON public.challenges
  FOR SELECT USING (is_active = TRUE);

-- User challenges: Full CRUD for own participation
CREATE POLICY "Users can manage own challenge participation" ON public.user_challenges
  FOR ALL USING (auth.uid() = user_id);

-- AI Sessions: Full CRUD for own sessions
CREATE POLICY "Users can manage own AI sessions" ON public.ai_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Announcements: Anyone can view active announcements
CREATE POLICY "Anyone can view announcements" ON public.announcements
  FOR SELECT USING (is_active = TRUE AND publish_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW()));

-- Announcement reads: Users can manage their own reads
CREATE POLICY "Users can manage own announcement reads" ON public.user_announcement_reads
  FOR ALL USING (auth.uid() = user_id);

-- Onboarding: Full CRUD for own responses
CREATE POLICY "Users can manage own onboarding" ON public.onboarding_responses
  FOR ALL USING (auth.uid() = user_id);

-- Quick notes: Full CRUD for own notes
CREATE POLICY "Users can manage own notes" ON public.quick_notes
  FOR ALL USING (auth.uid() = user_id);

-- Referrals: Full CRUD for own referrals
CREATE POLICY "Users can manage own referrals" ON public.referrals
  FOR ALL USING (auth.uid() = referrer_id);

-- Waitlist: No user access (admin only via service role)

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================

CREATE TRIGGER update_habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_onboarding_updated_at
  BEFORE UPDATE ON public.onboarding_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.quick_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update habit streaks
CREATE OR REPLACE FUNCTION public.update_habit_streak()
RETURNS TRIGGER AS $$
DECLARE
  last_date DATE;
  yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  -- Get the last completion date for this habit
  SELECT MAX(completed_date) INTO last_date
  FROM public.habit_completions
  WHERE habit_id = NEW.habit_id
    AND completed_date < NEW.completed_date;

  -- Update the habit's streak
  UPDATE public.habits
  SET
    last_completed_at = NEW.completed_date,
    total_completions = total_completions + NEW.completion_count,
    current_streak = CASE
      WHEN last_date IS NULL OR last_date < yesterday THEN 1
      WHEN last_date = yesterday THEN current_streak + 1
      ELSE current_streak
    END,
    longest_streak = GREATEST(
      longest_streak,
      CASE
        WHEN last_date IS NULL OR last_date < yesterday THEN 1
        WHEN last_date = yesterday THEN current_streak + 1
        ELSE current_streak
      END
    ),
    updated_at = NOW()
  WHERE id = NEW.habit_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_habit_completion
  AFTER INSERT ON public.habit_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_habit_streak();

-- Function to generate unique referral codes
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA: Default Challenges
-- ============================================================================

INSERT INTO public.challenges (name, display_name, description, icon, challenge_type, criteria_type, criteria_value, xp_reward, start_date, end_date, is_active, is_featured) VALUES
  ('7_day_streak', '7-Day Warrior', 'Complete any habit for 7 consecutive days', 'fire', 'streak', 'habit_streak', '{"days": 7}', 300, NOW(), NOW() + INTERVAL '30 days', TRUE, TRUE),
  ('early_bird', 'Early Bird', 'Complete 5 morning habits before 8 AM this week', 'sunrise', 'habit', 'morning_habits', '{"count": 5, "before_hour": 8}', 200, NOW(), NOW() + INTERVAL '7 days', TRUE, FALSE),
  ('goal_setter', 'Goal Setter', 'Create and make progress on 3 different goals', 'target', 'goal', 'goals_with_progress', '{"count": 3, "min_progress": 10}', 250, NOW(), NOW() + INTERVAL '14 days', TRUE, FALSE);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.activity_logs IS 'Non-sensitive user engagement tracking for analytics';
COMMENT ON TABLE public.habits IS 'Daily/weekly habit tracking with streak management';
COMMENT ON TABLE public.habit_completions IS 'Individual habit completion records';
COMMENT ON TABLE public.reminders IS 'User-scheduled reminders for goals and habits';
COMMENT ON TABLE public.user_devices IS 'Device registration for push notifications';
COMMENT ON TABLE public.integrations IS 'Status of connected third-party services (tokens stored securely elsewhere)';
COMMENT ON TABLE public.goal_milestones IS 'Milestone display metadata - detailed data in Cloud SQL';
COMMENT ON TABLE public.tags IS 'User-defined tags for flexible categorization';
COMMENT ON TABLE public.challenges IS 'Time-limited gamification challenges';
COMMENT ON TABLE public.ai_sessions IS 'AI assistant conversation metadata (not content)';
COMMENT ON TABLE public.announcements IS 'In-app announcements and feature updates';
COMMENT ON TABLE public.onboarding_responses IS 'User responses to onboarding questions for personalization';
COMMENT ON TABLE public.quick_notes IS 'Fast capture notes and ideas';
COMMENT ON TABLE public.waitlist_entries IS 'Pilot program waitlist management';
COMMENT ON TABLE public.referrals IS 'User referral tracking and rewards';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running migrations 003 + 004, you should have 27 tables total:
--
-- From 003 (9 tables):
--   profiles, user_preferences, goals, achievements, user_achievements,
--   user_progress, notification_templates, user_notifications, feedback
--
-- From 004 (18 tables):
--   activity_logs, habits, habit_completions, reminders, user_devices,
--   integrations, goal_milestones, tags, resource_tags, challenges,
--   user_challenges, ai_sessions, announcements, user_announcement_reads,
--   onboarding_responses, quick_notes, waitlist_entries, referrals
