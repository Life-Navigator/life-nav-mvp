import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PortalShell } from '@/components/portal/provider/PortalShell';

export const dynamic = 'force-dynamic';

/**
 * Server layout — gates the whole portal subtree by requiring an
 * authenticated user with a provider_profiles row. Non-providers are
 * sent away.
 */
export default async function ProviderPortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login?next=/portal/provider/dashboard');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/portal/provider/dashboard');

  const sb = supabase as any;
  const prof = await sb
    .from('provider_profiles')
    .select('display_name, legal_name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!prof.data) {
    return (
      <PortalShell>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          You are signed in but do not have a provider profile. Contact your administrator to be
          onboarded as a provider.
        </div>
      </PortalShell>
    );
  }
  const name = prof.data.display_name ?? prof.data.legal_name ?? 'Provider';
  return <PortalShell providerName={name}>{children}</PortalShell>;
}
