/**
 * @jest-environment node
 *
 * State-machine tests for the discovery engine.
 */

import {
  CONFIDENCE_STOP_THRESHOLD,
  MAX_DRILL_TURNS,
  nextPrompt,
  recordAnswer,
  startSession,
  summarize,
} from '../engine';

describe('startSession', () => {
  it('records the stated goal as the first turn and assigns a session id', () => {
    const s = startSession({
      stated_goal: 'I want to lose 20 pounds',
      agent_persona: 'physician_intake',
    });
    expect(s.session_id).toBeTruthy();
    expect(s.stated_goal).toBe('I want to lose 20 pounds');
    expect(s.turns).toHaveLength(1);
    expect(s.turns[0].prompt_kind).toBe('what_accomplish');
    expect(s.turns[0].user_answer).toBe('I want to lose 20 pounds');
    expect(s.done).toBe(false);
  });
});

describe('nextPrompt → recordAnswer drilling', () => {
  it('drills through what → why → success → consequence → urgency, then stops', () => {
    let s = startSession({
      stated_goal: 'I want to be financially independent',
      agent_persona: 'financial_advisor',
    });

    const seenKinds: string[] = [s.turns[0].prompt_kind];
    const answers: Record<string, string> = {
      what_unlock: 'It would let me leave my job and focus on my family',
      why_important: 'I want to provide for my kids and protect my family',
      success_definition: 'A portfolio that throws off enough to cover our expenses',
      consequence_of_inaction: 'I keep grinding and miss the kids growing up',
      urgency: 'Within 10 years',
    };

    let guard = 0;
    while (!s.done && guard++ < 10) {
      const probe = nextPrompt(s);
      if (probe.done) break;
      const prompt = probe.prompt!;
      seenKinds.push(prompt.kind);
      const ans = answers[prompt.kind] ?? 'no answer';
      s = recordAnswer(s, {
        prompt_kind: prompt.kind,
        prompt_text: prompt.text,
        answer: ans,
      });
    }

    expect(s.done).toBe(true);
    expect(seenKinds).toContain('what_unlock');
    expect(seenKinds).toContain('why_important');
    expect(seenKinds).toContain('success_definition');
    expect(s.success_definition).toBeDefined();
    expect(s.consequence_of_inaction).toBeDefined();
    // urgency is the last optional prompt — engine may stop sooner if
    // confidence + success + consequence are already set.
  });

  it('never asks the same prompt kind twice in one session', () => {
    let s = startSession({
      stated_goal: 'I want a Staff Engineer promotion',
      agent_persona: 'career_coach',
    });
    const seenKinds: string[] = [s.turns[0].prompt_kind];
    let guard = 0;
    while (!s.done && guard++ < 10) {
      const probe = nextPrompt(s);
      if (probe.done) break;
      seenKinds.push(probe.prompt!.kind);
      s = recordAnswer(s, {
        prompt_kind: probe.prompt!.kind,
        prompt_text: probe.prompt!.text,
        answer: 'Something meaningful here that includes growth.',
      });
    }
    const dedup = new Set(seenKinds);
    expect(dedup.size).toBe(seenKinds.length);
  });

  it('respects the MAX_DRILL_TURNS hard cap', () => {
    let s = startSession({
      stated_goal: 'I want to be better',
      agent_persona: 'general',
    });
    for (let i = 0; i < MAX_DRILL_TURNS + 5; i++) {
      const probe = nextPrompt(s);
      if (probe.done) break;
      s = recordAnswer(s, {
        prompt_kind: probe.prompt!.kind,
        prompt_text: probe.prompt!.text,
        answer: 'placeholder',
      });
    }
    expect(s.turns.length).toBeLessThanOrEqual(MAX_DRILL_TURNS);
  });
});

describe('summarize', () => {
  it('returns dominant_driver + scores from a financial-security flow', () => {
    let s = startSession({
      stated_goal: 'I want to be financially independent',
      agent_persona: 'financial_advisor',
    });
    s = recordAnswer(s, {
      prompt_kind: 'what_unlock',
      prompt_text: '?',
      answer: 'It lets me protect my family and stop worrying about money.',
    });
    s = recordAnswer(s, {
      prompt_kind: 'why_important',
      prompt_text: '?',
      answer: 'My kids matter most. I want them safe.',
    });
    s = recordAnswer(s, {
      prompt_kind: 'success_definition',
      prompt_text: '?',
      answer: 'Portfolio covers our expenses indefinitely.',
    });
    s = recordAnswer(s, {
      prompt_kind: 'consequence_of_inaction',
      prompt_text: '?',
      answer: 'I miss the kids growing up.',
    });
    s = recordAnswer(s, {
      prompt_kind: 'urgency',
      prompt_text: '?',
      answer: 'within 10 years',
    });

    const sum = summarize(s);
    expect(sum.dominant_driver).toBe('financial_security');
    expect(sum.driver_scores.financial_security).toBeGreaterThan(0);
    expect(sum.confidence).toBeGreaterThanOrEqual(0);
    expect(sum.urgency).toBe('medium'); // "within 10 years" → "year" match → medium
  });
});

describe('confidence threshold', () => {
  it('only stops drilling once threshold + required fields are met', () => {
    let s = startSession({
      stated_goal: 'I want to launch a startup and beat my PR and provide for my family',
      agent_persona: 'general',
    });
    // Even with strong first-turn signal, engine should still ask
    // success_definition + consequence_of_inaction before stopping.
    let asked = 0;
    while (!s.done) {
      const probe = nextPrompt(s);
      if (probe.done) break;
      asked += 1;
      s = recordAnswer(s, {
        prompt_kind: probe.prompt!.kind,
        prompt_text: probe.prompt!.text,
        answer: 'short answer',
      });
      if (asked > 10) break;
    }
    expect(s.success_definition).toBeDefined();
    expect(s.consequence_of_inaction).toBeDefined();
  });
});

it('exports a sane CONFIDENCE_STOP_THRESHOLD', () => {
  expect(CONFIDENCE_STOP_THRESHOLD).toBeGreaterThan(0);
  expect(CONFIDENCE_STOP_THRESHOLD).toBeLessThanOrEqual(1);
});
