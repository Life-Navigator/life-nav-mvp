create table if not exists family.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  name text not null,
  relationship text,
  phone text,
  email text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists family.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  name text not null,
  relationship text,
  account_type text,
  allocation_pct numeric,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists family.trusted_advisors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  name text not null,
  advisor_type text,
  firm text,
  email text,
  phone text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
do $$
declare t text;
begin
  foreach t in array array['emergency_contacts','beneficiaries','trusted_advisors'] loop
    execute format('alter table family.%I enable row level security', t);
    execute format('create index if not exists %I on family.%I(user_id)', 'idx_'||t||'_user', t);
    execute format($p$create policy %I on family.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())$p$, t||'_owner', t);
    execute format('grant select, insert, update, delete on family.%I to authenticated', t);
  end loop;
end $$;
notify pgrst, 'reload schema';
grant select, insert, update, delete on family.emergency_contacts, family.beneficiaries, family.trusted_advisors to service_role, anon;
