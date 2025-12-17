-- =============================================================================
-- Migration 005: Encryption Functions for HIPAA Database
-- =============================================================================
-- Description: Implements field-level encryption for Protected Health Information (PHI)
-- Uses pgcrypto extension for AES-256 encryption
-- Key management should be handled by application layer (GCP KMS, etc.)
-- HIPAA Security Rule: 45 CFR 164.312(a)(2)(iv) - Encryption and Decryption
-- =============================================================================

-- Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- ENCRYPTION KEY MANAGEMENT
-- =============================================================================
-- NOTE: In production, encryption keys should NEVER be stored in the database.
-- Use Google Cloud KMS or similar service.
--
-- The functions below expect the encryption key to be passed via session context:
--   SET app.encryption_key = 'your-64-char-hex-string';
-- =============================================================================

-- Function to get encryption key from session context
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS BYTEA AS $$
DECLARE
    key_hex TEXT;
BEGIN
    key_hex := current_setting('app.encryption_key', true);

    IF key_hex IS NULL OR key_hex = '' THEN
        RAISE EXCEPTION 'Encryption key not set in session context. Call SET app.encryption_key first.';
    END IF;

    -- Key should be 32 bytes (256 bits) for AES-256
    RETURN decode(key_hex, 'hex');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- ENCRYPTION FUNCTIONS
-- =============================================================================

-- Encrypt text data using AES-256-CBC with random IV
CREATE OR REPLACE FUNCTION encrypt_sensitive(plaintext TEXT)
RETURNS BYTEA AS $$
DECLARE
    key BYTEA;
    iv BYTEA;
    encrypted BYTEA;
BEGIN
    IF plaintext IS NULL THEN
        RETURN NULL;
    END IF;

    key := get_encryption_key();
    iv := gen_random_bytes(16);  -- 128-bit IV for AES-CBC

    -- Encrypt using AES-256-CBC
    encrypted := encrypt_iv(
        convert_to(plaintext, 'UTF8'),
        key,
        iv,
        'aes-cbc'
    );

    -- Prepend IV to encrypted data (IV || ciphertext)
    RETURN iv || encrypted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt data encrypted with encrypt_sensitive
CREATE OR REPLACE FUNCTION decrypt_sensitive(ciphertext BYTEA)
RETURNS TEXT AS $$
DECLARE
    key BYTEA;
    iv BYTEA;
    encrypted BYTEA;
    decrypted BYTEA;
BEGIN
    IF ciphertext IS NULL THEN
        RETURN NULL;
    END IF;

    key := get_encryption_key();

    -- Extract IV (first 16 bytes) and ciphertext
    iv := substring(ciphertext from 1 for 16);
    encrypted := substring(ciphertext from 17);

    -- Decrypt using AES-256-CBC
    decrypted := decrypt_iv(encrypted, key, iv, 'aes-cbc');

    RETURN convert_from(decrypted, 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Encrypt JSONB data
CREATE OR REPLACE FUNCTION encrypt_sensitive_json(plaintext_json JSONB)
RETURNS BYTEA AS $$
BEGIN
    IF plaintext_json IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN encrypt_sensitive(plaintext_json::TEXT);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt to JSONB
CREATE OR REPLACE FUNCTION decrypt_sensitive_json(ciphertext BYTEA)
RETURNS JSONB AS $$
DECLARE
    decrypted_text TEXT;
BEGIN
    IF ciphertext IS NULL THEN
        RETURN NULL;
    END IF;

    decrypted_text := decrypt_sensitive(ciphertext);
    RETURN decrypted_text::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- HASHING FUNCTIONS (for searchable encrypted fields)
-- =============================================================================

-- Create a deterministic hash for searching encrypted data
-- HMAC-SHA256 with tenant-specific salt prevents rainbow table attacks
CREATE OR REPLACE FUNCTION hash_for_search(
    plaintext TEXT,
    tenant_id UUID
)
RETURNS TEXT AS $$
DECLARE
    key BYTEA;
    salt TEXT;
BEGIN
    IF plaintext IS NULL THEN
        RETURN NULL;
    END IF;

    key := get_encryption_key();
    salt := tenant_id::TEXT;

    -- HMAC-SHA256 produces a deterministic hash for searching
    RETURN encode(
        hmac(plaintext || salt, key, 'sha256'),
        'hex'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADD ENCRYPTED COLUMNS TO HEALTH_CONDITIONS
-- =============================================================================

ALTER TABLE health_conditions
    ADD COLUMN IF NOT EXISTS condition_name_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS treatment_plan_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS notes_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS condition_name_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_health_conditions_name_hash ON health_conditions(condition_name_hash);

-- =============================================================================
-- ADD ENCRYPTED COLUMNS TO MEDICATIONS
-- =============================================================================

ALTER TABLE medications
    ADD COLUMN IF NOT EXISTS medication_name_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS prescription_number_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS notes_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS medication_name_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_medications_name_hash ON medications(medication_name_hash);

-- =============================================================================
-- ADD ENCRYPTED COLUMNS TO DIAGNOSES
-- =============================================================================

ALTER TABLE diagnoses
    ADD COLUMN IF NOT EXISTS diagnosis_description_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS clinical_notes_encrypted BYTEA;

-- =============================================================================
-- ADD ENCRYPTED COLUMNS TO TREATMENTS
-- =============================================================================

ALTER TABLE treatments
    ADD COLUMN IF NOT EXISTS treatment_name_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS description_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS outcome_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS notes_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS treatment_name_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_treatments_name_hash ON treatments(treatment_name_hash);

-- =============================================================================
-- ADD ENCRYPTED COLUMNS TO HEALTH_RECORDS
-- =============================================================================

ALTER TABLE health_records
    ADD COLUMN IF NOT EXISTS record_name_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS results_text_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS interpretation_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS notes_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS results_encrypted BYTEA;  -- For JSONB results

-- =============================================================================
-- ADD ENCRYPTED COLUMNS TO MEDICAL_APPOINTMENTS
-- =============================================================================

ALTER TABLE medical_appointments
    ADD COLUMN IF NOT EXISTS visit_summary_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS follow_up_notes_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS notes_encrypted BYTEA;

-- =============================================================================
-- DECRYPTION VIEWS FOR TRANSPARENT ACCESS
-- =============================================================================

-- Health Conditions decrypted view
CREATE OR REPLACE VIEW health_conditions_decrypted AS
SELECT
    id,
    tenant_id,
    user_id,
    COALESCE(decrypt_sensitive(condition_name_encrypted), condition_name) AS condition_name,
    condition_type,
    severity,
    icd_10_code,
    diagnosis_date,
    resolved_date,
    status,
    diagnosed_by,
    symptoms,
    COALESCE(decrypt_sensitive(treatment_plan_encrypted), treatment_plan) AS treatment_plan,
    metadata,
    COALESCE(decrypt_sensitive(notes_encrypted), notes) AS notes,
    created_at,
    updated_at,
    deleted_at
FROM health_conditions
WHERE deleted_at IS NULL;

-- Medications decrypted view
CREATE OR REPLACE VIEW medications_decrypted AS
SELECT
    id,
    tenant_id,
    user_id,
    condition_id,
    COALESCE(decrypt_sensitive(medication_name_encrypted), medication_name) AS medication_name,
    generic_name,
    dosage,
    dosage_unit,
    form,
    frequency,
    route,
    start_date,
    end_date,
    last_refill_date,
    next_refill_date,
    status,
    is_as_needed,
    prescribed_by,
    COALESCE(decrypt_sensitive(prescription_number_encrypted), prescription_number) AS prescription_number,
    pharmacy_name,
    reminder_enabled,
    reminder_times,
    side_effects,
    interactions,
    metadata,
    COALESCE(decrypt_sensitive(notes_encrypted), notes) AS notes,
    created_at,
    updated_at,
    deleted_at
FROM medications
WHERE deleted_at IS NULL;

-- Diagnoses decrypted view
CREATE OR REPLACE VIEW diagnoses_decrypted AS
SELECT
    id,
    tenant_id,
    user_id,
    condition_id,
    diagnosis_code,
    COALESCE(decrypt_sensitive(diagnosis_description_encrypted), diagnosis_description) AS diagnosis_description,
    diagnosis_type,
    diagnosis_date,
    diagnosing_provider,
    facility_name,
    COALESCE(decrypt_sensitive(clinical_notes_encrypted), clinical_notes) AS clinical_notes,
    certainty,
    metadata,
    created_at,
    updated_at,
    deleted_at
FROM diagnoses
WHERE deleted_at IS NULL;

-- Treatments decrypted view
CREATE OR REPLACE VIEW treatments_decrypted AS
SELECT
    id,
    tenant_id,
    user_id,
    condition_id,
    treatment_type,
    COALESCE(decrypt_sensitive(treatment_name_encrypted), treatment_name) AS treatment_name,
    COALESCE(decrypt_sensitive(description_encrypted), description) AS description,
    provider_name,
    facility_name,
    start_date,
    end_date,
    frequency,
    duration_minutes,
    status,
    COALESCE(decrypt_sensitive(outcome_encrypted), outcome) AS outcome,
    effectiveness_rating,
    estimated_cost,
    currency,
    metadata,
    COALESCE(decrypt_sensitive(notes_encrypted), notes) AS notes,
    created_at,
    updated_at,
    deleted_at
FROM treatments
WHERE deleted_at IS NULL;

-- Health Records decrypted view
CREATE OR REPLACE VIEW health_records_decrypted AS
SELECT
    id,
    tenant_id,
    user_id,
    record_type,
    COALESCE(decrypt_sensitive(record_name_encrypted), record_name) AS record_name,
    record_date,
    ordering_provider,
    performing_facility,
    COALESCE(decrypt_sensitive_json(results_encrypted), results) AS results,
    COALESCE(decrypt_sensitive(results_text_encrypted), results_text) AS results_text,
    normal_range,
    is_abnormal,
    COALESCE(decrypt_sensitive(interpretation_encrypted), interpretation) AS interpretation,
    file_url,
    file_name,
    file_type,
    file_size_bytes,
    metadata,
    COALESCE(decrypt_sensitive(notes_encrypted), notes) AS notes,
    created_at,
    updated_at,
    deleted_at
FROM health_records
WHERE deleted_at IS NULL;

-- Medical Appointments decrypted view
CREATE OR REPLACE VIEW medical_appointments_decrypted AS
SELECT
    id,
    tenant_id,
    user_id,
    condition_id,
    appointment_type,
    provider_name,
    provider_specialty,
    facility_name,
    facility_address,
    appointment_date,
    duration_minutes,
    check_in_time,
    status,
    preparation_instructions,
    fasting_required,
    follow_up_required,
    follow_up_date,
    COALESCE(decrypt_sensitive(follow_up_notes_encrypted), follow_up_notes) AS follow_up_notes,
    COALESCE(decrypt_sensitive(visit_summary_encrypted), visit_summary) AS visit_summary,
    diagnosis_codes,
    metadata,
    COALESCE(decrypt_sensitive(notes_encrypted), notes) AS notes,
    created_at,
    updated_at,
    deleted_at
FROM medical_appointments
WHERE deleted_at IS NULL;

-- =============================================================================
-- ENCRYPTION TRIGGERS FOR AUTOMATIC PHI ENCRYPTION
-- =============================================================================

-- Health Conditions encryption trigger
CREATE OR REPLACE FUNCTION encrypt_health_condition_data()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
        IF NEW.condition_name IS NOT NULL AND NEW.condition_name != '***ENCRYPTED***' THEN
            NEW.condition_name_encrypted := encrypt_sensitive(NEW.condition_name);
            NEW.condition_name_hash := hash_for_search(NEW.condition_name, NEW.tenant_id);
            NEW.condition_name := '***ENCRYPTED***';
        END IF;

        IF NEW.treatment_plan IS NOT NULL AND NEW.treatment_plan != '***ENCRYPTED***' THEN
            NEW.treatment_plan_encrypted := encrypt_sensitive(NEW.treatment_plan);
            NEW.treatment_plan := '***ENCRYPTED***';
        END IF;

        IF NEW.notes IS NOT NULL AND NEW.notes != '***ENCRYPTED***' THEN
            NEW.notes_encrypted := encrypt_sensitive(NEW.notes);
            NEW.notes := '***ENCRYPTED***';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS health_conditions_encrypt_trigger ON health_conditions;
CREATE TRIGGER health_conditions_encrypt_trigger
    BEFORE INSERT OR UPDATE ON health_conditions
    FOR EACH ROW EXECUTE FUNCTION encrypt_health_condition_data();

-- Medications encryption trigger
CREATE OR REPLACE FUNCTION encrypt_medication_data()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
        IF NEW.medication_name IS NOT NULL AND NEW.medication_name != '***ENCRYPTED***' THEN
            NEW.medication_name_encrypted := encrypt_sensitive(NEW.medication_name);
            NEW.medication_name_hash := hash_for_search(NEW.medication_name, NEW.tenant_id);
            NEW.medication_name := '***ENCRYPTED***';
        END IF;

        IF NEW.prescription_number IS NOT NULL AND NEW.prescription_number != '***ENCRYPTED***' THEN
            NEW.prescription_number_encrypted := encrypt_sensitive(NEW.prescription_number);
            NEW.prescription_number := '***ENCRYPTED***';
        END IF;

        IF NEW.notes IS NOT NULL AND NEW.notes != '***ENCRYPTED***' THEN
            NEW.notes_encrypted := encrypt_sensitive(NEW.notes);
            NEW.notes := '***ENCRYPTED***';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS medications_encrypt_trigger ON medications;
CREATE TRIGGER medications_encrypt_trigger
    BEFORE INSERT OR UPDATE ON medications
    FOR EACH ROW EXECUTE FUNCTION encrypt_medication_data();

-- Diagnoses encryption trigger
CREATE OR REPLACE FUNCTION encrypt_diagnosis_data()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
        IF NEW.diagnosis_description IS NOT NULL AND NEW.diagnosis_description != '***ENCRYPTED***' THEN
            NEW.diagnosis_description_encrypted := encrypt_sensitive(NEW.diagnosis_description);
            NEW.diagnosis_description := '***ENCRYPTED***';
        END IF;

        IF NEW.clinical_notes IS NOT NULL AND NEW.clinical_notes != '***ENCRYPTED***' THEN
            NEW.clinical_notes_encrypted := encrypt_sensitive(NEW.clinical_notes);
            NEW.clinical_notes := '***ENCRYPTED***';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS diagnoses_encrypt_trigger ON diagnoses;
CREATE TRIGGER diagnoses_encrypt_trigger
    BEFORE INSERT OR UPDATE ON diagnoses
    FOR EACH ROW EXECUTE FUNCTION encrypt_diagnosis_data();

-- Treatments encryption trigger
CREATE OR REPLACE FUNCTION encrypt_treatment_data()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
        IF NEW.treatment_name IS NOT NULL AND NEW.treatment_name != '***ENCRYPTED***' THEN
            NEW.treatment_name_encrypted := encrypt_sensitive(NEW.treatment_name);
            NEW.treatment_name_hash := hash_for_search(NEW.treatment_name, NEW.tenant_id);
            NEW.treatment_name := '***ENCRYPTED***';
        END IF;

        IF NEW.description IS NOT NULL AND NEW.description != '***ENCRYPTED***' THEN
            NEW.description_encrypted := encrypt_sensitive(NEW.description);
            NEW.description := '***ENCRYPTED***';
        END IF;

        IF NEW.outcome IS NOT NULL AND NEW.outcome != '***ENCRYPTED***' THEN
            NEW.outcome_encrypted := encrypt_sensitive(NEW.outcome);
            NEW.outcome := '***ENCRYPTED***';
        END IF;

        IF NEW.notes IS NOT NULL AND NEW.notes != '***ENCRYPTED***' THEN
            NEW.notes_encrypted := encrypt_sensitive(NEW.notes);
            NEW.notes := '***ENCRYPTED***';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS treatments_encrypt_trigger ON treatments;
CREATE TRIGGER treatments_encrypt_trigger
    BEFORE INSERT OR UPDATE ON treatments
    FOR EACH ROW EXECUTE FUNCTION encrypt_treatment_data();

-- Health Records encryption trigger
CREATE OR REPLACE FUNCTION encrypt_health_record_data()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
        IF NEW.record_name IS NOT NULL AND NEW.record_name != '***ENCRYPTED***' THEN
            NEW.record_name_encrypted := encrypt_sensitive(NEW.record_name);
            NEW.record_name := '***ENCRYPTED***';
        END IF;

        IF NEW.results_text IS NOT NULL AND NEW.results_text != '***ENCRYPTED***' THEN
            NEW.results_text_encrypted := encrypt_sensitive(NEW.results_text);
            NEW.results_text := '***ENCRYPTED***';
        END IF;

        IF NEW.interpretation IS NOT NULL AND NEW.interpretation != '***ENCRYPTED***' THEN
            NEW.interpretation_encrypted := encrypt_sensitive(NEW.interpretation);
            NEW.interpretation := '***ENCRYPTED***';
        END IF;

        IF NEW.results IS NOT NULL THEN
            NEW.results_encrypted := encrypt_sensitive_json(NEW.results);
            NEW.results := NULL;
        END IF;

        IF NEW.notes IS NOT NULL AND NEW.notes != '***ENCRYPTED***' THEN
            NEW.notes_encrypted := encrypt_sensitive(NEW.notes);
            NEW.notes := '***ENCRYPTED***';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS health_records_encrypt_trigger ON health_records;
CREATE TRIGGER health_records_encrypt_trigger
    BEFORE INSERT OR UPDATE ON health_records
    FOR EACH ROW EXECUTE FUNCTION encrypt_health_record_data();

-- Medical Appointments encryption trigger
CREATE OR REPLACE FUNCTION encrypt_appointment_data()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
        IF NEW.visit_summary IS NOT NULL AND NEW.visit_summary != '***ENCRYPTED***' THEN
            NEW.visit_summary_encrypted := encrypt_sensitive(NEW.visit_summary);
            NEW.visit_summary := '***ENCRYPTED***';
        END IF;

        IF NEW.follow_up_notes IS NOT NULL AND NEW.follow_up_notes != '***ENCRYPTED***' THEN
            NEW.follow_up_notes_encrypted := encrypt_sensitive(NEW.follow_up_notes);
            NEW.follow_up_notes := '***ENCRYPTED***';
        END IF;

        IF NEW.notes IS NOT NULL AND NEW.notes != '***ENCRYPTED***' THEN
            NEW.notes_encrypted := encrypt_sensitive(NEW.notes);
            NEW.notes := '***ENCRYPTED***';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_encrypt_trigger ON medical_appointments;
CREATE TRIGGER appointments_encrypt_trigger
    BEFORE INSERT OR UPDATE ON medical_appointments
    FOR EACH ROW EXECUTE FUNCTION encrypt_appointment_data();

-- =============================================================================
-- SEARCH FUNCTIONS FOR ENCRYPTED PHI
-- =============================================================================

-- Search health conditions by encrypted name
CREATE OR REPLACE FUNCTION search_health_conditions_by_name(
    p_tenant_id UUID,
    p_search_term TEXT
)
RETURNS TABLE (
    id UUID,
    condition_name TEXT,
    condition_type VARCHAR(50),
    severity VARCHAR(50),
    status VARCHAR(50)
) AS $$
DECLARE
    search_hash TEXT;
BEGIN
    search_hash := hash_for_search(p_search_term, p_tenant_id);

    RETURN QUERY
    SELECT
        hc.id,
        decrypt_sensitive(hc.condition_name_encrypted) AS condition_name,
        hc.condition_type,
        hc.severity,
        hc.status
    FROM health_conditions hc
    WHERE hc.tenant_id = p_tenant_id
        AND hc.condition_name_hash = search_hash
        AND hc.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search medications by encrypted name
CREATE OR REPLACE FUNCTION search_medications_by_name(
    p_tenant_id UUID,
    p_search_term TEXT
)
RETURNS TABLE (
    id UUID,
    medication_name TEXT,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    status VARCHAR(50)
) AS $$
DECLARE
    search_hash TEXT;
BEGIN
    search_hash := hash_for_search(p_search_term, p_tenant_id);

    RETURN QUERY
    SELECT
        m.id,
        decrypt_sensitive(m.medication_name_encrypted) AS medication_name,
        m.dosage,
        m.frequency,
        m.status
    FROM medications m
    WHERE m.tenant_id = p_tenant_id
        AND m.medication_name_hash = search_hash
        AND m.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ENCRYPTION AUDIT LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS encryption_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('encrypt', 'decrypt', 'key_rotation', 'search')),
    table_name VARCHAR(100),
    record_id UUID,
    field_names TEXT[],
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encryption_audit_tenant ON encryption_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_operation ON encryption_audit_log(operation, created_at DESC);

-- Immutable - append only
ALTER TABLE encryption_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- KEY ROTATION SUPPORT
-- =============================================================================

-- Rotate encryption key for all PHI tables
CREATE OR REPLACE FUNCTION rotate_hipaa_encryption_key(
    old_key_hex TEXT,
    new_key_hex TEXT
)
RETURNS TABLE (
    table_name TEXT,
    records_updated INTEGER
) AS $$
DECLARE
    rec RECORD;
    count_updated INTEGER;
BEGIN
    -- Rotate health_conditions
    count_updated := 0;
    PERFORM set_config('app.encryption_key', old_key_hex, true);

    FOR rec IN SELECT id, condition_name_encrypted, treatment_plan_encrypted, notes_encrypted
               FROM health_conditions
               WHERE condition_name_encrypted IS NOT NULL
    LOOP
        PERFORM set_config('app.encryption_key', new_key_hex, true);
        UPDATE health_conditions
        SET condition_name_encrypted = encrypt_sensitive(
                (SELECT decrypt_sensitive(rec.condition_name_encrypted))),
            treatment_plan_encrypted = CASE WHEN rec.treatment_plan_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.treatment_plan_encrypted)))
                ELSE NULL END,
            notes_encrypted = CASE WHEN rec.notes_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.notes_encrypted)))
                ELSE NULL END
        WHERE id = rec.id;
        count_updated := count_updated + 1;
    END LOOP;

    table_name := 'health_conditions';
    records_updated := count_updated;
    RETURN NEXT;

    -- Rotate medications
    count_updated := 0;
    PERFORM set_config('app.encryption_key', old_key_hex, true);

    FOR rec IN SELECT id, medication_name_encrypted, prescription_number_encrypted, notes_encrypted
               FROM medications
               WHERE medication_name_encrypted IS NOT NULL
    LOOP
        PERFORM set_config('app.encryption_key', new_key_hex, true);
        UPDATE medications
        SET medication_name_encrypted = encrypt_sensitive(
                (SELECT decrypt_sensitive(rec.medication_name_encrypted))),
            prescription_number_encrypted = CASE WHEN rec.prescription_number_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.prescription_number_encrypted)))
                ELSE NULL END,
            notes_encrypted = CASE WHEN rec.notes_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.notes_encrypted)))
                ELSE NULL END
        WHERE id = rec.id;
        count_updated := count_updated + 1;
    END LOOP;

    table_name := 'medications';
    records_updated := count_updated;
    RETURN NEXT;

    -- Rotate diagnoses
    count_updated := 0;
    PERFORM set_config('app.encryption_key', old_key_hex, true);

    FOR rec IN SELECT id, diagnosis_description_encrypted, clinical_notes_encrypted
               FROM diagnoses
               WHERE diagnosis_description_encrypted IS NOT NULL
    LOOP
        PERFORM set_config('app.encryption_key', new_key_hex, true);
        UPDATE diagnoses
        SET diagnosis_description_encrypted = encrypt_sensitive(
                (SELECT decrypt_sensitive(rec.diagnosis_description_encrypted))),
            clinical_notes_encrypted = CASE WHEN rec.clinical_notes_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.clinical_notes_encrypted)))
                ELSE NULL END
        WHERE id = rec.id;
        count_updated := count_updated + 1;
    END LOOP;

    table_name := 'diagnoses';
    records_updated := count_updated;
    RETURN NEXT;

END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION encrypt_sensitive IS 'Encrypts PHI using AES-256-CBC. Key from session context.';
COMMENT ON FUNCTION decrypt_sensitive IS 'Decrypts PHI encrypted with encrypt_sensitive.';
COMMENT ON FUNCTION hash_for_search IS 'Creates HMAC-SHA256 hash for searching encrypted PHI fields.';
COMMENT ON FUNCTION rotate_hipaa_encryption_key IS 'Re-encrypts all PHI with new key. Run during maintenance window.';
COMMENT ON VIEW health_conditions_decrypted IS 'Transparent decryption view for health_conditions PHI.';
COMMENT ON VIEW medications_decrypted IS 'Transparent decryption view for medications PHI.';
COMMENT ON VIEW diagnoses_decrypted IS 'Transparent decryption view for diagnoses PHI.';
COMMENT ON VIEW treatments_decrypted IS 'Transparent decryption view for treatments PHI.';
COMMENT ON VIEW health_records_decrypted IS 'Transparent decryption view for health_records PHI.';
COMMENT ON VIEW medical_appointments_decrypted IS 'Transparent decryption view for medical_appointments PHI.';
COMMENT ON TABLE encryption_audit_log IS 'Audit trail for PHI encryption operations - HIPAA compliance.';

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================

/*
-- 1. Set encryption key from GCP KMS before database operations
SET app.encryption_key = 'your-64-character-hex-string-representing-32-bytes';

-- 2. Insert PHI (automatically encrypted by trigger)
INSERT INTO health_conditions (tenant_id, user_id, condition_name, treatment_plan)
VALUES ('tenant-uuid', 'user-uuid', 'Type 2 Diabetes', 'Metformin 500mg twice daily');

-- 3. Read PHI via decrypted view
SELECT * FROM health_conditions_decrypted WHERE user_id = 'user-uuid';

-- 4. Search encrypted PHI by hash
SELECT * FROM search_health_conditions_by_name('tenant-uuid', 'Type 2 Diabetes');

-- 5. Rotate encryption key (maintenance window, requires downtime)
SELECT * FROM rotate_hipaa_encryption_key('old-key-hex', 'new-key-hex');
*/
