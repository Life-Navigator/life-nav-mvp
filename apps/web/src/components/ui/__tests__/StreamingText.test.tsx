import { act, renderHook } from '@testing-library/react';
import { useStreamedText } from '../StreamingText';

describe('useStreamedText', () => {
  afterEach(() => jest.useRealTimers());

  test('animate=false reveals the full text immediately', () => {
    const { result } = renderHook(() => useStreamedText('Hello world', false));
    expect(result.current.shown).toBe('Hello world');
    expect(result.current.done).toBe(true);
  });

  test('animate=true reveals progressively, then completes with the full text', () => {
    jest.useFakeTimers();
    const text = 'The quick brown fox jumps over the lazy dog.';
    const { result } = renderHook(() => useStreamedText(text, true, { tickMs: 18 }));

    // starts empty (mid-stream)
    expect(result.current.shown.length).toBeLessThan(text.length);
    expect(result.current.done).toBe(false);

    // advance partway → strictly a prefix of the real text (no fabricated characters)
    act(() => {
      jest.advanceTimersByTime(18 * 5);
    });
    expect(text.startsWith(result.current.shown)).toBe(true);

    // run to completion
    act(() => {
      jest.advanceTimersByTime(18 * 200);
    });
    expect(result.current.shown).toBe(text);
    expect(result.current.done).toBe(true);
  });

  test('empty text is handled (done, no crash)', () => {
    const { result } = renderHook(() => useStreamedText('', true));
    expect(result.current.shown).toBe('');
    expect(result.current.done).toBe(true);
  });
});
