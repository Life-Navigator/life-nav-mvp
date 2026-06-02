/**
 * 4-Tier Constitutional Layer Resolver — Sprint S Phase 4.
 *
 * Composes rules across global / industry / organization / user
 * with the hard invariant:
 *
 *   A rule from a LOWER layer can override a HIGHER-layer rule
 *   only when the higher-layer rule's `is_overridable === true`.
 *
 * Safety / lawfulness rules are seeded with `is_overridable = false`
 * in migration 104, so an organization cannot silently turn them
 * off. The resolver enforces the invariant deterministically.
 *
 * Resolution algorithm (per `entity_kind + slug`):
 *
 *   1. Collect all rules across the 4 layers that match the entity_kind +
 *      slug + active review_status.
 *   2. Sort by layer rank (global=0, industry=1, organization=2, user=3)
 *      — higher rank = more specific.
 *   3. The most-specific applicable rule wins, EXCEPT a higher layer
 *      with `is_overridable=false` blocks every more-specific layer
 *      for the same slug.
 */

import type { ConstitutionalLayer, Industry, LayerRule } from './types';

const LAYER_RANK: Record<ConstitutionalLayer, number> = {
  global: 0,
  industry: 1,
  organization: 2,
  user: 3,
};

export interface ResolveInputs {
  /** All candidate rules — caller pre-fetches via SQL. */
  rules: LayerRule[];
  industry: Industry;
  tenant_id?: string | null;
  user_id?: string | null;
}

export interface ResolvedRule {
  rule: LayerRule;
  origin_layer: ConstitutionalLayer;
  shadowed_count: number;
}

export interface ResolveResult {
  /** One rule per (entity_kind, slug) after resolution. */
  rules: ResolvedRule[];
  /** Attempts by a lower layer to override a non-overridable higher-layer rule. */
  blocked_overrides: Array<{
    entity_kind: string;
    slug: string;
    higher_layer: ConstitutionalLayer;
    attempted_layer: ConstitutionalLayer;
  }>;
}

/**
 * Filter rules to those that apply to (industry, tenant, user) BEFORE
 * resolving. A pure helper.
 */
export function filterApplicable(
  rules: LayerRule[],
  industry: Industry,
  tenant_id?: string | null,
  user_id?: string | null
): LayerRule[] {
  return rules.filter((r) => {
    if (r.review_status !== 'active') return false;
    switch (r.layer) {
      case 'global':
        return r.industry == null && r.tenant_id == null && r.user_id == null;
      case 'industry':
        return r.industry === industry;
      case 'organization':
        return tenant_id != null && r.tenant_id === tenant_id && r.user_id == null;
      case 'user':
        return (
          tenant_id != null && r.tenant_id === tenant_id && user_id != null && r.user_id === user_id
        );
    }
  });
}

/**
 * Resolve the layered rule set. Output is deterministic given the
 * input order; ties broken by `layer` rank then by `version` (string sort).
 */
export function resolveLayers(inputs: ResolveInputs): ResolveResult {
  const candidates = filterApplicable(
    inputs.rules,
    inputs.industry,
    inputs.tenant_id,
    inputs.user_id
  );

  // Group by (entity_kind, slug).
  const byKey = new Map<string, LayerRule[]>();
  for (const r of candidates) {
    const k = `${r.entity_kind}|${r.slug}`;
    const list = byKey.get(k) ?? [];
    list.push(r);
    byKey.set(k, list);
  }

  const resolved: ResolvedRule[] = [];
  const blocked: ResolveResult['blocked_overrides'] = [];

  for (const [key, list] of byKey) {
    // Sort by layer rank ascending so we can scan from global → user.
    list.sort((a, b) => LAYER_RANK[a.layer] - LAYER_RANK[b.layer]);

    let chosen: LayerRule = list[0];
    let shadowed = 0;
    let blocking: { layer: ConstitutionalLayer } | null = null;

    for (const r of list) {
      // If we have a previously chosen non-overridable higher-layer rule,
      // subsequent lower-layer override attempts are blocked.
      if (blocking && LAYER_RANK[r.layer] > LAYER_RANK[blocking.layer]) {
        const [entity_kind, slug] = key.split('|');
        blocked.push({
          entity_kind,
          slug,
          higher_layer: blocking.layer,
          attempted_layer: r.layer,
        });
        shadowed += 1;
        continue;
      }
      // Otherwise the more-specific layer wins.
      if (LAYER_RANK[r.layer] >= LAYER_RANK[chosen.layer]) {
        if (chosen !== r) shadowed += 1;
        chosen = r;
      }
      if (!r.is_overridable) blocking = { layer: r.layer };
    }

    resolved.push({
      rule: chosen,
      origin_layer: chosen.layer,
      shadowed_count: shadowed,
    });
  }

  return { rules: resolved, blocked_overrides: blocked };
}

/**
 * Convenience: compute the rule_set_version for cache invalidation.
 * Stable across orderings of the input.
 */
export function ruleSetVersion(rules: ResolvedRule[]): string {
  const ids = rules
    .map((r) => `${r.rule.entity_kind}.${r.rule.slug}@${r.rule.layer}/${r.rule.version}`)
    .sort();
  return djb2(ids.join('|'));
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const __test = { LAYER_RANK, djb2 };
