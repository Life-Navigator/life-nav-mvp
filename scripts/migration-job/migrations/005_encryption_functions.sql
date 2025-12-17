-- =============================================================================
-- Migration 005: Encryption Functions for Sensitive Data
-- =============================================================================
-- Description: Implements field-level encryption for sensitive data
-- Uses pgcrypto extension for AES-256 encryption
-- Key management should be handled by application layer (AWS KMS, GCP KMS, etc.)
-- =============================================================================

-- Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- ENCRYPTION KEY MANAGEMENT
-- =============================================================================
-- NOTE: In production, encryption keys should NEVER be stored in the database.
-- Use a Key Management Service (KMS) like:
--   - AWS KMS
--   - Google Cloud KMS
--   - HashiCorp Vault
--   - Azure Key Vault
--
-- The functions below expect the encryption key to be passed via session context:
--   SET app.encryption_key = 'your-32-byte-key-from-kms';
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
-- APPLY ENCRYPTION TO EXISTING TABLES
-- =============================================================================

-- Add encrypted columns to plaid_connections (Financial DB)
-- NOTE: Run this in the Financial database
ALTER TABLE plaid_connections
    ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA;

-- Migration function to encrypt existing tokens
CREATE OR REPLACE FUNCTION migrate_encrypt_plaid_tokens()
RETURNS void AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id, plaid_access_token FROM plaid_connections WHERE access_token_encrypted IS NULL AND plaid_access_token IS NOT NULL
    LOOP
        UPDATE plaid_connections
        SET access_token_encrypted = encrypt_sensitive(rec.plaid_access_token),
            plaid_access_token = '***MIGRATED***'  -- Clear plaintext after encryption
        WHERE id = rec.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ENCRYPTED COLUMNS FOR HIPAA DATA
-- =============================================================================

-- Add encrypted columns to health_conditions (HIPAA DB)
-- NOTE: Run this in the HIPAA database
ALTER TABLE health_conditions
    ADD COLUMN IF NOT EXISTS condition_name_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS treatment_plan_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS notes_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS condition_name_hash TEXT;

-- Add encrypted columns to medications
ALTER TABLE medications
    ADD COLUMN IF NOT EXISTS medication_name_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS prescription_number_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS notes_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS medication_name_hash TEXT;

-- Add encrypted columns to diagnoses
ALTER TABLE diagnoses
    ADD COLUMN IF NOT EXISTS diagnosis_description_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS clinical_notes_encrypted BYTEA;

-- =============================================================================
-- VIEWS FOR TRANSPARENT DECRYPTION
-- =============================================================================

-- View that automatically decrypts health conditions
-- Application queries this view instead of base table
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

-- View for medications
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

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC ENCRYPTION ON INSERT/UPDATE
-- =============================================================================

-- Trigger function to encrypt health condition data on insert/update
CREATE OR REPLACE FUNCTION encrypt_health_condition_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Only encrypt if encryption key is set
    IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
        -- Encrypt sensitive fields
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

CREATE TRIGGER health_conditions_encrypt_trigger
    BEFORE INSERT OR UPDATE ON health_conditions
    FOR EACH ROW EXECUTE FUNCTION encrypt_health_condition_data();

-- Trigger function for medications
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

CREATE TRIGGER medications_encrypt_trigger
    BEFORE INSERT OR UPDATE ON medications
    FOR EACH ROW EXECUTE FUNCTION encrypt_medication_data();

-- =============================================================================
-- SEARCH FUNCTIONS FOR ENCRYPTED DATA
-- =============================================================================

-- Search health conditions by encrypted condition name
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

-- =============================================================================
-- KEY ROTATION SUPPORT
-- =============================================================================

-- Function to re-encrypt data with a new key
-- IMPORTANT: This should be run during a maintenance window
CREATE OR REPLACE FUNCTION rotate_encryption_key(
    old_key_hex TEXT,
    new_key_hex TEXT
)
RETURNS TABLE (
    table_name TEXT,
    records_updated INTEGER
) AS $$
DECLARE
    rec RECORD;
    count_updated INTEGER := 0;
    old_key BYTEA;
    new_key BYTEA;
BEGIN
    old_key := decode(old_key_hex, 'hex');
    new_key := decode(new_key_hex, 'hex');

    -- Set old key for decryption
    PERFORM set_config('app.encryption_key', old_key_hex, true);

    -- Re-encrypt health_conditions
    FOR rec IN SELECT id, condition_name_encrypted, treatment_plan_encrypted, notes_encrypted
               FROM health_conditions
               WHERE condition_name_encrypted IS NOT NULL
    LOOP
        -- Decrypt with old key, encrypt with new key
        PERFORM set_config('app.encryption_key', new_key_hex, true);

        UPDATE health_conditions
        SET
            condition_name_encrypted = CASE
                WHEN rec.condition_name_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.condition_name_encrypted)))
                ELSE NULL
            END,
            treatment_plan_encrypted = CASE
                WHEN rec.treatment_plan_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.treatment_plan_encrypted)))
                ELSE NULL
            END,
            notes_encrypted = CASE
                WHEN rec.notes_encrypted IS NOT NULL
                THEN encrypt_sensitive((SELECT decrypt_sensitive(rec.notes_encrypted)))
                ELSE NULL
            END
        WHERE id = rec.id;

        count_updated := count_updated + 1;
    END LOOP;

    table_name := 'health_conditions';
    records_updated := count_updated;
    RETURN NEXT;

    -- Add similar blocks for medications, diagnoses, etc.

END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- AUDIT ENCRYPTION OPERATIONS
-- =============================================================================

-- Log all encryption/decryption operations for compliance
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

CREATE INDEX idx_encryption_audit_tenant ON encryption_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_encryption_audit_operation ON encryption_audit_log(operation, created_at DESC);

-- Immutable - no updates or deletes
ALTER TABLE encryption_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY encryption_audit_append_only ON encryption_audit_log
    FOR INSERT
    TO authenticated, service_account
    WITH CHECK (true);

CREATE POLICY encryption_audit_read ON encryption_audit_log
    FOR SELECT
    TO service_account
    USING (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION encrypt_sensitive IS 'Encrypts text using AES-256-CBC with random IV. Key from session context.';
COMMENT ON FUNCTION decrypt_sensitive IS 'Decrypts data encrypted with encrypt_sensitive.';
COMMENT ON FUNCTION hash_for_search IS 'Creates deterministic HMAC-SHA256 hash for searching encrypted fields.';
COMMENT ON FUNCTION rotate_encryption_key IS 'Re-encrypts all data with a new key. Run during maintenance window.';
COMMENT ON VIEW health_conditions_decrypted IS 'Transparent decryption view for health_conditions table.';
COMMENT ON TABLE encryption_audit_log IS 'Audit trail for all encryption/decryption operations.';

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================

/*
-- 1. Set encryption key from KMS before any database operations
SET app.encryption_key = 'your-64-character-hex-string-representing-32-bytes';

-- 2. Insert data (automatically encrypted by trigger)
INSERT INTO health_conditions (tenant_id, user_id, condition_name, treatment_plan)
VALUES ('tenant-uuid', 'user-uuid', 'Hypertension', 'Daily medication and lifestyle changes');

-- 3. Read data via decrypted view
SELECT * FROM health_conditions_decrypted WHERE user_id = 'user-uuid';

-- 4. Search encrypted data by hash
SELECT * FROM search_health_conditions_by_name('tenant-uuid', 'Hypertension');

-- 5. Rotate encryption key (maintenance window)
SELECT * FROM rotate_encryption_key('old-key-hex', 'new-key-hex');
*/
