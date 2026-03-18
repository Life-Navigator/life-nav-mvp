-- ==========================================================================
-- GraphRAG Expanded CDC Triggers
-- Adds sync triggers for all new entity types beyond the original 4
-- (goal, financial_account, risk_assessment, career_profile from 050_graphrag.sql)
-- ==========================================================================

-- -------------------------------------------------------------------------
-- Education domain
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
        'degree_type', NEW.degree_type,
        'field_of_study', NEW.field_of_study,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'gpa', NEW.gpa,
        'status', NEW.status
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_education_record_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.education_records
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_education_record_sync();


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
        'course_name', NEW.course_name,
        'provider', NEW.provider,
        'level', NEW.level,
        'topic', NEW.topic,
        'status', NEW.status,
        'duration_hours', NEW.duration_hours
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_course_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_course_sync();

-- -------------------------------------------------------------------------
-- Career domain (expanded)
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
        'company', NEW.company,
        'position', NEW.position,
        'status', NEW.status,
        'applied_date', NEW.applied_date,
        'match_score', NEW.match_score,
        'priority', NEW.priority
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_job_application_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_job_application_sync();


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
        'name', NEW.name,
        'company', NEW.company,
        'title', NEW.title,
        'relationship_type', NEW.relationship_type,
        'notes', NEW.notes
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_career_connection_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.career_connections
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_career_connection_sync();


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
        'title', NEW.title,
        'version', NEW.version,
        'format', NEW.format,
        'tailored_for', NEW.tailored_for,
        'is_default', NEW.is_default
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_resume_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_resume_sync();

-- -------------------------------------------------------------------------
-- Finance domain (expanded)
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
        'name', NEW.name,
        'target_amount', NEW.target_amount,
        'current_amount', NEW.current_amount,
        'target_date', NEW.target_date,
        'priority', NEW.priority,
        'account_id', NEW.account_id,
        'goal_id', NEW.goal_id
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_financial_goal_sync
  AFTER INSERT OR UPDATE OR DELETE ON finance.financial_goals
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_financial_goal_sync();


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
        'symbol', NEW.symbol,
        'quantity', NEW.quantity,
        'cost_basis', NEW.cost_basis,
        'current_value', NEW.current_value,
        'account_id', NEW.account_id
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_investment_holding_sync
  AFTER INSERT OR UPDATE OR DELETE ON finance.investment_holdings
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_investment_holding_sync();


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
        'amount', NEW.amount,
        'category', NEW.category,
        'merchant', NEW.merchant,
        'description', NEW.description,
        'transaction_date', NEW.transaction_date,
        'account_id', NEW.account_id
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_transaction_sync
  AFTER INSERT OR UPDATE OR DELETE ON finance.transactions
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_transaction_sync();

-- -------------------------------------------------------------------------
-- Family domain
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
        'name', NEW.name,
        'relationship', NEW.relationship,
        'date_of_birth', NEW.date_of_birth
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_family_member_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_family_member_sync();

-- -------------------------------------------------------------------------
-- Health domain
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
        'provider', NEW.provider,
        'notes', NEW.notes
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_health_record_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.health_records
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_health_record_sync();


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
        'value', NEW.value,
        'unit', NEW.unit,
        'measured_at', NEW.measured_at
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_health_metric_sync
  AFTER INSERT OR UPDATE OR DELETE ON health_meta.health_metrics
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_health_metric_sync();

-- -------------------------------------------------------------------------
-- Documents
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
        'name', NEW.name,
        'document_type', NEW.document_type,
        'mime_type', NEW.mime_type,
        'storage_path', NEW.storage_path
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_graphrag_document_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_document_sync();
