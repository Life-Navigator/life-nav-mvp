'use client';

import { ChevronRight, ArrowLeft } from 'lucide-react';

export interface Crumb {
  id: string;
  label: string;
}

export default function DecisionBreadcrumbs({
  trail,
  onJump,
  onBack,
}: {
  trail: Crumb[];
  onJump: (index: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      {trail.length > 1 && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/5 hover:bg-white/[0.08]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}
      <div className="flex items-center gap-1 overflow-x-auto">
        {trail.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
            <button
              onClick={() => onJump(i)}
              className={`whitespace-nowrap rounded-md px-1.5 py-0.5 transition-colors ${
                i === trail.length - 1
                  ? 'font-medium text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {c.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
