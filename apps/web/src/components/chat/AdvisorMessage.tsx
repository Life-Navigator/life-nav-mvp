'use client';

// Advisor Response Renderer — turns the advisor's Markdown-ish text into polished, structured UI blocks
// (a planning note, not a raw .md transcript). Renders React elements only (no dangerouslySetInnerHTML), so
// there is no HTML/script-injection surface. Falls back to clean paragraphs for plain text.
import { Fragment } from 'react';
import { parseBlocks, type Block, type Inline } from '@/lib/advisor/parseMarkdown';
import { useStreamedText } from '@/components/ui/StreamingText';

function InlineRun({ run }: { run: Inline[] }) {
  return (
    <>
      {run.map((s, i) => {
        if (s.t === 'bold')
          return (
            <strong key={i} className="font-semibold text-gray-900 dark:text-white">
              {s.v}
            </strong>
          );
        if (s.t === 'italic') return <em key={i}>{s.v}</em>;
        if (s.t === 'code')
          return (
            <code
              key={i}
              className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em] dark:bg-gray-700"
            >
              {s.v}
            </code>
          );
        if (s.t === 'link')
          return (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400"
            >
              {s.v}
            </a>
          );
        return <Fragment key={i}>{s.v}</Fragment>;
      })}
    </>
  );
}

// Subtle accent per plan row label (Career/Finance/Health/Education/Family + memo labels).
const ACCENT: Record<string, string> = {
  career: 'text-amber-600 dark:text-amber-400',
  finance: 'text-emerald-600 dark:text-emerald-400',
  finances: 'text-emerald-600 dark:text-emerald-400',
  health: 'text-rose-600 dark:text-rose-400',
  education: 'text-sky-600 dark:text-sky-400',
  family: 'text-violet-600 dark:text-violet-400',
  recommendation: 'text-indigo-600 dark:text-indigo-400',
  why: 'text-gray-500 dark:text-gray-400',
};
function accentFor(label: string): string {
  return (
    ACCENT[label.trim().toLowerCase().replace(/[:.]$/, '')] || 'text-gray-700 dark:text-gray-300'
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'heading':
      return (
        <p className="mt-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <InlineRun run={b.inline} />
        </p>
      );
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          <InlineRun run={b.inline} />
        </p>
      );
    case 'list':
      return b.ordered ? (
        <ol className="ml-1 list-inside list-decimal space-y-1 text-sm text-gray-700 dark:text-gray-200">
          {b.items.map((it, i) => (
            <li key={i}>
              <InlineRun run={it} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="ml-1 space-y-1 text-sm text-gray-700 dark:text-gray-200">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" aria-hidden />
              <span>
                <InlineRun run={it} />
              </span>
            </li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote className="border-l-2 border-indigo-300 pl-3 text-sm italic text-gray-600 dark:text-gray-300">
          <InlineRun run={b.inline} />
        </blockquote>
      );
    case 'plan':
      // Integrated Plan — structured domain rows, NOT a raw numbered list.
      return (
        <div className="rounded-xl border border-gray-200 bg-white/60 p-3 dark:border-gray-700 dark:bg-gray-800/40">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Your plan
          </div>
          <div className="space-y-2.5">
            {b.items.map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-[7rem_1fr] gap-2 max-sm:grid-cols-1 max-sm:gap-0.5"
              >
                <div className={`text-sm font-semibold ${accentFor(it.label)}`}>{it.label}</div>
                <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                  <InlineRun run={it.body} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'next':
      // Distinct "Next step / question" card.
      return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
            {b.label}
          </div>
          <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-100">
            <InlineRun run={b.content} />
          </p>
        </div>
      );
    default:
      return null;
  }
}

export default function AdvisorMessage({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  if (!blocks.length) {
    return <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{text}</p>;
  }
  return (
    <div className="space-y-2.5" data-testid="advisor-rendered">
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </div>
  );
}

// While the message is "typing", reveal plain text (premium feel + valid mid-stream Markdown is rare);
// once complete, swap to the polished block render. Non-animating (historical) messages render polished
// immediately.
export function StreamedAdvisorMessage({ text, animate }: { text: string; animate: boolean }) {
  const { shown, done } = useStreamedText(text || '', animate);
  if (done) return <AdvisorMessage text={text} />;
  return (
    <span className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
      {shown}
      <span
        aria-hidden
        className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse rounded-sm bg-current align-middle opacity-70"
      />
    </span>
  );
}
