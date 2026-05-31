/**
 * Supabase Database Types
 *
 * Manually maintained until Supabase project is connected.
 * Replace with: npx supabase gen types typescript --project-id <id>
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          marital_status: string | null;
          dependents_count: number | null;
          user_graph_captured_at: string | null;
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
          marital_status?: string | null;
          dependents_count?: number | null;
          user_graph_captured_at?: string | null;
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
          marital_status?: string | null;
          dependents_count?: number | null;
          user_graph_captured_at?: string | null;
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

      // ----------------------------------------------------------------
      // User Graph foundation (migration 060_user_graph_foundation.sql)
      // ----------------------------------------------------------------
      user_life_vision: {
        Row: {
          id: string;
          user_id: string;
          horizon:
            | '1_year'
            | '3_year'
            | '5_year'
            | '10_year'
            | 'definition_of_success'
            | 'fears_to_avoid';
          vision_text: string | null;
          domains: string[];
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          horizon: string;
          vision_text?: string | null;
          domains?: string[];
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          vision_text?: string | null;
          domains?: string[];
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Relationships: never[];
      };
      user_constraints: {
        Row: {
          id: string;
          user_id: string;
          dimension: 'time' | 'money' | 'health' | 'family' | 'geography' | 'other';
          severity: 'hard' | 'soft';
          description: string;
          value_numeric: number | null;
          value_unit: string | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          dimension: string;
          severity?: string;
          description: string;
          value_numeric?: number | null;
          value_unit?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          dimension?: string;
          severity?: string;
          description?: string;
          value_numeric?: number | null;
          value_unit?: string | null;
          is_active?: boolean;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Relationships: never[];
      };
      user_decision_preferences: {
        Row: {
          id: string;
          user_id: string;
          axis: 'speed' | 'certainty' | 'flexibility' | 'upside';
          weight: number;
          notes: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          axis: string;
          weight: number;
          notes?: string | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          axis?: string;
          weight?: number;
          notes?: string | null;
          source?: string;
          metadata?: Json;
        };
        Relationships: never[];
      };
      user_commitment_levels: {
        Row: {
          id: string;
          user_id: string;
          domain:
            | 'financial'
            | 'career'
            | 'education'
            | 'health'
            | 'family'
            | 'wellness'
            | 'lifestyle'
            | 'overall';
          hours_per_week: number | null;
          energy_level: 'low' | 'medium' | 'high' | null;
          duration_weeks: number | null;
          notes: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          domain: string;
          hours_per_week?: number | null;
          energy_level?: string | null;
          duration_weeks?: number | null;
          notes?: string | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          domain?: string;
          hours_per_week?: number | null;
          energy_level?: string | null;
          duration_weeks?: number | null;
          notes?: string | null;
          source?: string;
        };
        Relationships: never[];
      };
      user_motivations: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          motivation_text: string;
          motivation_type:
            | 'intrinsic'
            | 'extrinsic'
            | 'values_based'
            | 'identity'
            | 'fear_based'
            | null;
          intensity: number | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          goal_id?: string | null;
          motivation_text: string;
          motivation_type?: string | null;
          intensity?: number | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          motivation_text?: string;
          motivation_type?: string | null;
          intensity?: number | null;
          source?: string;
        };
        Relationships: never[];
      };
      user_domain_risk_tolerance: {
        Row: {
          id: string;
          user_id: string;
          domain: 'financial' | 'career' | 'education' | 'health' | 'entrepreneurship';
          tolerance_score: number;
          qualitative_level:
            | 'very_conservative'
            | 'conservative'
            | 'moderate'
            | 'growth_oriented'
            | 'aggressive'
            | null;
          notes: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          domain: string;
          tolerance_score: number;
          qualitative_level?: string | null;
          notes?: string | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          domain?: string;
          tolerance_score?: number;
          qualitative_level?: string | null;
          notes?: string | null;
          source?: string;
        };
        Relationships: never[];
      };
      user_capabilities: {
        Row: {
          id: string;
          user_id: string;
          capability_name: string;
          domain: string | null;
          proficiency_level: 'novice' | 'intermediate' | 'advanced' | 'expert';
          self_assessed: boolean;
          evidence: string | null;
          last_used_at: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          capability_name: string;
          domain?: string | null;
          proficiency_level?: string;
          self_assessed?: boolean;
          evidence?: string | null;
          last_used_at?: string | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          capability_name?: string;
          domain?: string | null;
          proficiency_level?: string;
          self_assessed?: boolean;
          evidence?: string | null;
          last_used_at?: string | null;
          source?: string;
        };
        Relationships: never[];
      };
      user_decisions: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          decision_type: string | null;
          title: string;
          description: string | null;
          options_considered: Json;
          chosen_option: Json | null;
          rationale: string | null;
          reversibility: 'reversible' | 'partial' | 'irreversible' | null;
          status: 'considering' | 'made' | 'reverted' | 'superseded';
          made_at: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          goal_id?: string | null;
          decision_type?: string | null;
          title: string;
          description?: string | null;
          options_considered?: Json;
          chosen_option?: Json | null;
          rationale?: string | null;
          reversibility?: string | null;
          status?: string;
          made_at?: string | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          goal_id?: string | null;
          decision_type?: string | null;
          title?: string;
          description?: string | null;
          options_considered?: Json;
          chosen_option?: Json | null;
          rationale?: string | null;
          reversibility?: string | null;
          status?: string;
          made_at?: string | null;
        };
        Relationships: never[];
      };
      user_recommendations: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          decision_id: string | null;
          source_agent: string;
          action: string;
          rationale: string | null;
          expected_impact: string | null;
          priority: number;
          status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'snoozed' | 'completed';
          expires_at: string | null;
          accepted_at: string | null;
          rejected_at: string | null;
          snoozed_until: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          goal_id?: string | null;
          decision_id?: string | null;
          source_agent?: string;
          action: string;
          rationale?: string | null;
          expected_impact?: string | null;
          priority?: number;
          status?: string;
          expires_at?: string | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          status?: string;
          priority?: number;
          accepted_at?: string | null;
          rejected_at?: string | null;
          snoozed_until?: string | null;
          expires_at?: string | null;
          rationale?: string | null;
          expected_impact?: string | null;
        };
        Relationships: never[];
      };
      user_outcomes: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          decision_id: string | null;
          recommendation_id: string | null;
          outcome_type:
            | 'achieved'
            | 'missed'
            | 'abandoned'
            | 'in_progress'
            | 'exceeded'
            | 'deferred';
          observed_value: number | null;
          observed_unit: string | null;
          observed_at: string;
          attribution_confidence: number | null;
          notes: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          goal_id?: string | null;
          decision_id?: string | null;
          recommendation_id?: string | null;
          outcome_type?: string;
          observed_value?: number | null;
          observed_unit?: string | null;
          observed_at?: string;
          attribution_confidence?: number | null;
          notes?: string | null;
          source?: string;
          confidence_score?: number | null;
          metadata?: Json;
        };
        Update: {
          outcome_type?: string;
          observed_value?: number | null;
          observed_unit?: string | null;
          observed_at?: string;
          attribution_confidence?: number | null;
          notes?: string | null;
        };
        Relationships: never[];
      };

      // ----------------------------------------------------------------
      // 061 expansion: user_actions, user_life_events
      // ----------------------------------------------------------------
      user_actions: {
        Row: {
          id: string;
          user_id: string;
          domain: string | null;
          action_type: string;
          action_title: string;
          description: string | null;
          goal_id: string | null;
          decision_id: string | null;
          recommendation_id: string | null;
          taken_at: string;
          effort_minutes: number | null;
          cost_amount: number | null;
          cost_currency: string | null;
          status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          action_type: string;
          action_title: string;
          [key: string]: unknown;
        };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };
      user_life_events: {
        Row: {
          id: string;
          user_id: string;
          domain: string | null;
          event_type: string;
          event_title: string;
          description: string | null;
          occurred_at: string | null;
          expected_at: string | null;
          is_anticipated: boolean;
          impact_level: 'low' | 'medium' | 'high' | 'major' | null;
          related_goal_id: string | null;
          source: string;
          confidence_score: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          event_type: string;
          event_title: string;
          [key: string]: unknown;
        };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };

      // ----------------------------------------------------------------
      // 064 — insurance
      // ----------------------------------------------------------------
      insurance_plans: {
        Row: {
          id: string;
          user_id: string;
          plan_type: string;
          carrier: string | null;
          plan_name: string | null;
          plan_id_external: string | null;
          member_id_encrypted: string | null;
          group_number_encrypted: string | null;
          effective_date: string | null;
          termination_date: string | null;
          is_primary: boolean;
          is_active: boolean;
          source_of_coverage: string | null;
          monthly_premium: number | null;
          annual_deductible: number | null;
          deductible_met_ytd: number | null;
          out_of_pocket_max: number | null;
          out_of_pocket_met_ytd: number | null;
          copay_primary_care: number | null;
          copay_specialist: number | null;
          copay_er: number | null;
          copay_urgent_care: number | null;
          coinsurance_percent: number | null;
          prescription_coverage_tier_json: Json;
          hsa_eligible: boolean | null;
          fsa_eligible: boolean | null;
          hra_eligible: boolean | null;
          network_type: string | null;
          network_restrictions: string | null;
          wellness_benefits_summary: string | null;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; plan_type: string; [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };
      insurance_documents: {
        Row: {
          id: string;
          user_id: string;
          insurance_plan_id: string | null;
          document_type: string;
          storage_bucket: string;
          storage_key: string;
          filename: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          ocr_status: string;
          ocr_completed_at: string | null;
          ocr_error: string | null;
          ocr_raw_text_encrypted: string | null;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          document_type: string;
          storage_key: string;
          [key: string]: unknown;
        };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };
      insurance_extracted_facts: {
        Row: {
          id: string;
          user_id: string;
          insurance_document_id: string;
          insurance_plan_id: string | null;
          fact_key: string;
          fact_value_text: string | null;
          fact_value_numeric: number | null;
          fact_value_date: string | null;
          bbox: Json | null;
          confidence_score: number | null;
          approved: boolean;
          approved_by: string | null;
          approved_at: string | null;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          insurance_document_id: string;
          fact_key: string;
          [key: string]: unknown;
        };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };

      // ----------------------------------------------------------------
      // 065 — education_intake & education_credentials
      // ----------------------------------------------------------------
      education_intake: {
        Row: {
          id: string;
          user_id: string;
          highest_completed_degree: string | null;
          current_program: string | null;
          current_institution: string | null;
          expected_completion_date: string | null;
          tuition_budget_total: number | null;
          tuition_budget_annual: number | null;
          willing_to_take_loans: boolean | null;
          expected_roi_preference: string | null;
          credential_urgency: string | null;
          time_available_for_study_hours_per_week: number | null;
          has_gi_bill: boolean | null;
          gi_bill_remaining_months: number | null;
          has_va_benefits: boolean | null;
          employer_tuition_reimbursement_annual: number | null;
          scholarships_summary: string | null;
          desired_schools: string[];
          financing_options: string[];
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };
      education_credentials: {
        Row: {
          id: string;
          user_id: string;
          credential_kind: string;
          name: string;
          issuer: string | null;
          issued_at: string | null;
          expires_at: string | null;
          status: string;
          url: string | null;
          notes: string | null;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; credential_kind: string; name: string; [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };

      // ----------------------------------------------------------------
      // 066 — family_lifestyle_profile & children_education_goals
      // ----------------------------------------------------------------
      family_lifestyle_profile: {
        Row: {
          id: string;
          user_id: string;
          has_elder_care_responsibilities: boolean | null;
          elder_care_notes: string | null;
          caregiving_hours_per_week: number | null;
          family_financial_obligations_monthly: number | null;
          willing_to_relocate: string | null;
          must_stay_near_family: boolean | null;
          travel_frequency_target: string | null;
          travel_budget_annual: number | null;
          lifestyle_goals: string | null;
          household_priorities: string[];
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };
      children_education_goals: {
        Row: {
          id: string;
          user_id: string;
          family_member_id: string | null;
          child_name_hint: string | null;
          child_birth_year: number | null;
          target_degree: string | null;
          target_institution: string | null;
          target_institution_type: string | null;
          estimated_total_cost: number | null;
          savings_vehicle: string | null;
          current_savings: number | null;
          monthly_contribution: number | null;
          funding_source: string[] | null;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };

      // ----------------------------------------------------------------
      // 068 — root-goal discovery, estate planning
      // ----------------------------------------------------------------
      goal_discovery_turns: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          session_id: string;
          turn_index: number;
          prompt_kind: string;
          prompt_text: string;
          user_answer: string | null;
          detected_drivers: Json;
          inferred_root_goal: string | null;
          confidence_after_turn: number | null;
          agent_persona: string | null;
          source: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          session_id: string;
          turn_index: number;
          prompt_kind: string;
          prompt_text: string;
          [key: string]: unknown;
        };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };
      estate_planning_profile: {
        Row: {
          id: string;
          user_id: string;
          has_will: boolean | null;
          will_last_updated: string | null;
          has_living_trust: boolean | null;
          trust_type: string | null;
          trust_last_updated: string | null;
          has_financial_poa: boolean | null;
          financial_poa_holder: string | null;
          has_healthcare_poa: boolean | null;
          healthcare_poa_holder: string | null;
          has_healthcare_directive: boolean | null;
          has_living_will: boolean | null;
          has_hipaa_release: boolean | null;
          has_minor_children: boolean | null;
          guardian_designated: boolean | null;
          guardian_name: string | null;
          guardian_relationship: string | null;
          alternate_guardian_name: string | null;
          charitable_intent: string | null;
          legacy_goals: string | null;
          owns_business: boolean | null;
          has_business_continuity_plan: boolean | null;
          business_continuity_notes: string | null;
          digital_asset_inventory_status: string | null;
          digital_asset_access_method: string | null;
          open_concerns: string | null;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };
      estate_beneficiaries: {
        Row: {
          id: string;
          user_id: string;
          family_member_id: string | null;
          beneficiary_name: string;
          relationship: string | null;
          asset_class: string | null;
          asset_reference: string | null;
          allocation_percent: number | null;
          is_contingent: boolean;
          notes: string | null;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; beneficiary_name: string; [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: never[];
      };

      // ----------------------------------------------------------------
      // 067 — user_onboarding_sections
      // ----------------------------------------------------------------
      user_onboarding_sections: {
        Row: {
          id: string;
          user_id: string;
          section: string;
          status: 'not_started' | 'in_progress' | 'skipped' | 'completed';
          completed_at: string | null;
          fields_captured: Json;
          source: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          section: string;
          status?: string;
          [key: string]: unknown;
        };
        Update: { [key: string]: unknown };
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

// User-graph foundation helpers (migration 060)
export type UserLifeVisionRow = Database['public']['Tables']['user_life_vision']['Row'];
export type UserConstraintRow = Database['public']['Tables']['user_constraints']['Row'];
export type UserDecisionPreferenceRow =
  Database['public']['Tables']['user_decision_preferences']['Row'];
export type UserCommitmentLevelRow = Database['public']['Tables']['user_commitment_levels']['Row'];
export type UserMotivationRow = Database['public']['Tables']['user_motivations']['Row'];
export type UserDomainRiskToleranceRow =
  Database['public']['Tables']['user_domain_risk_tolerance']['Row'];
export type UserCapabilityRow = Database['public']['Tables']['user_capabilities']['Row'];
export type UserDecisionRow = Database['public']['Tables']['user_decisions']['Row'];
export type UserRecommendationRow = Database['public']['Tables']['user_recommendations']['Row'];
export type UserOutcomeRow = Database['public']['Tables']['user_outcomes']['Row'];
export type UserActionRow = Database['public']['Tables']['user_actions']['Row'];
export type UserLifeEventRow = Database['public']['Tables']['user_life_events']['Row'];
export type InsurancePlanRow = Database['public']['Tables']['insurance_plans']['Row'];
export type EducationIntakeRow = Database['public']['Tables']['education_intake']['Row'];
export type EducationCredentialRow = Database['public']['Tables']['education_credentials']['Row'];
export type FamilyLifestyleProfileRow =
  Database['public']['Tables']['family_lifestyle_profile']['Row'];
export type ChildrenEducationGoalRow =
  Database['public']['Tables']['children_education_goals']['Row'];
export type UserOnboardingSectionRow =
  Database['public']['Tables']['user_onboarding_sections']['Row'];
export type GoalDiscoveryTurnRow = Database['public']['Tables']['goal_discovery_turns']['Row'];
export type EstatePlanningProfileRow =
  Database['public']['Tables']['estate_planning_profile']['Row'];
export type EstateBeneficiaryRow = Database['public']['Tables']['estate_beneficiaries']['Row'];

export type OnboardingSectionKey =
  | 'core_life_vision'
  | 'financial'
  | 'career'
  | 'education'
  | 'health_wellness'
  | 'insurance_benefits'
  | 'family_lifestyle'
  | 'risk_decision_preferences'
  | 'commitment_capacity'
  | 'final_review';
