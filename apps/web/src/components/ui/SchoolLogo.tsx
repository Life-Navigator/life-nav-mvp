'use client';

import { useState } from 'react';

/**
 * Renders a school/issuer logo from a URL, falling back to a tinted letter avatar
 * when the image is missing or 404s (Clearbit returns 404 for unknown domains).
 */
export function SchoolLogo({
  name,
  logoUrl,
  size = 36,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const letter = (name || '?').trim().charAt(0).toUpperCase();

  if (logoUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setErrored(true)}
        className="rounded-lg object-contain bg-white border border-slate-200 dark:border-slate-700 p-0.5 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  // Deterministic tint from the name so each school gets a stable color.
  const palette = [
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-sky-100 text-sky-700',
    'bg-rose-100 text-rose-700',
    'bg-violet-100 text-violet-700',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const tint = palette[hash % palette.length];

  return (
    <span
      className={`rounded-lg flex items-center justify-center font-semibold shrink-0 ${tint}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {letter}
    </span>
  );
}
