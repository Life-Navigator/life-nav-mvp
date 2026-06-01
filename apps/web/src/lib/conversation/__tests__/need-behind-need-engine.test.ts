/**
 * @jest-environment node
 *
 * NeedBehindNeedEngine tests — determinism + termination contract.
 */

import { __test } from '../need-behind-need-engine';
import type { DiscoveryDomain, PromptKind } from '@/types/conversation-intel';

const { detectStop, buildDrillDown, summarizeDrillDown } = __test;

function T(prompt_kind: PromptKind, answer: string) {
  return { prompt_kind, answer };
}

describe('detectStop heuristics', () => {
  test('< 3 words → low_signal', () => {
    expect(detectStop('Ok')).toBe('low_signal');
    expect(detectStop('I do')).toBe('low_signal');
  });

  test('"because" / "I value" → values_reached', () => {
    expect(detectStop('I want this because I never had stability growing up')).toBe(
      'values_reached'
    );
    expect(detectStop('I value security above almost everything else')).toBe('values_reached');
  });

  test('"can\'t afford to" / "if I don\'t" → consequence_reached', () => {
    expect(detectStop("I can't afford to fail at this")).toBe('consequence_reached');
    expect(detectStop("if I don't do this my kids miss out")).toBe('consequence_reached');
  });

  test('plain content → undefined (keep drilling)', () => {
    expect(detectStop('I want to pay off all my consumer debt this year')).toBeUndefined();
  });
});

describe('buildDrillDown — flow + termination', () => {
  test('depth 0 only → next prompt is depth-1 what_unlock', () => {
    const d = buildDrillDown({
      domain: 'financial' as DiscoveryDomain,
      history: [T('what_accomplish', 'I want to pay off all my debt and own a home')],
    });
    expect(d.nodes).toHaveLength(1);
    expect(d.next_prompt?.prompt_kind).toBe('what_unlock');
    expect(d.inferred_root_goal).toBeUndefined();
  });

  test('terminates at values_reached', () => {
    const d = buildDrillDown({
      domain: 'financial',
      history: [
        T('what_accomplish', 'I want to own a home'),
        T('what_unlock', 'I want to feel rooted somewhere'),
        T('why_important', 'Because I never had a stable place growing up'),
      ],
    });
    const last = d.nodes[d.nodes.length - 1];
    expect(last.should_continue).toBe(false);
    expect(last.reason_to_stop).toBe('values_reached');
    expect(d.inferred_root_goal).toBeDefined();
    expect(d.inferred_root_confidence).toBeGreaterThan(0.7);
    expect(d.next_prompt).toBeUndefined();
  });

  test('terminates at max_depth even without values trigger', () => {
    const d = buildDrillDown({
      domain: 'career',
      history: [
        T('what_accomplish', 'I want to become a Director'),
        T('what_unlock', 'I want to lead a function'),
        T('why_important', 'I want to have a bigger sphere of influence'),
        T('why_important', 'It feels like the natural next step'),
      ],
      max_depth: 3,
    });
    const last = d.nodes[d.nodes.length - 1];
    expect(last.depth).toBe(3);
    expect(last.reason_to_stop).toBe('max_depth');
  });

  test('low_signal terminates early', () => {
    const d = buildDrillDown({
      domain: 'health',
      history: [
        T('what_accomplish', 'I want to be more fit and have better energy levels overall'),
        T('what_unlock', 'Idk'),
      ],
    });
    const last = d.nodes[d.nodes.length - 1];
    expect(last.reason_to_stop).toBe('low_signal');
  });

  test('determinism: same history → byte-identical drill-down', () => {
    const history = [
      T('what_accomplish', 'I want financial independence'),
      T('what_unlock', 'I want to stop trading my time for money'),
      T('why_important', 'Because I value autonomy more than anything'),
    ];
    const a = buildDrillDown({ domain: 'financial', history });
    const b = buildDrillDown({ domain: 'financial', history });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('next_prompt has rationale text and uses driver-tuned phrasing when dominant emerges', () => {
    const d = buildDrillDown({
      domain: 'financial',
      history: [
        T(
          'what_accomplish',
          'I want to be financially safe and protected so my family never worries'
        ),
      ],
    });
    expect(d.next_prompt?.rationale).toMatch(/depth\s+1|next\s+step/i);
    expect(d.next_prompt?.text).toMatch(/worry|stop|start/i); // financial_security variant
  });
});

describe('summarizeDrillDown', () => {
  test('returns dominant driver + root goal for a terminated chain', () => {
    const d = buildDrillDown({
      domain: 'estate',
      history: [
        T('what_accomplish', 'I want my will and POA done'),
        T('what_unlock', 'I want the people I love to be protected'),
        T('why_important', "I value taking care of them because that's what real men do"),
      ],
    });
    const s = summarizeDrillDown(d);
    expect(s.root_goal).toBeTruthy();
    expect(s.reason).toBe('values_reached');
  });
});
