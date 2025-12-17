-- =============================================================================
-- HIPAA Database Migration 001: Create Health Schema
-- =============================================================================
-- Description: Creates isolated health data tables for HIPAA compliance
-- This database is completely isolated from the Core and Financial databases
-- References to tenant_id and user_id are logical (no foreign keys to Core DB)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Health Conditions
-- =============================================================================

CREATE TABLE health_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,  -- Logical reference to Core DB tenants
    user_id UUID NOT NULL,    -- Logical reference to Core DB users

    -- Condition details
    condition_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) CHECK (condition_type IN (
        'chronic', 'acute', 'genetic', 'mental_health', 'other'
    )),
    severity VARCHAR(50) CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
    icd_10_code VARCHAR(20),  -- International Classification of Diseases code

    -- Dates
    diagnosis_date DATE,
    resolved_date DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active', 'resolved', 'in_remission', 'chronic_managed'
    )),

    -- Clinical details
    diagnosed_by VARCHAR(255),  -- Healthcare provider name
    symptoms TEXT[],
    treatment_plan TEXT,

    -- ENCRYPTED FIELDS (use app-layer AES-256-GCM encryption)
    -- condition_name_encrypted, treatment_plan_encrypted, etc.

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_health_conditions_tenant ON health_conditions(tenant_id);
CREATE INDEX idx_health_conditions_user ON health_conditions(user_id);
CREATE INDEX idx_health_conditions_tenant_user ON health_conditions(tenant_id, user_id);
CREATE INDEX idx_health_conditions_status ON health_conditions(status);
CREATE INDEX idx_health_conditions_type ON health_conditions(condition_type);
CREATE INDEX idx_health_conditions_created_at ON health_conditions(created_at DESC);

-- =============================================================================
-- Medications
-- =============================================================================

CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    condition_id UUID REFERENCES health_conditions(id) ON DELETE SET NULL,

    -- Medication details
    medication_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    dosage VARCHAR(100),
    dosage_unit VARCHAR(50),
    form VARCHAR(50),
    frequency VARCHAR(100),
    route VARCHAR(50) CHECK (route IN ('oral', 'topical', 'injection', 'inhalation', 'other')),

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    last_refill_date DATE,
    next_refill_date DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active', 'discontinued', 'completed', 'on_hold'
    )),
    is_as_needed BOOLEAN DEFAULT false,

    -- Prescriber
    prescribed_by VARCHAR(255),
    prescription_number VARCHAR(100),
    pharmacy_name VARCHAR(255),

    -- Reminders
    reminder_enabled BOOLEAN DEFAULT true,
    reminder_times TIME[],

    -- Metadata
    side_effects TEXT[],
    interactions TEXT[],
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_medications_tenant ON medications(tenant_id);
CREATE INDEX idx_medications_user ON medications(user_id);
CREATE INDEX idx_medications_tenant_user ON medications(tenant_id, user_id);
CREATE INDEX idx_medications_condition ON medications(condition_id);
CREATE INDEX idx_medications_status ON medications(status);

-- =============================================================================
-- Diagnoses (Additional detail for health conditions)
-- =============================================================================

CREATE TABLE diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    condition_id UUID REFERENCES health_conditions(id) ON DELETE CASCADE,

    -- Diagnosis details
    diagnosis_code VARCHAR(20) NOT NULL,  -- ICD-10 code
    diagnosis_description TEXT NOT NULL,
    diagnosis_type VARCHAR(50) CHECK (diagnosis_type IN (
        'primary', 'secondary', 'admitting', 'working'
    )),
    diagnosis_date DATE NOT NULL,

    -- Provider
    diagnosing_provider VARCHAR(255),
    facility_name VARCHAR(255),

    -- Clinical
    clinical_notes TEXT,
    certainty VARCHAR(50) CHECK (certainty IN ('confirmed', 'provisional', 'differential', 'ruled_out')),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_diagnoses_tenant ON diagnoses(tenant_id);
CREATE INDEX idx_diagnoses_user ON diagnoses(user_id);
CREATE INDEX idx_diagnoses_condition ON diagnoses(condition_id);
CREATE INDEX idx_diagnoses_code ON diagnoses(diagnosis_code);

-- =============================================================================
-- Treatments
-- =============================================================================

CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    condition_id UUID REFERENCES health_conditions(id) ON DELETE SET NULL,

    -- Treatment details
    treatment_type VARCHAR(100) NOT NULL,
    treatment_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Provider
    provider_name VARCHAR(255),
    facility_name VARCHAR(255),

    -- Schedule
    start_date DATE,
    end_date DATE,
    frequency VARCHAR(100),
    duration_minutes INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'planned', 'active', 'completed', 'cancelled', 'on_hold'
    )),

    -- Outcome
    outcome TEXT,
    effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 10),

    -- Cost (for tracking, not billing)
    estimated_cost DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_treatments_tenant ON treatments(tenant_id);
CREATE INDEX idx_treatments_user ON treatments(user_id);
CREATE INDEX idx_treatments_condition ON treatments(condition_id);
CREATE INDEX idx_treatments_status ON treatments(status);

-- =============================================================================
-- Health Records (Lab results, imaging, etc.)
-- =============================================================================

CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Record details
    record_type VARCHAR(100) NOT NULL CHECK (record_type IN (
        'lab_result', 'imaging', 'vital_signs', 'immunization',
        'allergy', 'procedure', 'discharge_summary', 'other'
    )),
    record_name VARCHAR(255) NOT NULL,
    record_date DATE NOT NULL,

    -- Provider
    ordering_provider VARCHAR(255),
    performing_facility VARCHAR(255),

    -- Results
    results JSONB,  -- Structured results data
    results_text TEXT,  -- Free-text results
    normal_range VARCHAR(255),
    is_abnormal BOOLEAN DEFAULT false,
    interpretation TEXT,

    -- File attachment
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size_bytes INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_health_records_tenant ON health_records(tenant_id);
CREATE INDEX idx_health_records_user ON health_records(user_id);
CREATE INDEX idx_health_records_tenant_user ON health_records(tenant_id, user_id);
CREATE INDEX idx_health_records_type ON health_records(record_type);
CREATE INDEX idx_health_records_date ON health_records(record_date DESC);

-- =============================================================================
-- Medical Appointments
-- =============================================================================

CREATE TABLE medical_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    condition_id UUID REFERENCES health_conditions(id) ON DELETE SET NULL,

    -- Appointment details
    appointment_type VARCHAR(100) NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    provider_specialty VARCHAR(100),
    facility_name VARCHAR(255),
    facility_address TEXT,

    -- Schedule
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    check_in_time TIMESTAMP WITH TIME ZONE,

    -- Status
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'checked_in', 'in_progress',
        'completed', 'cancelled', 'no_show', 'rescheduled'
    )),

    -- Preparation
    preparation_instructions TEXT,
    fasting_required BOOLEAN DEFAULT false,

    -- Follow-up
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Summary
    visit_summary TEXT,
    diagnosis_codes VARCHAR(20)[],

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_medical_appointments_tenant ON medical_appointments(tenant_id);
CREATE INDEX idx_medical_appointments_user ON medical_appointments(user_id);
CREATE INDEX idx_medical_appointments_date ON medical_appointments(appointment_date);
CREATE INDEX idx_medical_appointments_status ON medical_appointments(status);

-- =============================================================================
-- HIPAA Audit Logs (7-year retention required)
-- =============================================================================

CREATE TABLE hipaa_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,  -- User who performed the action (null for system actions)
    target_user_id UUID,  -- User whose data was accessed

    -- Event details
    event_type VARCHAR(100) NOT NULL,  -- e.g., 'phi.read', 'phi.create', 'phi.update', 'phi.delete', 'phi.export'
    event_action VARCHAR(50) NOT NULL CHECK (event_action IN ('create', 'read', 'update', 'delete', 'export', 'print', 'fax')),
    event_description TEXT,

    -- Resource information
    resource_type VARCHAR(100) NOT NULL,  -- Table name: health_conditions, medications, etc.
    resource_id UUID,
    resource_data_before JSONB,  -- State before change (for updates/deletes)
    resource_data_after JSONB,   -- State after change (for creates/updates)

    -- PHI access tracking
    phi_accessed BOOLEAN DEFAULT true,
    phi_fields_accessed TEXT[],  -- Which specific PHI fields were accessed

    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    session_id UUID,

    -- Access authorization
    access_reason VARCHAR(255),  -- e.g., 'treatment', 'payment', 'healthcare_operations'
    authorization_id UUID,  -- Reference to patient consent/authorization if applicable

    -- Additional metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamp (immutable - no updated_at, HIPAA requires immutable audit logs)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for HIPAA audit logs (optimized for compliance queries)
CREATE INDEX idx_hipaa_audit_tenant ON hipaa_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_hipaa_audit_user ON hipaa_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_hipaa_audit_target_user ON hipaa_audit_logs(target_user_id, created_at DESC);
CREATE INDEX idx_hipaa_audit_event_type ON hipaa_audit_logs(event_type, created_at DESC);
CREATE INDEX idx_hipaa_audit_resource ON hipaa_audit_logs(resource_type, resource_id);
CREATE INDEX idx_hipaa_audit_created_at ON hipaa_audit_logs(created_at DESC);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_health_conditions_updated_at
    BEFORE UPDATE ON health_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at
    BEFORE UPDATE ON medications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diagnoses_updated_at
    BEFORE UPDATE ON diagnoses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatments_updated_at
    BEFORE UPDATE ON treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_records_updated_at
    BEFORE UPDATE ON health_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_appointments_updated_at
    BEFORE UPDATE ON medical_appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE health_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hipaa_audit_logs ENABLE ROW LEVEL SECURITY;

-- Function to get current tenant ID from session
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Tenant isolation policies for health data
CREATE POLICY health_conditions_tenant_isolation ON health_conditions
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY medications_tenant_isolation ON medications
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY diagnoses_tenant_isolation ON diagnoses
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY treatments_tenant_isolation ON treatments
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY health_records_tenant_isolation ON health_records
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY medical_appointments_tenant_isolation ON medical_appointments
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY hipaa_audit_logs_tenant_isolation ON hipaa_audit_logs
    FOR ALL USING (tenant_id = current_tenant_id());

-- =============================================================================
-- Database Roles
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hipaa_read') THEN
        CREATE ROLE hipaa_read;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hipaa_write') THEN
        CREATE ROLE hipaa_write;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hipaa_admin') THEN
        CREATE ROLE hipaa_admin;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO hipaa_read, hipaa_write, hipaa_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO hipaa_read;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO hipaa_write;
GRANT ALL ON ALL TABLES IN SCHEMA public TO hipaa_admin;

-- Audit logs are append-only for HIPAA compliance
REVOKE UPDATE, DELETE ON hipaa_audit_logs FROM hipaa_write;
GRANT INSERT, SELECT ON hipaa_audit_logs TO hipaa_write;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE health_conditions IS 'Patient health conditions - HIPAA protected PHI';
COMMENT ON TABLE medications IS 'Patient medications - HIPAA protected PHI';
COMMENT ON TABLE diagnoses IS 'Medical diagnoses with ICD-10 codes - HIPAA protected PHI';
COMMENT ON TABLE treatments IS 'Medical treatments and procedures - HIPAA protected PHI';
COMMENT ON TABLE health_records IS 'Lab results, imaging, and other health records - HIPAA protected PHI';
COMMENT ON TABLE medical_appointments IS 'Medical appointments - HIPAA protected PHI';
COMMENT ON TABLE hipaa_audit_logs IS 'Immutable HIPAA audit trail - 7 year retention required';
