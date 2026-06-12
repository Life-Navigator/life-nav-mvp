import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('display_name, avatar_url, email, role, created_at')
    .eq('id', user.id)
    .single();

  const meta = user.user_metadata || {};

  return NextResponse.json({
    id: user.id,
    name: profile?.display_name || meta.full_name || meta.name || user.email?.split('@')[0] || '',
    email: user.email || profile?.email || '',
    image: profile?.avatar_url || meta.avatar_url || null,
    role: profile?.role || 'user',
    createdAt: profile?.created_at || user.created_at,
    profile: {
      bio: meta.bio || '',
      phoneNumber: meta.phone_number || '',
      dateOfBirth: meta.date_of_birth || '',
      gender: meta.gender || '',
      address: meta.address || '',
      city: meta.city || '',
      state: meta.state || '',
      zipCode: meta.zip_code || '',
      country: meta.country || '',
      maritalStatus: meta.marital_status || '',
      dependents: meta.dependents ?? null,
      occupation: meta.occupation || '',
      employer: meta.employer || '',
      industry: meta.industry || '',
      yearsOfExperience: meta.years_of_experience ?? null,
      educationLevel: meta.education_level || '',
      linkedInUrl: meta.linkedin_url || '',
      websiteUrl: meta.website_url || '',
      incomeRange: meta.income_range || '',
      riskTolerance: meta.risk_tolerance || '',
      retirementAge: meta.retirement_age ?? null,
      healthStatus: meta.health_status || '',
      fitnessLevel: meta.fitness_level || '',
      dietaryPreferences: meta.dietary_preferences || '',
    },
  });
}

// Friendly profile-form fields -> auth.user_metadata keys (snake_case). Whitelist only; unknown
// keys are dropped, '' coerces to undefined (cleared), numbers coerced via Number().
function nz(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}
function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function toMetadata(body: Record<string, unknown>): Record<string, unknown> {
  return {
    full_name: nz(body.name),
    bio: nz(body.bio),
    phone_number: nz(body.phoneNumber),
    date_of_birth: nz(body.dateOfBirth),
    gender: nz(body.gender),
    address: nz(body.address),
    city: nz(body.city),
    state: nz(body.state),
    zip_code: nz(body.zipCode),
    country: nz(body.country),
    marital_status: nz(body.maritalStatus),
    dependents: num(body.dependents),
    occupation: nz(body.occupation),
    employer: nz(body.employer),
    industry: nz(body.industry),
    years_of_experience: num(body.yearsOfExperience),
    education_level: nz(body.educationLevel),
    linkedin_url: nz(body.linkedInUrl),
    website_url: nz(body.websiteUrl),
    income_range: nz(body.incomeRange),
    risk_tolerance: nz(body.riskTolerance),
    retirement_age: num(body.retirementAge),
    health_status: nz(body.healthStatus),
    fitness_level: nz(body.fitnessLevel),
    dietary_preferences: nz(body.dietaryPreferences),
  };
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const name = nz(body.name);

  // Update display name in profiles table under the user session (RLS: id = auth.uid()).
  if (name) {
    const { error: profileError } = await (supabase as any)
      .from('profiles')
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (profileError) {
      return safeApiError({
        code: 'db_persistence_error',
        internal: profileError,
        context: { route: 'PUT /api/user/profile', table: 'public.profiles' },
      });
    }
  }

  // Store extended profile fields in user_metadata (profiles table is intentionally PII-free).
  const { error } = await supabase.auth.updateUser({ data: toMetadata(body) });
  if (error) {
    return safeApiError({
      code: 'validation_failed',
      internal: error,
      context: { route: 'PUT /api/user/profile', table: 'auth.user_metadata' },
    });
  }

  // Return the freshly persisted profile so the client can repopulate without a second round-trip.
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('display_name, avatar_url, email, role, created_at')
    .eq('id', user.id)
    .single();
  const meta = (await supabase.auth.getUser()).data.user?.user_metadata || {};

  return NextResponse.json({
    success: true,
    id: user.id,
    name: profile?.display_name || meta.full_name || user.email?.split('@')[0] || '',
    email: user.email || profile?.email || '',
    image: profile?.avatar_url || meta.avatar_url || null,
    role: profile?.role || 'user',
    createdAt: profile?.created_at || user.created_at,
    profile: {
      bio: meta.bio || '',
      phoneNumber: meta.phone_number || '',
      dateOfBirth: meta.date_of_birth || '',
      gender: meta.gender || '',
      address: meta.address || '',
      city: meta.city || '',
      state: meta.state || '',
      zipCode: meta.zip_code || '',
      country: meta.country || '',
      maritalStatus: meta.marital_status || '',
      dependents: meta.dependents ?? null,
      occupation: meta.occupation || '',
      employer: meta.employer || '',
      industry: meta.industry || '',
      yearsOfExperience: meta.years_of_experience ?? null,
      educationLevel: meta.education_level || '',
      linkedInUrl: meta.linkedin_url || '',
      websiteUrl: meta.website_url || '',
      incomeRange: meta.income_range || '',
      riskTolerance: meta.risk_tolerance || '',
      retirementAge: meta.retirement_age ?? null,
      healthStatus: meta.health_status || '',
      fitnessLevel: meta.fitness_level || '',
      dietaryPreferences: meta.dietary_preferences || '',
    },
  });
}
