'use client';
import FeedbackPrompt from './FeedbackPrompt';
import { usePilotFeedback } from '@/lib/feedback/usePilotFeedback';

/**
 * Pilot instrument #5 — "Holy-shit" moment. Did anything surprise the user in a useful way?
 * yes/no → surprised; the optional "what?" → comment. kind='holy_shit'. Nothing is sent unless the
 * user submits.
 */
export default function HolyShitPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const { submit } = usePilotFeedback();
  return (
    <FeedbackPrompt
      title="Did anything surprise you in a useful way?"
      fields={[
        { key: 'surprised', label: 'A useful surprise?', type: 'yesno' },
        {
          key: 'what',
          label: 'What surprised you?',
          type: 'text',
          optional: true,
          placeholder: 'Optional — what stood out',
        },
      ]}
      submitLabel="Send"
      compact
      onDismiss={onDismiss}
      onSubmit={(v) =>
        submit({
          kind: 'holy_shit',
          surprised: typeof v.surprised === 'boolean' ? v.surprised : undefined,
          comment: typeof v.what === 'string' ? v.what : undefined,
        })
      }
    />
  );
}
