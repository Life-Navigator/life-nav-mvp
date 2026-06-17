-- ==========================================================================
-- Fix graphrag.trigger_course_sync() — it referenced NEW.topic, but
-- public.courses (migration 033) has NO `topic` column (that field lives on
-- public.study_logs). Every INSERT/UPDATE/DELETE on public.courses therefore
-- failed with: ERROR 42703 record "new" has no field "topic".
--
-- This broke BOTH the Add-Course and Add-Certification save paths (the
-- certifications API writes a completed course). Migrations 055 and 075 both
-- carried the bug; 075's "fix" did not remove `topic`. We drop it here and
-- keep only real columns from public.courses.
-- ==========================================================================

CREATE OR REPLACE FUNCTION graphrag.trigger_course_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'course', OLD.id::text,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'course', NEW.id::text,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'course_name',    NEW.course_name,
        'provider',       NEW.provider,
        'level',          NEW.level,
        'status',         NEW.status,
        'duration_hours', NEW.duration_hours
      )
    );
    RETURN NEW;
  END IF;
END;
$$;
