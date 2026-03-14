import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getProfile, getEmail, mapToCareerProfile } from '@/lib/integrations/linkedin/client';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!encryptionKey) {
    return NextResponse.json({ error: 'Encryption key not configured' }, { status: 503 });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('Admin client not configured');

    // Retrieve LinkedIn token
    const { data: tokenData, error: tokenError } = await admin.rpc('get_integration_token', {
      p_user_id: user.id,
      p_provider: 'linkedin',
      p_encryption_key: encryptionKey,
    });

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 });
    }

    const accessToken = tokenData.access_token || tokenData;

    // Fetch LinkedIn profile
    const profile = await getProfile(accessToken);
    const email = await getEmail(accessToken);
    const careerData = mapToCareerProfile(profile, email);

    // Upsert into career_profiles
    const { error: upsertError } = await (supabase as any).from('career_profiles').upsert(
      {
        user_id: user.id,
        ...careerData,
      },
      { onConflict: 'user_id' }
    );

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      profile: careerData,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
