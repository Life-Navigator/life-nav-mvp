// Goals CRUD mapper — writes to public.goals (migrations 003 + 030 + 068), RLS-isolated by user_id.
// Mirrors educationService/familyService: friendly form fields -> alias map -> column WHITELIST.
//
// Root cause this fixes: the MyBlocks goal form (app/goals/create) submits a full client-side `Goal`
// object with camelCase keys and enum values the DB rejects:
//   - priority: 'essential' | 'important' | 'nice_to_have'  (column is INT 1..5)
//   - status:   'not_started' | 'on_track' | 'at_risk' | 'deferred'  (CHECK draft/active/paused/completed/archived)
//   - category: 'custom' | 'retirement' | 'purchase' | ...  (CHECK education/career/finance/health/personal)
//   - targetAmount / currentAmount / targetDate / startDate / progress  (snake_case + different column names)
// Any of these caused the INSERT to fail; the form swallowed the error (no toast), so goals were lost.

type SB = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Real writable columns on public.goals. Stray keys are dropped so a write can never fail with
// "column does not exist". (id/user_id/created_at/updated_at are stamped by the route/DB, not here.)
const GOAL_COLUMNS = new Set([
  'category',
  'title',
  'description',
  'icon',
  'color',
  'progress_percent',
  'status',
  'priority',
  'target_date',
  'started_at',
  'completed_at',
  'target_value',
  'current_value',
  'starting_value',
  'unit',
  'time_horizon',
  'is_public',
  'reason',
  'smart_specific',
  'smart_measurable',
  'smart_achievable',
  'smart_relevant',
  'smart_time_bound',
  'dgx_goal_id',
]);

// Friendly form field (camelCase) → real column name.
const GOAL_ALIASES: Record<string, string> = {
  targetAmount: 'target_value',
  currentAmount: 'current_value',
  startingValue: 'starting_value',
  targetDate: 'target_date',
  startDate: 'started_at',
  completedDate: 'completed_at',
  completedAt: 'completed_at',
  progress: 'progress_percent',
  progressPercent: 'progress_percent',
  timeHorizon: 'time_horizon',
  isPublic: 'is_public',
};

const NUMERIC_COLUMNS = new Set([
  'progress_percent',
  'priority',
  'target_value',
  'current_value',
  'starting_value',
]);

const DATE_COLUMNS = new Set(['target_date', 'started_at', 'completed_at']);

// public.goals.category CHECK: education|career|finance|health|personal.
// Map the form's richer GoalCategory + Domain onto that allowed set; default 'personal'.
const CATEGORY_MAP: Record<string, string> = {
  education: 'education',
  career: 'career',
  finance: 'finance',
  financial: 'finance',
  wealth: 'finance',
  retirement: 'finance',
  purchase: 'finance',
  health: 'health',
  protection: 'personal',
  lifestyle: 'personal',
  family: 'personal',
  personal: 'personal',
  custom: 'personal',
};

// public.goals.status CHECK: draft|active|paused|completed|archived.
const STATUS_MAP: Record<string, string> = {
  draft: 'draft',
  not_started: 'draft',
  active: 'active',
  in_progress: 'active',
  on_track: 'active',
  at_risk: 'active',
  paused: 'paused',
  deferred: 'paused',
  completed: 'completed',
  archived: 'archived',
};

// public.goals.priority is INT 1..5. The form sends strings; map to a number.
const PRIORITY_MAP: Record<string, number> = {
  essential: 1,
  high: 2,
  important: 3,
  medium: 3,
  nice_to_have: 5,
  low: 5,
};

function coerceDate(value: unknown): string | null {
  if (value === '' || value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function coerceNumber(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/**
 * Build a DB-safe row for public.goals from a friendly form payload.
 * - aliases camelCase friendly names to real columns
 * - whitelists allowed columns (drops stray keys like domain/milestones/position/userId)
 * - maps category/status/priority onto the values the DB CHECK constraints accept
 * - coerces '' -> null, numbers via Number(), dates -> YYYY-MM-DD
 */
export function toGoalRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(body || {})) {
    if (raw === undefined) continue;
    const col = GOAL_ALIASES[key] ?? key;
    if (!GOAL_COLUMNS.has(col)) continue; // drop stray keys

    if (col === 'category') continue; // handled explicitly below
    if (col === 'status') continue;
    if (col === 'priority') continue;

    if (DATE_COLUMNS.has(col)) {
      row[col] = coerceDate(raw);
    } else if (NUMERIC_COLUMNS.has(col)) {
      row[col] = coerceNumber(raw);
    } else if (col === 'is_public') {
      row[col] = Boolean(raw);
    } else {
      row[col] = raw === '' ? null : raw;
    }
  }

  // category: prefer body.category, fall back to body.domain; map onto the CHECK set.
  const rawCategory = String((body.category ?? body.domain ?? 'personal') as string).toLowerCase();
  row.category = CATEGORY_MAP[rawCategory] ?? 'personal';

  // status: map onto CHECK set; default draft.
  const rawStatus = String((body.status ?? 'draft') as string).toLowerCase();
  row.status = STATUS_MAP[rawStatus] ?? 'draft';

  // priority: accept a number (clamped 1..5) or a known string label; default 3.
  const rawPriority = body.priority;
  if (typeof rawPriority === 'number' && Number.isFinite(rawPriority)) {
    row.priority = Math.min(5, Math.max(1, Math.trunc(rawPriority)));
  } else if (typeof rawPriority === 'string' && PRIORITY_MAP[rawPriority.toLowerCase()] != null) {
    row.priority = PRIORITY_MAP[rawPriority.toLowerCase()];
  } else if (rawPriority != null) {
    const n = Number(rawPriority);
    row.priority = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.trunc(n))) : 3;
  } else {
    row.priority = 3;
  }

  // progress_percent must be an INT in 0..100.
  if (row.progress_percent != null) {
    const p = Number(row.progress_percent);
    row.progress_percent = Number.isFinite(p) ? Math.min(100, Math.max(0, Math.trunc(p))) : 0;
  }

  // title is NOT NULL.
  if (typeof row.title === 'string') row.title = (row.title as string).slice(0, 200);

  return row;
}

export async function listGoals(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGoal(supabase: SB, userId: string, body: Record<string, unknown>) {
  const row: Record<string, unknown> = { ...toGoalRow(body), user_id: userId };
  if (!row.title) throw new Error('title is required');
  const { data, error } = await supabase.from('goals').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateGoal(
  supabase: SB,
  userId: string,
  id: string,
  body: Record<string, unknown>
) {
  const row = toGoalRow(body);
  delete (row as Record<string, unknown>).user_id;
  const { data, error } = await supabase
    .from('goals')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
