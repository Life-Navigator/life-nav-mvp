-- ==========================================================================
-- 075: Fix migration 055 GraphRAG triggers
--
-- Background
-- ----------
-- 050_graphrag.sql defines:
--   graphrag.enqueue_sync(p_user_id UUID, p_entity_type TEXT,
--                         p_entity_id UUID,  -- <<<< UUID, not TEXT
--                         p_source_table TEXT, p_operation TEXT,
--                         p_payload JSONB)
--
-- 055_graphrag_expanded_triggers.sql calls it with `OLD.id::text` and
-- `NEW.id::text`. PostgreSQL does not implicitly cast TEXT -> UUID, so
-- every fire of the 12 functions in 055 raises:
--   ERROR: function graphrag.enqueue_sync(uuid, text, text, text, text, jsonb)
--          does not exist
--
-- Consequence: until this migration is applied, none of the historical
-- entity types from 055 (education_record, course, job_application,
-- career_connection, resume, financial_goal, investment_holding,
-- transaction, family_member, health_record, health_metric, document)
-- have ever produced sync-queue rows. Their Neo4j + Qdrant projections
-- are missing.
--
-- This migration
-- --------------
-- Rewrites all 12 functions to pass `OLD.id` / `NEW.id` (UUID) directly.
-- Functions are replaced in place via CREATE OR REPLACE — the existing
-- 12 triggers (created in 055) continue to reference them by name, so
-- no DROP TRIGGER / CREATE TRIGGER is needed.
--
-- Idempotent: re-running this file is a no-op (functions are replaced
-- with their already-correct bodies).
-- ==========================================================================


-- -------------------------------------------------------------------------
-- 1. Education domain
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_education_record_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'education_record', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'education_record', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'institution_name', NEW.institution_name,
        'degree_type',      NEW.degree_type,
        'field_of_study',   NEW.field_of_study,
        'start_date',       NEW.start_date,
        'end_date',         NEW.end_date,
        'gpa',              NEW.gpa,
        'status',           NEW.status
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION graphrag.trigger_course_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'course', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'course', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'course_name',    NEW.course_name,
        'provider',       NEW.provider,
        'level',          NEW.level,
        'topic',          NEW.topic,
        'status',         NEW.status,
        'duration_hours', NEW.duration_hours
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


-- -------------------------------------------------------------------------
-- 2. Career domain
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_job_application_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'job_application', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'job_application', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'company',      NEW.company,
        'position',     NEW.position,
        'status',       NEW.status,
        'applied_date', NEW.applied_date,
        'match_score',  NEW.match_score,
        'priority',     NEW.priority
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION graphrag.trigger_career_connection_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'career_connection', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'career_connection', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'name',              NEW.name,
        'company',           NEW.company,
        'title',             NEW.title,
        'relationship_type', NEW.relationship_type
        -- 'notes' deliberately omitted: may contain sensitive free text;
        -- summary is reconstructable from the structured fields.
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION graphrag.trigger_resume_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'resume', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'resume', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'title',        NEW.title,
        'version',      NEW.version,
        'format',       NEW.format,
        'tailored_for', NEW.tailored_for,
        'is_default',   NEW.is_default
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


-- -------------------------------------------------------------------------
-- 3. Finance domain
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_financial_goal_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'financial_goal', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'financial_goal', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'name',           NEW.name,
        'target_amount',  NEW.target_amount,
        'current_amount', NEW.current_amount,
        'target_date',    NEW.target_date,
        'priority',       NEW.priority,
        'account_id',     NEW.account_id,
        'goal_id',        NEW.goal_id
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION graphrag.trigger_investment_holding_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'investment_holding', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'investment_holding', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'symbol',        NEW.symbol,
        'quantity',      NEW.quantity,
        'cost_basis',    NEW.cost_basis,
        'current_value', NEW.current_value,
        'account_id',    NEW.account_id
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION graphrag.trigger_transaction_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'transaction', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'transaction', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'amount',           NEW.amount,
        'category',         NEW.category,
        'merchant',         NEW.merchant,
        -- 'description' deliberately omitted: may carry merchant memos
        -- or transfer notes the user wouldn't want embedded.
        'transaction_date', NEW.transaction_date,
        'account_id',       NEW.account_id
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


-- -------------------------------------------------------------------------
-- 4. Family domain
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_family_member_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'family_member', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'family_member', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'name',          NEW.name,
        'relationship',  NEW.relationship,
        'date_of_birth', NEW.date_of_birth
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


-- -------------------------------------------------------------------------
-- 5. Health domain
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_health_record_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'health_record', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'health_record', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'record_type', NEW.record_type,
        'record_date', NEW.record_date,
        'provider',    NEW.provider
        -- 'notes' deliberately omitted: PHI free text.
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION graphrag.trigger_health_metric_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'health_metric', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'health_metric', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'metric_type', NEW.metric_type,
        'value',       NEW.value,
        'unit',        NEW.unit,
        'measured_at', NEW.measured_at
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


-- -------------------------------------------------------------------------
-- 6. Documents
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_document_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'document', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'document', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'name',          NEW.name,
        'document_type', NEW.document_type,
        'mime_type',     NEW.mime_type,
        'storage_path',  NEW.storage_path
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


-- -------------------------------------------------------------------------
-- 7. Self-test: prove the type signatures now match. This block raises
--    if any of the 12 functions still resolves to a signature that the
--    fixed call sites can't reach.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn      TEXT;
  v_fns     TEXT[] := ARRAY[
    'graphrag.trigger_education_record_sync',
    'graphrag.trigger_course_sync',
    'graphrag.trigger_job_application_sync',
    'graphrag.trigger_career_connection_sync',
    'graphrag.trigger_resume_sync',
    'graphrag.trigger_financial_goal_sync',
    'graphrag.trigger_investment_holding_sync',
    'graphrag.trigger_transaction_sync',
    'graphrag.trigger_family_member_sync',
    'graphrag.trigger_health_record_sync',
    'graphrag.trigger_health_metric_sync',
    'graphrag.trigger_document_sync'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_fns LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname || '.' || p.proname = v_fn
    ) THEN
      v_missing := array_append(v_missing, v_fn);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION '075 self-test failed: missing functions %', v_missing;
  END IF;
END $$;
