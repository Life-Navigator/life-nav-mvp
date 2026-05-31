/**
 * @jest-environment jsdom
 */
import { saveUserGraph } from '../save-user-graph';
import { EMPTY_USER_GRAPH_PAYLOAD, type UserGraphPayload } from '@/types/user-graph';

describe('saveUserGraph', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      } as unknown as Response)
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('skips sections whose payload is empty (no fetch call)', async () => {
    const result = await saveUserGraph({ ...EMPTY_USER_GRAPH_PAYLOAD });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    // Every section recorded as a 204 "skipped" success.
    for (const key of Object.keys(result.sections)) {
      expect(result.sections[key].ok).toBe(true);
      expect(result.sections[key].status).toBe(204);
    }
  });

  it('POSTs only the populated sections with structured payload', async () => {
    const payload: UserGraphPayload = {
      ...EMPTY_USER_GRAPH_PAYLOAD,
      life_vision: [{ horizon: '1_year', vision_text: 'Pay down debt' }],
      decision_preferences: [
        { axis: 'speed', weight: 0.4 },
        { axis: 'certainty', weight: 0.8 },
      ],
      // motivations with blank text should be filtered out
      motivations: [
        { motivation_text: '', intensity: null },
        { motivation_text: '  Be present with my family  ', intensity: 9 },
      ],
    };

    const result = await saveUserGraph(payload);

    expect(result.ok).toBe(true);

    const calledPaths = fetchMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toContain('/api/onboarding/life-vision');
    expect(calledPaths).toContain('/api/onboarding/decision-preferences');
    expect(calledPaths).toContain('/api/onboarding/motivations');
    expect(calledPaths).not.toContain('/api/onboarding/constraints');
    expect(calledPaths).not.toContain('/api/onboarding/commitment-levels');
    expect(calledPaths).not.toContain('/api/onboarding/domain-risk');

    const motivationsCall = fetchMock.mock.calls.find(
      (c) => c[0] === '/api/onboarding/motivations'
    )!;
    const body = JSON.parse(motivationsCall[1].body as string);
    expect(body.motivations).toHaveLength(1);
    expect(body.motivations[0].motivation_text).toBe('Be present with my family');
    expect(body.source).toBe('onboarding');
  });

  it('reports per-section failures without blocking other sections', async () => {
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/onboarding/life-vision') {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve('bad request'),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      } as unknown as Response);
    });

    const payload: UserGraphPayload = {
      ...EMPTY_USER_GRAPH_PAYLOAD,
      life_vision: [{ horizon: '1_year', vision_text: 'something' }],
      decision_preferences: [{ axis: 'speed', weight: 0.5 }],
    };

    const result = await saveUserGraph(payload);

    expect(result.ok).toBe(false);
    expect(result.sections.life_vision.ok).toBe(false);
    expect(result.sections.life_vision.status).toBe(400);
    expect(result.sections.decision_preferences.ok).toBe(true);
  });

  it('treats a network throw as a failed section, not a thrown error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));

    const payload: UserGraphPayload = {
      ...EMPTY_USER_GRAPH_PAYLOAD,
      life_vision: [{ horizon: '1_year', vision_text: 'something' }],
    };

    const result = await saveUserGraph(payload);

    expect(result.ok).toBe(false);
    expect(result.sections.life_vision.ok).toBe(false);
    expect(result.sections.life_vision.status).toBe(0);
    expect(result.sections.life_vision.error).toMatch(/boom/);
  });
});
