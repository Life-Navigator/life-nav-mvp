import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchBadges, mapBadgeToCourse } from '@/lib/integrations/credly/client';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Get stored Credly username
    const { data: integration } = await (supabase as any)
      .from('integrations')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('provider', 'credly')
      .single();

    const username = integration?.metadata?.username;
    if (!username) {
      return NextResponse.json({ error: 'Credly not connected' }, { status: 400 });
    }

    const badges = await fetchBadges(username);
    const courses = badges.map(mapBadgeToCourse);

    let synced = 0;
    for (const course of courses) {
      const credlyId = course.metadata.credly_badge_id;

      // Check if already synced via metadata
      const { data: existing } = await (supabase as any)
        .from('courses')
        .select('id')
        .eq('user_id', user.id)
        .contains('metadata', { credly_badge_id: credlyId })
        .maybeSingle();

      if (existing) {
        // Update existing
        await (supabase as any).from('courses').update(course).eq('id', existing.id);
      } else {
        // Insert new
        await (supabase as any).from('courses').insert({ ...course, user_id: user.id });
        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      total: badges.length,
      synced,
      updated: badges.length - synced,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
