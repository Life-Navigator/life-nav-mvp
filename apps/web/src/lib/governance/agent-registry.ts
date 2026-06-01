/**
 * Agent Registry — Sprint L Phase 10.
 *
 * No agent may directly deliver recommendations to the user. Every
 * agent emitter must appear in `governance.agent_registry`. The
 * SQL layer enforces this via `governance.agent_is_registered`
 * (SECURITY DEFINER). The TS layer mirrors the check for hot-path
 * UX.
 */

import type { AgentRegistration } from '@/types/governance';

/**
 * Built-in registry — mirror of the seeded rows in migration 088.
 * Authoritative source is the DB; this list lets the engine run in
 * test environments and as a sanity check during development.
 */
export const BUILTIN_AGENTS: AgentRegistration[] = [
  {
    agent_kind: 'advisor',
    agent_name: 'advisor.core',
    active: true,
    capabilities: ['recommendation', 'explanation'],
  },
  {
    agent_kind: 'arcana_health',
    agent_name: 'arcana.health',
    active: true,
    capabilities: ['recommendation', 'explanation'],
  },
  {
    agent_kind: 'arcana_longevity',
    agent_name: 'arcana.longevity',
    active: true,
    capabilities: ['recommendation', 'explanation'],
  },
  {
    agent_kind: 'arcana_compliance',
    agent_name: 'arcana.compliance',
    active: true,
    capabilities: ['clearance_check'],
  },
  {
    agent_kind: 'arcana_provider_coordination',
    agent_name: 'arcana.provider_coordination',
    active: true,
    capabilities: ['lead_package_handoff'],
  },
  {
    agent_kind: 'arcana_orchestrator',
    agent_name: 'arcana.orchestrator',
    active: true,
    capabilities: ['orchestration'],
  },
  {
    agent_kind: 'optimizer',
    agent_name: 'optimizer.dynamic_goal',
    active: true,
    capabilities: ['recommendation'],
  },
  {
    agent_kind: 'provider',
    agent_name: 'provider.portal',
    active: true,
    capabilities: ['recommendation'],
  },
];

const builtinIndex = new Map(BUILTIN_AGENTS.map((a) => [`${a.agent_kind}::${a.agent_name}`, a]));

export function isAgentRegisteredBuiltin(kind: string, name: string): boolean {
  return Boolean(builtinIndex.get(`${kind}::${name}`)?.active);
}

/**
 * Validator used by the middleware: given a known DB-fetched list of
 * agents plus an optional candidate, returns the registration
 * decision. The middleware uses this when the DB lookup is
 * cache-warm.
 */
export function isAgentRegistered(
  registry: AgentRegistration[],
  kind: string,
  name: string
): boolean {
  if (registry.length === 0) return isAgentRegisteredBuiltin(kind, name);
  return registry.some((a) => a.agent_kind === kind && a.agent_name === name && a.active);
}

export const __test = { BUILTIN_AGENTS, isAgentRegisteredBuiltin, isAgentRegistered };
