/**
 * Beta model activation contract. Locks in the exact beta routing policy:
 *   • ONLY onboarding_advisor, report_writer, recommendation_critic route to Claude Sonnet (Vertex).
 *   • Everything else stays Gemini — even with Claude enabled.
 *   • Opus stays disabled for beta.
 *   • Every Claude route carries a Gemini fallback; Gemini-only mode works.
 */
type RouterMod = typeof import('../modelRouter');

function load(env: Record<string, string>): RouterMod {
  jest.resetModules();
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  let router!: RouterMod;
  jest.isolateModules(() => (router = require('../modelRouter')));
  return router;
}

// Claude is enabled AND in a Claude-served region (us-east5).
const BETA = {
  AI_MODEL_ROUTER_ENABLED: 'true',
  AI_ENABLE_CLAUDE: 'true',
  AI_ENABLE_CLAUDE_OPUS: 'false',
  AI_VERTEX_LOCATION: 'us-east5',
};
const GEMINI_ONLY = { ...BETA, AI_ENABLE_CLAUDE: 'false' };

afterEach(() => {
  for (const k of [
    'AI_MODEL_ROUTER_ENABLED',
    'AI_ENABLE_CLAUDE',
    'AI_ENABLE_CLAUDE_OPUS',
    'AI_VERTEX_LOCATION',
  ])
    delete process.env[k];
});

const CLAUDE_AGENTS = ['onboarding_advisor', 'report_writer', 'recommendation_critic'] as const;
const GEMINI_AGENTS = [
  'decision_engine',
  'scenario_lab',
  'recommendation_generator',
  'explainability_builder',
  'graph_retrieval_planner',
  'graph_node_summarizer',
  'finance_explainer',
  'document_extractor',
  'document_classifier',
  'goal_extractor',
  'intent_classifier',
] as const;

describe('beta activation — Claude on (us-east5)', () => {
  test('the 3 beta agents route to Claude Sonnet on Vertex', () => {
    const r = load(BETA);
    for (const a of CLAUDE_AGENTS) {
      const route = r.routeModel({ agent: a });
      expect(route.provider).toBe('vertex-claude');
      expect(route.model).toBe('claude-sonnet-4-5');
    }
  });

  test('every other agent stays Gemini even with Claude enabled', () => {
    const r = load(BETA);
    for (const a of GEMINI_AGENTS) {
      expect(r.routeModel({ agent: a }).provider).toBe('vertex-gemini');
    }
  });

  test('each Claude route carries a Gemini fallback (failure never breaks UX)', () => {
    const r = load(BETA);
    for (const a of CLAUDE_AGENTS) {
      const route = r.routeModel({ agent: a });
      expect(route.fallbackModels.some((f) => f.provider === 'vertex-gemini')).toBe(true);
    }
  });

  test('Opus stays disabled — a high-stakes critic does NOT escalate to Opus in beta', () => {
    const r = load(BETA);
    const route = r.routeModel({
      agent: 'recommendation_critic',
      riskLevel: 'regulated',
      requiresCritic: true,
    });
    expect(route.model).not.toBe('claude-opus-4-1');
    expect(route.provider).toBe('vertex-claude'); // stays Sonnet
  });
});

describe('Gemini-only safety mode (AI_ENABLE_CLAUDE=false)', () => {
  test('the platform still works — the 3 agents fall back to Gemini', () => {
    const r = load(GEMINI_ONLY);
    for (const a of CLAUDE_AGENTS) {
      const route = r.routeModel({ agent: a });
      expect(route.provider).toBe('vertex-gemini');
    }
    // and everything else is unchanged
    expect(r.routeModel({ agent: 'decision_engine' }).provider).toBe('vertex-gemini');
  });
});

describe('region guard — Claude enabled but not served in the region', () => {
  test('falls back to Gemini when AI_VERTEX_LOCATION has no Claude (e.g. us-central1)', () => {
    const r = load({ ...BETA, AI_VERTEX_LOCATION: 'us-central1' });
    const route = r.routeModel({ agent: 'onboarding_advisor' });
    expect(route.provider).toBe('vertex-gemini');
    expect(route.reason).toMatch(/unavailable|fallback/i);
  });
});
