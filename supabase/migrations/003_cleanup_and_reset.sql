-- ============================================================================
-- Life Navigator - Supabase Cleanup & Reset Migration
-- ============================================================================
-- WARNING: This is a DESTRUCTIVE migration that drops all existing tables
-- and recreates only the non-sensitive tables needed for Supabase.
--
-- All sensitive data (financial, health, career, education) will be stored
-- in Cloud SQL backend, NOT in Supabase.
-- ============================================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- ============================================================================
-- DROP ALL EXISTING TABLES (from old Prisma/Vercel setup)
-- ============================================================================

-- Drop tables with foreign key dependencies first (in reverse order)
DROP TABLE IF EXISTS public.network_value_insights CASCADE;
DROP TABLE IF EXISTS public.social_network_connections CASCADE;
DROP TABLE IF EXISTS public.calendar_connections CASCADE;
DROP TABLE IF EXISTS public.plaid_items CASCADE;
DROP TABLE IF EXISTS public.family_appointments CASCADE;
DROP TABLE IF EXISTS public.pets CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.benefit_rankings CASCADE;
DROP TABLE IF EXISTS public.user_integrations CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.job_applications CASCADE;
DROP TABLE IF EXISTS public.career_profiles CASCADE;
DROP TABLE IF EXISTS public.career_connections CASCADE;
DROP TABLE IF EXISTS public.resumes CASCADE;
DROP TABLE IF EXISTS public.education_courses CASCADE;
DROP TABLE IF EXISTS public.education_records CASCADE;
DROP TABLE IF EXISTS public.study_logs CASCADE;
DROP TABLE IF EXISTS public.health_metrics CASCADE;
DROP TABLE IF EXISTS public.health_records CASCADE;
DROP TABLE IF EXISTS public.wearable_metrics CASCADE;
DROP TABLE IF EXISTS public.wearable_connections CASCADE;
DROP TABLE IF EXISTS public.financial_goals CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.financial_accounts CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.risk_recommendations CASCADE;
DROP TABLE IF EXISTS public.risk_category_scores CASCADE;
DROP TABLE IF EXISTS public.assessment_answers CASCADE;
DROP TABLE IF EXISTS public.assessment_questions CASCADE;
DROP TABLE IF EXISTS public.risk_assessments CASCADE;
DROP TABLE IF EXISTS public.goal_dependencies CASCADE;
DROP TABLE IF EXISTS public.goal_reminders CASCADE;
DROP TABLE IF EXISTS public.goal_updates CASCADE;
DROP TABLE IF EXISTS public.goal_benefits CASCADE;
DROP TABLE IF EXISTS public.goal_milestones CASCADE;
DROP TABLE IF EXISTS public.goal_categories CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.user_devices CASCADE;
DROP TABLE IF EXISTS public.security_tokens CASCADE;
DROP TABLE IF EXISTS public.security_audit_logs CASCADE;
DROP TABLE IF EXISTS public.revoked_tokens CASCADE;
DROP TABLE IF EXISTS public.verification_tokens CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop additional tables that might exist from extensions
DROP TABLE IF EXISTS public.tax_profiles CASCADE;
DROP TABLE IF EXISTS public.employer_benefits CASCADE;
DROP TABLE IF EXISTS public.deduction_opportunities CASCADE;
DROP TABLE IF EXISTS public.tax_strategies CASCADE;
DROP TABLE IF EXISTS public.retirement_plans CASCADE;
DROP TABLE IF EXISTS public.investment_holdings CASCADE;
DROP TABLE IF EXISTS public.feature_votes CASCADE;
DROP TABLE IF EXISTS public.feature_waitlist CASCADE;
DROP TABLE IF EXISTS public.student_profiles CASCADE;
DROP TABLE IF EXISTS public.degree_analyses CASCADE;
DROP TABLE IF EXISTS public.degree_comparisons CASCADE;
DROP TABLE IF EXISTS public.education_documents CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- Drop old Supabase tables if they exist (from previous 001 migration)
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP TABLE IF EXISTS public.user_notifications CASCADE;
DROP TABLE IF EXISTS public.notification_templates CASCADE;
DROP TABLE IF EXISTS public.user_progress CASCADE;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop any remaining tables (catch-all)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Drop old functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- ============================================================================
-- CREATE NEW SCHEMA (Non-Sensitive Data Only)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PROFILES (Minimal - No PII)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dgx_user_id TEXT UNIQUE,  -- Reference to backend Cloud SQL user

  -- Display preferences (non-PII)
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  locale TEXT DEFAULT 'en-US',

  -- Theme & UI preferences
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  color_scheme TEXT DEFAULT 'blue',

  -- Onboarding state
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INT DEFAULT 0,

  -- Pilot access (synced from backend)
  pilot_role TEXT DEFAULT 'waitlist' CHECK (pilot_role IN ('waitlist', 'investor', 'pilot', 'admin')),
  pilot_enabled BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER PREFERENCES (Non-Sensitive Settings)
-- ============================================================================
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Notification preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,

  -- Email digest settings
  daily_digest BOOLEAN DEFAULT FALSE,
  weekly_digest BOOLEAN DEFAULT TRUE,

  -- AI Assistant preferences
  ai_voice TEXT DEFAULT 'friendly',
  ai_verbosity TEXT DEFAULT 'normal' CHECK (ai_verbosity IN ('concise', 'normal', 'detailed')),

  -- Dashboard customization
  dashboard_layout JSONB DEFAULT '{}',
  widget_order JSONB DEFAULT '[]',

  -- Feature flags
  enable_gamification BOOLEAN DEFAULT TRUE,
  enable_social_features BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================================
-- GOALS (Non-Sensitive Goal Metadata Only)
-- ============================================================================
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dgx_goal_id TEXT,  -- Reference to detailed goal in Cloud SQL

  -- Goal category
  category TEXT NOT NULL CHECK (category IN ('education', 'career', 'finance', 'health', 'personal')),

  -- Display info (non-sensitive)
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'target',
  color TEXT DEFAULT 'blue',

  -- Progress (percentage only - amounts in Cloud SQL)
  progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  priority INT DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),

  -- Timeline (dates only - no financial details)
  target_date DATE,
  started_at DATE,
  completed_at DATE,

  -- Gamification
  xp_reward INT DEFAULT 100,
  achievements_unlocked JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ACHIEVEMENTS & GAMIFICATION
-- ============================================================================
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Achievement metadata
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT DEFAULT 'gold',

  -- Rarity
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  xp_value INT DEFAULT 50,

  -- Unlock criteria (non-sensitive)
  criteria_type TEXT NOT NULL,
  criteria_value JSONB DEFAULT '{}',

  -- Display
  is_hidden BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,

  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  is_displayed BOOLEAN DEFAULT TRUE,

  UNIQUE(user_id, achievement_id)
);

-- ============================================================================
-- USER LEVEL & XP
-- ============================================================================
CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- XP & Level
  total_xp INT DEFAULT 0,
  current_level INT DEFAULT 1,
  xp_to_next_level INT DEFAULT 100,

  -- Streaks
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,

  -- Statistics (non-sensitive counts only)
  goals_completed INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  achievements_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================================
-- NOTIFICATION TEMPLATES
-- ============================================================================
CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,

  -- Channels
  supports_email BOOLEAN DEFAULT TRUE,
  supports_push BOOLEAN DEFAULT TRUE,
  supports_sms BOOLEAN DEFAULT FALSE,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER NOTIFICATIONS (Non-Sensitive)
-- ============================================================================
CREATE TABLE public.user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  icon TEXT,

  -- Action
  action_url TEXT,
  action_label TEXT,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ============================================================================
-- FEEDBACK & SUPPORT (Non-Sensitive)
-- ============================================================================
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Feedback type
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'general', 'praise')),
  category TEXT,

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'in_progress', 'resolved', 'closed')),

  -- Rating
  satisfaction_rating INT CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_dgx_user ON public.profiles(dgx_user_id);
CREATE INDEX idx_profiles_pilot_role ON public.profiles(pilot_role);
CREATE INDEX idx_goals_user_id ON public.goals(user_id);
CREATE INDEX idx_goals_category ON public.goals(category);
CREATE INDEX idx_goals_status ON public.goals(status);
CREATE INDEX idx_goals_dgx_goal ON public.goals(dgx_goal_id);
CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX idx_user_notifications_user ON public.user_notifications(user_id);
CREATE INDEX idx_user_notifications_unread ON public.user_notifications(user_id) WHERE NOT is_read;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Preferences: Users can only access their own preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Goals: Users can only access their own goals
CREATE POLICY "Users can view own goals" ON public.goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id);

-- Achievements: Users can view all achievements, but only their own unlocks
CREATE POLICY "Anyone can view achievements" ON public.achievements
  FOR SELECT USING (true);
CREATE POLICY "Users can view own achievement unlocks" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Progress: Users can only access their own progress
CREATE POLICY "Users can view own progress" ON public.user_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Notifications: Users can only access their own notifications
CREATE POLICY "Users can view own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Feedback: Users can create and view their own feedback
CREATE POLICY "Users can submit feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to handle profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, dgx_user_id, display_name)
  VALUES (
    NEW.id,
    NULL,  -- Will be set by backend sync
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_progress (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- SEED DATA: Default Achievements
-- ============================================================================
INSERT INTO public.achievements (name, display_name, description, icon, rarity, xp_value, criteria_type, criteria_value) VALUES
  ('first_login', 'Welcome Aboard', 'Complete your first login', 'star', 'common', 50, 'login_count', '{"count": 1}'),
  ('profile_complete', 'Identity Established', 'Complete your profile setup', 'user', 'common', 100, 'profile_complete', '{}'),
  ('first_goal', 'Dream Starter', 'Create your first goal', 'target', 'common', 75, 'goal_count', '{"count": 1}'),
  ('five_goals', 'Ambitious', 'Create 5 goals', 'targets', 'uncommon', 150, 'goal_count', '{"count": 5}'),
  ('goal_master', 'Goal Master', 'Complete 10 goals', 'trophy', 'rare', 500, 'goals_completed', '{"count": 10}'),
  ('week_streak', 'Consistent', 'Maintain a 7-day streak', 'fire', 'uncommon', 200, 'streak', '{"days": 7}'),
  ('month_streak', 'Dedicated', 'Maintain a 30-day streak', 'flame', 'rare', 750, 'streak', '{"days": 30}'),
  ('level_5', 'Rising Star', 'Reach level 5', 'star-half', 'uncommon', 250, 'level', '{"level": 5}'),
  ('level_10', 'Achiever', 'Reach level 10', 'star-fill', 'rare', 500, 'level', '{"level": 10}'),
  ('level_25', 'Navigator Elite', 'Reach level 25', 'crown', 'epic', 1500, 'level', '{"level": 25}'),
  ('pilot_pioneer', 'Pilot Pioneer', 'Be part of the exclusive pilot program', 'rocket', 'legendary', 2000, 'pilot_member', '{}');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'User profiles with minimal non-PII data. Sensitive data in Cloud SQL.';
COMMENT ON TABLE public.goals IS 'Goal metadata only. Financial targets and amounts stored in Cloud SQL.';
COMMENT ON TABLE public.achievements IS 'Gamification achievements for user engagement.';
COMMENT ON COLUMN public.profiles.dgx_user_id IS 'Reference to user record in backend Cloud SQL database.';
COMMENT ON COLUMN public.goals.dgx_goal_id IS 'Reference to detailed goal with financial data in Cloud SQL.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, you should have exactly 9 tables:
-- 1. profiles
-- 2. user_preferences
-- 3. goals
-- 4. achievements
-- 5. user_achievements
-- 6. user_progress
-- 7. notification_templates
-- 8. user_notifications
-- 9. feedback
