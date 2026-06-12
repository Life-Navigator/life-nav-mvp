type SB = any;

// ── Career Profile ──────────────────────────────────────────────────────

// The REAL columns on public.career_profiles (migrations 032 + 065). Anything not in this set is dropped
// before the upsert, so a stray or mislabeled field can never fail the write with "column does not exist".
const PROFILE_COLUMNS = new Set([
  'current_title',
  'current_company',
  'industry',
  'years_of_experience',
  'desired_title',
  'desired_salary_min',
  'desired_salary_max',
  'skills',
  'certifications',
  'linkedin_url',
  'github_url',
  'portfolio_url',
  'summary',
  'work_arrangement',
  'current_income',
  'income_trajectory',
  'promotion_target',
  'target_income',
  'time_for_upskilling_hours_per_week',
  'job_change_willingness',
  'entrepreneurial_interest',
]);

// Friendly form field → real column. The Career form uses short names; the table uses current_*/_min.
// This is the root-cause fix for "Failed to save profile": title/company/desired_salary were not columns.
const FIELD_ALIASES: Record<string, string> = {
  title: 'current_title',
  company: 'current_company',
  desired_salary: 'desired_salary_min',
};

// Map a form/body payload to a clean DB row: resolve aliases, keep only real columns, drop undefined.
function toProfileRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (value === undefined) continue;
    const col = FIELD_ALIASES[key] ?? key;
    if (PROFILE_COLUMNS.has(col)) row[col] = value;
  }
  return row;
}

// Echo friendly aliases back onto the row so the form can render saved data verbatim after a refresh.
function withAliases(data: Record<string, unknown> | null) {
  if (!data) return data;
  return {
    ...data,
    title: data.current_title ?? '',
    company: data.current_company ?? '',
    desired_salary: data.desired_salary_min ?? '',
  };
}

export async function getCareerProfile(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('career_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return withAliases(data);
}

export async function upsertCareerProfile(
  supabase: SB,
  userId: string,
  profile: Record<string, unknown>
) {
  const row = toProfileRow(profile);
  const { data, error } = await supabase
    .from('career_profiles')
    .upsert({ ...row, user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return withAliases(data);
}

// ── Job Applications ────────────────────────────────────────────────────

export async function listApplications(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getApplication(supabase: SB, userId: string, id: string) {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createApplication(
  supabase: SB,
  userId: string,
  application: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({ ...application, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateApplication(
  supabase: SB,
  userId: string,
  id: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('job_applications')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteApplication(supabase: SB, userId: string, id: string) {
  const { error } = await supabase
    .from('job_applications')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw error;
}

// ── Career Connections ──────────────────────────────────────────────────

export async function listConnections(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('career_connections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getConnection(supabase: SB, userId: string, id: string) {
  const { data, error } = await supabase
    .from('career_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createConnection(
  supabase: SB,
  userId: string,
  connection: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('career_connections')
    .insert({ ...connection, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateConnection(
  supabase: SB,
  userId: string,
  id: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('career_connections')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteConnection(supabase: SB, userId: string, id: string) {
  const { error } = await supabase
    .from('career_connections')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw error;
}

// ── Resumes ─────────────────────────────────────────────────────────────

export async function listResumes(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getResume(supabase: SB, userId: string, id: string) {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createResume(supabase: SB, userId: string, resume: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('resumes')
    .insert({ ...resume, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateResume(
  supabase: SB,
  userId: string,
  id: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('resumes')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteResume(supabase: SB, userId: string, id: string) {
  const { error } = await supabase.from('resumes').delete().eq('user_id', userId).eq('id', id);

  if (error) throw error;
}
