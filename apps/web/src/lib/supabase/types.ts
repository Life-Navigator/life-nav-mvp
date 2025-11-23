/**
 * Supabase Database Types
 *
 * Auto-generated types should be placed here after running:
 * npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
 *
 * For now, we define the types manually based on our schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          dgx_user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          locale: string;
          theme: 'light' | 'dark' | 'system';
          color_scheme: string;
          onboarding_completed: boolean;
          onboarding_step: number;
          pilot_role: 'waitlist' | 'investor' | 'pilot' | 'admin';
          pilot_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          dgx_user_id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          locale?: string;
          theme?: 'light' | 'dark' | 'system';
          color_scheme?: string;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          pilot_role?: 'waitlist' | 'investor' | 'pilot' | 'admin';
          pilot_enabled?: boolean;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          locale?: string;
          theme?: 'light' | 'dark' | 'system';
          color_scheme?: string;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          pilot_role?: 'waitlist' | 'investor' | 'pilot' | 'admin';
          pilot_enabled?: boolean;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          email_notifications: boolean;
          push_notifications: boolean;
          sms_notifications: boolean;
          daily_digest: boolean;
          weekly_digest: boolean;
          ai_voice: string;
          ai_verbosity: 'concise' | 'normal' | 'detailed';
          dashboard_layout: Json;
          widget_order: Json;
          enable_gamification: boolean;
          enable_social_features: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_notifications?: boolean;
          push_notifications?: boolean;
          sms_notifications?: boolean;
          daily_digest?: boolean;
          weekly_digest?: boolean;
          ai_voice?: string;
          ai_verbosity?: 'concise' | 'normal' | 'detailed';
          dashboard_layout?: Json;
          widget_order?: Json;
          enable_gamification?: boolean;
          enable_social_features?: boolean;
        };
        Update: {
          email_notifications?: boolean;
          push_notifications?: boolean;
          sms_notifications?: boolean;
          daily_digest?: boolean;
          weekly_digest?: boolean;
          ai_voice?: string;
          ai_verbosity?: 'concise' | 'normal' | 'detailed';
          dashboard_layout?: Json;
          widget_order?: Json;
          enable_gamification?: boolean;
          enable_social_features?: boolean;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          dgx_goal_id: string | null;
          category: 'education' | 'career' | 'finance' | 'health' | 'personal';
          title: string;
          description: string | null;
          icon: string;
          color: string;
          progress_percent: number;
          status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
          priority: number;
          target_date: string | null;
          started_at: string | null;
          completed_at: string | null;
          xp_reward: number;
          achievements_unlocked: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          dgx_goal_id?: string | null;
          category: 'education' | 'career' | 'finance' | 'health' | 'personal';
          title: string;
          description?: string | null;
          icon?: string;
          color?: string;
          progress_percent?: number;
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
          priority?: number;
          target_date?: string | null;
          started_at?: string | null;
          xp_reward?: number;
        };
        Update: {
          dgx_goal_id?: string | null;
          category?: 'education' | 'career' | 'finance' | 'health' | 'personal';
          title?: string;
          description?: string | null;
          icon?: string;
          color?: string;
          progress_percent?: number;
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
          priority?: number;
          target_date?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          xp_reward?: number;
          achievements_unlocked?: Json;
        };
      };
      achievements: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string;
          icon: string;
          color: string;
          rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
          xp_value: number;
          criteria_type: string;
          criteria_value: Json;
          is_hidden: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          display_name: string;
          description: string;
          icon: string;
          color?: string;
          rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
          xp_value?: number;
          criteria_type: string;
          criteria_value?: Json;
          is_hidden?: boolean;
          is_active?: boolean;
        };
        Update: {
          display_name?: string;
          description?: string;
          icon?: string;
          color?: string;
          rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
          xp_value?: number;
          criteria_type?: string;
          criteria_value?: Json;
          is_hidden?: boolean;
          is_active?: boolean;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
          is_displayed: boolean;
        };
        Insert: {
          user_id: string;
          achievement_id: string;
          is_displayed?: boolean;
        };
        Update: {
          is_displayed?: boolean;
        };
      };
      user_progress: {
        Row: {
          id: string;
          user_id: string;
          total_xp: number;
          current_level: number;
          xp_to_next_level: number;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          goals_completed: number;
          tasks_completed: number;
          achievements_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_xp?: number;
          current_level?: number;
          xp_to_next_level?: number;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          goals_completed?: number;
          tasks_completed?: number;
          achievements_count?: number;
        };
        Update: {
          total_xp?: number;
          current_level?: number;
          xp_to_next_level?: number;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          goals_completed?: number;
          tasks_completed?: number;
          achievements_count?: number;
        };
      };
      user_notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          category: string;
          icon: string | null;
          action_url: string | null;
          action_label: string | null;
          is_read: boolean;
          read_at: string | null;
          priority: 'low' | 'normal' | 'high' | 'urgent';
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          user_id: string;
          title: string;
          body: string;
          category?: string;
          icon?: string | null;
          action_url?: string | null;
          action_label?: string | null;
          priority?: 'low' | 'normal' | 'high' | 'urgent';
          expires_at?: string | null;
        };
        Update: {
          title?: string;
          body?: string;
          category?: string;
          icon?: string | null;
          action_url?: string | null;
          action_label?: string | null;
          is_read?: boolean;
          read_at?: string | null;
          priority?: 'low' | 'normal' | 'high' | 'urgent';
          expires_at?: string | null;
        };
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          type: 'bug' | 'feature' | 'general' | 'praise';
          category: string | null;
          title: string;
          description: string;
          status: 'pending' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';
          satisfaction_rating: number | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          user_id?: string | null;
          type: 'bug' | 'feature' | 'general' | 'praise';
          category?: string | null;
          title: string;
          description: string;
          status?: 'pending' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';
          satisfaction_rating?: number | null;
        };
        Update: {
          type?: 'bug' | 'feature' | 'general' | 'praise';
          category?: string | null;
          title?: string;
          description?: string;
          status?: 'pending' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';
          satisfaction_rating?: number | null;
          resolved_at?: string | null;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type Achievement = Database['public']['Tables']['achievements']['Row'];
export type UserAchievement = Database['public']['Tables']['user_achievements']['Row'];
export type UserProgress = Database['public']['Tables']['user_progress']['Row'];
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
export type UserNotification = Database['public']['Tables']['user_notifications']['Row'];
export type Feedback = Database['public']['Tables']['feedback']['Row'];
