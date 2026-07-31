'use client';

/**
 * Categorized advisor-response reporting (audit finding R-3 / B-22).
 *
 * WHY THIS DOES NOT USE `components/ui/dialog.tsx`
 * -----------------------------------------------
 * That module is a STUB — a shadcn placeholder whose `Dialog` ignores `open`, renders its children
 * unconditionally, and provides no focus trap, no Escape handling and no modal semantics. Reusing
 * it would produce a "dialog" that is always in the DOM, cannot be closed, and traps nothing —
 * failing every accessibility requirement this feature has. Rather than silently ship an
 * inaccessible dialog or silently rewrite the design system, this component implements the modal
 * behaviour locally and the stub is left untouched.
 *
 * Category values come from the typed client (`lib/advisor/responseReport`), never redeclared here,
 * so the wire vocabulary has exactly one definition.
 *
 * Never rendered: internal traces, prompts, raw model output, model config, policy internals.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  MAX_EXPLANATION_LENGTH,
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  isRetryable,
  submitResponseReport,
  type ReportCategory,
  type ResponseReportOutcome,
} from '@/lib/advisor/responseReport';

export interface ReportResponseDialogProps {
  /** Server-issued turn id. The caller must not render this dialog without one. */
  turnId: string;
  open: boolean;
  onClose: () => void;
  /** Element focus returns to on close (the originating response's report button). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Injected in tests. */
  submit?: typeof submitResponseReport;
}

type Phase = 'form' | 'submitting' | 'success';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function ReportResponseDialog({
  turnId,
  open,
  onClose,
  returnFocusRef,
  submit = submitResponseReport,
}: ReportResponseDialogProps) {
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [explanation, setExplanation] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string>('');
  const [canRetry, setCanRetry] = useState(false);
  const [reportId, setReportId] = useState('');
  const [wasDuplicate, setWasDuplicate] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Guards against a late response updating state after unmount or close — and against a second
  // in-flight request from repeated clicks.
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const titleId = useId();
  const descId = useId();
  const groupId = useId();
  const errorId = useId();
  const counterId = useId();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Focus enters the dialog on open; returns to the originating control on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      const target = returnFocusRef?.current ?? previous;
      target?.focus?.();
    };
  }, [open, returnFocusRef]);

  const close = useCallback(() => {
    if (phase === 'submitting') return; // never abandon an in-flight submission
    onClose();
  }, [phase, onClose]);

  // Escape to close + focus trap.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [close]
  );

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (inFlight.current) return; // double-submit prevention
    if (!category) {
      setError('Choose what went wrong.');
      setCanRetry(false);
      return;
    }
    inFlight.current = true;
    setPhase('submitting');
    setError('');

    const outcome: ResponseReportOutcome = await submit({
      turn_id: turnId,
      category,
      explanation: explanation || undefined,
    });

    inFlight.current = false;
    if (!mounted.current) return; // stale response after unmount

    if (outcome.kind === 'submitted' || outcome.kind === 'duplicate') {
      setReportId(outcome.reportId);
      setWasDuplicate(outcome.kind === 'duplicate');
      setPhase('success');
      return;
    }

    // Failure — the explanation and category are deliberately NOT cleared so a retry costs nothing.
    setPhase('form');
    setCanRetry(isRetryable(outcome));
    setError(messageFor(outcome));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 motion-reduce:transition-none"
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800 motion-reduce:transition-none"
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
          Report this response
        </h2>

        {phase === 'success' ? (
          <div>
            <p
              role="status"
              aria-live="polite"
              className="mt-3 text-sm text-gray-700 dark:text-gray-200"
            >
              {wasDuplicate
                ? 'You’ve already reported this response for that reason — we’re still looking into it.'
                : 'Thanks — your report was received.'}
              {reportId ? ` Reference: ${reportId}` : ''}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <p id={descId} className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Your report may be reviewed to improve LifeNavigator. Sending it doesn’t change this
              answer or your saved information.
            </p>

            <fieldset className="mt-4" aria-describedby={error ? errorId : undefined}>
              <legend id={groupId} className="text-sm font-medium text-gray-900 dark:text-white">
                What went wrong?
              </legend>
              <div className="mt-2 space-y-1">
                {REPORT_CATEGORIES.map((c, i) => (
                  <label
                    key={c}
                    className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-100"
                  >
                    <input
                      ref={i === 0 ? firstFieldRef : undefined}
                      type="radio"
                      name="report-category"
                      value={c}
                      checked={category === c}
                      onChange={() => {
                        setCategory(c);
                        setError('');
                      }}
                      disabled={phase === 'submitting'}
                    />
                    {REPORT_CATEGORY_LABELS[c]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-4">
              <label
                htmlFor="report-explanation"
                className="text-sm font-medium text-gray-900 dark:text-white"
              >
                Anything else? (optional)
              </label>
              <textarea
                id="report-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value.slice(0, MAX_EXPLANATION_LENGTH))}
                maxLength={MAX_EXPLANATION_LENGTH}
                rows={3}
                disabled={phase === 'submitting'}
                aria-describedby={counterId}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
              <p id={counterId} className="mt-1 text-xs text-gray-500">
                Up to {MAX_EXPLANATION_LENGTH} characters. Please don’t include sensitive details
                you wouldn’t want reviewed.
              </p>
            </div>

            {error ? (
              <p id={errorId} role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            {phase === 'submitting' ? (
              <p role="status" aria-live="polite" className="mt-3 text-sm text-gray-600">
                Sending your report…
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={phase === 'submitting'}
                className="min-h-[44px] rounded-md px-4 py-2 text-sm text-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={phase === 'submitting'}
                className="min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {phase === 'submitting' ? 'Sending…' : canRetry ? 'Try again' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function messageFor(outcome: ResponseReportOutcome): string {
  switch (outcome.kind) {
    case 'invalid':
      return outcome.message;
    case 'session_expired':
      return 'Your session expired. Sign in again, then resend this report.';
    case 'unavailable':
      return 'This response is no longer available to report.';
    case 'rate_limited':
      return outcome.retryAfterSeconds
        ? `Too many reports just now. Try again in about ${outcome.retryAfterSeconds} seconds.`
        : 'Too many reports just now. Please try again shortly.';
    case 'network_error':
      return 'We couldn’t reach LifeNavigator. Your note is saved here — try again.';
    default:
      return 'Something went wrong sending your report. Your note is saved here — try again.';
  }
}
