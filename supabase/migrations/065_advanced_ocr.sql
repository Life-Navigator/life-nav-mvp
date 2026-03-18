-- ============================================================================
-- 065: Advanced OCR Support (Gemini Vision + Document AI)
-- ============================================================================
-- Extends extraction_method values and adds OCR metadata columns to support
-- Gemini Vision multimodal extraction and future Google Document AI integration.
-- ============================================================================

-- Extend extraction_method allowed values
ALTER TABLE public.scenario_extracted_fields
  DROP CONSTRAINT IF EXISTS scenario_extracted_fields_extraction_method_check;

ALTER TABLE public.scenario_extracted_fields
  ADD CONSTRAINT scenario_extracted_fields_extraction_method_check
  CHECK (extraction_method IN (
    'ocr_pattern', 'pdf_text', 'heuristic', 'gemini_vision', 'document_ai'
  ));

-- Add auto-detected document type + OCR metadata to scenario_documents
ALTER TABLE public.scenario_documents
  ADD COLUMN IF NOT EXISTS detected_document_type TEXT,
  ADD COLUMN IF NOT EXISTS ocr_metadata JSONB DEFAULT '{}'::jsonb;

-- Add auto-detected document type + OCR metadata to upload_documents
ALTER TABLE core.upload_documents
  ADD COLUMN IF NOT EXISTS detected_document_type TEXT,
  ADD COLUMN IF NOT EXISTS ocr_metadata JSONB DEFAULT '{}'::jsonb;
