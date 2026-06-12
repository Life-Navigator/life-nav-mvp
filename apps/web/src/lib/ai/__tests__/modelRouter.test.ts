/**
 * Model router foundation tests. Feature flags are read from process.env at module load, so each test
 * sets env then re-requires the modules in isolation.
 */
import type { ModelRoute } from '../types';

type RouterMod = typeof import('../modelRouter');
type AuditMod = typeof import('../auditLog');

function load(env: Record<string, string>): { router: RouterMod; audit: AuditMod } {
  jest.resetModules();
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  let router!: RouterMod;
  let audit!: AuditMod;
  jest.isolateModules(() => {
    router = require('../modelRouter');
    audit = require('../auditLog');
  });
  return { router, audit };
}

const CLAUDE_OFF = {
  AI_MODEL_ROUTER_ENABLED: 'true',
  AI_ENABLE_CLAUDE: 'false',
  AI_ENABLE_CLAUDE_OPUS: 'false',
  AI_VERTEX_LOCATION: 'us-central1',
};
const CLAUDE_ON = {
  AI_MODEL_ROUTER_ENABLED: 'true',
  AI_ENABLE_CLAUDE: 'true',
  AI_ENABLE_CLAUDE_OPUS: 'false',
  AI_VERTEX_LOCATION: 'us-east5',
};

afterEach(() => {
  for (const k of [
    'AI_MODEL_ROUTER_ENABLED',
    'AI_ENABLE_CLAUDE',
    'AI_ENABLE_CLAUDE_OPUS',
    'AI_VERTEX_LOCATION',
  ])
    delete process.env[k];
});

describe('agent → model resolution', () => {
  test('cheap classifiers resolve to the flash-lite model', () => {
    const { router } = load(CLAUDE_OFF);
    for (const a of [
      'router',
      'intent_classifier',
      'domain_classifier',
      'risk_classifier',
      'document_classifier',
      'graph_node_summarizer',
    ] as const) {
      expect(router.routeModel({ agent: a }).model).toBe('gemini-2.5-flash-lite');
    }
  });

  test('default-tier agents resolve to gemini-3.5-flash', () => {
    const { router } = load(CLAUDE_OFF);
    for (const a of [
      'goal_extractor',
      'explainability_builder',
      'graph_retrieval_planner',
      'document_extractor',
      'finance_explainer',
    ] as const) {
      expect(router.routeModel({ agent: a }).model).toBe('gemini-3.5-flash');
    }
  });

  test('deep-reasoning agents resolve to gemini-2.5-pro', () => {
    const { router } = load(CLAUDE_OFF);
    for (const a of ['decision_engine', 'scenario_lab', 'recommendation_generator'] as const) {
      expect(router.routeModel({ agent: a }).model).toBe('gemini-2.5-pro');
    }
  });

  test('Claude-enabled (in a Claude region): empathy + report agents resolve to claude-sonnet-4-5', () => {
    const { router } = load(CLAUDE_ON);
    expect(router.routeModel({ agent: 'onboarding_advisor' }).model).toBe('claude-sonnet-4-5');
    expect(router.routeModel({ agent: 'report_writer' }).model).toBe('claude-sonnet-4-5');
    expect(router.routeModel({ agent: 'recommendation_critic' }).provider).toBe('vertex-claude');
  });
});

describe('Claude-disabled fallback', () => {
  test('onboarding/report/critic fall back to Gemini when Claude is off', () => {
    const { router } = load(CLAUDE_OFF);
    expect(router.routeModel({ agent: 'onboarding_advisor' }).model).toBe('gemini-3.5-flash');
    expect(router.routeModel({ agent: 'report_writer' }).model).toBe('gemini-3.5-flash');
    // critic falls back to deep Gemini reasoning
    expect(router.routeModel({ agent: 'recommendation_critic' }).model).toBe('gemini-2.5-pro');
    expect(router.routeModel({ agent: 'onboarding_advisor' }).provider).toBe('vertex-gemini');
  });

  test('Claude unavailable in region (us-central1) also falls back even if flag is on', () => {
    const { router } = load({
      ...CLAUDE_OFF,
      AI_ENABLE_CLAUDE: 'true',
      AI_VERTEX_LOCATION: 'us-central1',
    });
    const r = router.routeModel({ agent: 'onboarding_advisor' });
    expect(r.provider).toBe('vertex-gemini');
    expect(r.reason).toMatch(/fallback|unavailable/i);
  });
});

describe('Claude-failure fallback chain', () => {
  test('when Claude is primary, the route carries a Gemini fallback so a failure never breaks UX', () => {
    const { router } = load(CLAUDE_ON);
    const r: ModelRoute = router.routeModel({ agent: 'onboarding_advisor' });
    expect(r.provider).toBe('vertex-claude');
    expect(r.fallbackModels.some((f) => f.provider === 'vertex-gemini')).toBe(true);
  });
});

describe('risk floors — regulated/high-risk never use cheap models', () => {
  test('regulated risk upgrades a cheap classifier to deep reasoning', () => {
    const { router } = load(CLAUDE_OFF);
    const r = router.routeModel({ agent: 'router', riskLevel: 'regulated' });
    expect(r.model).not.toBe('gemini-2.5-flash-lite');
    expect(r.model).toBe('gemini-2.5-pro');
  });

  test('high risk upgrades a cheap classifier off flash-lite', () => {
    const { router } = load(CLAUDE_OFF);
    const r = router.routeModel({ agent: 'intent_classifier', riskLevel: 'high' });
    expect(r.model).not.toBe('gemini-2.5-flash-lite');
  });

  test('requiresDeepReasoning forces at least gemini-2.5-pro', () => {
    const { router } = load(CLAUDE_OFF);
    expect(
      router.routeModel({ agent: 'domain_classifier', requiresDeepReasoning: true }).model
    ).toBe('gemini-2.5-pro');
  });
});

describe('finance math is never an LLM responsibility', () => {
  test('FINANCE_MATH_USES_LLM is false and the guard does not throw', () => {
    const { router } = load(CLAUDE_OFF);
    expect(router.FINANCE_MATH_USES_LLM).toBe(false);
    expect(() => router.assertFinanceMathNotLlm()).not.toThrow();
  });

  test('finance_explainer is explanation-only and uses Gemini, never reasoning math', () => {
    jest.resetModules();
    let profiles!: typeof import('../agentProfiles');
    jest.isolateModules(() => (profiles = require('../agentProfiles')));
    expect(profiles.AGENT_PROFILES.finance_explainer.explanationOnly).toBe(true);
  });
});

describe('audit logging', () => {
  test('routeAndAudit emits a structured record with no raw content by default', () => {
    const { router, audit } = load(CLAUDE_OFF);
    const buf: any[] = [];
    audit.setAuditSink((r) => buf.push(r));
    const { route } = router.routeAndAudit(
      { agent: 'decision_engine', domain: 'finance', riskLevel: 'high' },
      { userId: 'u1', promptVersion: '1.0.0', promptPreview: 'SECRET RAW CONTENT' }
    );
    expect(buf).toHaveLength(1);
    expect(buf[0].agent).toBe('decision_engine');
    expect(buf[0].model).toBe(route.model);
    expect(buf[0].userId).toBe('u1');
    expect(buf[0].requestId).toBeTruthy();
    expect(buf[0].promptPreview).toBeUndefined(); // raw content stripped unless AI_AUDIT_DEV_CONTENT=true
    audit.resetAuditSink();
  });
});

describe('safety', () => {
  test('unknown agent falls back to the Gemini default', () => {
    const { router } = load(CLAUDE_OFF);
    const r = router.routeModel({ agent: 'totally_unknown' as any });
    expect(r.provider).toBe('vertex-gemini');
    expect(r.model).toBe('gemini-3.5-flash');
  });

  test('router disabled → single default model, no fallbacks', () => {
    const { router } = load({ ...CLAUDE_OFF, AI_MODEL_ROUTER_ENABLED: 'false' });
    const r = router.routeModel({ agent: 'decision_engine' });
    expect(r.model).toBe('gemini-3.5-flash');
    expect(r.fallbackModels).toHaveLength(0);
  });
});
