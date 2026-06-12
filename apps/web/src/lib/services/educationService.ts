type SB = any;

// Real columns on public.education_records (migration 033). Stray/mislabeled keys are dropped so a write
// can never fail with "column does not exist".
const RECORD_COLUMNS = new Set([
  'institution_name',
  'degree_type',
  'field_of_study',
  'gpa',
  'start_date',
  'end_date',
  'graduation_date',
  'is_current',
  'status',
  'achievements',
  'metadata',
]);

// Friendly form field → real column. Root-cause fix: the Add Education form sends `institution`, but the
// column is `institution_name` (NOT NULL) — the mismatch produced a PGRST204 "Failed to save record".
const RECORD_ALIASES: Record<string, string> = { institution: 'institution_name' };

function toRecordRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (value === undefined) continue;
    const col = RECORD_ALIASES[key] ?? key;
    // empty string → null so NUMERIC/DATE columns (gpa, start_date…) don't fail their cast
    if (RECORD_COLUMNS.has(col)) row[col] = value === '' ? null : value;
  }
  return row;
}

// ── Education Records ───────────────────────────────────────────────────

export async function listRecords(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('education_records')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getRecord(supabase: SB, userId: string, id: string) {
  const { data, error } = await supabase
    .from('education_records')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createRecord(supabase: SB, userId: string, record: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('education_records')
    .insert({ ...toRecordRow(record), user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRecord(
  supabase: SB,
  userId: string,
  id: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('education_records')
    .update(toRecordRow(updates))
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRecord(supabase: SB, userId: string, id: string) {
  const { error } = await supabase
    .from('education_records')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw error;
}

// ── Courses ─────────────────────────────────────────────────────────────

export async function listCourses(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCourse(supabase: SB, userId: string, id: string) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCourse(supabase: SB, userId: string, course: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('courses')
    .insert({ ...course, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCourse(
  supabase: SB,
  userId: string,
  id: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCourse(supabase: SB, userId: string, id: string) {
  const { error } = await supabase.from('courses').delete().eq('user_id', userId).eq('id', id);

  if (error) throw error;
}

// ── Certifications (completed courses with certificate_url) ─────────────

export async function listCertifications(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('certificate_url', 'is', null)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export function mapCourseToCertification(course: Record<string, any>) {
  return {
    id: course.id,
    title: course.title,
    provider: course.provider || 'Unknown',
    platform: course.platform || null,
    certificateUrl: course.certificate_url || null,
    certificateDate: course.completed_at || course.created_at,
    skills: course.skills_learned || [],
    status: course.status,
    completedAt: course.completed_at,
    isStandalone: false,
    source: course.provider || 'manual',
  };
}

export function computeCertificationStats(certifications: Record<string, any>[]) {
  const currentYear = new Date().getFullYear();
  const allSkills = new Set<string>();
  const providers = new Set<string>();

  for (const cert of certifications) {
    providers.add(cert.provider || 'Unknown');
    const skills = cert.skills_learned || cert.skills || [];
    for (const s of skills) allSkills.add(s);
  }

  const thisYear = certifications.filter((c) => {
    const d = c.completed_at || c.created_at;
    return d && new Date(d).getFullYear() === currentYear;
  }).length;

  return {
    total: certifications.length,
    thisYear,
    providers: providers.size,
    skills: allSkills.size,
  };
}

// ── Study Logs ──────────────────────────────────────────────────────────

export async function listStudyLogs(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('study_logs')
    .select('*, courses(title)')
    .eq('user_id', userId)
    .order('study_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createStudyLog(supabase: SB, userId: string, log: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('study_logs')
    .insert({ ...log, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}
