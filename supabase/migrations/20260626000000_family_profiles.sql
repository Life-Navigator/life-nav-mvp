-- family.family_profiles — additive, idempotent. One planning profile per user. (fact→domain sync target)
CREATE SCHEMA IF NOT EXISTS family;
CREATE TABLE IF NOT EXISTS family.family_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  relationship_status text,
  partner_status text,
  wedding_date date,
  wedding_timeline text,
  home_goal boolean DEFAULT false,
  home_timeline text,
  children_goal boolean DEFAULT false,
  children_timeline text,
  adoption_goal boolean DEFAULT false,
  pet_goal boolean DEFAULT false,
  caregiving_obligations text[] DEFAULT '{}',
  family_goals text[] DEFAULT '{}',
  planning_priorities text[] DEFAULT '{}',
  insurance_needs_review boolean DEFAULT false,
  estate_guardianship_review boolean DEFAULT false,
  shared_financial_plan_needed boolean DEFAULT false,
  source text,
  confidence numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE family.family_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_family_profile ON family.family_profiles;
CREATE POLICY users_own_family_profile ON family.family_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS service_family_profile ON family.family_profiles;
CREATE POLICY service_family_profile ON family.family_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT USAGE ON SCHEMA family TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE ON family.family_profiles TO authenticated, service_role;
