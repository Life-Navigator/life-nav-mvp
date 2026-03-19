import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
      city: meta.city || '',
      state: meta.state || '',
      country: meta.country || '',
      occupation: meta.occupation || '',
      employer: meta.employer || '',
      industry: meta.industry || '',
      educationLevel: meta.education_level || '',
      linkedInUrl: meta.linkedin_url || '',
      websiteUrl: meta.website_url || '',
      incomeRange: meta.income_range || '',
      riskTolerance: meta.risk_tolerance || '',
      healthStatus: meta.health_status || '',
      fitnessLevel: meta.fitness_level || '',
    },
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Update display name in profiles table
  if (body.name) {
    await (supabase as any)
      .from('profiles')
      .update({
        display_name: body.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
  }

  // Store extended profile fields in user_metadata
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: body.name || undefined,
      bio: body.bio || undefined,
      phone_number: body.phoneNumber || undefined,
      date_of_birth: body.dateOfBirth || undefined,
      gender: body.gender || undefined,
      city: body.city || undefined,
      state: body.state || undefined,
      country: body.country || undefined,
      occupation: body.occupation || undefined,
      employer: body.employer || undefined,
      industry: body.industry || undefined,
      education_level: body.educationLevel || undefined,
      linkedin_url: body.linkedInUrl || undefined,
      website_url: body.websiteUrl || undefined,
      income_range: body.incomeRange || undefined,
      risk_tolerance: body.riskTolerance || undefined,
      health_status: body.healthStatus || undefined,
      fitness_level: body.fitnessLevel || undefined,
    },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
