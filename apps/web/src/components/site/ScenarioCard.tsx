import type { ReactNode } from 'react';

export default function ScenarioCard({
  domain,
  title,
  detail,
  metric,
  icon,
}: {
  domain: string;
  title: string;
  detail: string;
  metric?: string;
  icon: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.35), transparent 60%)' }}
      />
      <div className="relative flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#5eead4]">
          {icon}
        </div>
        <div className="text-xs font-medium uppercase tracking-wider text-[#5eead4]">{domain}</div>
      </div>
      <h3 className="relative mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-white/55">{detail}</p>
      {metric && (
        <div className="relative mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70">
          {metric}
        </div>
      )}
    </div>
  );
}
