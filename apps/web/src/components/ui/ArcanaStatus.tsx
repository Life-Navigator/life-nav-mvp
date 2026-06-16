'use client';

import type { ArcanaStatus } from '@/lib/arcana/streaming';
import { ARCANA_STATUS_LABEL } from '@/lib/arcana/streaming';

/**
 * Subtle pre-answer status line — "Arcana is thinking…" / "Arcana is checking this…".
 *
 * Shown ONLY for the safe, pre-approval states (thinking / checking) and briefly while the
 * approved answer types (responding). It NEVER renders model output, compliance internals,
 * model names, validator internals, or rejection reasons. Keep it understated.
 */
export default function ArcanaStatus({ status }: { status: ArcanaStatus }) {
  const label = ARCANA_STATUS_LABEL[status];
  if (!label) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-1 py-1 text-xs font-medium text-gray-500"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
      </span>
      <span>{label}</span>
      <span aria-hidden className="inline-flex gap-0.5">
        <span className="animate-bounce [animation-delay:-0.3s]">.</span>
        <span className="animate-bounce [animation-delay:-0.15s]">.</span>
        <span className="animate-bounce">.</span>
      </span>
    </div>
  );
}
