'use client';
import FeedbackPrompt from './FeedbackPrompt';
import { usePilotFeedback } from '@/lib/feedback/usePilotFeedback';

/**
 * Pilot instrument #1 — Narrative accuracy. Asks whether Arcana correctly understood the user's
 * situation. Composes the shared FeedbackPrompt + usePilotFeedback; maps values onto the canonical
 * payload (kind='narrative_accuracy'). No fabrication: nothing is sent unless the user submits.
 */
export default function NarrativeAccuracyPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const { submit } = usePilotFeedback();
  return (
    <FeedbackPrompt
      title="Did Arcana correctly understand your situation?"
      fields={[
        { key: 'accuracy', label: 'How accurate was its understanding?', type: 'scale' },
        {
          key: 'misunderstood',
          label: 'What did Arcana misunderstand?',
          type: 'text',
          optional: true,
          placeholder: 'Optional — anything it got wrong',
        },
        {
          key: 'understood_well',
          label: 'What did it understand particularly well?',
          type: 'text',
          optional: true,
          placeholder: 'Optional — anything it nailed',
        },
      ]}
      submitLabel="Send"
      onDismiss={onDismiss}
      onSubmit={(v) =>
        submit({
          kind: 'narrative_accuracy',
          metrics: typeof v.accuracy === 'number' ? { narrative_accuracy: v.accuracy } : undefined,
          comment: typeof v.misunderstood === 'string' ? v.misunderstood : undefined,
          context:
            typeof v.understood_well === 'string' && v.understood_well
              ? { understood_well: v.understood_well }
              : undefined,
        })
      }
    />
  );
}
