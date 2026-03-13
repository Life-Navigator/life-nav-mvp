/**
 * Supabase Database Types
 *
 * Manually maintained until Supabase project is connected.
 * Replace with: npx supabase gen types typescript --project-id <id>
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
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          locale: string;
          theme: string;
          role: string;
          pilot_role: string;
          pilot_enabled: boolean;
          user_type: string;
          setup_completed: boolean;
          setup_completed_at: string | null;
          date_of_birth: string | null;
          phone_number: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          subscription_tier: string;
          onboarding_completed: boolean;
          onboarding_step: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          locale?: string;
          theme?: string;
          role?: string;
          pilot_role?: string;
          pilot_enabled?: boolean;
          user_type?: string;
          setup_completed?: boolean;
          setup_completed_at?: string | null;
          date_of_birth?: string | null;
          phone_number?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          subscription_tier?: string;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          locale?: string;
          theme?: string;
          role?: string;
          pilot_role?: string;
          pilot_enabled?: boolean;
          user_type?: string;
          setup_completed?: boolean;
          setup_completed_at?: string | null;
          date_of_birth?: string | null;
          phone_number?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          subscription_tier?: string;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          updated_at?: string;
        };
        Relationships: never[];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          title: string;
          description: string | null;
          priority: string;
          status: string;
          target_value: number | null;
          target_unit: string | null;
          progress_percent: number;
          target_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          category: string;
          description?: string | null;
          priority?: string;
          status?: string;
          target_value?: number | null;
          target_unit?: string | null;
          progress_percent?: number;
          target_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          title?: string;
          category?: string;
          description?: string | null;
          priority?: string;
          status?: string;
          target_value?: number | null;
          target_unit?: string | null;
          progress_percent?: number;
          target_date?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      risk_assessments: {
        Row: {
          id: string;
          user_id: string;
          assessment_type: string;
          overall_score: number;
          risk_level: string;
          status: string;
          responses: Json | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assessment_type: string;
          overall_score: number;
          risk_level: string;
          status?: string;
          responses?: Json | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          assessment_type?: string;
          overall_score?: number;
          risk_level?: string;
          status?: string;
          responses?: Json | null;
          metadata?: Json | null;
          updated_at?: string;
        };
        Relationships: never[];
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
          ai_verbosity: string;
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
          ai_verbosity?: string;
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
          ai_verbosity?: string;
          dashboard_layout?: Json;
          widget_order?: Json;
          enable_gamification?: boolean;
          enable_social_features?: boolean;
        };
        Relationships: never[];
      };
      scenario_jobs: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: never[];
      };
      scenarios: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: never[];
      };
      scenario_extracted_fields: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: never[];
      };
      scenario_versions: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: never[];
      };
      scenario_documents: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: never[];
      };
      scenario_pins: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: never[];
      };
      waitlist: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type Achievement = Record<string, unknown>;
export type UserAchievement = Record<string, unknown>;
export type UserProgress = Record<string, unknown>;
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
export type UserNotification = Record<string, unknown>;
export type Feedback = Record<string, unknown>;
