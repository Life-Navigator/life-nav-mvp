'use client';

import { ChevronRight, ChevronLeft } from 'lucide-react';

export interface Crumb {
  id: string;
  label: string;
}

interface Props {
  trail: Crumb[];
  onJump: (index: number) => void;
  onBack: () => void;
}

/** Drilldown trail, built from real node selections — not synthetic. Hidden until the user drills in. */
export function GraphBreadcrumbs({ trail, onJump, onBack }: Props) {
  if (!trail.length) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-slate-400">
      {trail.length > 1 && (
        <button
          type="button"
          onClick={onBack}
          className="mr-1 flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
        >
          <ChevronLeft className="h-3 w-3" /> Back
        </button>
      )}
      {trail.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
          <button
            type="button"
            onClick={() => onJump(i)}
            className={
              i === trail.length - 1
                ? 'font-medium text-white'
                : 'text-slate-400 hover:text-slate-200'
            }
          >
            {c.label}
          </button>
        </span>
      ))}
    </div>
  );
}
