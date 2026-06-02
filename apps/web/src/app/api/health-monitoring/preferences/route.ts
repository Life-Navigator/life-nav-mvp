import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const Schema = z
  .object({
    alerts_enabled: z.boolean().optional(),
    email_alerts_enabled: z.boolean().optional(),
    push_alerts_enabled: z.boolean().optional(),
    sms_alerts_enabled: z.boolean().optional(),
    quiet_hours_start_local: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional()
      .nullable(),
    quiet_hours_end_local: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional()
      .nullable(),
    min_severity_to_notify: z.enum(['info', 'watch', 'warn', 'urgent']).optional(),
    share_alerts_with_physician: z.boolean().optional(),
    physician_email: z.string().email().optional().nullable(),
  })
  .strict();

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb: any = supabase;
  const { data, error } = await sb
    .schema('health_meta')
    .from('health_monitoring_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    if (/permission|policy|locked/i.test(error.message)) {
      return NextResponse.json({ preferences: null, feature_locked: true });
    }
    return safeApiError({ code: 'validation_failed', internal: error });
  }
  return NextResponse.json({
    preferences: data ?? {
      alerts_enabled: true,
      email_alerts_enabled: true,
      push_alerts_enabled: false,
      sms_alerts_enabled: false,
      quiet_hours_start_local: null,
      quiet_hours_end_local: null,
      min_severity_to_notify: 'info',
      share_alerts_with_physician: false,
      physician_email: null,
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

  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const sb: any = supabase;
  const { error } = await sb
    .schema('health_meta')
    .from('health_monitoring_preferences')
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: 'user_id' });
  if (error) {
    if (/permission|policy|locked/i.test(error.message)) {
      return NextResponse.json({ success: false, feature_locked: true });
    }
    return safeApiError({ code: 'validation_failed', internal: error });
  }
  return NextResponse.json({ success: true });
}
