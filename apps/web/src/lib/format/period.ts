// Human "Mon YYYY – Present" range for history cards. Safe on empty/invalid input.
function fmt(d?: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function period(
  start?: string | null,
  end?: string | null,
  current?: boolean
): string | undefined {
  const s = fmt(start);
  const e = current ? 'Present' : fmt(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `${s} – Present`;
  if (e) return e;
  return undefined;
}
