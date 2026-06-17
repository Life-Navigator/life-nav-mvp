'use client';
import FeedbackPrompt from './FeedbackPrompt';
import { usePilotFeedback } from '@/lib/feedback/usePilotFeedback';

/**
 * Pilot instrument #6 — Return intent. Would the user use LifeNavigator again, and why?
 * scale → metrics.return_intent; the optional "why?" → comment. kind='return_intent'. Nothing is
 * sent unless the user submits.
 */
export default function ReturnIntentPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const { submit } = usePilotFeedback();
  return (
    <FeedbackPrompt
      title="Would you use LifeNavigator again?"
      fields={[
        { key: 'return_intent', label: 'How likely are you to come back?', type: 'scale' },
        {
          key: 'why',
          label: 'Why?',
          type: 'text',
          optional: true,
          placeholder: 'Optional — what would (or would not) bring you back',
        },
      ]}
      submitLabel="Send"
      compact
      onDismiss={onDismiss}
      onSubmit={(v) =>
        submit({
          kind: 'return_intent',
          metrics:
            typeof v.return_intent === 'number' ? { return_intent: v.return_intent } : undefined,
          comment: typeof v.why === 'string' ? v.why : undefined,
        })
      }
    />
  );
}
