'use client';
import { useState } from 'react';

/**
 * Reusable, non-intrusive pilot feedback prompt primitive. Compose it into specific instruments
 * (narrative accuracy, trust, NPS, holy-shit, etc.). Supports a 0/1–10 scale, yes/no, and free text.
 * Brand navy/teal; dismissible; shows a brief thank-you after submit. No data is fabricated or shown back.
 */
export type FieldType = 'scale' | 'yesno' | 'text';

export interface FeedbackField {
  key: string;
  label: string;
  type: FieldType;
  min?: number; // scale min (default 1)
  max?: number; // scale max (default 10)
  optional?: boolean;
  placeholder?: string;
}

export interface FeedbackPromptProps {
  title: string;
  fields: FeedbackField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, number | boolean | string>) => Promise<boolean> | boolean;
  onDismiss?: () => void;
  compact?: boolean;
}

export default function FeedbackPrompt({
  title,
  fields,
  submitLabel = 'Send feedback',
  onSubmit,
  onDismiss,
  compact,
}: FeedbackPromptProps) {
  const [values, setValues] = useState<Record<string, number | boolean | string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: number | boolean | string) => setValues((p) => ({ ...p, [k]: v }));

  const canSubmit = fields.some((f) => values[f.key] !== undefined && values[f.key] !== '');

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    const ok = await onSubmit(values);
    setBusy(false);
    if (ok) setDone(true);
  };

  if (done) {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm text-teal-800">
        Thank you — your feedback helps Arcana get better.
      </div>
    );
  }

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'} shadow-sm`}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            Skip
          </button>
        )}
      </div>

      <div className="mt-3 space-y-4">
        {fields.map((f) => {
          const min = f.min ?? 1;
          const max = f.max ?? 10;
          return (
            <div key={f.key}>
              <label className="block text-sm text-slate-700">{f.label}</label>
              {f.type === 'scale' && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set(f.key, n)}
                      aria-pressed={values[f.key] === n}
                      className={`h-8 w-8 rounded-md border text-xs font-medium transition ${
                        values[f.key] === n
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {f.type === 'yesno' && (
                <div className="mt-2 flex gap-2">
                  {[
                    ['Yes', true],
                    ['No', false],
                  ].map(([lbl, val]) => (
                    <button
                      key={String(lbl)}
                      type="button"
                      onClick={() => set(f.key, val as boolean)}
                      aria-pressed={values[f.key] === val}
                      className={`rounded-md border px-4 py-1.5 text-sm font-medium transition ${
                        values[f.key] === val
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
              {f.type === 'text' && (
                <textarea
                  rows={2}
                  placeholder={f.placeholder}
                  value={(values[f.key] as string) || ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit || busy}
        className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Sending…' : submitLabel}
      </button>
    </section>
  );
}
