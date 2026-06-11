create table if not exists life.rejected_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  session_id text,
  rejected_goal text not null,
  normalized_goal text not null,
  reason text,
  rejected_by_user_quote text,
  source_turn_id text,
  created_at timestamptz default now()
);
alter table life.rejected_goals enable row level security;
create index if not exists idx_rejected_goals_user on life.rejected_goals(user_id);
drop policy if exists rejected_goals_owner on life.rejected_goals;
create policy rejected_goals_owner on life.rejected_goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on life.rejected_goals to authenticated, service_role, anon;
notify pgrst, 'reload schema';
