import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, interest } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      // If Supabase isn't configured, still return success so the UI shows confirmation
      return NextResponse.json({ success: true });
    }

    // Store in a simple waitlist table (or profiles with a flag)
    await (supabase as any)
      .from('waitlist')
      .upsert(
        { email, name, interest, created_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Waitlist error:', err);
    // Don't fail the user experience for a waitlist signup
    return NextResponse.json({ success: true });
  }
}
