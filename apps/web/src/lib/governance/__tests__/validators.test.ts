/**
 * @jest-environment node
 *
 * Governance validator unit tests — one block per validator.
 * Phase 11: target = 100% pass rate.
 *
 * Strategy:
 *   - Positive case: a stylized bad subject triggers the rule.
 *   - Negative case: a benign subject does not trigger the rule.
 */

import type { GovernanceSubject } from '@/types/governance';
import { __test as polTest } from '../validators/political-influence';
import { __test as manipTest } from '../validators/manipulation';
import { __test as shTest } from '../validators/self-harm';
import { __test as htoTest } from '../validators/harm-to-others';
import { __test as illegalTest } from '../validators/illegal-activity';
import { __test as fraudTest } from '../validators/fraud';
import { __test as exploitTest } from '../validators/exploitation';
import { __test as pbTest } from '../validators/partner-bias';
import { __test as unsafeTest } from '../validators/unsafe-health';
import { __test as umedTest } from '../validators/unverified-medical';
import { __test as coerTest } from '../validators/coercive-messaging';
import { __test as transTest } from '../validators/transparency';
import { __test as ointTest } from '../validators/outcome-integrity';
import { __test as advTest } from '../validators/user-advocacy';

function subj(text: string, extra: Partial<GovernanceSubject> = {}): GovernanceSubject {
  return {
    kind: 'recommendation',
    text,
    citations: extra.citations ?? [{ label: 'Some Source' }],
    assumptions: extra.assumptions ?? ['stated assumption'],
    confidence: extra.confidence ?? 0.6,
    tradeoffs: extra.tradeoffs ?? [{ summary: 't' }],
    risks: extra.risks ?? ['known risk'],
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Political Influence
// ---------------------------------------------------------------------------

describe('Political Neutrality', () => {
  test('blocks "vote for" advocacy', () => {
    const v = polTest.validatePoliticalInfluence(subj('You should vote for the green party.'));
    expect(v.length).toBeGreaterThan(0);
    expect(
      v.some((x) => x.rule_id === 'pol.advocacy_verb' || x.rule_id === 'pol.ideology_persuasion')
    ).toBe(true);
  });
  test('flags "support the candidate"', () => {
    const v = polTest.validatePoliticalInfluence(subj('Donate to the campaign tomorrow.'));
    expect(v.some((x) => x.rule_id === 'pol.advocacy_verb')).toBe(true);
  });
  test('flags ideology persuasion', () => {
    const v = polTest.validatePoliticalInfluence(subj('You must vote against the proposal.'));
    expect(v.some((x) => x.rule_id === 'pol.ideology_persuasion')).toBe(true);
  });
  test('influence campaign is critical', () => {
    const v = polTest.validatePoliticalInfluence(
      subj('Mobilize voters to turn out for the primary.')
    );
    expect(v.some((x) => x.severity === 'critical')).toBe(true);
  });
  test('neutral comparison does not trigger', () => {
    const v = polTest.validatePoliticalInfluence(
      subj('Compare the two candidates on healthcare policy.')
    );
    expect(v).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Manipulation
// ---------------------------------------------------------------------------

describe('Manipulation', () => {
  test('flags pressure tactics', () => {
    expect(
      manipTest.validateManipulation(subj('Only 3 seats left! Act now.')).length
    ).toBeGreaterThan(0);
  });
  test('flags shame', () => {
    expect(
      manipTest.validateManipulation(subj('You should be ashamed of your spending.')).length
    ).toBeGreaterThan(0);
  });
  test('flags guilt', () => {
    expect(
      manipTest.validateManipulation(subj("You're letting your family down by not signing up."))
        .length
    ).toBeGreaterThan(0);
  });
  test('neutral suggestion does not trigger', () => {
    expect(manipTest.validateManipulation(subj('You might consider a Roth conversion.'))).toEqual(
      []
    );
  });
});

// ---------------------------------------------------------------------------
// Self-Harm
// ---------------------------------------------------------------------------

describe('No-Harm — self-harm', () => {
  test('encouraging self-harm is critical', () => {
    const v = shTest.validateSelfHarm(subj('You should hurt yourself if you fail.'));
    expect(v.some((x) => x.severity === 'critical' && x.rule_id === 'sh.encourage')).toBe(true);
  });
  test('disordered-eating encouragement is critical', () => {
    const v = shTest.validateSelfHarm(subj('Just starve yourself for two weeks to hit the goal.'));
    expect(v.some((x) => x.severity === 'critical')).toBe(true);
  });
  test('substance misuse is critical', () => {
    const v = shTest.validateSelfHarm(subj('Take more than the prescribed dose to feel better.'));
    expect(v.some((x) => x.severity === 'critical')).toBe(true);
  });
  test('discussing past self-harm in a benign frame does not trigger', () => {
    expect(
      shTest.validateSelfHarm(subj('Healthy coping strategies for difficult emotions are below.'))
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Harm to Others
// ---------------------------------------------------------------------------

describe('No-Harm — harm to others', () => {
  test('violence is critical', () => {
    expect(
      htoTest
        .validateHarmToOthers(subj('You should hit him repeatedly.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
  test('stalking is critical', () => {
    expect(
      htoTest
        .validateHarmToOthers(subj('Spy on your ex without consent.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
  test('harassment is flagged', () => {
    expect(
      htoTest.validateHarmToOthers(subj('Send repeated messages to your former boss.')).length
    ).toBeGreaterThan(0);
  });
  test('coercion / blackmail is critical', () => {
    expect(
      htoTest
        .validateHarmToOthers(subj('Threaten to expose his secrets unless he pays.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Illegal Activity
// ---------------------------------------------------------------------------

describe('Legal Compliance — illegal activity', () => {
  test('criminal verbs flagged', () => {
    expect(
      illegalTest.validateIllegalActivity(subj('Smuggle the package across the border.')).length
    ).toBeGreaterThan(0);
  });
  test('regulatory avoidance flagged', () => {
    expect(
      illegalTest.validateIllegalActivity(
        subj('Structure deposits to avoid the reporting threshold.')
      ).length
    ).toBeGreaterThan(0);
  });
  test('insider trading flagged', () => {
    expect(
      illegalTest.validateIllegalActivity(
        subj('Use insider trading info before the earnings call.')
      ).length
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fraud
// ---------------------------------------------------------------------------

describe('Legal Compliance — fraud', () => {
  test('tax evasion is critical and surfaces lawful alternatives', () => {
    const v = fraudTest.validateFraud(subj('Hide income from the IRS using unreported cash.'));
    const e = v.find((x) => x.rule_id === 'fraud.tax_evasion');
    expect(e?.severity).toBe('critical');
    expect((e?.safer_alternatives ?? []).length).toBeGreaterThan(0);
  });
  test('application fraud is critical', () => {
    expect(
      fraudTest
        .validateFraud(subj('Use fake pay stubs on the mortgage application.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
  test('concealment from spouse flagged', () => {
    expect(
      fraudTest.validateFraud(subj('Hide accounts from my spouse during the divorce.')).length
    ).toBeGreaterThan(0);
  });
  test('legal tax planning does not trigger', () => {
    expect(
      fraudTest.validateFraud(subj('Use tax-loss harvesting to offset capital gains.'))
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Exploitation
// ---------------------------------------------------------------------------

describe('No-Harm — exploitation', () => {
  test('predatory targeting flagged', () => {
    expect(
      exploitTest.validateExploitation(subj('Target elderly homeowners with this offer.')).length
    ).toBeGreaterThan(0);
  });
  test('scam patterns flagged', () => {
    expect(
      exploitTest.validateExploitation(subj('Run a pig butchering script on the matches.')).length
    ).toBeGreaterThan(0);
  });
  test('hidden terms flagged', () => {
    expect(
      exploitTest.validateExploitation(subj('Bury the fee in the fine print so they sign.')).length
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Partner Bias
// ---------------------------------------------------------------------------

describe('Partner Bias', () => {
  test('partner_economics + ranking_boost is critical', () => {
    const v = pbTest.validatePartnerBias({
      kind: 'partner_recommendation',
      text: 'use this insurer',
      metadata: { commission: 200, ranking_boost: 3 },
    });
    expect(v.some((x) => x.severity === 'critical')).toBe(true);
  });
  test('only partner_economics is high', () => {
    const v = pbTest.validatePartnerBias({
      kind: 'partner_recommendation',
      text: 'use this insurer',
      metadata: { commission: 200 },
    });
    expect(v.some((x) => x.severity === 'high')).toBe(true);
  });
  test('ranking_override alone is medium', () => {
    const v = pbTest.validatePartnerBias({
      kind: 'partner_recommendation',
      text: 'use this insurer',
      metadata: { ranking_boost: 1 },
    });
    expect(v.some((x) => x.severity === 'medium')).toBe(true);
  });
  test('no partner metadata → no violation', () => {
    expect(pbTest.validatePartnerBias({ kind: 'recommendation', text: 'plan A' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Unsafe Health
// ---------------------------------------------------------------------------

describe('Safety — unsafe health', () => {
  test('stop-medication is critical', () => {
    expect(
      unsafeTest
        .validateUnsafeHealth(subj('Stop taking your antidepressant immediately.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
  test('alter-dose is critical', () => {
    expect(
      unsafeTest
        .validateUnsafeHealth(subj('Double the dose if you feel fine.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
  test('delay-care is critical', () => {
    expect(
      unsafeTest
        .validateUnsafeHealth(subj('Skip your surgery and try this instead.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unverified Medical
// ---------------------------------------------------------------------------

describe('Safety — unverified medical', () => {
  test('uncited medical claim flagged', () => {
    const v = umedTest.validateUnverifiedMedical(
      subj('This protocol cures diabetes.', { citations: [] })
    );
    expect(v.some((x) => x.rule_id === 'umed.uncited_claim')).toBe(true);
  });
  test('cited claim does not flag uncited rule', () => {
    const v = umedTest.validateUnverifiedMedical(
      subj('This protocol cures diabetes.', {
        citations: [{ label: 'NEJM 2024' }],
      })
    );
    expect(v.find((x) => x.rule_id === 'umed.uncited_claim')).toBeUndefined();
  });
  test('absolute efficacy flagged', () => {
    expect(
      umedTest.validateUnverifiedMedical(subj('100% guaranteed to cure your symptoms.')).length
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Coercive Messaging
// ---------------------------------------------------------------------------

describe('Coercive Messaging', () => {
  test('imperative pressure flagged', () => {
    expect(
      coerTest.validateCoerciveMessaging(subj('You must sign this today.')).length
    ).toBeGreaterThan(0);
  });
  test('consequence threat flagged', () => {
    expect(
      coerTest.validateCoerciveMessaging(
        subj("If you don't switch carriers, you'll lose coverage forever.")
      ).length
    ).toBeGreaterThan(0);
  });
  test('"you might consider" does not flag', () => {
    expect(
      coerTest.validateCoerciveMessaging(subj('You might consider a Roth conversion.'))
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Transparency
// ---------------------------------------------------------------------------

describe('Transparency', () => {
  test('full envelope passes', () => {
    const v = transTest.validateTransparency(subj('Add 2 weekly Z2 sessions'));
    expect(v).toEqual([]);
  });
  test('missing citations flagged at medium', () => {
    const v = transTest.validateTransparency(subj('Add 2 weekly Z2 sessions', { citations: [] }));
    expect(v.find((x) => x.rule_id === 'trans.no_citations')?.severity).toBe('medium');
  });
  test('non-substantive subject not checked', () => {
    const v = transTest.validateTransparency({ kind: 'advisor_message', text: 'hi' });
    expect(v).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Outcome Integrity
// ---------------------------------------------------------------------------

describe('Outcome Integrity', () => {
  test('engagement bait flagged', () => {
    expect(
      ointTest.validateOutcomeIntegrity(subj('Check back hourly to keep your streak.')).length
    ).toBeGreaterThan(0);
  });
  test('retention bait flagged', () => {
    expect(
      ointTest.validateOutcomeIntegrity(subj('Upgrade today to keep your trend graphs.')).length
    ).toBeGreaterThan(0);
  });
  test('click bait flagged', () => {
    expect(
      ointTest.validateOutcomeIntegrity(subj('Doctors hate this one weird trick.')).length
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// User Advocacy
// ---------------------------------------------------------------------------

describe('User Advocacy', () => {
  test('explicit non-user beneficiary flagged', () => {
    expect(
      advTest.validateUserAdvocacy(subj('This benefits the employer because it lowers costs.'))
        .length
    ).toBeGreaterThan(0);
  });
  test('optimized for third party is critical', () => {
    expect(
      advTest
        .validateUserAdvocacy(subj('We engineered this plan for the insurer.'))
        .some((x) => x.severity === 'critical')
    ).toBe(true);
  });
  test('user-first framing does not trigger', () => {
    expect(
      advTest.validateUserAdvocacy(subj('This benefits you because it lowers your taxes.'))
    ).toEqual([]);
  });
});
