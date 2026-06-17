-- Family domain: first-class household members, pets, and guardianship planning entries.
-- Mirrors the family.emergency_contacts/beneficiaries/trusted_advisors pattern (RLS owner-isolation,
-- authenticated + service_role grants, PostgREST schema reload). Does NOT touch existing family tables.

create table if not exists family.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  name text not null,
  relationship text,
  date_of_birth text,
  age integer,
  is_dependent boolean default false,
  lives_in_household boolean default true,
  school_name text,
  grade_level text,
  college_planning_status text,
  financial_dependency_level text,
  special_needs_notes text,
  emergency_priority integer,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists family.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  name text not null,
  species text,
  breed text,
  age integer,
  date_of_birth text,
  medical_needs text,
  medications text,
  vet_name text,
  vet_phone text,
  insurance_provider text,
  monthly_cost_estimate numeric,
  emergency_care_notes text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists family.guardianship (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  guardian_name text not null,
  relationship text,
  backup_guardian text,
  legal_doc_status text,
  children_covered text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['family_members','pets','guardianship'] loop
    execute format('alter table family.%I enable row level security', t);
    execute format('create index if not exists %I on family.%I(user_id)', 'idx_'||t||'_user', t);
    execute format($p$create policy %I on family.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())$p$, t||'_owner', t);
    execute format('grant select, insert, update, delete on family.%I to authenticated', t);
  end loop;
end $$;

grant select, insert, update, delete on family.family_members, family.pets, family.guardianship to service_role, anon;
notify pgrst, 'reload schema';
