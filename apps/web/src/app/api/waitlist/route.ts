import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Public access-request waitlist. People who want in (but aren't invited yet) leave their contact here; the
// founder reviews `public.waitlist_entries` (status='waiting') and grants access when ready by minting an
// invite key (scripts/beta/mint_invite.mjs) and flipping status to 'invited'. This does NOT create an account.
export async function POST(request: NextRequest) {
  let persisted = false;
  try {
    const body = await request.json();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const name = body?.name ? String(body.name).trim() : null;
    const phone = body?.phone ? String(body.phone).trim() : null;
    // Everything else the form collects (company / tier / interest / message) is kept as a note so nothing the
    // requester tells us is lost — the table itself only has email/name/phone/status columns.
    const noteParts = [body?.company, body?.tier, body?.interest, body?.message]
      .map((v: unknown) => (v ? String(v).trim() : ''))
      .filter(Boolean);
    const notes = noteParts.length ? noteParts.join(' · ') : null;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (supabase) {
      // Correct table is public.waitlist_entries (migration 004) — the old code wrote to a non-existent
      // "waitlist" table and swallowed the error, so requests were silently lost.
      const { error } = await (
        supabase as unknown as {
          from: (t: string) => {
            upsert: (rows: unknown, opts: unknown) => Promise<{ error: unknown }>;
          };
        }
      )
        .from('waitlist_entries')
        .upsert(
          { email, name, phone, notes, source: 'website', status: 'waiting' },
          { onConflict: 'email' }
        );
      if (error) {
        console.error('Waitlist persist error:', error);
      } else {
        persisted = true;
      }
    }

    // Soft-success for UX, but tell the truth about whether we actually recorded it.
    return NextResponse.json({ success: true, recorded: persisted });
  } catch (err) {
    console.error('Waitlist error:', err);
    return NextResponse.json({ success: true, recorded: false });
  }
}
