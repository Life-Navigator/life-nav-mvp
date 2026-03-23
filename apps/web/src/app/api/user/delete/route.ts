import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { password, confirmText } = body;

    if (confirmText !== 'DELETE') {
      return NextResponse.json({ error: 'Confirmation text must be DELETE' }, { status: 400 });
    }

    // Verify password by attempting sign-in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (verifyError) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
    }

    // Use service role to delete user data and auth record
    const adminClient = createServiceRoleClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 503 });
    }

    // Delete user data from all tables (cascades via FK where configured)
    // The GDPR delete function handles this if available
    const { error: rpcError } = await (adminClient as any).rpc('delete_user_data', {
      p_user_id: user.id,
    });

    if (rpcError) {
      // Fallback: delete profile directly (FK cascades handle the rest)
      await (adminClient as any).from('profiles').delete().eq('id', user.id);
    }

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('User delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
