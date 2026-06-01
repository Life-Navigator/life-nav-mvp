/**
 * Secrets Manager — Sprint M Phase 2.
 *
 * Single getSecret(name) facade. Today the implementation walks a
 * provider chain (env → optional Google Secret Manager) so we can
 * migrate from local env to GSM with a configuration change rather
 * than a code rewrite.
 *
 * Contract:
 *   - getSecret() returns the value or null. It NEVER throws on
 *     "not found" — callers decide what's required.
 *   - requireSecret() throws if the value is null or empty.
 *   - The set of canonical secret names is the source of truth in
 *     SECRET_REGISTRY below. Any code path that wants a secret should
 *     reference SECRET_REGISTRY rather than typing a raw key string.
 *
 * The GSM transport is intentionally NOT shipped here — adding it
 * later means importing `@google-cloud/secret-manager` and wiring
 * `loadFromGsm` into `providerChain`. The env transport works today.
 */

export const SECRET_REGISTRY = {
  // LLM providers
  GEMINI_API_KEY: {
    env: 'GEMINI_API_KEY',
    gsm: 'projects/lifenavigator-prod/secrets/gemini-api-key',
    sensitive: true,
  },
  OPENAI_API_KEY: {
    env: 'OPENAI_API_KEY',
    gsm: 'projects/lifenavigator-prod/secrets/openai-api-key',
    sensitive: true,
  },
  ANTHROPIC_API_KEY: {
    env: 'ANTHROPIC_API_KEY',
    gsm: 'projects/lifenavigator-prod/secrets/anthropic-api-key',
    sensitive: true,
  },

  // Supabase
  SUPABASE_URL: {
    env: 'NEXT_PUBLIC_SUPABASE_URL',
    gsm: 'projects/lifenavigator-prod/secrets/supabase-url',
    sensitive: false,
  },
  SUPABASE_ANON_KEY: {
    env: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    gsm: 'projects/lifenavigator-prod/secrets/supabase-anon-key',
    sensitive: false,
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    env: 'SUPABASE_SERVICE_ROLE_KEY',
    gsm: 'projects/lifenavigator-prod/secrets/supabase-service-role',
    sensitive: true,
  },

  // Plaid
  PLAID_CLIENT_ID: {
    env: 'PLAID_CLIENT_ID',
    gsm: 'projects/lifenavigator-prod/secrets/plaid-client-id',
    sensitive: false,
  },
  PLAID_SECRET: {
    env: 'PLAID_SECRET',
    gsm: 'projects/lifenavigator-prod/secrets/plaid-secret',
    sensitive: true,
  },
  PLAID_WEBHOOK_SECRET: {
    env: 'PLAID_WEBHOOK_SECRET',
    gsm: 'projects/lifenavigator-prod/secrets/plaid-webhook-secret',
    sensitive: true,
  },

  // Graph stores
  NEO4J_URL: {
    env: 'NEO4J_URL',
    gsm: 'projects/lifenavigator-prod/secrets/neo4j-url',
    sensitive: false,
  },
  NEO4J_USER: {
    env: 'NEO4J_USER',
    gsm: 'projects/lifenavigator-prod/secrets/neo4j-user',
    sensitive: true,
  },
  NEO4J_PASSWORD: {
    env: 'NEO4J_PASSWORD',
    gsm: 'projects/lifenavigator-prod/secrets/neo4j-password',
    sensitive: true,
  },
  QDRANT_URL: {
    env: 'QDRANT_URL',
    gsm: 'projects/lifenavigator-prod/secrets/qdrant-url',
    sensitive: false,
  },
  QDRANT_API_KEY: {
    env: 'QDRANT_API_KEY',
    gsm: 'projects/lifenavigator-prod/secrets/qdrant-api-key',
    sensitive: true,
  },

  // Infra
  VERCEL_TOKEN: {
    env: 'VERCEL_TOKEN',
    gsm: 'projects/lifenavigator-prod/secrets/vercel-token',
    sensitive: true,
  },
  FLY_API_TOKEN: {
    env: 'FLY_API_TOKEN',
    gsm: 'projects/lifenavigator-prod/secrets/fly-api-token',
    sensitive: true,
  },

  // Observability
  SENTRY_DSN: {
    env: 'SENTRY_DSN',
    gsm: 'projects/lifenavigator-prod/secrets/sentry-dsn',
    sensitive: false,
  },
  OTEL_EXPORTER_OTLP_ENDPOINT: {
    env: 'OTEL_EXPORTER_OTLP_ENDPOINT',
    gsm: 'projects/lifenavigator-prod/secrets/otel-endpoint',
    sensitive: false,
  },
  OTEL_EXPORTER_OTLP_HEADERS: {
    env: 'OTEL_EXPORTER_OTLP_HEADERS',
    gsm: 'projects/lifenavigator-prod/secrets/otel-headers',
    sensitive: true,
  },

  // Arcana provider verification
  ARCANA_PROVIDER_VERIFICATION_KEY: {
    env: 'ARCANA_PROVIDER_VERIFICATION_KEY',
    gsm: 'projects/lifenavigator-prod/secrets/arcana-provider-verification-key',
    sensitive: true,
  },
} as const;

export type SecretName = keyof typeof SECRET_REGISTRY;

// ---------------------------------------------------------------------------
// Provider chain
// ---------------------------------------------------------------------------

interface Provider {
  name: string;
  load(secret: { env: string; gsm: string }): Promise<string | null>;
}

const ENV_PROVIDER: Provider = {
  name: 'env',
  async load(s) {
    const v = process.env[s.env];
    return v && v.length > 0 ? v : null;
  },
};

/**
 * Lazy hook for the future GSM transport. Activated when
 * USE_GOOGLE_SECRET_MANAGER=1 AND a service-account credential is
 * available. We do NOT import the GSM client at module load to keep
 * cold-start light.
 */
const GSM_PROVIDER: Provider = {
  name: 'gsm',
  async load(s) {
    if (process.env.USE_GOOGLE_SECRET_MANAGER !== '1') return null;
    try {
      // String-indirected dynamic import — only paid for when the
      // USE_GOOGLE_SECRET_MANAGER flag is on. The indirection keeps
      // the optional GSM SDK out of the TS resolver.
      const importer = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
      const mod = await importer('@google-cloud/secret-manager');
      const Client = mod.SecretManagerServiceClient ?? mod.default?.SecretManagerServiceClient;
      if (!Client) return null;
      const client = new Client();
      const [version] = await client.accessSecretVersion({ name: `${s.gsm}/versions/latest` });
      const payload = version?.payload?.data?.toString();
      return payload && payload.length > 0 ? payload : null;
    } catch {
      return null;
    }
  },
};

const PROVIDERS: Provider[] = [ENV_PROVIDER, GSM_PROVIDER];

// ---------------------------------------------------------------------------
// Cache (per-process, 5 min TTL)
// ---------------------------------------------------------------------------

const SECRET_CACHE = new Map<SecretName, { value: string | null; at: number }>();
const SECRET_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getSecret(name: SecretName): Promise<string | null> {
  const cached = SECRET_CACHE.get(name);
  if (cached && Date.now() - cached.at < SECRET_TTL_MS) return cached.value;
  const def = SECRET_REGISTRY[name];
  for (const p of PROVIDERS) {
    const v = await p.load(def);
    if (v != null) {
      SECRET_CACHE.set(name, { value: v, at: Date.now() });
      return v;
    }
  }
  SECRET_CACHE.set(name, { value: null, at: Date.now() });
  return null;
}

export async function requireSecret(name: SecretName): Promise<string> {
  const v = await getSecret(name);
  if (v == null) {
    throw new Error(
      `Required secret ${name} not configured. Set ${SECRET_REGISTRY[name].env} ` +
        `or enable USE_GOOGLE_SECRET_MANAGER with access to ${SECRET_REGISTRY[name].gsm}.`
    );
  }
  return v;
}

export function clearSecretCache(): void {
  SECRET_CACHE.clear();
}

// ---------------------------------------------------------------------------
// Inventory helper — for the launch checklist
// ---------------------------------------------------------------------------

export interface SecretInventoryRow {
  name: SecretName;
  configured: boolean;
  source: 'env' | 'gsm' | 'missing';
  sensitive: boolean;
}

export async function inventorySecrets(): Promise<SecretInventoryRow[]> {
  const out: SecretInventoryRow[] = [];
  for (const name of Object.keys(SECRET_REGISTRY) as SecretName[]) {
    const def = SECRET_REGISTRY[name];
    const envHit = (await ENV_PROVIDER.load(def)) != null;
    const gsmHit = !envHit && (await GSM_PROVIDER.load(def)) != null;
    out.push({
      name,
      configured: envHit || gsmHit,
      source: envHit ? 'env' : gsmHit ? 'gsm' : 'missing',
      sensitive: def.sensitive,
    });
  }
  return out;
}

export const __test = {
  ENV_PROVIDER,
  GSM_PROVIDER,
  SECRET_CACHE,
  clear: clearSecretCache,
};
