// Fallback resolution. Turns an agent's (primary + fallbacks) logical chain into a concrete, usable list
// of provider/model pairs given the current feature flags + region — always ending in a Gemini model so
// the user experience never breaks (beta safety).

import type { ProviderModel } from './types';
import {
  type ModelKey,
  descriptor,
  isModelEnabled,
  isModelAvailableInRegion,
  aiConfig,
} from './modelRegistry';

const GEMINI_TAIL: ModelKey = 'gemini-default'; // always-on safety net

export interface ResolvedChain {
  /** First usable model. */
  primary: ProviderModel;
  /** Remaining usable models, in order. */
  fallbacks: ProviderModel[];
  /** True when the requested primary was NOT usable and we fell back. */
  fellBack: boolean;
  fallbackReason?: string;
}

function usable(key: ModelKey, region: string): { ok: boolean; why?: string } {
  if (!isModelEnabled(key)) return { ok: false, why: `${key} disabled by feature flag` };
  if (!isModelAvailableInRegion(key, region))
    return { ok: false, why: `${key} unavailable in ${region}` };
  return { ok: true };
}

function toProviderModel(key: ModelKey): ProviderModel {
  const d = descriptor(key);
  return { provider: d.provider, model: d.model };
}

/**
 * Build the usable chain. `desired` is the (possibly risk-upgraded) primary; `fallbacks` is the agent's
 * configured fallback list. Any disabled/region-unavailable model is skipped (with a logged reason); a
 * Gemini default is always appended so there is a guaranteed safe response.
 */
export function resolveChain(
  desired: ModelKey,
  fallbacks: ModelKey[],
  region: string = aiConfig.vertexLocation
): ResolvedChain {
  const ordered: ModelKey[] = [desired, ...fallbacks];
  if (!ordered.includes(GEMINI_TAIL)) ordered.push(GEMINI_TAIL);

  const usableKeys: ModelKey[] = [];
  let fellBack = false;
  let fallbackReason: string | undefined;

  for (const key of ordered) {
    const u = usable(key, region);
    if (u.ok) {
      usableKeys.push(key);
    } else if (usableKeys.length === 0) {
      // the desired primary (or earlier candidates) was skipped → record why we fell back
      fellBack = true;
      fallbackReason = fallbackReason || u.why;
    }
  }

  // Guarantee at least the Gemini tail even if everything odd happened.
  if (usableKeys.length === 0) usableKeys.push(GEMINI_TAIL);

  // Dedupe by concrete model id (env could collapse keys to the same id).
  const seen = new Set<string>();
  const concrete = usableKeys.map(toProviderModel).filter((pm) => {
    const id = `${pm.provider}:${pm.model}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return {
    primary: concrete[0],
    fallbacks: concrete.slice(1),
    fellBack,
    fallbackReason,
  };
}
