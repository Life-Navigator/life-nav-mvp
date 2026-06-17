'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, GitBranch, ArrowRight, X } from 'lucide-react';
import type { LifeGraphWorkspace } from '../types';

/**
 * Lightweight "Why am I seeing this?" onboarding header for the explainable Life Graph.
 *
 * Trust rule: this tells a STORY about HOW the graph works, not a fabricated narrative about the
 * user. The only per-user values shown are real counts read straight off the workspace response
 * (nodes / connections / recommendations / sources). There is NO invented per-user text — if the
 * workspace ever carries a real life_brief we can swap the static copy for it, but until then the
 * copy is a fixed explainer + the graph's own real numbers. Honest empty states handled upstream.
 */
export function GraphStoryHeader({ workspace }: { workspace: LifeGraphWorkspace }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const nodes = workspace.metrics?.totalNodes ?? workspace.nodes.length;
  const edges = workspace.metrics?.totalEdges ?? workspace.edges.length;
  const recs = workspace.nodes.filter((n) => n.type === 'recommendation').length;
  const sources = workspace.nodes.filter((n) => n.type === 'source').length;

  return (
    <div className="z-10 border-b border-white/10 bg-gradient-to-r from-indigo-500/10 via-slate-950/40 to-slate-950/40 px-6 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-100">This is your life, connected.</div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Every dot is something real we know about you — a goal, an account, a document, a risk,
            a recommendation. Every line is a relationship we can actually <em>cite</em>: if we
            can&apos;t back a connection with your data, we don&apos;t draw it. Click any node to
            see exactly what data it&apos;s built from and why it matters.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3 w-3 text-slate-500" />
              <span className="font-medium text-slate-200">{nodes}</span> things ·{' '}
              <span className="font-medium text-slate-200">{edges}</span> connections
            </span>
            {recs > 0 && (
              <span>
                <span className="font-medium text-slate-200">{recs}</span> recommendation
                {recs === 1 ? '' : 's'} traced to evidence
              </span>
            )}
            {sources > 0 && (
              <span>
                <span className="font-medium text-slate-200">{sources}</span> source
                {sources === 1 ? '' : 's'} grounding the graph
              </span>
            )}
            <Link
              href="/dashboard/recommendations"
              className="inline-flex items-center gap-1 font-medium text-indigo-300 hover:text-indigo-200"
            >
              See what to do next <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss explanation"
          className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
