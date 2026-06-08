-- 144_documents_triggers.sql — GraphRAG sync for the Document Intelligence Platform.
-- enum-before-trigger: Document/DocumentField enum variants are deployed in the worker. Documents
-- -> :Document (user HAS_DOCUMENT); extracted fields -> :DocumentField (fk HAS_EXTRACTED_FIELD
-- <- document_id). This is the data-acquisition graph every domain reads from.
CREATE OR REPLACE FUNCTION documents.enqueue_doc_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, documents, graphrag, pg_catalog, pg_temp
AS $$
DECLARE v_op TEXT; v_etype TEXT := TG_ARGV[0];
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, v_etype, OLD.id, 'documents.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, v_etype, NEW.id, 'documents.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END; $$;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('documents', 'document'),
    ('document_fields', 'document_field')
  ) AS t(tbl, etype) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_graphrag_%1$s ON documents.%1$I', r.tbl);
    EXECUTE format('CREATE TRIGGER trg_graphrag_%1$s AFTER INSERT OR UPDATE OR DELETE ON documents.%1$I FOR EACH ROW EXECUTE FUNCTION documents.enqueue_doc_sync(%2$L)', r.tbl, r.etype);
  END LOOP;
END $$;
