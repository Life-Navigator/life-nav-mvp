'use client';
import FeedbackPrompt from './FeedbackPrompt';
import { usePilotFeedback } from '@/lib/feedback/usePilotFeedback';

/**
 * Pilot instrument #2 — Trust. Measures whether the user trusts Arcana's reasoning, understands the
 * "why", and feels the recommendation is personalized. kind='trust'. When a recommendationId is
 * provided it is attached as context.recommendation_id. Nothing is sent unless the user submits.
 */
export default function TrustPrompt({
  recommendationId,
  onDismiss,
}: {
  recommendationId?: string;
  onDismiss?: () => void;
}) {
  const { submit } = usePilotFeedback();
  return (
    <FeedbackPrompt
      title="How much do you trust this recommendation?"
      fields={[
        { key: 'trust', label: "I trust Arcana's reasoning", type: 'scale' },
        {
          key: 'understanding',
          label: 'I understand why this recommendation was made',
          type: 'scale',
        },
        {
          key: 'personalization',
          label: 'The recommendation feels personalized',
          type: 'scale',
        },
      ]}
      submitLabel="Send"
      compact
      onDismiss={onDismiss}
      onSubmit={(v) => {
        const metrics: Record<string, number> = {};
        if (typeof v.trust === 'number') metrics.trust = v.trust;
        if (typeof v.understanding === 'number') metrics.understanding = v.understanding;
        if (typeof v.personalization === 'number') metrics.personalization = v.personalization;
        return submit({
          kind: 'trust',
          metrics: Object.keys(metrics).length ? metrics : undefined,
          context: recommendationId ? { recommendation_id: recommendationId } : undefined,
        });
      }}
    />
  );
}
