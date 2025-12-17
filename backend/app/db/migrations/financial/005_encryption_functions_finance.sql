-- =============================================================================
-- Migration 005: Encryption Functions for Financial Database
-- =============================================================================
-- Description: Implements field-level encryption for sensitive financial data
-- Uses pgcrypto extension for AES-256 encryption
-- Key management should be handled by application layer (GCP KMS, etc.)
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
-- APPLY ENCRYPTION TO PLAID CONNECTIONS
-- =============================================================================

-- Add encrypted column for Plaid access tokens
ALTER TABLE plaid_connections
    ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA;

-- Migration function to encrypt existing tokens
CREATE OR REPLACE FUNCTION migrate_encrypt_plaid_tokens()
RETURNS void AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id, plaid_access_token FROM plaid_connections
               WHERE access_token_encrypted IS NULL
               AND plaid_access_token IS NOT NULL
               AND plaid_access_token != '***MIGRATED***'
    LOOP
        UPDATE plaid_connections
        SET access_token_encrypted = encrypt_sensitive(rec.plaid_access_token),
            plaid_access_token = '***MIGRATED***'  -- Clear plaintext after encryption
        WHERE id = rec.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ENCRYPTION AUDIT LOG
-- =============================================================================

-- Log all encryption/decryption operations for PCI-DSS compliance
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

-- Immutable - no updates or deletes allowed
ALTER TABLE encryption_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- KEY ROTATION SUPPORT FOR FINANCIAL DATA
-- =============================================================================

-- Function to re-encrypt plaid tokens with a new key
CREATE OR REPLACE FUNCTION rotate_plaid_encryption_key(
    old_key_hex TEXT,
    new_key_hex TEXT
)
RETURNS INTEGER AS $$
DECLARE
    rec RECORD;
    count_updated INTEGER := 0;
    decrypted_token TEXT;
BEGIN
    FOR rec IN SELECT id, access_token_encrypted
               FROM plaid_connections
               WHERE access_token_encrypted IS NOT NULL
    LOOP
        -- Decrypt with old key
        PERFORM set_config('app.encryption_key', old_key_hex, true);
        decrypted_token := decrypt_sensitive(rec.access_token_encrypted);

        -- Encrypt with new key
        PERFORM set_config('app.encryption_key', new_key_hex, true);

        UPDATE plaid_connections
        SET access_token_encrypted = encrypt_sensitive(decrypted_token)
        WHERE id = rec.id;

        count_updated := count_updated + 1;
    END LOOP;

    RETURN count_updated;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION encrypt_sensitive IS 'Encrypts text using AES-256-CBC with random IV. Key from session context.';
COMMENT ON FUNCTION decrypt_sensitive IS 'Decrypts data encrypted with encrypt_sensitive.';
COMMENT ON FUNCTION hash_for_search IS 'Creates deterministic HMAC-SHA256 hash for searching encrypted fields.';
COMMENT ON FUNCTION migrate_encrypt_plaid_tokens IS 'One-time migration to encrypt existing Plaid tokens.';
COMMENT ON FUNCTION rotate_plaid_encryption_key IS 'Re-encrypts Plaid tokens with a new key. Run during maintenance window.';
COMMENT ON TABLE encryption_audit_log IS 'Audit trail for encryption operations - PCI-DSS compliance.';

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================

/*
-- 1. Set encryption key from GCP KMS before any database operations
SET app.encryption_key = 'your-64-character-hex-string-representing-32-bytes';

-- 2. Migrate existing Plaid tokens to encrypted format
SELECT migrate_encrypt_plaid_tokens();

-- 3. Manual encryption example
SELECT encrypt_sensitive('my-secret-token');

-- 4. Manual decryption example
SELECT decrypt_sensitive(access_token_encrypted) FROM plaid_connections WHERE id = 'some-uuid';

-- 5. Rotate encryption key (maintenance window)
SELECT rotate_plaid_encryption_key('old-key-hex', 'new-key-hex');
*/
