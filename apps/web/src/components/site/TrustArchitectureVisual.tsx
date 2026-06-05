/** Two-layer grounding architecture, told visually. Light surfaces, accent
 *  reserved for the authoritative/personal path. */
export default function TrustArchitectureVisual({ className = '' }: { className?: string }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-paper)] p-6 [box-shadow:var(--brand-elev)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-line)] px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--brand-muted)]">
            Central GraphRAG
          </div>
          <h3 className="mt-3 text-lg font-semibold">Governs HOW</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--brand-muted)]">
            Shared methodology, compliance, and safety policy. Identical for everyone. Contains no
            personal data, and never decides what is true about you.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent-soft)] p-6 [box-shadow:var(--brand-elev)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--brand-accent)]">
            Personal GraphRAG
          </div>
          <h3 className="mt-3 text-lg font-semibold">Determines WHAT is true</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--brand-ink)]/70">
            Your accounts, goals, and history — isolated to you. The only source for any personal
            fact.
          </p>
        </div>
      </div>

      {/* outcomes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-paper)] p-5">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand-accent)] text-white">
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <div className="font-semibold">Authoritative facts</div>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Your real figures are read from the system of record and cited as the source of truth.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-paper)] p-5">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--brand-line)] text-[var(--brand-muted)]">
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
            <div className="font-semibold">Refuse when unknown</div>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              If a fact isn&apos;t in your data, LifeNavigator says so and offers to add it — it
              never guesses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
