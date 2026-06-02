import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  action: z.enum(['acknowledge', 'dismiss', 'share_with_physician']),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, string> = {};
  if (parsed.data.action === 'acknowledge') patch.acknowledged_at = now;
  if (parsed.data.action === 'dismiss') patch.dismissed_at = now;
  if (parsed.data.action === 'share_with_physician') patch.shared_with_physician_at = now;

  const sb: any = supabase;
  const { error } = await sb
    .schema('health_meta')
    .from('health_alert_events')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    if (/permission|policy|locked/i.test(error.message)) {
      return NextResponse.json({ success: false, feature_locked: true });
    }
    return safeApiError({ code: 'validation_failed', internal: error });
  }
  return NextResponse.json({ success: true });
}
