-- =============================================================================
-- Life Navigator - HIPAA Database Seed Data
-- =============================================================================
-- Seeds: Health Conditions, Medications, Diagnoses, Treatments, Records
-- Run on: ln-health-db-beta / lifenavigator_health
-- NOTE: Uses same tenant_id and user_id as Core database for cross-reference
-- =============================================================================

-- Demo user/tenant IDs (must match Core database)
-- tenant_id: b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- user_id: c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

-- Create health condition: Hypertension
INSERT INTO health_conditions (id, tenant_id, user_id, condition_name, condition_type, severity, icd_10_code, diagnosis_date, status, diagnosed_by, symptoms, treatment_plan)
VALUES (
    '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Essential Hypertension',
    'chronic',
    'mild',
    'I10',
    (CURRENT_DATE - INTERVAL '365 days')::date,
    'active',
    'Dr. Sarah Johnson',
    ARRAY['occasional headaches', 'elevated blood pressure readings', 'mild dizziness'],
    'Lifestyle modifications including reduced sodium intake, regular exercise, and daily medication. Follow-up every 3 months.'
);

-- Create health condition: Seasonal Allergies
INSERT INTO health_conditions (id, tenant_id, user_id, condition_name, condition_type, severity, icd_10_code, diagnosis_date, status, diagnosed_by, symptoms, treatment_plan)
VALUES (
    '12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Allergic Rhinitis, Seasonal',
    'chronic',
    'mild',
    'J30.2',
    (CURRENT_DATE - INTERVAL '730 days')::date,
    'chronic_managed',
    'Dr. Michael Chen',
    ARRAY['sneezing', 'nasal congestion', 'itchy eyes', 'runny nose'],
    'OTC antihistamines as needed during pollen season. Avoid outdoor activities on high pollen days.'
);

-- Create medications
INSERT INTO medications (id, tenant_id, user_id, condition_id, medication_name, generic_name, dosage, dosage_unit, form, frequency, route, start_date, status, is_as_needed, prescribed_by, pharmacy_name, reminder_enabled)
VALUES
    -- Lisinopril for hypertension
    ('21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lisinopril', 'Lisinopril', '10', 'mg', 'tablet', 'Once daily in the morning',
     'oral', (CURRENT_DATE - INTERVAL '365 days')::date, 'active', false, 'Dr. Sarah Johnson', 'CVS Pharmacy #1234', true),
    -- Claritin for allergies
    ('22eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Claritin', 'Loratadine', '10', 'mg', 'tablet', 'Once daily as needed',
     'oral', (CURRENT_DATE - INTERVAL '730 days')::date, 'active', true, 'Dr. Michael Chen', 'CVS Pharmacy #1234', false),
    -- Vitamin D supplement
    ('23eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     NULL, 'Vitamin D3', 'Cholecalciferol', '2000', 'IU', 'softgel', 'Once daily with food',
     'oral', (CURRENT_DATE - INTERVAL '180 days')::date, 'active', false, 'Dr. Sarah Johnson', 'Amazon', true);

-- Create diagnoses
INSERT INTO diagnoses (id, tenant_id, user_id, condition_id, diagnosis_code, diagnosis_description, diagnosis_type, diagnosis_date, diagnosing_provider, facility_name, certainty)
VALUES
    ('31eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'I10', 'Essential (primary) hypertension', 'primary',
     (CURRENT_DATE - INTERVAL '365 days')::date, 'Dr. Sarah Johnson', 'City Medical Center', 'confirmed'),
    ('32eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'J30.2', 'Other seasonal allergic rhinitis', 'primary',
     (CURRENT_DATE - INTERVAL '730 days')::date, 'Dr. Michael Chen', 'Allergy & Asthma Center', 'confirmed');

-- Create treatments
INSERT INTO treatments (id, tenant_id, user_id, condition_id, treatment_type, treatment_name, description, provider_name, start_date, frequency, status)
VALUES
    ('41eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'lifestyle', 'DASH Diet', 'Dietary Approaches to Stop Hypertension - low sodium, high potassium diet plan',
     'Dr. Sarah Johnson', (CURRENT_DATE - INTERVAL '365 days')::date, 'Daily', 'active'),
    ('42eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'exercise', 'Cardiovascular Exercise Program', '30 minutes of moderate cardio exercise at least 5 days per week',
     'Dr. Sarah Johnson', (CURRENT_DATE - INTERVAL '365 days')::date, '5x per week', 'active');

-- Create health records (lab results)
INSERT INTO health_records (id, tenant_id, user_id, record_type, record_name, record_date, ordering_provider, performing_facility, results, is_abnormal, interpretation)
VALUES
    -- Complete Metabolic Panel
    ('51eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'lab_result', 'Complete Metabolic Panel', (CURRENT_DATE - INTERVAL '30 days')::date, 'Dr. Sarah Johnson', 'Quest Diagnostics',
     '{"glucose": {"value": 98, "unit": "mg/dL", "range": "70-100", "status": "normal"}, "sodium": {"value": 140, "unit": "mEq/L", "range": "136-145", "status": "normal"}, "potassium": {"value": 4.2, "unit": "mEq/L", "range": "3.5-5.0", "status": "normal"}, "creatinine": {"value": 0.9, "unit": "mg/dL", "range": "0.7-1.3", "status": "normal"}}',
     false, 'All values within normal limits'),
    -- Lipid Panel
    ('52eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'lab_result', 'Lipid Panel', (CURRENT_DATE - INTERVAL '30 days')::date, 'Dr. Sarah Johnson', 'Quest Diagnostics',
     '{"total_cholesterol": {"value": 195, "unit": "mg/dL", "range": "125-200", "status": "normal"}, "hdl": {"value": 55, "unit": "mg/dL", "range": ">40", "status": "normal"}, "ldl": {"value": 120, "unit": "mg/dL", "range": "<100", "status": "borderline_high"}, "triglycerides": {"value": 145, "unit": "mg/dL", "range": "<150", "status": "normal"}}',
     true, 'LDL cholesterol slightly elevated. Consider dietary modifications.'),
    -- Blood Pressure reading
    ('53eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'vital_signs', 'Blood Pressure Check', (CURRENT_DATE - INTERVAL '7 days')::date, 'Self', 'Home Monitoring',
     '{"systolic": {"value": 128, "unit": "mmHg", "range": "<120", "status": "elevated"}, "diastolic": {"value": 82, "unit": "mmHg", "range": "<80", "status": "elevated"}, "pulse": {"value": 72, "unit": "bpm", "range": "60-100", "status": "normal"}}',
     true, 'Blood pressure slightly elevated. Continue medication and lifestyle modifications.');

-- Create medical appointments
INSERT INTO medical_appointments (id, tenant_id, user_id, condition_id, appointment_type, provider_name, provider_specialty, facility_name, appointment_date, duration_minutes, status, preparation_instructions)
VALUES
    -- Upcoming cardiology follow-up
    ('61eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '01eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Follow-up Visit', 'Dr. Sarah Johnson', 'Internal Medicine', 'City Medical Center',
     (NOW() + INTERVAL '14 days'), 30, 'scheduled', 'Bring home blood pressure log. Fast for 8 hours if labs needed.'),
    -- Annual physical
    ('62eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     NULL, 'Annual Physical', 'Dr. Sarah Johnson', 'Internal Medicine', 'City Medical Center',
     (NOW() + INTERVAL '60 days'), 45, 'scheduled', 'Fast for 12 hours before appointment. Bring list of all current medications.');

-- Create HIPAA audit log entries
INSERT INTO hipaa_audit_logs (id, tenant_id, user_id, target_user_id, event_type, event_action, event_description, resource_type, phi_accessed, access_reason)
VALUES
    ('71eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'system.seed', 'create', 'Initial seed data creation for health records',
     'health_records', true, 'healthcare_operations');

-- Summary
SELECT 'HIPAA database seeded successfully!' as status;
SELECT COUNT(*) as health_conditions FROM health_conditions;
SELECT COUNT(*) as medications FROM medications;
SELECT COUNT(*) as diagnoses FROM diagnoses;
SELECT COUNT(*) as treatments FROM treatments;
SELECT COUNT(*) as health_records FROM health_records;
SELECT COUNT(*) as appointments FROM medical_appointments;
