import {
  statusForFinal,
  streamDurationMs,
  shouldRenderInstantly,
  ARCANA_STREAMING_ENABLED,
} from '../streaming';

describe('arcana streaming policy', () => {
  describe('statusForFinal — maps the approved final to a UX state (never gates content)', () => {
    it('routes the health-safety fallback to an immediate safety response', () => {
      expect(statusForFinal('safety_fallback')).toBe('safety_response');
    });

    it('treats any fallback:* status as an approved deterministic fallback', () => {
      expect(statusForFinal('fallback:unavailable')).toBe('fallback');
      expect(statusForFinal('fallback:empty')).toBe('fallback');
      expect(statusForFinal('fallback:error')).toBe('fallback');
    });

    it('treats enhanced / disabled / empty as a normal typed response', () => {
      expect(statusForFinal('enhanced')).toBe('responding');
      expect(statusForFinal('disabled')).toBe('responding');
      expect(statusForFinal('')).toBe('responding');
      expect(statusForFinal(undefined)).toBe('responding');
      expect(statusForFinal(null)).toBe('responding');
    });

    it('is case-insensitive', () => {
      expect(statusForFinal('SAFETY_FALLBACK')).toBe('safety_response');
      expect(statusForFinal('Fallback:Unavailable')).toBe('fallback');
    });
  });

  describe('shouldRenderInstantly — safety always immediate', () => {
    it('renders safety responses instantly regardless of the flag', () => {
      expect(shouldRenderInstantly('safety_response')).toBe(true);
    });

    it('types normal responses when streaming is enabled (default)', () => {
      // Default build has streaming enabled; a normal response should NOT be instant.
      if (ARCANA_STREAMING_ENABLED) {
        expect(shouldRenderInstantly('responding')).toBe(false);
      }
    });
  });

  describe('streamDurationMs — fast and natural, never theatrical', () => {
    it('keeps short answers in the 300–500ms band', () => {
      expect(streamDurationMs(0)).toBe(300);
      expect(streamDurationMs(60)).toBeGreaterThanOrEqual(300);
      expect(streamDurationMs(120)).toBeLessThanOrEqual(500);
    });

    it('keeps medium answers in the 1–2s band', () => {
      expect(streamDurationMs(121)).toBeGreaterThanOrEqual(1000);
      expect(streamDurationMs(600)).toBeLessThanOrEqual(2000);
    });

    it('keeps long answers in the 2–5s band and caps at 5s', () => {
      expect(streamDurationMs(601)).toBeGreaterThanOrEqual(2000);
      expect(streamDurationMs(2000)).toBeLessThanOrEqual(5000);
      expect(streamDurationMs(50_000)).toBe(5000); // hard cap — no theatrical typing
    });

    it('is monotonically non-decreasing in length', () => {
      let prev = -1;
      for (const len of [0, 50, 120, 121, 300, 600, 601, 1200, 2000, 10_000]) {
        const d = streamDurationMs(len);
        expect(d).toBeGreaterThanOrEqual(prev);
        prev = d;
      }
    });
  });
});
