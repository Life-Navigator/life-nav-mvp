// Goals safe to render on the dashboard: clean, concise, deduped. NEVER a raw onboarding paragraph
// (length/word guard) — raw text stays as evidence internally, it is not a goal.
export interface DisplayGoal {
  title?: string;
  domain?: string;
  timeframe?: string;
  confirmation?: string;
}
export function filterDisplayGoals<T extends DisplayGoal>(goals: T[] | null | undefined): T[] {
  if (!Array.isArray(goals)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const g of goals) {
    const t = (g?.title || '').trim();
    if (!t || t.length > 120 || t.split(/\s+/).length > 18) continue; // raw paragraph → reject
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}
