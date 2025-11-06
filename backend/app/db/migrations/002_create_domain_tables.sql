-- =============================================================================
-- Migration 002: Create Domain Tables - Finance, Career, Education, Goals, Health, Relationships
-- =============================================================================
-- Description: Creates all domain-specific tables for the 6 Life Navigator modules
-- Prerequisites: 001_create_base_schema.sql
-- =============================================================================

-- =============================================================================
-- FINANCE DOMAIN
-- =============================================================================

-- Financial Accounts
CREATE TABLE financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Account details
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN (
        'checking', 'savings', 'credit_card', 'investment', 'retirement',
        'loan', 'mortgage', 'student_loan', 'crypto', 'other'
    )),
    institution_name VARCHAR(255),
    account_number_last4 VARCHAR(4),  -- Last 4 digits only for security
    currency VARCHAR(3) DEFAULT 'USD',

    -- Balances
    current_balance DECIMAL(15, 2),
    available_balance DECIMAL(15, 2),
    credit_limit DECIMAL(15, 2),  -- For credit cards
    interest_rate DECIMAL(5, 2),  -- APR %
    minimum_payment DECIMAL(15, 2),  -- For credit accounts

    -- Integration
    plaid_item_id VARCHAR(255),
    plaid_account_id VARCHAR(255),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    is_manual BOOLEAN DEFAULT false,  -- Manually tracked vs API integration

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_financial_accounts_tenant ON financial_accounts(tenant_id);
CREATE INDEX idx_financial_accounts_user ON financial_accounts(user_id);
CREATE INDEX idx_financial_accounts_type ON financial_accounts(account_type);
CREATE INDEX idx_financial_accounts_plaid ON financial_accounts(plaid_item_id, plaid_account_id);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,

    -- Transaction details
    transaction_date DATE NOT NULL,
    post_date DATE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT NOT NULL,
    merchant_name VARCHAR(255),
    category VARCHAR(100),
    subcategory VARCHAR(100),

    -- Classification
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('debit', 'credit', 'transfer')),
    is_recurring BOOLEAN DEFAULT false,
    is_pending BOOLEAN DEFAULT false,

    -- Integration
    plaid_transaction_id VARCHAR(255),
    external_id VARCHAR(255),  -- From other integrations

    -- Location
    location JSONB,  -- { "city", "state", "country", "coordinates" }

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_category ON transactions(category, subcategory);
CREATE INDEX idx_transactions_amount ON transactions(amount);

-- Budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Budget details
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    period VARCHAR(20) NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Time range
    start_date DATE NOT NULL,
    end_date DATE,

    -- Alerts
    alert_threshold DECIMAL(3, 2) DEFAULT 0.80,  -- Alert at 80% by default
    alert_enabled BOOLEAN DEFAULT true,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_budgets_tenant ON budgets(tenant_id);
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_budgets_category ON budgets(category);
CREATE INDEX idx_budgets_period ON budgets(period, start_date);

-- =============================================================================
-- CAREER DOMAIN
-- =============================================================================

-- Career Profile
CREATE TABLE career_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Profile details
    headline VARCHAR(255),
    summary TEXT,
    industry VARCHAR(100),
    current_job_title VARCHAR(255),
    years_of_experience INTEGER,
    career_level VARCHAR(50) CHECK (career_level IN (
        'entry', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'c-level'
    )),

    -- Preferences
    desired_job_titles TEXT[],
    desired_industries TEXT[],
    desired_locations TEXT[],
    desired_salary_min INTEGER,
    desired_salary_max INTEGER,
    salary_currency VARCHAR(3) DEFAULT 'USD',
    remote_preference VARCHAR(50) CHECK (remote_preference IN ('on-site', 'hybrid', 'remote', 'flexible')),
    open_to_relocation BOOLEAN DEFAULT false,
    job_search_status VARCHAR(50) DEFAULT 'passive' CHECK (job_search_status IN (
        'not_looking', 'passive', 'active', 'urgent'
    )),

    -- Links
    linkedin_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    github_url VARCHAR(500),
    website_url VARCHAR(500),

    -- Metadata
    skills JSONB DEFAULT '[]',  -- Array of { skill, proficiency, years }
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_career_profiles_tenant ON career_profiles(tenant_id);
CREATE INDEX idx_career_profiles_user ON career_profiles(user_id);
CREATE INDEX idx_career_profiles_industry ON career_profiles(industry);

-- Job Applications
CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Job details
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_website VARCHAR(500),
    job_url VARCHAR(500),
    job_description TEXT,
    location VARCHAR(255),
    remote_type VARCHAR(50),
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(3) DEFAULT 'USD',

    -- Application details
    application_date DATE NOT NULL,
    application_method VARCHAR(100),  -- LinkedIn, Company website, Referral, etc.
    status VARCHAR(50) DEFAULT 'applied' CHECK (status IN (
        'saved', 'applied', 'screening', 'interviewing',
        'offer', 'accepted', 'rejected', 'withdrawn'
    )),

    -- Contact
    recruiter_name VARCHAR(255),
    recruiter_email VARCHAR(255),
    recruiter_phone VARCHAR(20),
    hiring_manager_name VARCHAR(255),

    -- Tracking
    resume_version VARCHAR(100),
    cover_letter_version VARCHAR(100),
    referral_source VARCHAR(255),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_job_applications_tenant ON job_applications(tenant_id);
CREATE INDEX idx_job_applications_user ON job_applications(user_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_job_applications_company ON job_applications(company_name);

-- Interviews
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,

    -- Interview details
    interview_type VARCHAR(50) CHECK (interview_type IN (
        'phone_screen', 'video', 'on-site', 'technical', 'behavioral', 'panel', 'final'
    )),
    interview_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER,
    location VARCHAR(255),
    meeting_link VARCHAR(500),

    -- Participants
    interviewers JSONB DEFAULT '[]',  -- Array of { name, title, email }

    -- Preparation
    preparation_notes TEXT,
    questions_prepared TEXT[],

    -- Follow-up
    thank_you_sent BOOLEAN DEFAULT false,
    thank_you_sent_at TIMESTAMP WITH TIME ZONE,

    -- Outcome
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'completed', 'cancelled', 'rescheduled'
    )),
    outcome VARCHAR(50) CHECK (outcome IN (
        'pending', 'passed', 'failed', 'waiting_feedback'
    )),
    feedback TEXT,
    next_steps TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_interviews_tenant ON interviews(tenant_id);
CREATE INDEX idx_interviews_user ON interviews(user_id);
CREATE INDEX idx_interviews_application ON interviews(application_id);
CREATE INDEX idx_interviews_date ON interviews(interview_date);

-- =============================================================================
-- EDUCATION DOMAIN
-- =============================================================================

-- Degrees & Credentials
CREATE TABLE education_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Credential details
    credential_type VARCHAR(50) CHECK (credential_type IN (
        'high_school', 'associate', 'bachelor', 'master', 'doctorate',
        'certificate', 'bootcamp', 'professional_certification'
    )),
    credential_name VARCHAR(255) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    field_of_study VARCHAR(255),
    major VARCHAR(255),
    minor VARCHAR(255),

    -- Dates
    start_date DATE,
    end_date DATE,
    graduation_date DATE,
    expected_graduation_date DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'incomplete', 'dropped'
    )),

    -- Details
    gpa DECIMAL(3, 2),
    gpa_scale DECIMAL(3, 1) DEFAULT 4.0,
    honors TEXT[],  -- Dean's List, Summa Cum Laude, etc.
    thesis_title TEXT,

    -- Verification
    credential_id VARCHAR(255),
    credential_url VARCHAR(500),
    verified BOOLEAN DEFAULT false,
    verification_date DATE,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_education_credentials_tenant ON education_credentials(tenant_id);
CREATE INDEX idx_education_credentials_user ON education_credentials(user_id);
CREATE INDEX idx_education_credentials_type ON education_credentials(credential_type);
CREATE INDEX idx_education_credentials_institution ON education_credentials(institution_name);

-- Courses & Learning
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES education_credentials(id) ON DELETE SET NULL,

    -- Course details
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50),
    provider VARCHAR(255),  -- Coursera, Udemy, LinkedIn Learning, University, etc.
    platform VARCHAR(100),
    category VARCHAR(100),
    difficulty_level VARCHAR(50) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),

    -- Dates
    start_date DATE,
    end_date DATE,
    enrollment_date DATE,
    completion_date DATE,

    -- Progress
    status VARCHAR(50) DEFAULT 'enrolled' CHECK (status IN (
        'enrolled', 'in_progress', 'completed', 'dropped', 'on_hold'
    )),
    progress_percentage INTEGER CHECK (progress_percentage BETWEEN 0 AND 100),
    hours_completed DECIMAL(6, 2),
    total_hours DECIMAL(6, 2),

    -- Outcome
    grade VARCHAR(10),
    certificate_url VARCHAR(500),
    certificate_id VARCHAR(255),

    -- Cost
    cost DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Metadata
    skills_learned TEXT[],
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_courses_tenant ON courses(tenant_id);
CREATE INDEX idx_courses_user ON courses(user_id);
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_provider ON courses(provider);

-- =============================================================================
-- GOALS DOMAIN
-- =============================================================================

-- Goals
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,  -- For sub-goals

    -- Goal details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) CHECK (category IN (
        'financial', 'career', 'education', 'health', 'relationships',
        'personal', 'family', 'travel', 'other'
    )),
    goal_type VARCHAR(50) CHECK (goal_type IN ('short_term', 'medium_term', 'long_term', 'habit')),

    -- SMART framework
    is_specific BOOLEAN DEFAULT false,
    is_measurable BOOLEAN DEFAULT false,
    is_achievable BOOLEAN DEFAULT false,
    is_relevant BOOLEAN DEFAULT false,
    is_time_bound BOOLEAN DEFAULT false,

    -- Timeline
    start_date DATE,
    target_date DATE,
    completed_date DATE,

    -- Progress tracking
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'on_track', 'at_risk', 'blocked',
        'completed', 'abandoned', 'on_hold'
    )),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),

    -- Measurement
    metric_name VARCHAR(255),  -- e.g., "savings", "weight", "applications"
    metric_unit VARCHAR(50),   -- e.g., "USD", "lbs", "count"
    target_value DECIMAL(15, 2),
    current_value DECIMAL(15, 2),

    -- Priority
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    importance_score INTEGER CHECK (importance_score BETWEEN 1 AND 10),
    urgency_score INTEGER CHECK (urgency_score BETWEEN 1 AND 10),

    -- Metadata
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_goals_tenant ON goals(tenant_id);
CREATE INDEX idx_goals_user ON goals(user_id);
CREATE INDEX idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX idx_goals_category ON goals(category);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goals_target_date ON goals(target_date);

-- Milestones
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,

    -- Milestone details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    completed_date DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'completed', 'skipped', 'cancelled'
    )),
    is_required BOOLEAN DEFAULT true,
    order_index INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_milestones_tenant ON milestones(tenant_id);
CREATE INDEX idx_milestones_goal ON milestones(goal_id);
CREATE INDEX idx_milestones_status ON milestones(status);

-- =============================================================================
-- HEALTH DOMAIN
-- =============================================================================

-- Health Conditions
CREATE TABLE health_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

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
CREATE INDEX idx_health_conditions_status ON health_conditions(status);
CREATE INDEX idx_health_conditions_type ON health_conditions(condition_type);

-- Medications
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    condition_id UUID REFERENCES health_conditions(id) ON DELETE SET NULL,

    -- Medication details
    medication_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    dosage VARCHAR(100),
    dosage_unit VARCHAR(50),  -- mg, ml, tablets, etc.
    form VARCHAR(50),  -- tablet, capsule, liquid, injection, etc.
    frequency VARCHAR(100),  -- Once daily, twice daily, as needed, etc.
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
CREATE INDEX idx_medications_condition ON medications(condition_id);
CREATE INDEX idx_medications_status ON medications(status);

-- =============================================================================
-- RELATIONSHIPS DOMAIN
-- =============================================================================

-- Contacts
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Contact details
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    nickname VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    company VARCHAR(255),
    job_title VARCHAR(255),

    -- Relationship
    relationship_type VARCHAR(50) CHECK (relationship_type IN (
        'family', 'friend', 'colleague', 'professional', 'acquaintance', 'other'
    )),
    relationship_strength INTEGER CHECK (relationship_strength BETWEEN 1 AND 5),  -- 1=weak, 5=strong
    importance VARCHAR(20) DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),

    -- Dates
    birthday DATE,
    anniversary DATE,
    first_met_date DATE,

    -- Contact frequency
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    contact_frequency_days INTEGER,  -- Desired frequency in days
    next_contact_reminder DATE,

    -- Social links
    linkedin_url VARCHAR(500),
    twitter_handle VARCHAR(100),
    instagram_handle VARCHAR(100),

    -- Metadata
    interests TEXT[],
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_relationship ON contacts(relationship_type);
CREATE INDEX idx_contacts_name ON contacts(first_name, last_name);

-- Interactions
CREATE TABLE contact_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Interaction details
    interaction_type VARCHAR(50) CHECK (interaction_type IN (
        'meeting', 'call', 'text', 'email', 'social_media', 'event', 'other'
    )),
    interaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER,
    location VARCHAR(255),

    -- Content
    subject VARCHAR(255),
    summary TEXT,
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),

    -- Follow-up
    requires_follow_up BOOLEAN DEFAULT false,
    follow_up_date DATE,
    follow_up_completed BOOLEAN DEFAULT false,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_contact_interactions_tenant ON contact_interactions(tenant_id);
CREATE INDEX idx_contact_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX idx_contact_interactions_date ON contact_interactions(interaction_date DESC);

-- =============================================================================
-- Apply updated_at triggers to all domain tables
-- =============================================================================

CREATE TRIGGER update_financial_accounts_updated_at
    BEFORE UPDATE ON financial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_career_profiles_updated_at
    BEFORE UPDATE ON career_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at
    BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at
    BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_education_credentials_updated_at
    BEFORE UPDATE ON education_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at
    BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_conditions_updated_at
    BEFORE UPDATE ON health_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at
    BEFORE UPDATE ON medications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_interactions_updated_at
    BEFORE UPDATE ON contact_interactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
