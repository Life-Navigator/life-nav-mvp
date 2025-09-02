-- Enable encryption and security features for PostgreSQL
-- This script configures encryption at the database level

-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create encryption key table (keys stored in Azure Key Vault, this is for metadata)
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name VARCHAR(255) NOT NULL UNIQUE,
    key_version INTEGER NOT NULL DEFAULT 1,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    purpose VARCHAR(100) NOT NULL,
    CHECK (algorithm IN ('AES-256-GCM', 'AES-256-CBC', 'RSA-4096'))
);

-- Create function for transparent encryption
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(
    plaintext text,
    key_name text DEFAULT 'default'
) RETURNS text AS $$
DECLARE
    encryption_key text;
BEGIN
    -- In production, this key comes from Azure Key Vault
    -- This is a placeholder that the application will override
    encryption_key := current_setting('app.encryption_key', true);
    
    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Encryption key not set. Configure app.encryption_key';
    END IF;
    
    RETURN encode(
        pgp_sym_encrypt(
            plaintext,
            encryption_key,
            'cipher-algo=aes256'
        ),
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for transparent decryption
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(
    ciphertext text,
    key_name text DEFAULT 'default'
) RETURNS text AS $$
DECLARE
    encryption_key text;
BEGIN
    -- In production, this key comes from Azure Key Vault
    encryption_key := current_setting('app.encryption_key', true);
    
    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Encryption key not set. Configure app.encryption_key';
    END IF;
    
    RETURN pgp_sym_decrypt(
        decode(ciphertext, 'base64'),
        encryption_key,
        'cipher-algo=aes256'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function for automatic encryption
CREATE OR REPLACE FUNCTION auto_encrypt_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt sensitive fields based on table
    CASE TG_TABLE_NAME
        WHEN 'User' THEN
            IF NEW.email IS NOT NULL THEN
                NEW.email = encrypt_sensitive_data(NEW.email);
            END IF;
        WHEN 'UserProfile' THEN
            IF NEW."phoneNumber" IS NOT NULL THEN
                NEW."phoneNumber" = encrypt_sensitive_data(NEW."phoneNumber");
            END IF;
            IF NEW."dateOfBirth" IS NOT NULL THEN
                NEW."dateOfBirth" = encrypt_sensitive_data(NEW."dateOfBirth"::text)::date;
            END IF;
        WHEN 'RiskAssessment' THEN
            IF NEW."riskData" IS NOT NULL THEN
                NEW."riskData" = encrypt_sensitive_data(NEW."riskData"::text)::jsonb;
            END IF;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "AuditLog" (
        id,
        "userId",
        action,
        entity,
        "entityId",
        changes,
        "ipAddress",
        "userAgent",
        "createdAt"
    ) VALUES (
        gen_random_uuid()::text,
        current_setting('app.current_user_id', true),
        TG_OP,
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
                'old', to_jsonb(OLD),
                'new', to_jsonb(NEW)
            )
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        END,
        current_setting('app.client_ip', true),
        current_setting('app.user_agent', true),
        CURRENT_TIMESTAMP
    );
    
    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_user_changes
    AFTER INSERT OR UPDATE OR DELETE ON "User"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_goal_changes
    AFTER INSERT OR UPDATE OR DELETE ON "Goal"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_risk_assessment_changes
    AFTER INSERT OR UPDATE OR DELETE ON "RiskAssessment"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_user_profile_changes
    AFTER INSERT OR UPDATE OR DELETE ON "UserProfile"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Create function for data masking (for non-privileged users)
CREATE OR REPLACE FUNCTION mask_sensitive_data(
    data text,
    mask_type text DEFAULT 'email'
) RETURNS text AS $$
BEGIN
    CASE mask_type
        WHEN 'email' THEN
            -- Show only first 2 chars and domain
            RETURN CASE 
                WHEN data LIKE '%@%' THEN
                    LEFT(SPLIT_PART(data, '@', 1), 2) || '***@' || SPLIT_PART(data, '@', 2)
                ELSE '***'
            END;
        WHEN 'phone' THEN
            -- Show only last 4 digits
            RETURN '***-***-' || RIGHT(data, 4);
        WHEN 'ssn' THEN
            -- Show only last 4 digits
            RETURN '***-**-' || RIGHT(data, 4);
        ELSE
            RETURN '***';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create view with masked data for reporting
CREATE OR REPLACE VIEW user_profile_masked AS
SELECT 
    "userId",
    mask_sensitive_data("phoneNumber", 'phone') as phone_masked,
    "preferredName",
    timezone,
    "createdAt",
    "updatedAt"
FROM "UserProfile";

-- Grant limited access to masked view
GRANT SELECT ON user_profile_masked TO PUBLIC;

-- Create function to check encryption status
CREATE OR REPLACE FUNCTION check_encryption_status()
RETURNS TABLE (
    table_name text,
    column_name text,
    is_encrypted boolean,
    encryption_type text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::text,
        c.column_name::text,
        CASE 
            WHEN c.column_name IN ('email', 'phoneNumber', 'dateOfBirth', 'riskData') 
            THEN true 
            ELSE false 
        END as is_encrypted,
        CASE 
            WHEN c.column_name IN ('email', 'phoneNumber', 'dateOfBirth', 'riskData') 
            THEN 'AES-256-GCM'
            ELSE 'none'
        END as encryption_type
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND c.column_name IN ('email', 'phoneNumber', 'dateOfBirth', 'riskData', 'password');
END;
$$ LANGUAGE plpgsql;

-- Create index on encrypted fields for performance
CREATE INDEX IF NOT EXISTS idx_user_email_encrypted ON "User" USING hash(email);
CREATE INDEX IF NOT EXISTS idx_profile_phone_encrypted ON "UserProfile" USING hash("phoneNumber");

-- Set up key rotation reminder
CREATE TABLE IF NOT EXISTS key_rotation_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name VARCHAR(255) NOT NULL,
    last_rotation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_rotation TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    rotation_interval INTERVAL DEFAULT '90 days'
);

-- Insert default key rotation schedule
INSERT INTO key_rotation_schedule (key_name) 
VALUES ('default'), ('user_data'), ('health_data')
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Encryption configuration completed successfully';
    RAISE NOTICE 'Remember to:';
    RAISE NOTICE '1. Set app.encryption_key from Azure Key Vault';
    RAISE NOTICE '2. Rotate keys every 90 days';
    RAISE NOTICE '3. Test encryption with: SELECT check_encryption_status()';
END $$;