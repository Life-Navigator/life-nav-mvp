/**
 * B-25 — server-issued turn_id survives conversation history.
 *
 * EVIDENCE BOUNDARY: pure unit tests over the shaping logic. No database, no HTTP.
 * Contract evidence, not deployed evidence.
 */

/** Mirrors the shaping in app/api/chat/threads/[id]/messages/route.ts GET. */
function shapeHistory(rows: Record<string, unknown>[]) {
  return rows.map((m) => {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    const turnId =
      m.role === 'assistant' && typeof meta.turn_id === 'string' ? meta.turn_id : undefined;
    const { metadata: _drop, ...rest } = m;
    return turnId ? { ...rest, turn_id: turnId } : rest;
  });
}

const TURN = 'server-issued-turn-abc';

describe('history turn_id restoration', () => {
  it('restores turn_id onto a persisted advisor message', () => {
    const [msg] = shapeHistory([
      { id: '1', role: 'assistant', content: 'hi', metadata: { turn_id: TURN, llm_status: 'ok' } },
    ]);
    expect(msg.turn_id).toBe(TURN);
  });

  it('NEVER assigns a turn id to a user message', () => {
    // A user message carrying an advisor turn id would let a report bind to the wrong thing.
    const [msg] = shapeHistory([
      { id: '1', role: 'user', content: 'q', metadata: { turn_id: TURN } },
    ]);
    expect(msg).not.toHaveProperty('turn_id');
  });

  it('NEVER assigns a turn id to a system message', () => {
    const [msg] = shapeHistory([
      { id: '1', role: 'system', content: 's', metadata: { turn_id: TURN } },
    ]);
    expect(msg).not.toHaveProperty('turn_id');
  });

  it('legacy advisor messages stay readable without a turn id', () => {
    const [msg] = shapeHistory([
      { id: '1', role: 'assistant', content: 'old answer', metadata: { llm_status: 'ok' } },
    ]);
    expect(msg.content).toBe('old answer');
    expect(msg).not.toHaveProperty('turn_id'); // absent, never fabricated
  });

  it('does not leak the rest of metadata to the client', () => {
    // metadata may hold diagnostic fields the browser has no business seeing.
    const [msg] = shapeHistory([
      {
        id: '1',
        role: 'assistant',
        content: 'a',
        metadata: { turn_id: TURN, llm_status: 'ok', internal_diagnostic: 'SECRET' },
      },
    ]);
    expect(msg).not.toHaveProperty('metadata');
    expect(JSON.stringify(msg)).not.toContain('SECRET');
    expect(JSON.stringify(msg)).not.toContain('llm_status');
  });

  it('binds each turn id to its own message across multiple advisor turns', () => {
    const shaped = shapeHistory([
      { id: '1', role: 'user', content: 'q1' },
      { id: '2', role: 'assistant', content: 'a1', metadata: { turn_id: 'turn-1' } },
      { id: '3', role: 'user', content: 'q2' },
      { id: '4', role: 'assistant', content: 'a2', metadata: { turn_id: 'turn-2' } },
    ]);
    expect(shaped.map((m) => m.turn_id)).toEqual([undefined, 'turn-1', undefined, 'turn-2']);
  });

  it('ignores a non-string turn_id rather than coercing it', () => {
    const [msg] = shapeHistory([
      { id: '1', role: 'assistant', content: 'a', metadata: { turn_id: 12345 } },
    ]);
    expect(msg).not.toHaveProperty('turn_id');
  });
});
