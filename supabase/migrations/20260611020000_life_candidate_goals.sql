-- P0.1 — persist every extracted goal across turns so the final Life Model reflects what the user
-- actually said (no goal disappears, none collapsed into a generic label). One row per distinct goal,
-- deduped by (user_id, normalized_goal); re-mentioning a goal upserts (refreshes quote/turn).
create table if not exists life.candidate_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid,
  session_id text,
  goal_text text not null,            -- the user's OWN words (verbatim clause)
  normalized_goal text not null,      -- lowercased dedupe key
  objective_key text,                 -- secondary label key (may be null)
  objective_label text,               -- secondary human label (may be null)
  domain text not null default 'core',-- finance | family | health | education | career | core
  confidence numeric default 0.5,
  supporting_quote text,              -- evidence: no quote, no goal
  status text not null default 'active', -- active | future_goal | confirmed
  source_turn_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, normalized_goal)
);
alter table life.candidate_goals enable row level security;
create index if not exists idx_candidate_goals_user on life.candidate_goals(user_id);
drop policy if exists candidate_goals_owner on life.candidate_goals;
create policy candidate_goals_owner on life.candidate_goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on life.candidate_goals to authenticated, service_role, anon;
notify pgrst, 'reload schema';
