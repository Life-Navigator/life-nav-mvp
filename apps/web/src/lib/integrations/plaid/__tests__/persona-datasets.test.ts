/** @jest-environment node */
import {
  PLAID_PERSONAS,
  getPlaidActivation,
  personaMetadata,
  listPublicPersonas,
} from '../personas';
import { PLAID_CUSTOM_CONFIGS } from '../plaid-custom-configs';

describe('persona datasets are distinct', () => {
  it('every persona has full LifeNavigator metadata', () => {
    for (const p of PLAID_PERSONAS) {
      for (const field of [
        'profession',
        'income_type',
        'spending_pattern',
        'asset_profile',
        'liability_profile',
        'investment_profile',
        'risk_profile',
      ] as const) {
        expect(typeof p[field]).toBe('string');
        expect(p[field].length).toBeGreaterThan(0);
      }
      expect(p.primary_goals.length).toBeGreaterThan(0);
      expect(p.expected_insights.length).toBeGreaterThan(0);
    }
  });

  it('custom configs produce materially different account sets', () => {
    const fingerprints = new Set<string>();
    for (const [id, cfg] of Object.entries(PLAID_CUSTOM_CONFIGS)) {
      const accts = cfg.override_accounts;
      expect(accts.length).toBeGreaterThan(0);
      // fingerprint = sorted (subtype:balance) + total txns
      const fp =
        accts
          .map((a) => `${a.subtype}:${a.starting_balance}`)
          .sort()
          .join(',') + `#${accts.reduce((n, a) => n + a.transactions.length, 0)}`;
      fingerprints.add(fp);
      void id;
    }
    // each custom persona's dataset fingerprint is unique
    expect(fingerprints.size).toBe(Object.keys(PLAID_CUSTOM_CONFIGS).length);
  });

  it('persona metadata differs across personas (risk/income/asset profiles)', () => {
    const metas = PLAID_PERSONAS.map(personaMetadata);
    const riskByProfession = new Set(
      metas.map((m) => `${m.profession}|${m.income_type}|${m.asset_profile}`)
    );
    expect(riskByProfession.size).toBe(PLAID_PERSONAS.length);
  });

  it('getPlaidActivation returns a custom config for user_custom personas, null otherwise', () => {
    for (const p of PLAID_PERSONAS) {
      const a = getPlaidActivation(p);
      if (p.plaid_config_source === 'user_custom') {
        expect(a.username).toBe('user_custom');
        expect(a.customConfig).not.toBeNull();
        expect(a.customConfig!.override_accounts.length).toBeGreaterThan(0);
      } else {
        expect(a.customConfig).toBeNull();
        expect(a.username).not.toBe('user_custom');
      }
    }
  });
});

describe('credential safety (still holds with metadata)', () => {
  it('public payload exposes profession/risk but never credentials or configs', () => {
    const json = JSON.stringify(listPublicPersonas());
    for (const secret of [
      'pass_good',
      'user_custom',
      'override_accounts',
      'override_password',
      'starting_balance',
    ]) {
      expect(json).not.toContain(secret);
    }
    const first = listPublicPersonas()[0] as Record<string, unknown>;
    expect(first.profession).toBeTruthy();
    expect(first.risk_profile).toBeTruthy();
    expect(first.plaid_sandbox_user).toBeUndefined();
  });
});
