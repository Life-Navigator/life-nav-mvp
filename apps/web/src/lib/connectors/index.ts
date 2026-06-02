/**
 * Connector registry — Sprint S Phase 3.
 *
 * The 1 Sprint P (ADP) + 7 Sprint S connectors. Each connector
 * exposes a `slug`, `kind`, and `vendor`; the orchestrator selects
 * by slug. When a connector is missing credentials, it returns
 * `{ ok: false, error_kind: 'not_configured' }` — never a silent
 * fake.
 */

export { BaseConnector } from './base';
export type {
  ConnectorCredentials,
  ConnectorSyncResult,
  NormalizedAccount,
  NormalizedPosition,
  NormalizedTransaction,
  NormalizedPaystub,
} from './base';

export { AdpConnector } from './adp';
export { PaychexConnector } from './paychex';
export { GustoConnector } from './gusto';
export { FidelityConnector } from './fidelity';
export { SchwabConnector } from './schwab';
export { VanguardConnector } from './vanguard';
export { EmpowerConnector } from './empower';
export { MorganStanleyConnector } from './morgan_stanley';

import { AdpConnector } from './adp';
import { PaychexConnector } from './paychex';
import { GustoConnector } from './gusto';
import { FidelityConnector } from './fidelity';
import { SchwabConnector } from './schwab';
import { VanguardConnector } from './vanguard';
import { EmpowerConnector } from './empower';
import { MorganStanleyConnector } from './morgan_stanley';
import type { BaseConnector } from './base';

export const CONNECTOR_REGISTRY: Record<string, () => BaseConnector> = {
  'adp.workforce_now': () => new AdpConnector(),
  'paychex.flex': () => new PaychexConnector(),
  'gusto.payroll': () => new GustoConnector(),
  'fidelity.wealthscape': () => new FidelityConnector(),
  'schwab.trader': () => new SchwabConnector(),
  'vanguard.aggregator': () => new VanguardConnector(),
  'empower.retirement': () => new EmpowerConnector(),
  'morgan_stanley.wealth': () => new MorganStanleyConnector(),
};

export function getConnector(slug: string): BaseConnector | null {
  const factory = CONNECTOR_REGISTRY[slug];
  return factory ? factory() : null;
}
