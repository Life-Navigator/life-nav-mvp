import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { verifyConsentAt } from '@/lib/arcana/lead-package-service';
import { Card, PageHeader } from '@/components/portal/provider/PortalShell';
import { LeadActions } from '@/components/portal/provider/LeadActions';
import type { LeadPackage, LeadPackageConsent } from '@/types/arcana';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leadId: string }>;
}

export default async function ProviderLeadWorkspacePage({ params }: Props) {
  const { leadId } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!prof.data) return null;

  const lpRes = await sb
    .from('lead_packages')
    .select('*')
    .eq('id', leadId)
    .eq('recipient_provider_id', prof.data.id)
    .maybeSingle();
  if (!lpRes.data) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Lead not found or not addressed to you.</p>
      </Card>
    );
  }
  const lp = lpRes.data as LeadPackage;
  const consentRes = await sb
    .from('lead_package_consents')
    .select('*')
    .eq('id', lp.consent_id)
    .maybeSingle();
  const consent = (consentRes.data ?? null) as LeadPackageConsent | null;
  const engRes = await sb
    .from('provider_engagements')
    .select('id, status')
    .eq('provider_id', prof.data.id)
    .eq('patient_user_id', lp.user_id)
    .maybeSingle();
  const accepted = engRes.data?.status === 'active';

  const now = new Date().toISOString();
  const verdict = consent
    ? verifyConsentAt(consent, now)
    : { ok: false, reasons: ['missing_consent_row'] };

  if (!verdict.ok) {
    return (
      <>
        <PageHeader title="Lead workspace" subtitle="Consent is no longer active." />
        <Card>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            The patient has withdrawn or the consent has expired. We do not show non-consented data.
          </p>
          <ul className="mt-2 text-xs text-slate-500">
            {verdict.reasons.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </Card>
      </>
    );
  }

  const p = lp.payload;
  return (
    <>
      <PageHeader
        title={`Lead — ${p.patient_summary.name_initials}`}
        subtitle={
          `${p.patient_summary.age_band ?? ''} ${p.patient_summary.sex ?? ''}`.trim() || undefined
        }
        actions={<LeadActions leadId={lp.id} alreadyAccepted={accepted} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold">Summary</h2>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Membership</dt>
            <dd>{p.patient_summary.membership_tier ?? '—'}</dd>
            <dt className="text-slate-500">Dominant driver</dt>
            <dd>{p.motivation_summary?.dominant_driver ?? '—'}</dd>
            <dt className="text-slate-500">Readiness</dt>
            <dd>
              {lp.readiness_score != null ? (lp.readiness_score * 100).toFixed(0) + '%' : '—'}
            </dd>
            <dt className="text-slate-500">Probability of success</dt>
            <dd>
              {lp.probability_of_success != null
                ? (lp.probability_of_success * 100).toFixed(0) + '%'
                : '—'}
            </dd>
          </dl>
        </Card>

        {p.goals && p.goals.length > 0 ? (
          <Card>
            <h2 className="text-lg font-semibold">Health Goals</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {p.goals.map((g, i) => (
                <li key={i} className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <div className="font-medium">{g.title}</div>
                  <div className="text-xs text-slate-500">
                    {g.kind} · {g.domain}
                  </div>
                  {g.why ? (
                    <div className="mt-1 italic text-slate-700 dark:text-slate-300">“{g.why}”</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {p.constraints && p.constraints.length > 0 ? (
          <Card>
            <h2 className="text-lg font-semibold">Constraints</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {p.constraints.map((c, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${c.severity === 'hard' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}
                  >
                    {c.severity}
                  </span>
                  <span>{c.description}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {p.motivation_summary?.short_quote ? (
          <Card>
            <h2 className="text-lg font-semibold">Motivation</h2>
            <p className="mt-2 text-sm italic">“{p.motivation_summary.short_quote}”</p>
            <p className="mt-1 text-xs text-slate-500">
              Drivers inferred from intake session:{' '}
              {p.motivation_summary.drivers_inferred_from_session ? 'yes' : 'no'}
            </p>
          </Card>
        ) : null}

        {p.biometric_snapshot && p.biometric_snapshot.length > 0 ? (
          <Card>
            <h2 className="text-lg font-semibold">Biometric snapshot</h2>
            <ul className="mt-2 text-sm">
              {p.biometric_snapshot.map((b, i) => (
                <li
                  key={i}
                  className="flex justify-between border-t border-slate-100 dark:border-slate-800 py-1.5"
                >
                  <span className="text-slate-700 dark:text-slate-300">
                    {b.metric_kind.replace(/_/g, ' ')}
                  </span>
                  <span>
                    {b.most_recent_value}
                    {b.unit ? ` ${b.unit}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {p.lab_snapshot && p.lab_snapshot.length > 0 ? (
          <Card>
            <h2 className="text-lg font-semibold">Labs</h2>
            <ul className="mt-2 text-sm">
              {p.lab_snapshot.map((l, i) => (
                <li
                  key={i}
                  className="flex justify-between border-t border-slate-100 dark:border-slate-800 py-1.5"
                >
                  <span>{l.lab_kind.replace(/_/g, ' ')}</span>
                  <span>
                    {l.result_value ?? '—'} {l.unit ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {(lp.key_risks?.length ?? 0) > 0 ? (
          <Card>
            <h2 className="text-lg font-semibold">Risks</h2>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {lp.key_risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {(lp.recommended_discussion_topics?.length ?? 0) > 0 ? (
          <Card>
            <h2 className="text-lg font-semibold">Discussion topics</h2>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {lp.recommended_discussion_topics.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {p.insurance ? (
          <Card>
            <h2 className="text-lg font-semibold">Insurance summary</h2>
            <p className="mt-2 text-sm">{p.insurance.plan_summary ?? '—'}</p>
            {p.insurance.coverage_notes ? (
              <p className="mt-1 text-xs text-slate-500">{p.insurance.coverage_notes}</p>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}
