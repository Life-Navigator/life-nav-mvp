'use client';
import FeedbackPrompt from './FeedbackPrompt';
import { usePilotFeedback } from '@/lib/feedback/usePilotFeedback';

/**
 * Pilot instrument #3 — Recommendation quality. Was it useful, would the user actually do it, and
 * was anything missing? kind='recommendation_quality'. recommendationId → context.recommendation_id.
 * Nothing is sent unless the user submits.
 */
export default function RecommendationQualityPrompt({
  recommendationId,
  onDismiss,
}: {
  recommendationId?: string;
  onDismiss?: () => void;
}) {
  const { submit } = usePilotFeedback();
  return (
    <FeedbackPrompt
      title="Was this recommendation any good?"
      fields={[
        { key: 'usefulness', label: 'Was this useful?', type: 'scale' },
        { key: 'actionability', label: 'Would you actually do this?', type: 'scale' },
        {
          key: 'missing',
          label: 'Was anything missing?',
          type: 'text',
          optional: true,
          placeholder: 'Optional — what would have made it better',
        },
      ]}
      submitLabel="Send"
      compact
      onDismiss={onDismiss}
      onSubmit={(v) => {
        const metrics: Record<string, number> = {};
        if (typeof v.usefulness === 'number') metrics.usefulness = v.usefulness;
        if (typeof v.actionability === 'number') metrics.actionability = v.actionability;
        // Composite recommendation_quality = mean of the two sub-scores, so the dashboard's
        // Recommendation Quality gate has a direct value while the components stay visible.
        const parts = [v.usefulness, v.actionability].filter(
          (n): n is number => typeof n === 'number'
        );
        if (parts.length) {
          metrics.recommendation_quality = Math.round(
            parts.reduce((a, b) => a + b, 0) / parts.length
          );
        }
        return submit({
          kind: 'recommendation_quality',
          metrics: Object.keys(metrics).length ? metrics : undefined,
          comment: typeof v.missing === 'string' ? v.missing : undefined,
          context: recommendationId ? { recommendation_id: recommendationId } : undefined,
        });
      }}
    />
  );
}
