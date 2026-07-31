'use client';

/**
 * `Report this response` entry point (R-3 / B-22).
 *
 * Renders ONLY when the message carries a nonempty server-issued `turn_id`. A completed advisor
 * response without one is a legacy history message or a contract failure — either way it emits a
 * privacy-safe diagnostic and renders nothing, rather than showing an action that cannot work or
 * inventing an identifier.
 */
import { useEffect, useRef, useState } from 'react';
import { ReportResponseDialog } from '@/components/chat/ReportResponseDialog';

export interface ReportResponseActionProps {
  turnId?: string;
  /** Position in the rendered conversation. Diagnostic only — NEVER used to derive an identifier. */
  messageIndex: number;
  /** Injected in tests. */
  onDiagnostic?: (event: MissingTurnDiagnostic) => void;
}

export interface MissingTurnDiagnostic {
  event: 'advisor_response_not_reportable';
  reason: 'legacy_or_missing_turn_id';
  message_index: number;
}

/** Privacy-safe: index only. No question, answer, citations, tenant or user content. */
function emitDiagnostic(d: MissingTurnDiagnostic) {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(d));
}

export function ReportResponseAction({
  turnId,
  messageIndex,
  onDiagnostic = emitDiagnostic,
}: ReportResponseActionProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reportable = typeof turnId === 'string' && turnId.length > 0;

  useEffect(() => {
    if (!reportable) {
      onDiagnostic({
        event: 'advisor_response_not_reportable',
        reason: 'legacy_or_missing_turn_id',
        message_index: messageIndex,
      });
    }
  }, [reportable, messageIndex, onDiagnostic]);

  if (!reportable) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700 dark:text-gray-400"
      >
        Report this response
      </button>
      <ReportResponseDialog
        turnId={turnId}
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
