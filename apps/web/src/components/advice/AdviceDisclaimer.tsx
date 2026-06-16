import {
  type DisclaimerLevel,
  SUBTLE_COPY,
  EXPLICIT_COPY,
  FORMAL_COPY,
} from '@/lib/advice/disclosure';

/**
 * Context-aware advice disclaimer. Renders nothing at level "none" (this is what keeps discovery,
 * goal capture, and low-risk coaching clean). "subtle" is a single muted line; "explicit"/"formal"
 * use a calm amber note. Never alarming, never repeated unnecessarily.
 */
export default function AdviceDisclaimer({
  level,
  className = '',
}: {
  level: DisclaimerLevel;
  className?: string;
}) {
  if (level === 'none') return null;

  if (level === 'subtle') {
    return <p className={`text-xs text-gray-500 ${className}`}>{SUBTLE_COPY}</p>;
  }

  const copy = level === 'formal' ? FORMAL_COPY : EXPLICIT_COPY;
  return (
    <div
      role="note"
      className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className}`}
    >
      {copy}
    </div>
  );
}
