/**
 * @jest-environment node
 *
 * Policy Engine integration tests — covers the composed engine,
 * conflict-of-interest engine, governance XAI, agent guard, and
 * determinism contract.
 */

import { __test as engineTest } from '../policy-engine';
import { __test as coiTest } from '../conflict-of-interest-engine';
import { __test as xaiTest } from '../governance-xai';
import { __test as agentTest } from '../agent-registry';
import { __test as middlewareTest } from '../middleware';
import { __test as safetyTest } from '../safety-messaging';
import type { GovernanceSubject } from '@/types/governance';

const { evaluate, evaluateWithAgent, inputHash } = engineTest;

function clean(): GovernanceSubject {
  return {
    kind: 'recommendation',
    text: 'Consider increasing your 401(k) contribution to capture the employer match.',
    citations: [{ label: 'IRS Pub 590' }],
    assumptions: ['Employer match is currently below the cap.'],
    risks: ['Reduces take-home pay short term.'],
    confidence: 0.7,
    tradeoffs: [{ summary: 'liquidity vs long-term growth' }],
    user_id: 'u1',
  };
}

// ---------------------------------------------------------------------------
// Approval pathways
// ---------------------------------------------------------------------------

describe('Engine — approval pathways', () => {
  test('a clean recommendation is approved', () => {
    const d = evaluate(clean());
    expect(d.approved).toBe(true);
    expect(d.verdict).toBe('approved');
    expect(d.severity).toBe('none');
    expect(d.violations).toEqual([]);
  });

  test('low-only violations approve with warnings', () => {
    const s = clean();
    s.tradeoffs = []; // missing tradeoffs → low
    const d = evaluate(s);
    expect(d.approved).toBe(true);
    expect(d.verdict).toBe('approved_with_warnings');
    expect(d.severity).toBe('low');
  });

  test('medium violations approve with warnings', () => {
    const s = clean();
    s.citations = []; // missing citations → medium (transparency)
    const d = evaluate(s);
    expect(d.verdict).toBe('approved_with_warnings');
    expect(d.severity).toBe('medium');
  });

  test('high violations block', () => {
    const s = clean();
    // Consequence-threat coercion is a HIGH-severity rule.
    s.text = "If you don't switch carriers, you'll lose your coverage forever.";
    const d = evaluate(s);
    expect(d.approved).toBe(false);
    expect(d.verdict).toBe('blocked');
    expect(d.severity).toBe('high');
  });

  test('critical violations block', () => {
    const s = clean();
    s.text = 'Stop taking your insulin.';
    const d = evaluate(s);
    expect(d.approved).toBe(false);
    expect(d.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// Conflict-of-interest
// ---------------------------------------------------------------------------

describe('ConflictOfInterestEngine', () => {
  test('referral-fee flagged high', () => {
    const r = coiTest.detectConflictsOfInterest({
      kind: 'partner_recommendation',
      text: 'X',
      metadata: { referral_fee: 50 },
    });
    expect(r.violations.some((v) => v.rule_id === 'coi.referral_fee')).toBe(true);
    expect(r.highest_severity).toBe('high');
  });
  test('provider self-dealing flagged critical', () => {
    const r = coiTest.detectConflictsOfInterest({
      kind: 'provider_recommendation',
      text: 'X',
      metadata: { recommends_own_service: true },
    });
    expect(r.highest_severity).toBe('critical');
  });
  test('no metadata → no violations', () => {
    const r = coiTest.detectConflictsOfInterest({ kind: 'recommendation', text: 'X' });
    expect(r.violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Governance XAI
// ---------------------------------------------------------------------------

describe('Governance XAI', () => {
  test('blocked decision yields a categorized explanation', () => {
    const d = evaluate({ ...clean(), text: 'Stop taking your medication.' });
    const e = xaiTest.explainDecision(d);
    expect(e.blocked).toBe(true);
    expect(e.worst_category).toBe('unsafe_health');
    expect(e.short_summary).toMatch(/licensed healthcare professional|requires evaluation/i);
    expect(e.detailed_reasons.length).toBeGreaterThan(0);
  });
  test('approved decision says so', () => {
    const d = evaluate(clean());
    const e = xaiTest.explainDecision(d);
    expect(e.blocked).toBe(false);
    expect(e.verdict).toBe('approved');
  });
  test('does not leak internal regex patterns', () => {
    const d = evaluate({ ...clean(), text: 'You must vote against the proposal.' });
    const e = xaiTest.explainDecision(d);
    for (const r of e.detailed_reasons) {
      expect(r.reason).not.toMatch(/regex|pattern|test\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// Agent registry guard
// ---------------------------------------------------------------------------

describe('Agent registry', () => {
  test('built-in registry contains advisor.core', () => {
    expect(agentTest.isAgentRegisteredBuiltin('advisor', 'advisor.core')).toBe(true);
  });
  test('unknown agent → not registered', () => {
    expect(agentTest.isAgentRegisteredBuiltin('partner', 'sketchy.partner')).toBe(false);
  });

  test('engine emits agent_not_registered when emitter is unknown', () => {
    const d = evaluateWithAgent(clean(), {
      agent_kind: 'partner',
      agent_name: 'sketchy.partner',
      is_registered: false,
    });
    expect(d.approved).toBe(false);
    expect(d.violations.some((v) => v.category === 'agent_not_registered')).toBe(true);
  });

  test('engine passes when emitter is registered', () => {
    const d = evaluateWithAgent(clean(), {
      agent_kind: 'advisor',
      agent_name: 'advisor.core',
      is_registered: true,
    });
    expect(d.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('Determinism', () => {
  test('identical subject → byte-identical decision', () => {
    const s = clean();
    const a = evaluate(s, { now: '2026-06-01T00:00:00.000Z' });
    const b = evaluate(s, { now: '2026-06-01T00:00:00.000Z' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('identical subject → identical input_hash', () => {
    const s = clean();
    expect(inputHash(s, '1.0.0')).toBe(inputHash(s, '1.0.0'));
  });

  test('different subjects → different hashes', () => {
    const a = inputHash(clean(), '1.0.0');
    const b = inputHash({ ...clean(), text: 'Different text.' }, '1.0.0');
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Safety messaging
// ---------------------------------------------------------------------------

describe('Safety messaging', () => {
  test('every category has a message', () => {
    const all = Object.keys(safetyTest.BUILTIN);
    expect(all).toContain('self_harm');
    expect(all).toContain('illegal_activity');
    expect(all).toContain('partner_bias');
  });
  test('composeBlockMessage picks the worst category as the body', () => {
    const d = evaluate({ ...clean(), text: 'Stop taking your insulin.' });
    const msg = safetyTest.composeBlockMessage(d.violations);
    expect(msg.category).toBe('unsafe_health');
  });
});

// ---------------------------------------------------------------------------
// Middleware (no DB)
// ---------------------------------------------------------------------------

describe('Middleware — validate', () => {
  test('happy path: agent registered + clean subject', () => {
    middlewareTest.primeAgentRegistry([
      { agent_kind: 'advisor', agent_name: 'advisor.core', active: true, capabilities: [] },
    ]);
    const d = middlewareTest.validate({
      subject: clean(),
      emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
    });
    expect(d.approved).toBe(true);
  });

  test('unregistered emitter is blocked', () => {
    middlewareTest.primeAgentRegistry([
      { agent_kind: 'advisor', agent_name: 'advisor.core', active: true, capabilities: [] },
    ]);
    const d = middlewareTest.validate({
      subject: clean(),
      emitter: { agent_kind: 'partner', agent_name: 'sketchy.partner' },
    });
    expect(d.approved).toBe(false);
    expect(d.violations.some((v) => v.category === 'agent_not_registered')).toBe(true);
  });

  test('audit envelope mirrors decision', () => {
    middlewareTest.primeAgentRegistry([
      { agent_kind: 'advisor', agent_name: 'advisor.core', active: true, capabilities: [] },
    ]);
    const d = middlewareTest.validate({
      subject: clean(),
      emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
    });
    const env = middlewareTest.buildAuditEnvelope(
      { subject: clean(), emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' } },
      d
    );
    expect(env.approved).toBe(true);
    expect(env.violations).toEqual(d.violations);
    expect(env.emitter_agent_kind).toBe('advisor');
  });
});

// ---------------------------------------------------------------------------
// Phase 11 — Success-criteria oracle tests
// ---------------------------------------------------------------------------

describe('Phase 11 — success criteria', () => {
  test('Political Neutrality: no party recommendation surfaces', () => {
    const d = evaluate({
      ...clean(),
      text: 'You should vote for the green party because they support healthcare.',
    });
    expect(d.approved).toBe(false);
  });

  test('User Advocacy: a recommendation optimized for employer is blocked', () => {
    const d = evaluate({
      ...clean(),
      text: 'We engineered this plan for the employer to reduce their healthcare bill.',
    });
    expect(d.approved).toBe(false);
  });

  test('Legal Compliance: tax evasion blocked + lawful alternatives surfaced', () => {
    const d = evaluate({
      ...clean(),
      text: 'Hide income from the IRS by routing it through a relative.',
    });
    expect(d.approved).toBe(false);
    expect(d.safer_alternatives.length).toBeGreaterThan(0);
  });

  test('Safety: violence + exploitation + self-harm blocked', () => {
    for (const text of [
      'Hurt yourself if you fail',
      'You should hit her if she disobeys',
      'Target elderly seniors with this offer',
    ]) {
      const d = evaluate({ ...clean(), text });
      expect(d.approved).toBe(false);
    }
  });

  test('Partner Integrity: commission-influenced ranking blocked', () => {
    const d = evaluate({
      kind: 'partner_recommendation',
      text: 'Recommend Insurer X over Y.',
      citations: [{ label: 'CMS coverage list' }],
      assumptions: ['network adequacy verified'],
      risks: [],
      confidence: 0.6,
      tradeoffs: [{ summary: 'premium vs deductible' }],
      metadata: { commission: 500, ranking_boost: 2 },
    });
    expect(d.approved).toBe(false);
    expect(
      d.violations.some(
        (v) => v.category === 'partner_bias' || v.category === 'conflict_of_interest'
      )
    ).toBe(true);
  });

  test('Transparency: full envelope marked transparent; missing pieces noted', () => {
    const full = evaluate(clean());
    expect(full.policy_checks.find((c) => c.category === 'transparency')?.violations).toBe(0);
    const bare = evaluate({
      ...clean(),
      citations: [],
      assumptions: [],
      risks: [],
      tradeoffs: [],
      confidence: undefined,
    });
    expect(
      bare.policy_checks.find((c) => c.category === 'transparency')?.violations
    ).toBeGreaterThan(0);
  });
});
