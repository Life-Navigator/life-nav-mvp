/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import {
  PLAID_PERSONAS,
  listPublicPersonas,
  toPublicPersona,
  getPersona,
  isValidPersonaId,
} from '../personas';

const EXPECTED_IDS = [
  'young_professional',
  'small_business_owner',
  'married_family',
  'high_income_executive',
  'credit_rebuilding',
  'gig_worker',
  'salary_plus_bonus',
  'earned_wage_access',
  'bank_income',
  'dynamic_transactions',
];

describe('Plaid persona registry', () => {
  it('contains all 10 personas with unique ids', () => {
    expect(PLAID_PERSONAS).toHaveLength(10);
    const ids = PLAID_PERSONAS.map((p) => p.persona_id);
    expect(new Set(ids).size).toBe(10);
    expect(ids.sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('every persona carries server-side sandbox credentials', () => {
    for (const p of PLAID_PERSONAS) {
      expect(p.plaid_sandbox_user).toBeTruthy();
      expect(p.plaid_sandbox_password).toBeTruthy();
      expect(p.plaid_products.length).toBeGreaterThan(0);
      expect(p.institution_id).toBeTruthy();
    }
  });

  it('getPersona / isValidPersonaId accept known ids and reject unknown', () => {
    expect(getPersona('young_professional')?.display_name).toBe('Young Professional');
    expect(getPersona('not_real')).toBeNull();
    expect(isValidPersonaId('bank_income')).toBe(true);
    expect(isValidPersonaId('nope')).toBe(false);
    expect(isValidPersonaId(123)).toBe(false);
    expect(isValidPersonaId(undefined)).toBe(false);
  });
});

describe('public persona payload (what the browser receives)', () => {
  it('toPublicPersona strips all credential / Plaid-wiring fields', () => {
    const pub = toPublicPersona(PLAID_PERSONAS[0]) as Record<string, unknown>;
    expect(pub.plaid_sandbox_user).toBeUndefined();
    expect(pub.plaid_sandbox_password).toBeUndefined();
    expect(pub.plaid_products).toBeUndefined();
    expect(pub.institution_id).toBeUndefined();
    expect(pub.plaid_profile_label).toBeUndefined();
    // keeps the safe display fields
    expect(pub.persona_id).toBeTruthy();
    expect(pub.display_name).toBeTruthy();
    expect(pub.goals).toBeDefined();
    expect(pub.complexity).toBeTruthy();
  });

  it('the serialized public list contains NO sandbox secrets', () => {
    const json = JSON.stringify(listPublicPersonas());
    for (const secret of [
      'pass_good',
      'user_good',
      'user_bank_income',
      'user_transactions_dynamic',
      'ins_109508',
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe('frontend never contains sandbox passwords', () => {
  it('the persona registry is marked server-only', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/integrations/plaid/personas.ts'),
      'utf8'
    );
    expect(src).toContain("import 'server-only'");
  });

  it('the client onboarding component has no sandbox credentials', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/components/onboarding/SampleFinancialProfile.tsx'),
      'utf8'
    );
    expect(src).not.toContain('pass_good');
    expect(src).not.toContain('plaid_sandbox_password');
    expect(src).not.toContain('plaid_sandbox_user');
  });
});
