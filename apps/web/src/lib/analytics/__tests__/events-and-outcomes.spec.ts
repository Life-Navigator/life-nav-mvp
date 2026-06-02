/**
 * @jest-environment node
 *
 * Sprint O.0 Phases 5 + 6 — analytics + outcomes wiring tests.
 */

import { recordUserEvent } from '../events';
import {
  recordRecommendationGenerated,
  transitionOutcome,
  setOutcomeScore,
} from '@/lib/outcomes/decision-outcomes';

interface Op {
  table: string;
  op: 'insert' | 'update';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: any;
}

function captureSupabase(
  insertRetval: { data: unknown; error: unknown } = { data: { id: 'r1' }, error: null }
) {
  const ops: Op[] = [];
  const client = {
    from(table: string) {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insert(payload: any) {
          ops.push({ table, op: 'insert', payload });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve(insertRetval);
                },
              };
            },
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update(payload: any) {
          ops.push({ table, op: 'update', payload });
          return {
            eq() {
              return {
                eq() {
                  return {
                    select() {
                      return {
                        single() {
                          return Promise.resolve(insertRetval);
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { ops, client };
}

describe('recordUserEvent', () => {
  test('inserts into analytics_user_events with required fields', async () => {
    const { ops, client } = captureSupabase();
    await recordUserEvent(client, {
      user_id: 'u1',
      event_type: 'recommendation_viewed',
      event_metadata: { rec_id: 'r1' },
      subject_kind: 'recommendation',
      subject_id: 'r1',
    });
    const row = ops.find((o) => o.table === 'analytics_user_events');
    expect(row).toBeDefined();
    expect(row!.payload.event_type).toBe('recommendation_viewed');
    expect(row!.payload.user_id).toBe('u1');
    expect(row!.payload.subject_kind).toBe('recommendation');
  });

  test('failure is swallowed (best-effort)', async () => {
    const badClient = {
      from() {
        return {
          insert() {
            throw new Error('boom');
          },
        };
      },
    };
    await expect(
      recordUserEvent(badClient, {
        user_id: 'u1',
        event_type: 'goal_created',
      })
    ).resolves.toBeUndefined();
  });
});

describe('decision outcome lifecycle', () => {
  test('recordRecommendationGenerated inserts outcome + history event', async () => {
    const { ops, client } = captureSupabase();
    const r = await recordRecommendationGenerated(client, {
      user_id: 'u1',
      recommendation_id: 'rec-1',
      governance_audit_id: 'a-1',
    });
    expect(r).not.toBeNull();
    const outcomeIns = ops.find((o) => o.table === 'decision_outcomes_v' && o.op === 'insert');
    expect(outcomeIns).toBeDefined();
    expect(outcomeIns!.payload.state).toBe('generated');
    expect(outcomeIns!.payload.recommendation_id).toBe('rec-1');

    const historyIns = ops.find((o) => o.table === 'decision_outcome_events' && o.op === 'insert');
    expect(historyIns).toBeDefined();
    expect(historyIns!.payload.to_state).toBe('generated');
    expect(historyIns!.payload.from_state).toBeNull();
  });

  test('transitionOutcome moves state forward + writes history', async () => {
    const { ops, client } = captureSupabase();
    await transitionOutcome(client, { user_id: 'u1', recommendation_id: 'rec-1' }, 'viewed', {
      source: 'recommendation_card',
    });
    const upd = ops.find((o) => o.table === 'decision_outcomes_v' && o.op === 'update');
    expect(upd).toBeDefined();
    expect(upd!.payload.state).toBe('viewed');
    expect(upd!.payload.viewed_at).toBeDefined();

    const history = ops.find((o) => o.table === 'decision_outcome_events');
    expect(history).toBeDefined();
    expect(history!.payload.to_state).toBe('viewed');
  });

  test('setOutcomeScore rejects out-of-range scores', async () => {
    const { ops, client } = captureSupabase();
    await setOutcomeScore(client, { user_id: 'u1', recommendation_id: 'rec-1' }, 1.5);
    // No update row should have been written.
    expect(ops.find((o) => o.table === 'decision_outcomes_v' && o.op === 'update')).toBeUndefined();

    await setOutcomeScore(client, { user_id: 'u1', recommendation_id: 'rec-1' }, 0.8, 'great');
    const upd = ops.find((o) => o.table === 'decision_outcomes_v' && o.op === 'update');
    expect(upd).toBeDefined();
    expect(upd!.payload.outcome_score).toBe(0.8);
  });
});
