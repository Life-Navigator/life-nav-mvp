-- =============================================================================
-- Life Navigator - Core Database Seed Data
-- =============================================================================
-- Seeds: Organizations, Tenants, Users
-- Run on: ln-core-db-beta / lifenavigator_core
-- =============================================================================

-- Create demo organization
INSERT INTO organizations (id, name, slug, email, status, subscription_tier)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Demo Organization',
    'demo-org',
    'demo@lifenavigator.app',
    'active',
    'pro'
) ON CONFLICT (slug) DO NOTHING;

-- Create demo tenant
INSERT INTO tenants (id, organization_id, name, slug, type, status, hipaa_enabled, audit_log_enabled)
VALUES (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Demo Workspace',
    'demo-workspace',
    'workspace',
    'active',
    true,
    true
) ON CONFLICT (organization_id, slug) DO NOTHING;

-- Create demo user (password hash for 'DemoUser2024!')
-- BCrypt hash generated for DemoUser2024!
INSERT INTO users (id, email, email_verified, first_name, last_name, display_name, auth_provider, password_hash, status)
VALUES (
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'demo@lifenavigator.app',
    true,
    'Demo',
    'User',
    'Demo User',
    'email',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4o5G6xRN4dYP6oZy',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Create user-tenant membership
INSERT INTO user_tenants (id, user_id, tenant_id, role, status, joined_at)
VALUES (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'owner',
    'active',
    NOW()
) ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Create additional test user
INSERT INTO users (id, email, email_verified, first_name, last_name, display_name, auth_provider, password_hash, status)
VALUES (
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'test@lifenavigator.app',
    true,
    'Test',
    'Member',
    'Test Member',
    'email',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4o5G6xRN4dYP6oZy',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Add test user to demo tenant as member
INSERT INTO user_tenants (id, user_id, tenant_id, role, status, joined_at)
VALUES (
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'member',
    'active',
    NOW()
) ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Create sample career profile
INSERT INTO career_profiles (id, tenant_id, user_id, headline, industry, current_job_title, years_of_experience, career_level, job_search_status, skills)
VALUES (
    '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Senior Software Engineer passionate about building great products',
    'Technology',
    'Senior Software Engineer',
    5,
    'senior',
    'passive',
    '[{"skill": "Python", "proficiency": "expert", "years": 5}, {"skill": "TypeScript", "proficiency": "advanced", "years": 3}]'
) ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Create sample goals
INSERT INTO goals (id, tenant_id, user_id, title, description, category, goal_type, status, target_date, progress_percentage, priority, metric_name, metric_unit, target_value, current_value)
VALUES
    ('20eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Build Emergency Fund', 'Save 6 months of expenses for financial security', 'financial', 'medium_term', 'in_progress',
     (CURRENT_DATE + INTERVAL '180 days')::date, 60, 'high', 'savings', 'USD', 25000, 15000),
    ('21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Get AWS Certified', 'Pass AWS Solutions Architect Professional exam', 'career', 'short_term', 'in_progress',
     (CURRENT_DATE + INTERVAL '90 days')::date, 35, 'high', 'completion', '%', 100, 35),
    ('22eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Lower Blood Pressure', 'Get blood pressure under control through lifestyle changes', 'health', 'medium_term', 'in_progress',
     (CURRENT_DATE + INTERVAL '120 days')::date, 40, 'critical', 'systolic', 'mmHg', 120, 128);

-- Create milestones for goals
INSERT INTO milestones (id, tenant_id, user_id, goal_id, title, status, order_index)
VALUES
    ('30eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Save first $5,000', 'completed', 1),
    ('31eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Reach $10,000', 'completed', 2),
    ('32eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Reach $15,000', 'completed', 3),
    ('33eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Hit $25,000 goal', 'pending', 4),
    ('34eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Complete online course', 'completed', 1),
    ('35eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Pass practice exam', 'in_progress', 2),
    ('36eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Schedule certification exam', 'pending', 3);

-- Create sample education credentials
INSERT INTO education_credentials (id, tenant_id, user_id, credential_type, credential_name, institution_name, field_of_study, graduation_date, status, gpa)
VALUES
    ('40eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'bachelor', 'Bachelor of Science in Computer Science', 'State University', 'Computer Science', '2019-05-15', 'completed', 3.75);

-- Create sample courses
INSERT INTO courses (id, tenant_id, user_id, course_name, provider, category, status, progress_percentage, hours_completed, total_hours)
VALUES
    ('50eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'AWS Solutions Architect Professional', 'Udemy', 'Cloud Computing', 'in_progress', 35, 14.0, 40.0);

-- Create sample contacts
INSERT INTO contacts (id, tenant_id, user_id, first_name, last_name, display_name, email, company, job_title, relationship_type, relationship_strength, importance)
VALUES
    ('60eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'John', 'Smith', 'John Smith', 'john.smith@example.com', 'Tech Corp', 'Engineering Manager', 'professional', 4, 'high'),
    ('61eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Sarah', 'Johnson', 'Sarah Johnson', 'sarah.j@example.com', 'Startup Inc', 'CTO', 'professional', 5, 'high'),
    ('62eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Mike', 'Williams', 'Mike Williams', 'mike.w@example.com', NULL, NULL, 'friend', 5, 'medium');

-- Create audit log entry for seeding
INSERT INTO audit_logs (id, tenant_id, user_id, event_type, event_category, severity, resource_type, metadata)
VALUES (
    '70eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'system.seed',
    'system',
    'info',
    'database',
    '{"action": "initial_seed", "timestamp": "' || NOW() || '"}'
);

-- Summary
SELECT 'Core database seeded successfully!' as status;
SELECT COUNT(*) as organizations FROM organizations;
SELECT COUNT(*) as tenants FROM tenants;
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as goals FROM goals;
