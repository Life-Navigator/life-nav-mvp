type SB = any;

// ── Career Profile ──────────────────────────────────────────────────────

export async function getCareerProfile(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from('career_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data;
}

export async function upsertCareerProfile(
  supabase: SB,
  userId: string,
  profile: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('career_profiles')
    .upsert({ ...profile, user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
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
