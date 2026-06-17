'use client';
import FeedbackPrompt from './FeedbackPrompt';
import { usePilotFeedback } from '@/lib/feedback/usePilotFeedback';

/**
 * Pilot instrument #4 — Insight. Did Arcana identify something the user hadn't considered?
 * yes/no → insight_detected; the optional "what?" → comment. kind='insight'. Nothing is sent unless
 * the user submits.
 */
export default function InsightPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const { submit } = usePilotFeedback();
  return (
    <FeedbackPrompt
      title="Did Arcana identify something you hadn't considered?"
      fields={[
        { key: 'insight', label: 'Something new to you?', type: 'yesno' },
        {
          key: 'what',
          label: 'What?',
          type: 'text',
          optional: true,
          placeholder: 'Optional — what did it surface',
        },
      ]}
      submitLabel="Send"
      compact
      onDismiss={onDismiss}
      onSubmit={(v) =>
        submit({
          kind: 'insight',
          insight_detected: typeof v.insight === 'boolean' ? v.insight : undefined,
          comment: typeof v.what === 'string' ? v.what : undefined,
        })
      }
    />
  );
}
