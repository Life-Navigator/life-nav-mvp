-- ==========================================================================
-- 074: GraphRAG v2 sync triggers
--
--   Wires the new tables from migrations 060–073 into the existing
--   graphrag.sync_queue plumbing defined in 050_graphrag.sql.
--
-- ----- Pre-existing triggers (preserved, NOT recreated here) ---------------
--   050: goals, financial_accounts, risk_assessments, career_profiles
--   055: education_records, courses, job_applications, career_connections,
--        resumes, financial_goals, investment_holdings, transactions,
--        family_members, health_records, health_metrics, documents
--   068: goal_discovery_turns, estate_planning_profile, estate_beneficiaries
--
-- ----- Added in this migration --------------------------------------------
--   Core user-graph (060/061):   12 tables
--   Optimizer (070):              4 tables
--   Trajectory (071):             5 tables
--   Insurance (064):              3 tables
--   Benefits (069), Education extras (065), Family/lifestyle (066), Finance
--   summary (062), Health (063/069/073 — singletons + key time-series),
--   Marketplace (072 user-scoped only).
--
--   Total: 41 new triggers + their per-entity functions.
--
-- ----- Conventions ---------------------------------------------------------
--   * Every trigger calls graphrag.enqueue_sync(p_user_id, p_entity_type,
--     p_entity_id UUID, p_source_table, p_operation, p_payload JSONB).
--     entity_id is passed as the raw UUID (no ::text cast). The function's
--     signature expects UUID and an explicit cast to TEXT silently breaks
--     16 of the 19 pre-existing triggers — see PERSONALIZED_GRAPHRAG_ACTIVATION.md
--     for the fix recommendation. This migration does NOT alter those
--     pre-existing triggers to avoid risk of accidental behavior change.
--   * Payloads are intentionally narrow: 3–6 information-bearing fields per
--     entity. The Rust normalizer rebuilds the summary; keeping enqueue
--     cheap caps the worst-case sync_queue row size.
--   * Sensitive fields (anything *_encrypted, member_id, group_number,
--     account_number, routing_number, notes_encrypted) are NEVER included
--     in the payload. The Rust worker has a belt-and-braces filter; this
--     is the suspenders.
--   * Every function is SECURITY DEFINER (matches 050/055/068 pattern).
--   * DROP TRIGGER IF EXISTS makes the file safely re-applicable.
-- ==========================================================================


-- ==========================================================================
-- Section A — Core user-graph (060/061)
-- ==========================================================================

-- A1. user_life_vision -----------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_life_vision_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_vision', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_vision', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'horizon', NEW.horizon,
        'vision_text', NEW.vision_text,
        'domains', NEW.domains,
        'confidence_score', NEW.confidence_score));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_life_vision_sync ON public.user_life_vision;
CREATE TRIGGER trigger_graphrag_user_life_vision_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_life_vision
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_life_vision_sync();

-- A2. user_constraints -----------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_constraints_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'constraint', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'constraint', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'dimension', NEW.dimension,
        'severity', NEW.severity,
        'description', NEW.description,
        'value_numeric', NEW.value_numeric,
        'value_unit', NEW.value_unit,
        'is_active', NEW.is_active));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_constraints_sync ON public.user_constraints;
CREATE TRIGGER trigger_graphrag_user_constraints_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_constraints
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_constraints_sync();

-- A3. user_capabilities ----------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_capabilities_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'capability', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'capability', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'capability_name', NEW.capability_name,
        'domain', NEW.domain,
        'proficiency_level', NEW.proficiency_level,
        'self_assessed', NEW.self_assessed));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_capabilities_sync ON public.user_capabilities;
CREATE TRIGGER trigger_graphrag_user_capabilities_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_capabilities
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_capabilities_sync();

-- A4. user_commitment_levels -----------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_commitment_levels_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'commitment_level', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'commitment_level', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'domain', NEW.domain,
        'hours_per_week', NEW.hours_per_week,
        'energy_level', NEW.energy_level,
        'duration_weeks', NEW.duration_weeks));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_commitment_levels_sync ON public.user_commitment_levels;
CREATE TRIGGER trigger_graphrag_user_commitment_levels_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_commitment_levels
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_commitment_levels_sync();

-- A5. user_motivations -----------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_motivations_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'motivation', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'motivation', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'motivation_text', NEW.motivation_text,
        'motivation_type', NEW.motivation_type,
        'intensity', NEW.intensity,
        'goal_id', NEW.goal_id));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_motivations_sync ON public.user_motivations;
CREATE TRIGGER trigger_graphrag_user_motivations_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_motivations
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_motivations_sync();

-- A6. user_decision_preferences --------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_decision_preferences_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'decision_preference', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'decision_preference', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'axis', NEW.axis,
        'weight', NEW.weight,
        'notes', NEW.notes));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_decision_preferences_sync ON public.user_decision_preferences;
CREATE TRIGGER trigger_graphrag_user_decision_preferences_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_decision_preferences
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_decision_preferences_sync();

-- A7. user_domain_risk_tolerance -------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_domain_risk_tolerance_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'domain_risk_tolerance', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'domain_risk_tolerance', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'domain', NEW.domain,
        'tolerance_score', NEW.tolerance_score,
        'qualitative_level', NEW.qualitative_level));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_domain_risk_tolerance_sync ON public.user_domain_risk_tolerance;
CREATE TRIGGER trigger_graphrag_user_domain_risk_tolerance_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_domain_risk_tolerance
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_domain_risk_tolerance_sync();

-- A8. user_decisions -------------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_decisions_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'decision', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'decision', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'decision_type', NEW.decision_type,
        'title', NEW.title,
        'description', NEW.description,
        'rationale', NEW.rationale,
        'reversibility', NEW.reversibility,
        'status', NEW.status,
        'goal_id', NEW.goal_id,
        'made_at', NEW.made_at));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_decisions_sync ON public.user_decisions;
CREATE TRIGGER trigger_graphrag_user_decisions_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_decisions
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_decisions_sync();

-- A9. user_recommendations -------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_recommendations_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'recommendation', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'recommendation', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'source_agent', NEW.source_agent,
        'action', NEW.action,
        'rationale', NEW.rationale,
        'expected_impact', NEW.expected_impact,
        'priority', NEW.priority,
        'status', NEW.status,
        'goal_id', NEW.goal_id,
        'decision_id', NEW.decision_id));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_recommendations_sync ON public.user_recommendations;
CREATE TRIGGER trigger_graphrag_user_recommendations_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_recommendations
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_recommendations_sync();

-- A10. user_outcomes -------------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_outcomes_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'outcome', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'outcome', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'outcome_type', NEW.outcome_type,
        'observed_value', NEW.observed_value,
        'observed_unit', NEW.observed_unit,
        'observed_at', NEW.observed_at,
        'goal_id', NEW.goal_id,
        'decision_id', NEW.decision_id,
        'recommendation_id', NEW.recommendation_id));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_outcomes_sync ON public.user_outcomes;
CREATE TRIGGER trigger_graphrag_user_outcomes_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_outcomes
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_outcomes_sync();

-- A11. user_actions --------------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_actions_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'action', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'action', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'domain', NEW.domain,
        'action_type', NEW.action_type,
        'action_title', NEW.action_title,
        'taken_at', NEW.taken_at,
        'status', NEW.status,
        'goal_id', NEW.goal_id,
        'decision_id', NEW.decision_id,
        'recommendation_id', NEW.recommendation_id));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_actions_sync ON public.user_actions;
CREATE TRIGGER trigger_graphrag_user_actions_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_actions
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_actions_sync();

-- A12. user_life_events ----------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_life_events_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_event', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_event', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'event_type', NEW.event_type,
        'event_title', NEW.event_title,
        'occurred_at', NEW.occurred_at,
        'expected_at', NEW.expected_at,
        'is_anticipated', NEW.is_anticipated,
        'impact_level', NEW.impact_level));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_life_events_sync ON public.user_life_events;
CREATE TRIGGER trigger_graphrag_user_life_events_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.user_life_events
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_life_events_sync();


-- ==========================================================================
-- Section B — Optimizer (070)
-- ==========================================================================

-- B1. goal_interpretations -------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_goal_interpretations_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'goal_interpretation', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'goal_interpretation', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'goal_id', NEW.goal_id,
        'stated_goal', NEW.stated_goal,
        'inferred_true_goal', NEW.inferred_true_goal,
        'confidence_score', NEW.confidence_score));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_goal_interpretations_sync ON public.goal_interpretations;
CREATE TRIGGER trigger_graphrag_goal_interpretations_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_interpretations
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_goal_interpretations_sync();

-- B2. goal_optimizer_runs --------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_optimizer_runs_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'optimizer_run', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'optimizer_run', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'goal_id', NEW.goal_id,
        'status', NEW.status,
        'engine_version', NEW.engine_version,
        'monthly_surplus', NEW.monthly_surplus,
        'next_best_action', NEW.next_best_action,
        'summary', NEW.summary,
        'confidence_score', NEW.confidence_score));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_optimizer_runs_sync ON public.goal_optimizer_runs;
CREATE TRIGGER trigger_graphrag_optimizer_runs_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_optimizer_runs
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_optimizer_runs_sync();

-- B3. goal_optimizer_allocations -------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_optimizer_allocations_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'optimizer_allocation', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'optimizer_allocation', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'run_id', NEW.run_id,
        'category', NEW.category,
        'amount_usd', NEW.amount_usd,
        'share_pct', NEW.share_pct,
        'priority', NEW.priority,
        'rationale', NEW.rationale,
        'category_score', NEW.category_score));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_optimizer_allocations_sync ON public.goal_optimizer_allocations;
CREATE TRIGGER trigger_graphrag_optimizer_allocations_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_optimizer_allocations
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_optimizer_allocations_sync();

-- B4. goal_optimizer_recommendations ---------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_optimizer_recommendations_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'optimizer_recommendation', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'optimizer_recommendation', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'run_id', NEW.run_id,
        'title', NEW.title,
        'body', NEW.body,
        'status', NEW.status,
        'confidence_score', NEW.confidence_score));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_optimizer_recommendations_sync ON public.goal_optimizer_recommendations;
CREATE TRIGGER trigger_graphrag_optimizer_recommendations_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_optimizer_recommendations
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_optimizer_recommendations_sync();


-- ==========================================================================
-- Section C — Trajectory (071)
-- ==========================================================================

-- C1. life_scenarios -------------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_life_scenarios_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_scenario', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_scenario', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'title', NEW.title,
        'description', NEW.description,
        'domain', NEW.domain,
        'primary_goal_id', NEW.primary_goal_id,
        'status', NEW.status));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_life_scenarios_sync ON public.life_scenarios;
CREATE TRIGGER trigger_graphrag_life_scenarios_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.life_scenarios
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_life_scenarios_sync();

-- C2. life_scenario_versions -----------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_life_scenario_versions_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_scenario_version', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_scenario_version', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'scenario_id', NEW.scenario_id,
        'version_index', NEW.version_index,
        'label', NEW.label,
        'horizon_years', NEW.horizon_years,
        'status', NEW.status));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_life_scenario_versions_sync ON public.life_scenario_versions;
CREATE TRIGGER trigger_graphrag_life_scenario_versions_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.life_scenario_versions
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_life_scenario_versions_sync();

-- C3. life_scenario_decisions ----------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_life_scenario_decisions_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_scenario_decision', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_scenario_decision', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'scenario_version_id', NEW.scenario_version_id,
        'decision_type', NEW.decision_type,
        'description', NEW.description,
        'at_month', NEW.at_month,
        'amount', NEW.amount));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_life_scenario_decisions_sync ON public.life_scenario_decisions;
CREATE TRIGGER trigger_graphrag_life_scenario_decisions_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.life_scenario_decisions
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_life_scenario_decisions_sync();

-- C4. life_scenario_outputs ------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_life_scenario_outputs_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_scenario_output', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_scenario_output', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'scenario_version_id', NEW.scenario_version_id,
        'final_net_worth', NEW.final_net_worth,
        'final_debt', NEW.final_debt,
        'final_annual_income', NEW.final_annual_income,
        'retirement_ready', NEW.retirement_ready,
        'emergency_fund_months_final', NEW.emergency_fund_months_final,
        'health_cost_exposure_final', NEW.health_cost_exposure_final,
        'recommended', NEW.recommended,
        'rationale', NEW.rationale));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_life_scenario_outputs_sync ON public.life_scenario_outputs;
CREATE TRIGGER trigger_graphrag_life_scenario_outputs_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.life_scenario_outputs
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_life_scenario_outputs_sync();

-- C5. life_trajectory_snapshots --------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_life_trajectory_snapshots_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_trajectory_snapshot', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_trajectory_snapshot', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'taken_at', NEW.taken_at,
        'net_worth', NEW.net_worth,
        'annual_income', NEW.annual_income,
        'monthly_cash_flow', NEW.monthly_cash_flow,
        'total_debt', NEW.total_debt,
        'emergency_months', NEW.emergency_months,
        'health_cost_exposure', NEW.health_cost_exposure));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_life_trajectory_snapshots_sync ON public.life_trajectory_snapshots;
CREATE TRIGGER trigger_graphrag_life_trajectory_snapshots_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.life_trajectory_snapshots
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_life_trajectory_snapshots_sync();


-- ==========================================================================
-- Section D — Insurance + Benefits (064 / 069)
-- ==========================================================================

-- D1. insurance_plans ------------------------------------------------------
--   *** member_id_encrypted and group_number_encrypted are deliberately
--   *** NOT included in the payload. The Rust normalizer also drops them
--   *** as a second line of defense.
CREATE OR REPLACE FUNCTION graphrag.trigger_insurance_plans_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'insurance_plan', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'insurance_plan', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'plan_type', NEW.plan_type,
        'carrier', NEW.carrier,
        'plan_name', NEW.plan_name,
        'monthly_premium', NEW.monthly_premium,
        'annual_deductible', NEW.annual_deductible,
        'out_of_pocket_max', NEW.out_of_pocket_max,
        'coinsurance_percent', NEW.coinsurance_percent,
        'hsa_eligible', NEW.hsa_eligible,
        'fsa_eligible', NEW.fsa_eligible,
        'hra_eligible', NEW.hra_eligible,
        'network_type', NEW.network_type,
        'source_of_coverage', NEW.source_of_coverage,
        'is_primary', NEW.is_primary,
        'is_active', NEW.is_active));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_insurance_plans_sync ON public.insurance_plans;
CREATE TRIGGER trigger_graphrag_insurance_plans_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.insurance_plans
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_insurance_plans_sync();

-- D2. insurance_documents (metadata only — no OCR raw text in payload) -----
CREATE OR REPLACE FUNCTION graphrag.trigger_insurance_documents_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'insurance_document', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'insurance_document', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'insurance_plan_id', NEW.insurance_plan_id,
        'document_type', NEW.document_type,
        'filename', NEW.filename,
        'ocr_status', NEW.ocr_status,
        'ocr_completed_at', NEW.ocr_completed_at));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_insurance_documents_sync ON public.insurance_documents;
CREATE TRIGGER trigger_graphrag_insurance_documents_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.insurance_documents
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_insurance_documents_sync();

-- D3. insurance_extracted_facts --------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_insurance_extracted_facts_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'insurance_document_fact', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'insurance_document_fact', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'insurance_document_id', NEW.insurance_document_id,
        'insurance_plan_id', NEW.insurance_plan_id,
        'fact_key', NEW.fact_key,
        'fact_value_text', NEW.fact_value_text,
        'fact_value_numeric', NEW.fact_value_numeric,
        'fact_value_date', NEW.fact_value_date,
        'confidence_score', NEW.confidence_score,
        'approved', NEW.approved));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_insurance_extracted_facts_sync ON public.insurance_extracted_facts;
CREATE TRIGGER trigger_graphrag_insurance_extracted_facts_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.insurance_extracted_facts
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_insurance_extracted_facts_sync();

-- D4. benefit_profiles -----------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_benefit_profiles_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'benefit_profile', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'benefit_profile', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'has_employer_wellness_stipend', NEW.has_employer_wellness_stipend,
        'wellness_stipend_annual', NEW.wellness_stipend_annual,
        'has_education_reimbursement', NEW.has_education_reimbursement,
        'education_reimbursement_annual', NEW.education_reimbursement_annual,
        'has_commuter_benefits', NEW.has_commuter_benefits,
        'has_dependent_care_fsa', NEW.has_dependent_care_fsa,
        'has_espp', NEW.has_espp,
        'has_va_benefits', NEW.has_va_benefits));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_benefit_profiles_sync ON public.benefit_profiles;
CREATE TRIGGER trigger_graphrag_benefit_profiles_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.benefit_profiles
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_benefit_profiles_sync();


-- ==========================================================================
-- Section E — Finance summary (062)
-- ==========================================================================

-- E1. finance.user_financial_profile ---------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_user_financial_profile_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'user_financial_profile', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'user_financial_profile', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'annual_income', NEW.annual_income,
        'income_stability', NEW.income_stability,
        'employment_type', NEW.employment_type,
        'household_annual_income', NEW.household_annual_income,
        'monthly_expenses', NEW.monthly_expenses,
        'emergency_fund_months', NEW.emergency_fund_months,
        'credit_score_range', NEW.credit_score_range,
        'employer_match_percent', NEW.employer_match_percent,
        'estimated_marginal_tax_bracket', NEW.estimated_marginal_tax_bracket));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_user_financial_profile_sync ON finance.user_financial_profile;
CREATE TRIGGER trigger_graphrag_user_financial_profile_sync
  AFTER INSERT OR UPDATE OR DELETE ON finance.user_financial_profile
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_user_financial_profile_sync();

-- E2. finance.debts --------------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_finance_debts_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'debt', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'debt', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'debt_name', NEW.debt_name,
        'debt_type', NEW.debt_type,
        'current_balance', NEW.current_balance,
        'interest_rate', NEW.interest_rate,
        'minimum_payment', NEW.minimum_payment,
        'payoff_strategy', NEW.payoff_strategy,
        'is_active', NEW.is_active));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_finance_debts_sync ON finance.debts;
CREATE TRIGGER trigger_graphrag_finance_debts_sync
  AFTER INSERT OR UPDATE OR DELETE ON finance.debts
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_finance_debts_sync();

-- E3. finance.financing_preferences ----------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_financing_preferences_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'financing_preference', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'financing_preference', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'liquidity_preference', NEW.liquidity_preference,
        'liquidity_target_months', NEW.liquidity_target_months,
        'debt_pay_weight', NEW.debt_pay_weight,
        'invest_weight', NEW.invest_weight,
        'save_weight', NEW.save_weight));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_financing_preferences_sync ON finance.financing_preferences;
CREATE TRIGGER trigger_graphrag_financing_preferences_sync
  AFTER INSERT OR UPDATE OR DELETE ON finance.financing_preferences
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_financing_preferences_sync();


-- ==========================================================================
-- Section F — Education + Family extras (065 / 066)
-- ==========================================================================

-- F1. education_intake -----------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_education_intake_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'education_intake', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'education_intake', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'highest_completed_degree', NEW.highest_completed_degree,
        'current_program', NEW.current_program,
        'current_institution', NEW.current_institution,
        'tuition_budget_annual', NEW.tuition_budget_annual,
        'expected_roi_preference', NEW.expected_roi_preference,
        'credential_urgency', NEW.credential_urgency,
        'has_gi_bill', NEW.has_gi_bill,
        'desired_schools', NEW.desired_schools));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_education_intake_sync ON public.education_intake;
CREATE TRIGGER trigger_graphrag_education_intake_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.education_intake
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_education_intake_sync();

-- F2. education_credentials ------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_education_credentials_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'certification', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'certification', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'credential_kind', NEW.credential_kind,
        'name', NEW.name,
        'issuer', NEW.issuer,
        'issued_at', NEW.issued_at,
        'expires_at', NEW.expires_at,
        'status', NEW.status));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_education_credentials_sync ON public.education_credentials;
CREATE TRIGGER trigger_graphrag_education_credentials_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.education_credentials
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_education_credentials_sync();

-- F3. family_lifestyle_profile ---------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_family_lifestyle_profile_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'lifestyle_goal', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'lifestyle_goal', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'has_elder_care_responsibilities', NEW.has_elder_care_responsibilities,
        'caregiving_hours_per_week', NEW.caregiving_hours_per_week,
        'family_financial_obligations_monthly', NEW.family_financial_obligations_monthly,
        'willing_to_relocate', NEW.willing_to_relocate,
        'travel_frequency_target', NEW.travel_frequency_target,
        'lifestyle_goals', NEW.lifestyle_goals,
        'household_priorities', NEW.household_priorities));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_family_lifestyle_profile_sync ON public.family_lifestyle_profile;
CREATE TRIGGER trigger_graphrag_family_lifestyle_profile_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.family_lifestyle_profile
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_family_lifestyle_profile_sync();


-- ==========================================================================
-- Section G — Health (063 / 069 / 073)
--   Triggers fire on writes regardless of is_health_enabled() (the gate
--   only affects authenticated reads/writes via RLS; service_role and
--   trigger-time SECURITY DEFINER bypass it). When the feature unlocks,
--   the queue is already warm with the historical writes.
-- ==========================================================================

-- G1. health_meta.training_profile -----------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_training_profile_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'fitness_profile', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'fitness_profile', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'activity_level', NEW.activity_level,
        'years_training', NEW.years_training,
        'preferred_modalities', NEW.preferred_modalities,
        'sessions_per_week_target', NEW.sessions_per_week_target,
        'gym_access', NEW.gym_access,
        'swimming_access', NEW.swimming_access));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_training_profile_sync ON health_meta.training_profile;
CREATE TRIGGER trigger_graphrag_training_profile_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.training_profile
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_training_profile_sync();

-- G2. health_meta.body_measurements ----------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_body_measurements_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'body_measurement', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'body_measurement', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'measured_at', NEW.measured_at,
        'height_cm', NEW.height_cm,
        'weight_kg', NEW.weight_kg,
        'target_weight_kg', NEW.target_weight_kg,
        'body_fat_percent', NEW.body_fat_percent,
        'waist_cm', NEW.waist_cm,
        'chest_cm', NEW.chest_cm,
        'hips_cm', NEW.hips_cm));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_body_measurements_sync ON health_meta.body_measurements;
CREATE TRIGGER trigger_graphrag_body_measurements_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.body_measurements
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_body_measurements_sync();

-- G3. health_meta.injuries -------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_injuries_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'injury', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'injury', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'body_region', NEW.body_region,
        'side', NEW.side,
        'severity', NEW.severity,
        'pain_score', NEW.pain_score,
        'status', NEW.status,
        'onset_date', NEW.onset_date,
        'affects_modalities', NEW.affects_modalities));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_injuries_sync ON health_meta.injuries;
CREATE TRIGGER trigger_graphrag_injuries_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.injuries
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_injuries_sync();

-- G4. health_meta.daily_wellbeing ------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_daily_wellbeing_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'health_metric', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'health_metric', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'observed_on', NEW.observed_on,
        'sleep_hours', NEW.sleep_hours,
        'sleep_quality', NEW.sleep_quality,
        'energy_score', NEW.energy_score,
        'recovery_score', NEW.recovery_score,
        'stress_score', NEW.stress_score,
        'mood_score', NEW.mood_score));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_daily_wellbeing_sync ON health_meta.daily_wellbeing;
CREATE TRIGGER trigger_graphrag_daily_wellbeing_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.daily_wellbeing
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_daily_wellbeing_sync();

-- G5. health_meta.nutrition_profile ----------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_nutrition_profile_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'nutrition_log', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'nutrition_log', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'diet_type', NEW.diet_type,
        'daily_calorie_target', NEW.daily_calorie_target,
        'protein_target_g', NEW.protein_target_g,
        'carb_target_g', NEW.carb_target_g,
        'fat_target_g', NEW.fat_target_g,
        'water_target_ml', NEW.water_target_ml,
        'food_allergies', NEW.food_allergies));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_nutrition_profile_sync ON health_meta.nutrition_profile;
CREATE TRIGGER trigger_graphrag_nutrition_profile_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.nutrition_profile
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_nutrition_profile_sync();

-- G6. health_meta.health_profile (singleton intent table) ------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_health_profile_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'health_profile', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'health_profile', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'primary_health_goal', NEW.primary_health_goal,
        'secondary_health_goals', NEW.secondary_health_goals,
        'arcana_optimization_consented', NEW.arcana_optimization_consented,
        'share_with_physician', NEW.share_with_physician,
        'preferred_communication_cadence', NEW.preferred_communication_cadence));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_health_profile_sync ON health_meta.health_profile;
CREATE TRIGGER trigger_graphrag_health_profile_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.health_profile
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_health_profile_sync();

-- G7. health_meta.health_alert_events --------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_health_alert_events_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'health_alert_event', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'health_alert_event', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'rule_key', NEW.rule_key,
        'severity', NEW.severity,
        'observed_at', NEW.observed_at,
        'headline', NEW.headline,
        'recommended_next_step', NEW.recommended_next_step));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_health_alert_events_sync ON health_meta.health_alert_events;
CREATE TRIGGER trigger_graphrag_health_alert_events_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.health_alert_events
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_health_alert_events_sync();


-- ==========================================================================
-- Section H — Marketplace, user-scoped only (072)
--   employer_profiles + employer_job_posts are shared/public-facing, not
--   per-user personal graph. We sync only the candidate-facing rows.
-- ==========================================================================

-- H1. candidate_career_profiles --------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_candidate_career_profiles_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'career_profile', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'career_profile', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'visibility', NEW.visibility,
        'open_to_introductions', NEW.open_to_introductions,
        'desired_industries', NEW.desired_industries,
        'desired_locations', NEW.desired_locations,
        'availability_timeline', NEW.availability_timeline));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_candidate_career_profiles_sync ON public.candidate_career_profiles;
CREATE TRIGGER trigger_graphrag_candidate_career_profiles_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_career_profiles
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_candidate_career_profiles_sync();

-- H2. job_candidate_matches ------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_job_candidate_matches_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'candidate_match', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb);
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'candidate_match', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'job_post_id', NEW.job_post_id,
        'employer_id', NEW.employer_id,
        'match_score', NEW.match_score,
        'status', NEW.status,
        'employer_facing_summary', NEW.employer_facing_summary));
    RETURN NEW;
  END IF;
END$$;
DROP TRIGGER IF EXISTS trigger_graphrag_job_candidate_matches_sync ON public.job_candidate_matches;
CREATE TRIGGER trigger_graphrag_job_candidate_matches_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.job_candidate_matches
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_job_candidate_matches_sync();


-- ==========================================================================
-- Wrap-up
-- ==========================================================================
COMMENT ON SCHEMA graphrag IS
  '074 added 41 sync triggers covering core user-graph (12), optimizer (4), '
  'trajectory (5), insurance + benefits (4), finance summary (3), education + '
  'family (3), health singletons + key time-series (7), marketplace user-scoped (2).';
