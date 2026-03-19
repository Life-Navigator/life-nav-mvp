-- ==========================================================================
-- GraphRAG CDC Triggers for Email & Calendar
-- Connects email_messages and calendar_events tables to the GraphRAG
-- sync pipeline (sync_queue → entity_mapper → Neo4j + Qdrant)
-- ==========================================================================

-- -------------------------------------------------------------------------
-- Email (communication domain)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_email_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'email', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'email', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'subject', NEW.subject,
        'from_address', NEW.from_address,
        'from_name', NEW.from_name,
        'snippet', LEFT(NEW.snippet, 300),
        'date', NEW.date,
        'is_read', NEW.is_read,
        'labels', NEW.labels,
        'thread_id', NEW.thread_id,
        'provider', NEW.provider
      )
    );
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'graphrag email sync trigger: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_graphrag_email_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_email_sync();

-- -------------------------------------------------------------------------
-- Calendar events (calendar domain)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.trigger_calendar_event_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'calendar_event', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'calendar_event', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'summary', NEW.summary,
        'description', LEFT(NEW.description, 300),
        'location', NEW.location,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time,
        'all_day', NEW.all_day,
        'status', NEW.status,
        'attendee_count', jsonb_array_length(COALESCE(NEW.attendees, '[]'::jsonb)),
        'is_organizer', NEW.is_organizer,
        'conference_url', NEW.conference_url,
        'provider', NEW.provider
      )
    );
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'graphrag calendar_event sync trigger: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_graphrag_calendar_event_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_calendar_event_sync();

-- -------------------------------------------------------------------------
-- Sync queue stats RPC (used by sync-status API route)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.get_sync_queue_stats(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'pending_count', COALESCE(SUM(CASE WHEN sync_status IN ('pending', 'processing') THEN 1 ELSE 0 END), 0),
    'failed_count', COALESCE(SUM(CASE WHEN sync_status IN ('failed', 'dead') THEN 1 ELSE 0 END), 0),
    'last_processed_at', MAX(processed_at)
  ) INTO v_result
  FROM graphrag.sync_queue
  WHERE user_id = p_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION graphrag.get_sync_queue_stats FROM PUBLIC;
GRANT EXECUTE ON FUNCTION graphrag.get_sync_queue_stats TO service_role;
