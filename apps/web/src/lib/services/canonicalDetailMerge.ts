// Source-of-truth bridge for the detail pages. Onboarding/MCP sync writes the current role to
// public.career_profiles and completed degrees to education.education_profiles.existing_credentials — but the
// Experience/Degrees detail pages read career.experience_records / public.education_records. So the dashboard
// shows the facts while the detail pages look empty. These helpers surface the SAME canonical facts as
// read-only "Captured from onboarding" records (deduped against manual rows, which win).
/* eslint-disable @typescript-eslint/no-explicit-any */

const norm = (s: unknown) =>
  String(s ?? '')
    .trim()
    .toLowerCase();

/** Prepend the canonical current role (career_profiles) as an employment record if not already present. */
export async function mergeCanonicalExperience(
  sb: any,
  userId: string,
  items: any[]
): Promise<any[]> {
  try {
    const { data } = await sb
      .from('career_profiles')
      .select('current_title, current_company, summary, skills')
      .eq('user_id', userId)
      .maybeSingle();
    const title = data?.current_title;
    if (!title) return items;
    const employer = data?.current_company || '';
    // Manual experience_records row for the same role wins (no duplicate).
    if (items.some((it) => norm(it.title) === norm(title) && norm(it.employer) === norm(employer)))
      return items;
    const skills = Array.isArray(data?.skills) ? data.skills.join(' · ') : '';
    const focus = String(data?.summary || '').replace(/^focus:\s*/i, '');
    const resp = [focus && `Focus: ${focus}`, skills && `Skills: ${skills}`]
      .filter(Boolean)
      .join(' — ');
    return [
      {
        id: 'onboarding-current-role',
        title,
        employer,
        is_current: true,
        responsibilities: resp,
        _source: 'Captured from onboarding',
        _canonical: true,
      },
      ...items,
    ];
  } catch {
    return items;
  }
}

/** Prepend completed degrees from education_profiles.existing_credentials if not already present. */
export async function mergeCanonicalDegrees(sb: any, userId: string, items: any[]): Promise<any[]> {
  try {
    const { data } = await sb
      .schema('education')
      .from('education_profiles')
      .select('existing_credentials')
      .eq('user_id', userId)
      .maybeSingle();
    const creds = Array.isArray(data?.existing_credentials) ? data.existing_credentials : [];
    if (!creds.length) return items;
    const extra: any[] = [];
    creds.forEach((c: any, i: number) => {
      const degree = c?.highest_level || c?.level || c?.degree_type;
      const school = c?.school || c?.institution || c?.institution_name;
      if (!degree && !school) return;
      // Manual education_records row for the same degree+school wins.
      if (
        items.some(
          (it) =>
            norm(it.degree_type) === norm(degree) && norm(it.institution_name) === norm(school)
        )
      )
        return;
      extra.push({
        id: `onboarding-credential-${i}`,
        degree_type: degree || 'Degree',
        institution_name: school || '',
        field_of_study: c?.field || c?.field_of_study || '',
        status: 'completed',
        _source: 'Captured from onboarding',
        _canonical: true,
      });
    });
    return [...extra, ...items];
  } catch {
    return items;
  }
}
