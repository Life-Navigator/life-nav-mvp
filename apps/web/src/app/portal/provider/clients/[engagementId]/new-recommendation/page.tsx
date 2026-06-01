import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, PageHeader } from '@/components/portal/provider/PortalShell';
import { RecommendationBuilderForm } from '@/components/portal/provider/RecommendationBuilderForm';
import type { ProviderDomain, ProviderEngagement } from '@/types/provider';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ engagementId: string }>;
}

export default async function NewRecommendationPage({ params }: Props) {
  const { engagementId } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!prof.data) return null;

  const e = await sb
    .from('provider_engagements')
    .select('*')
    .eq('id', engagementId)
    .eq('provider_id', prof.data.id)
    .maybeSingle();
  if (!e.data) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Engagement not found.</p>
      </Card>
    );
  }
  const eng = e.data as ProviderEngagement;

  return (
    <>
      <PageHeader
        title="New recommendation"
        subtitle={`Scope: ${eng.allowed_domains.join(', ')}`}
      />
      <Card>
        <RecommendationBuilderForm
          engagementId={engagementId}
          patientUserId={eng.patient_user_id}
          scopeDomains={eng.allowed_domains as ProviderDomain[]}
        />
      </Card>
    </>
  );
}
