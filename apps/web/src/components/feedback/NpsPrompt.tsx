'use client';
import FeedbackPrompt from './FeedbackPrompt';
import { usePilotFeedback } from '@/lib/feedback/usePilotFeedback';

/**
 * Pilot instrument #7 — NPS. How likely is the user to recommend LifeNavigator? Standard 0–10 scale
 * sent on the dedicated `nps` field (not a 0-10 metric). kind='nps'. Nothing is sent unless the user
 * submits.
 */
export default function NpsPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const { submit } = usePilotFeedback();
  return (
    <FeedbackPrompt
      title="How likely are you to recommend LifeNavigator?"
      fields={[
        {
          key: 'nps',
          label: '0 = not at all likely, 10 = extremely likely',
          type: 'scale',
          min: 0,
          max: 10,
        },
      ]}
      submitLabel="Send"
      compact
      onDismiss={onDismiss}
      onSubmit={(v) =>
        submit({
          kind: 'nps',
          nps: typeof v.nps === 'number' ? v.nps : undefined,
        })
      }
    />
  );
}
