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

// ── Courses (also backs Certifications) ─────────────────────────────────
// Real columns on public.courses (migration 033). The Add-Course and Add-Certification forms send
// friendly names (title, certificateUrl, certificateDate, skills, completed_at, platform) that are NOT
// real columns — the column is `course_name` (NOT NULL), the date is `completion_date`, and there is no
// `title`/`platform`/`completed_at` column. Sending those raw produced a PGRST204 "Failed to save".
const COURSE_COLUMNS = new Set([
  'course_name',
  'provider',
  'instructor',
  'url',
  'duration_hours',
  'level',
  'status',
  'progress_percent',
  'rating',
  'certificate_url',
  'skills_learned',
  'start_date',
  'completion_date',
  'cost',
  'notes',
]);

// Friendly form field → real column.
const COURSE_ALIASES: Record<string, string> = {
  title: 'course_name',
  name: 'course_name',
  certificateUrl: 'certificate_url',
  certificate_url: 'certificate_url',
  certificateDate: 'completion_date',
  completed_at: 'completion_date',
  completedAt: 'completion_date',
  skills: 'skills_learned',
};

const COURSE_NUMERIC = new Set(['duration_hours', 'progress_percent', 'rating', 'cost']);

export function toCourseRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (value === undefined) continue;
    if (key === 'user_id' || key === 'id') continue; // user_id is stamped from the session
    const col = COURSE_ALIASES[key] ?? key;
    if (!COURSE_COLUMNS.has(col)) continue; // drop stray keys (platform, credentialId, …)
    if (value === '') {
      row[col] = null; // '' → null so NUMERIC/DATE casts don't fail
    } else if (COURSE_NUMERIC.has(col)) {
      const n = Number(value);
      row[col] = Number.isNaN(n) ? null : n;
    } else {
      row[col] = value;
    }
  }
  return row;
}

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
  const row = toCourseRow(course);
  if (!row.course_name) throw new Error('course_name (title) is required');
  const { data, error } = await supabase
    .from('courses')
    .insert({ ...row, user_id: userId })
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
    .update(toCourseRow(updates))
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
  // A certification = a completed course. We intentionally do NOT require certificate_url (a user can
  // record a cert without a public link) — completion_date is the canonical real column to sort by.
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completion_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export function mapCourseToCertification(course: Record<string, any>) {
  return {
    id: course.id,
    // `course_name` is the real column; `title` never existed.
    title: course.course_name,
    provider: course.provider || 'Unknown',
    platform: null, // no platform column on courses
    certificateUrl: course.certificate_url || null,
    certificateDate: course.completion_date || course.created_at,
    skills: course.skills_learned || [],
    status: course.status,
    completedAt: course.completion_date,
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
    const d = c.completion_date || c.created_at;
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
