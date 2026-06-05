/** Two-layer grounding architecture, dark/cinematic. */
export default function TrustArchitectureVisual({ className = '' }: { className?: string }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-white/50">
            Central GraphRAG
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">Governs HOW</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            Shared methodology, compliance, and safety policy. Identical for everyone. Contains no
            personal data, and never decides what is true about you.
          </p>
        </div>
        <div
          className="rounded-2xl border border-[#2dd4bf]/30 p-6 backdrop-blur-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(45,212,191,0.1), rgba(45,212,191,0.02))',
          }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2dd4bf]/30 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-[#5eead4]">
            Personal GraphRAG
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">Determines WHAT is true</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/65">
            Your accounts, goals, and history — isolated to you. The only source for any personal
            fact.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2dd4bf] text-[#06060a]">
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
            >
              <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <div className="font-semibold text-white">Authoritative facts</div>
            <p className="mt-1 text-sm text-white/55">
              Your real figures are read from the system of record and cited as the source of truth.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-white/50">
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M10 6v5M10 14h0" strokeLinecap="round" />
              <circle cx="10" cy="10" r="7" />
            </svg>
          </span>
          <div>
            <div className="font-semibold text-white">Refuse when unknown</div>
            <p className="mt-1 text-sm text-white/55">
              If a fact isn&apos;t in your data, LifeNavigator says so and offers to add it — it
              never guesses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
