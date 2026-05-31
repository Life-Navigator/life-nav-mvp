/**
 * Saves the structured user-graph payload captured by UserGraphQuestionnaire
 * to its six dedicated API routes.
 *
 * Each call is independent — a 4xx/5xx from one section does not prevent the
 * others from persisting. Returns a summary so callers can surface partial
 * failures to the user without blocking onboarding completion.
 */

import type { UserGraphPayload } from '@/types/user-graph';

export interface SaveUserGraphResult {
  ok: boolean;
  sections: Record<string, { ok: boolean; status: number; error?: string }>;
}

interface Section {
  key: keyof UserGraphPayload;
  path: string;
  buildBody: (p: UserGraphPayload) => Record<string, unknown> | null;
}

const SECTIONS: Section[] = [
  {
    key: 'life_vision',
    path: '/api/onboarding/life-vision',
    buildBody: (p) =>
      p.life_vision.length ? { entries: p.life_vision, source: 'onboarding' } : null,
  },
  {
    key: 'constraints',
    path: '/api/onboarding/constraints',
    buildBody: (p) =>
      p.constraints.filter((c) => c.description?.trim()).length
        ? {
            constraints: p.constraints
              .filter((c) => c.description?.trim())
              .map((c) => ({ ...c, description: c.description.trim() })),
            source: 'onboarding',
          }
        : null,
  },
  {
    key: 'decision_preferences',
    path: '/api/onboarding/decision-preferences',
    buildBody: (p) =>
      p.decision_preferences.length
        ? { preferences: p.decision_preferences, source: 'onboarding' }
        : null,
  },
  {
    key: 'commitment_levels',
    path: '/api/onboarding/commitment-levels',
    buildBody: (p) => {
      const useful = p.commitment_levels.filter(
        (c) =>
          (c.hours_per_week ?? null) !== null ||
          (c.energy_level ?? null) !== null ||
          (c.duration_weeks ?? null) !== null
      );
      return useful.length ? { commitments: useful, source: 'onboarding' } : null;
    },
  },
  {
    key: 'domain_risk_tolerance',
    path: '/api/onboarding/domain-risk',
    buildBody: (p) =>
      p.domain_risk_tolerance.length
        ? { tolerances: p.domain_risk_tolerance, source: 'onboarding' }
        : null,
  },
  {
    key: 'motivations',
    path: '/api/onboarding/motivations',
    buildBody: (p) => {
      const useful = p.motivations.filter((m) => m.motivation_text?.trim());
      return useful.length
        ? {
            motivations: useful.map((m) => ({
              ...m,
              motivation_text: m.motivation_text.trim(),
            })),
            source: 'onboarding',
          }
        : null;
    },
  },
];

export async function saveUserGraph(payload: UserGraphPayload): Promise<SaveUserGraphResult> {
  const sections: SaveUserGraphResult['sections'] = {};

  for (const section of SECTIONS) {
    const body = section.buildBody(payload);
    if (!body) {
      sections[section.key] = { ok: true, status: 204 };
      continue;
    }

    try {
      const res = await fetch(section.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      sections[section.key] = {
        ok: res.ok,
        status: res.status,
        error: res.ok ? undefined : (await res.text()).slice(0, 500),
      };
    } catch (err) {
      sections[section.key] = {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : 'network error',
      };
    }
  }

  return {
    ok: Object.values(sections).every((s) => s.ok),
    sections,
  };
}
