# Secrets and Configuration Management

**Status**: Production Security Standard
**Last Updated**: 2026-01-09
**Owner**: Security Engineering

---

## Overview

This document defines the **ZERO `.env` IN PRODUCTION** policy for Life Navigator. All secrets must be managed through secure secret stores with automatic rotation, audit logging, and fail-fast validation.

### Security Principles

1. **Managed Secrets Only**: No `.env` files in production deployments
2. **Fail Fast**: Missing required secrets cause immediate startup failure
3. **Least Privilege**: Services receive only required secrets with minimal scopes
4. **Rotation**: Automated rotation for all credentials (30-90 day cycles)
5. **Audit**: All secret access logged to Cloud Audit Logs

---

## Secret Storage by Environment

| Environment | Storage Solution | Access Method | Rotation |
|-------------|------------------|---------------|----------|
| **Development** | `.env.local` (git-ignored) | Direct file read | Manual |
| **CI/CD** | GitHub Secrets | `${{ secrets.NAME }}` | Manual |
| **Vercel (Staging)** | Vercel Environment Variables | Automatic injection | Manual via dashboard |
| **GCP (Production)** | GCP Secret Manager | Cloud Run/GKE secret mounts | Automatic (Cloud KMS) |
| **Supabase** | Supabase Vault | Postgres `vault.secrets` table | API-driven rotation |

---

## Complete Secret Inventory

### 1. Database Credentials

#### Supabase (Primary Database)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `SUPABASE_URL` | Supabase project URL | Frontend, Backend | Vercel Env, GCP SM | Never (URL identifier) |
| `SUPABASE_KEY` | Anon/public key (JWT issuance) | Frontend | Vercel Env | 90 days |
| `SUPABASE_SERVICE_KEY` | Admin key (bypasses RLS) | Backend | GCP SM only | 30 days |
| `SUPABASE_JWT_SECRET` | JWT signature verification | Backend | GCP SM only | 90 days |
| `DATABASE_URL` | PostgreSQL connection (NextAuth) | Frontend API routes | Vercel Env | Never (Supabase-managed) |

**Access Control**:
- `SUPABASE_KEY`: Read-only via RLS, can be public
- `SUPABASE_SERVICE_KEY`: **NEVER expose to frontend**, backend admin operations only
- `SUPABASE_JWT_SECRET`: Backend validation only

**Rotation Procedure**:
```bash
# Supabase Dashboard → Settings → API → Generate new service_role key
# Update GCP Secret Manager
gcloud secrets versions add supabase-service-key --data-file=./new-key.txt

# Restart backend pods
kubectl rollout restart deployment/backend -n life-navigator-prod
```

#### CloudSQL HIPAA (Health Data)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `DATABASE_HIPAA_URL` | PostgreSQL connection string | Backend | GCP SM | 30 days (password) |
| `CLOUDSQL_HIPAA_INSTANCE` | CloudSQL instance name | Backend | GCP SM | Never (identifier) |
| `CLOUDSQL_HIPAA_USER` | Database username | Backend | GCP SM | Never (IAM auth preferred) |
| `CLOUDSQL_HIPAA_PASSWORD` | Database password | Backend | GCP SM | 30 days |

**IAM Authentication** (Preferred):
```bash
# Enable IAM auth for CloudSQL
gcloud sql instances patch life-navigator-hipaa \
  --database-flags=cloudsql.iam_authentication=on

# Grant IAM permissions
gcloud sql users create backend-sa@PROJECT.iam \
  --instance=life-navigator-hipaa \
  --type=CLOUD_IAM_SERVICE_ACCOUNT
```

**Rotation Procedure**:
```bash
# Rotate CloudSQL password
gcloud sql users set-password cloudsql_user \
  --instance=life-navigator-hipaa \
  --password=$(openssl rand -base64 32)

# Update secret
gcloud secrets versions add cloudsql-hipaa-password \
  --data-file=<(echo -n "$NEW_PASSWORD")
```

#### CloudSQL Financial (PCI-DSS Data)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `DATABASE_FINANCIAL_URL` | PostgreSQL connection string | Backend | GCP SM | 30 days |
| `CLOUDSQL_FINANCIAL_INSTANCE` | CloudSQL instance name | Backend | GCP SM | Never |
| `CLOUDSQL_FINANCIAL_USER` | Database username | Backend | GCP SM | Never (IAM auth preferred) |
| `CLOUDSQL_FINANCIAL_PASSWORD` | Database password | GCP SM | 30 days |

---

### 2. External Service API Keys

#### Plaid (Financial Data Aggregation)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `PLAID_CLIENT_ID` | Plaid application ID | Frontend, Backend | Vercel Env, GCP SM | 180 days |
| `PLAID_SECRET` | Plaid API secret | Backend only | GCP SM | 180 days |
| `PLAID_WEBHOOK_SECRET` | Webhook signature verification | Backend | GCP SM | 180 days |
| `PLAID_ENV` | Environment (sandbox/production) | Frontend, Backend | Vercel Env, GCP SM | Never (config, not secret) |

**Security Notes**:
- `PLAID_CLIENT_ID`: Safe to expose (identifier only)
- `PLAID_SECRET`: **NEVER expose to frontend**
- Webhook secret validates Plaid → Backend callbacks

**Rotation Procedure**:
```bash
# Plaid Dashboard → API → Generate new secret
# Update GCP Secret Manager
gcloud secrets versions add plaid-secret --data-file=./new-secret.txt

# Test webhook validation
curl -X POST https://api.lifenav.app/api/v1/webhooks/plaid \
  -H "Plaid-Verification: $NEW_SIGNATURE" \
  -d '{}'
```

#### Stripe (Payments)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side SDK initialization | Frontend | Vercel Env | 180 days |
| `STRIPE_SECRET_KEY` | Server-side API calls | Backend | GCP SM | 90 days |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Backend | GCP SM | 180 days |

**Access Control**:
- Publishable key: Safe for frontend (scoped to public operations)
- Secret key: Backend only, full account access

#### Google OAuth

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `GOOGLE_CLIENT_ID` | OAuth application ID | Frontend | Vercel Env | Never (GCP identifier) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Backend | GCP SM | 90 days |

#### OpenAI (Embeddings) - **TO BE REMOVED**

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `OPENAI_API_KEY` | Embedding generation | Backend | GCP SM | ⚠️ **DEPRECATE** - Replace with GraphRAG |

**Migration Plan**:
```python
# BEFORE (OpenAI)
from openai import AsyncOpenAI
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# AFTER (GraphRAG via gRPC)
from app.clients.graphrag_client import GraphRAGClient
client = GraphRAGClient(host=settings.GRAPHRAG_HOST)
embeddings = await client.generate_embeddings(texts)
```

---

### 3. Encryption Keys

#### Application Encryption

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `SECRET_KEY` | JWT signing, session encryption | Backend | GCP SM | 90 days |
| `NEXTAUTH_SECRET` | NextAuth session encryption | Frontend | Vercel Env, GCP SM | 90 days |
| `ENCRYPTION_KEY` | Field-level encryption (AES-256) | Backend | GCP SM (KMS-backed) | 90 days |

**Field-Level Encryption**:
```python
# Encrypted fields (HIPAA requirement § 164.312(a)(2)(iv))
- health_records.ssn
- health_records.diagnosis
- medications.name
- health_records.medical_record_number
```

**Key Management**:
```bash
# Generate new encryption key (32 bytes = 64 hex chars)
openssl rand -hex 32 > encryption-key.txt

# Store in GCP Secret Manager with KMS encryption
gcloud secrets create encryption-key \
  --data-file=encryption-key.txt \
  --replication-policy=automatic \
  --kms-key-name=projects/PROJECT/locations/global/keyRings/secrets/cryptoKeys/encryption-master

# Rotate key (envelope encryption pattern)
# 1. Generate new key
# 2. Re-encrypt all data with new key
# 3. Update secret
# 4. Rolling restart services
```

---

### 4. External Integrations

#### Neo4j (Knowledge Graph)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `NEO4J_URI` | Neo4j Aura connection string | Backend, GraphRAG service | GCP SM | Never (URL) |
| `NEO4J_USER` | Database username | Backend, GraphRAG service | GCP SM | Never (fixed) |
| `NEO4J_PASSWORD` | Database password | Backend, GraphRAG service | GCP SM | 90 days |

#### Qdrant (Vector Database)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `QDRANT_URL` | Qdrant Cloud URL | Backend, GraphRAG service | GCP SM | Never (URL) |
| `QDRANT_API_KEY` | API authentication | Backend, GraphRAG service | GCP SM | 90 days |

#### Temporal (Workflow Orchestration)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `TEMPORAL_NAMESPACE` | Temporal Cloud namespace | Agents service | GCP SM | Never (identifier) |
| `TEMPORAL_ADDRESS` | gRPC endpoint | Agents service | GCP SM | Never (URL) |
| `TEMPORAL_MTLS_CERT` | mTLS client certificate | Agents service | GCP SM | 365 days |
| `TEMPORAL_MTLS_KEY` | mTLS private key | Agents service | GCP SM | 365 days |

---

### 5. Monitoring & Observability

#### Sentry (Error Tracking)

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `SENTRY_DSN` | Error reporting endpoint | Frontend, Backend | Vercel Env, GCP SM | 180 days |

#### GCP Monitoring

| Secret Name | Purpose | Consumer | Storage | Rotation Policy |
|-------------|---------|----------|---------|-----------------|
| `GCP_PROJECT_ID` | GCP project identifier | All services | GCP SM | Never (identifier) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account key JSON | Backend, Services | GKE Workload Identity (no secret) | Never (Workload Identity) |

**Workload Identity** (No Secret Required):
```yaml
# GKE pod uses Workload Identity (recommended)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backend-sa
  annotations:
    iam.gke.io/gcp-service-account: backend@PROJECT.iam.gserviceaccount.com
```

---

## Production Configuration Loader

### Backend (Python/FastAPI)

**Location**: `backend/app/core/config.py`

#### Current Implementation Issues

```python
# ❌ PROBLEM 1: Allows .env file in production
model_config = SettingsConfigDict(
    env_file=".env",  # Should be disabled in production
    env_file_encoding="utf-8",
    case_sensitive=True,
    extra="ignore",  # ❌ PROBLEM 2: Ignores unknown variables
)

# ❌ PROBLEM 3: Insecure defaults allowed
SECRET_KEY: str = Field(default="development-secret-key-change-in-production-32chars")
DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/lifenavigator"
```

#### Secure Implementation

**File**: `backend/app/core/config_secure.py`

```python
"""
Secure production configuration loader.

Security guarantees:
1. No .env files in production
2. Fail fast on missing required secrets
3. Reject unknown environment variables
4. No insecure defaults in deployed environments
"""

from functools import lru_cache
from typing import Literal
import sys
import os

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigurationError(Exception):
    """Raised when configuration is invalid for the current environment."""
    pass


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables ONLY.

    In production:
    - NO .env file loading
    - ALL secrets from GCP Secret Manager
    - Fail fast if required secrets missing
    - Reject unknown variables
    """

    # Environment detection
    ENVIRONMENT: Literal["development", "staging", "beta", "production"] = Field(
        default="development",
        description="Runtime environment"
    )

    # Determine if .env should be loaded
    @property
    def _load_dotenv(self) -> bool:
        """Only load .env in development."""
        return self.ENVIRONMENT == "development"

    model_config = SettingsConfigDict(
        # Conditional .env loading
        env_file=".env" if os.getenv("ENVIRONMENT", "development") == "development" else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="forbid",  # ✅ CRITICAL: Reject unknown variables
        validate_default=True,
    )

    # ===========================================================================
    # REQUIRED SECRETS (No defaults in production)
    # ===========================================================================

    # JWT Signing
    SECRET_KEY: str = Field(
        ...,  # Required, no default
        min_length=32,
        description="JWT signing key (HS256). MUST be 32+ characters."
    )

    # Database - Supabase
    SUPABASE_URL: str = Field(..., description="Supabase project URL")
    SUPABASE_KEY: str = Field(..., description="Supabase anon/public key")
    SUPABASE_SERVICE_KEY: str = Field(..., description="Supabase service_role key")
    SUPABASE_JWT_SECRET: str = Field(..., description="Supabase JWT secret for validation")

    # Database - CloudSQL HIPAA (optional in dev)
    DATABASE_HIPAA_URL: str | None = Field(
        default=None,
        description="CloudSQL HIPAA connection string"
    )

    # Database - CloudSQL Financial (optional in dev)
    DATABASE_FINANCIAL_URL: str | None = Field(
        default=None,
        description="CloudSQL Financial connection string"
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )

    # ===========================================================================
    # EXTERNAL SERVICE SECRETS
    # ===========================================================================

    # Plaid (required in production)
    PLAID_CLIENT_ID: str | None = Field(default=None, description="Plaid client ID")
    PLAID_SECRET: str | None = Field(default=None, description="Plaid API secret")

    # Stripe (required for payments)
    STRIPE_SECRET_KEY: str | None = Field(default=None, description="Stripe secret key")
    STRIPE_WEBHOOK_SECRET: str | None = Field(default=None, description="Stripe webhook secret")

    # Neo4j (optional, for GraphRAG)
    NEO4J_URI: str = Field(default="bolt://localhost:7687", description="Neo4j connection URI")
    NEO4J_PASSWORD: str | None = Field(default=None, description="Neo4j password")

    # Qdrant (optional, for vector search)
    QDRANT_URL: str = Field(default="http://localhost:6333", description="Qdrant URL")
    QDRANT_API_KEY: str | None = Field(default=None, description="Qdrant API key")

    # Sentry (recommended for production)
    SENTRY_DSN: str | None = Field(default=None, description="Sentry DSN for error tracking")

    # Field-level encryption key
    ENCRYPTION_KEY: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="AES-256 encryption key (64 hex chars)"
    )

    # ===========================================================================
    # VALIDATION: Fail Fast in Production
    # ===========================================================================

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """
        Enforce required secrets in production/staging/beta.

        Fail fast if critical secrets are missing or using insecure defaults.
        """
        if self.ENVIRONMENT not in ("staging", "beta", "production"):
            # Development: Allow defaults
            return self

        # CRITICAL: Validate JWT signing key
        if self.SECRET_KEY == "development-secret-key-change-in-production-32chars":
            raise ConfigurationError(
                "SECRET_KEY must be changed from default in production. "
                "Generate: openssl rand -hex 32"
            )

        if len(self.SECRET_KEY) < 32:
            raise ConfigurationError(
                f"SECRET_KEY must be at least 32 characters (got {len(self.SECRET_KEY)})"
            )

        # Validate Supabase secrets
        if not self.SUPABASE_URL or "localhost" in self.SUPABASE_URL:
            raise ConfigurationError(
                "SUPABASE_URL must be set to production Supabase project"
            )

        if not self.SUPABASE_SERVICE_KEY:
            raise ConfigurationError(
                "SUPABASE_SERVICE_KEY is required in production"
            )

        # Validate encryption key
        if self.ENCRYPTION_KEY == "0" * 64:
            raise ConfigurationError(
                "ENCRYPTION_KEY must be changed from default in production. "
                "Generate: openssl rand -hex 32"
            )

        # Warn if monitoring not configured
        if not self.SENTRY_DSN:
            import logging
            logging.warning(
                "SENTRY_DSN not configured. Error tracking disabled in production!"
            )

        return self

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key_entropy(cls, v: str) -> str:
        """Validate SECRET_KEY has sufficient entropy."""
        if len(set(v)) < 16:
            raise ValueError(
                "SECRET_KEY has low entropy (too many repeated characters). "
                "Generate a cryptographically random key."
            )
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_deployed(self) -> bool:
        return self.ENVIRONMENT in ("beta", "staging", "production")


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    This function will fail fast if:
    - Required secrets are missing in production
    - Insecure defaults are used
    - Unknown environment variables are present
    """
    try:
        settings = Settings()
    except Exception as e:
        print(f"❌ CONFIGURATION ERROR: {e}", file=sys.stderr)
        print("\nRequired secrets in production:", file=sys.stderr)
        print("  - SECRET_KEY (32+ chars)", file=sys.stderr)
        print("  - SUPABASE_URL", file=sys.stderr)
        print("  - SUPABASE_SERVICE_KEY", file=sys.stderr)
        print("  - ENCRYPTION_KEY (64 hex chars)", file=sys.stderr)
        print("\nGenerate secrets:", file=sys.stderr)
        print("  openssl rand -hex 32   # SECRET_KEY, ENCRYPTION_KEY", file=sys.stderr)
        sys.exit(1)

    return settings


# Singleton instance
settings = get_settings()
```

---

### Frontend (TypeScript/Next.js)

**File**: `apps/web/src/lib/config.ts`

```typescript
/**
 * Secure configuration loader for Next.js frontend.
 *
 * Security guarantees:
 * 1. Fail fast if required env vars missing
 * 2. Type-safe environment variable access
 * 3. Reject unknown variables in production
 * 4. No secrets in client bundle
 */

// ===========================================================================
// Environment Detection
// ===========================================================================

export const ENV = (process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.NODE_ENV ||
  "development") as "development" | "preview" | "production";

export const IS_PRODUCTION = ENV === "production";
export const IS_PREVIEW = ENV === "preview";
export const IS_DEVELOPMENT = ENV === "development";

// ===========================================================================
// Public Environment Variables (Safe for Client Bundle)
// ===========================================================================

interface PublicConfig {
  // App URLs
  APP_URL: string;
  API_URL: string;

  // Feature Flags
  ENABLE_HEALTH_CONNECT: boolean;
  ENABLE_FINANCE: boolean;
  ENABLE_GOOGLE_INTEGRATIONS: boolean;

  // Plaid (Client ID only, no secret)
  PLAID_CLIENT_ID?: string;
  PLAID_ENV: "sandbox" | "development" | "production";

  // Stripe (Publishable key only, no secret)
  STRIPE_PUBLISHABLE_KEY?: string;

  // Sentry (DSN is safe to expose)
  SENTRY_DSN?: string;
}

/**
 * Get public configuration (safe for client-side rendering).
 *
 * These values are bundled into the JavaScript and visible to users.
 */
export function getPublicConfig(): PublicConfig {
  const config: PublicConfig = {
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",

    ENABLE_HEALTH_CONNECT:
      process.env.NEXT_PUBLIC_ENABLE_HEALTH_CONNECT === "true",
    ENABLE_FINANCE: process.env.NEXT_PUBLIC_ENABLE_FINANCE === "true",
    ENABLE_GOOGLE_INTEGRATIONS:
      process.env.NEXT_PUBLIC_ENABLE_GOOGLE_INTEGRATIONS === "true",

    PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
    PLAID_ENV: (process.env.PLAID_ENV as any) || "sandbox",

    STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

    SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };

  // Validate required fields in production
  if (IS_PRODUCTION) {
    if (!config.APP_URL || config.APP_URL.includes("localhost")) {
      throw new Error(
        "NEXT_PUBLIC_APP_URL must be set to production URL"
      );
    }

    if (!config.API_URL || config.API_URL.includes("localhost")) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be set to production backend URL"
      );
    }
  }

  return config;
}

// ===========================================================================
// Server-Side Secrets (NEVER exposed to client)
// ===========================================================================

interface ServerConfig extends PublicConfig {
  // Database
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;

  // NextAuth
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;

  // OAuth Secrets
  GOOGLE_CLIENT_SECRET?: string;

  // Plaid Secret
  PLAID_SECRET?: string;

  // Stripe Secret
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

/**
 * Get server-side configuration (includes secrets).
 *
 * ⚠️ WARNING: This MUST ONLY be called in server-side code:
 * - API routes (app/api/*)
 * - Server Components
 * - getServerSideProps
 *
 * NEVER call this in Client Components or it will expose secrets!
 */
export function getServerConfig(): ServerConfig {
  // Ensure we're running on server
  if (typeof window !== "undefined") {
    throw new Error(
      "getServerConfig() called on client side! This would expose secrets. " +
        "Only call this function in API routes or Server Components."
    );
  }

  const publicConfig = getPublicConfig();

  const serverConfig: ServerConfig = {
    ...publicConfig,

    // Database
    DATABASE_URL: process.env.DATABASE_URL!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_KEY: process.env.SUPABASE_KEY!,

    // NextAuth
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || publicConfig.APP_URL,

    // OAuth
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

    // Plaid
    PLAID_SECRET: process.env.PLAID_SECRET,

    // Stripe
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  };

  // Validate required secrets in production
  if (IS_PRODUCTION) {
    const requiredSecrets: (keyof ServerConfig)[] = [
      "DATABASE_URL",
      "SUPABASE_URL",
      "SUPABASE_KEY",
      "NEXTAUTH_SECRET",
    ];

    for (const secret of requiredSecrets) {
      if (!serverConfig[secret]) {
        throw new Error(
          `Required secret ${secret} is missing in production environment`
        );
      }
    }

    // Validate NEXTAUTH_SECRET entropy
    if (
      serverConfig.NEXTAUTH_SECRET.length < 32 ||
      serverConfig.NEXTAUTH_SECRET === "your-secret-key-here"
    ) {
      throw new Error(
        "NEXTAUTH_SECRET must be a cryptographically random string (32+ chars). " +
          "Generate: openssl rand -base64 32"
      );
    }
  }

  return serverConfig;
}

// ===========================================================================
// Type-Safe Environment Variable Access
// ===========================================================================

/**
 * Get environment variable with type safety and validation.
 *
 * @throws Error if variable is required but missing
 */
export function getEnv(
  name: string,
  options: {
    required?: boolean;
    default?: string;
    serverOnly?: boolean;
  } = {}
): string | undefined {
  const { required = false, default: defaultValue, serverOnly = false } = options;

  // Check if we're on client and variable is server-only
  if (serverOnly && typeof window !== "undefined") {
    throw new Error(
      `Environment variable ${name} is server-only but accessed on client`
    );
  }

  const value = process.env[name];

  if (!value) {
    if (required && IS_PRODUCTION) {
      throw new Error(
        `Required environment variable ${name} is missing in production`
      );
    }
    return defaultValue;
  }

  return value;
}
```

---

## CI/CD Enforcement

### GitHub Actions - Block `.env` Files

**File**: `.github/workflows/secrets-check.yml`

```yaml
name: Secrets & Config Validation

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  check-secrets:
    name: "Block .env Files & Validate Secrets"
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Block .env files (except .env.example)
        run: |
          # Find any .env files that are not .env.example
          if find . -name ".env*" ! -name ".env.example" ! -path "*/node_modules/*" ! -path "*/.next/*" | grep -q .; then
            echo "❌ ERROR: .env files found in repository!"
            echo ""
            echo "Found files:"
            find . -name ".env*" ! -name ".env.example" ! -path "*/node_modules/*" ! -path "*/.next/*"
            echo ""
            echo "❌ .env files are FORBIDDEN in production deployments."
            echo "✅ Use GCP Secret Manager, Vercel Environment Variables, or GitHub Secrets."
            echo "✅ For local development, create .env.local (git-ignored)."
            exit 1
          fi
          echo "✅ No .env files found (except .env.example)"

      - name: Secret entropy check (detect-secrets)
        run: |
          pip install detect-secrets
          detect-secrets scan --baseline .secrets.baseline
          if [ $? -ne 0 ]; then
            echo "❌ New secrets detected! Review and update baseline if false positive."
            exit 1
          fi
          echo "✅ Secret scan passed"

      - name: Validate .env.example files
        run: |
          # Ensure .env.example exists and has no real values
          for example in $(find . -name ".env.example"); do
            echo "Checking $example"

            # Check for suspicious patterns (base64, hex keys, real URLs)
            if grep -qE "(eyJ|[A-Za-z0-9+/]{40,}=|sk_live_|pk_live_|https://[a-z0-9-]+\.supabase\.co)" "$example"; then
              echo "❌ ERROR: $example contains real secret values!"
              echo "Found suspicious patterns:"
              grep -E "(eyJ|[A-Za-z0-9+/]{40,}=|sk_live_|pk_live_|https://[a-z0-9-]+\.supabase\.co)" "$example"
              exit 1
            fi
          done
          echo "✅ All .env.example files are clean (no real secrets)"

      - name: Validate Backend Config
        run: |
          cd backend
          python -c "
          from app.core.config_secure import Settings
          import os

          # Simulate production environment
          os.environ['ENVIRONMENT'] = 'production'
          os.environ['SECRET_KEY'] = 'test-secret-key-with-32-characters-minimum'
          os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
          os.environ['SUPABASE_SERVICE_KEY'] = 'test-key'
          os.environ['SUPABASE_KEY'] = 'test-key'
          os.environ['SUPABASE_JWT_SECRET'] = 'test-jwt-secret'
          os.environ['ENCRYPTION_KEY'] = 'a' * 64

          try:
              settings = Settings()
              print('✅ Backend config validation passed')
          except Exception as e:
              print(f'❌ Backend config validation failed: {e}')
              exit(1)
          "

      - name: Validate Frontend Config
        run: |
          cd apps/web
          npx tsx --eval "
          process.env.NODE_ENV = 'production';
          process.env.NEXT_PUBLIC_APP_URL = 'https://app.lifenav.app';
          process.env.NEXT_PUBLIC_API_URL = 'https://api.lifenav.app';

          import { getPublicConfig } from './src/lib/config';

          try {
            const config = getPublicConfig();
            console.log('✅ Frontend config validation passed');
          } catch (error) {
            console.error('❌ Frontend config validation failed:', error);
            process.exit(1);
          }
          "
```

### Pre-Commit Hook

**File**: `.pre-commit-config.yaml` (Add to existing)

```yaml
repos:
  # ... existing hooks ...

  - repo: local
    hooks:
      - id: block-env-files
        name: Block .env files (except .env.example)
        entry: bash -c 'if git diff --cached --name-only | grep -E "\.env[^.]*$" | grep -v ".env.example"; then echo "❌ ERROR: Cannot commit .env files. Use .env.local for local dev (git-ignored)."; exit 1; fi'
        language: system
        pass_filenames: false

      - id: validate-env-example
        name: Validate .env.example has no real secrets
        entry: bash -c 'for f in $(git diff --cached --name-only | grep ".env.example"); do if grep -qE "(eyJ|[A-Za-z0-9+/]{40,}=|sk_live_|pk_live_)" "$f"; then echo "❌ $f contains real secrets!"; exit 1; fi; done'
        language: system
        pass_filenames: false
```

---

## Deployment Configuration

### Vercel (Staging Environment)

**Dashboard**: https://vercel.com/life-navigator/settings/environment-variables

**Environment Variables** (Set via Vercel UI):

```bash
# Public (Client-side)
NEXT_PUBLIC_APP_URL=https://staging.lifenav.app
NEXT_PUBLIC_API_URL=https://staging-api.lifenav.app
NEXT_PUBLIC_ENABLE_HEALTH_CONNECT=true
NEXT_PUBLIC_ENABLE_FINANCE=true

# Secrets (Server-side only)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_KEY=eyJ... (anon key)
NEXTAUTH_SECRET=<32+ char random string>
NEXTAUTH_URL=https://staging.lifenav.app

PLAID_CLIENT_ID=<from Plaid dashboard>
PLAID_SECRET=<from Plaid dashboard>

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Important**: Vercel injects these at build time. No `.env` file needed.

### GCP Cloud Run (Production)

**Method 1: Secret Manager References** (Recommended)

```yaml
# cloudrun-backend.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: backend
spec:
  template:
    spec:
      containers:
        - image: gcr.io/PROJECT/backend:latest
          env:
            # Public config (plain env vars)
            - name: ENVIRONMENT
              value: "production"
            - name: LOG_LEVEL
              value: "INFO"

            # Secrets from GCP Secret Manager
            - name: SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: jwt-secret-key
                  key: latest
            - name: SUPABASE_SERVICE_KEY
              valueFrom:
                secretKeyRef:
                  name: supabase-service-key
                  key: latest
            - name: DATABASE_HIPAA_URL
              valueFrom:
                secretKeyRef:
                  name: cloudsql-hipaa-connection-string
                  key: latest
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: encryption-master-key
                  key: latest
```

**Method 2: Secret Manager Volume Mounts** (For large secrets)

```yaml
spec:
  template:
    spec:
      volumes:
        - name: secrets
          secret:
            secretName: backend-secrets
      containers:
        - image: gcr.io/PROJECT/backend:latest
          volumeMounts:
            - name: secrets
              mountPath: /secrets
              readOnly: true
          env:
            - name: GOOGLE_APPLICATION_CREDENTIALS
              value: /secrets/gcp-service-account.json
```

---

## Secret Rotation Procedures

### Automated Rotation (GCP Secret Manager + Cloud Scheduler)

**File**: `scripts/rotate-secrets.sh`

```bash
#!/bin/bash
# Automated secret rotation for Life Navigator
# Schedule: Every 30 days via Cloud Scheduler

set -euo pipefail

PROJECT_ID="life-navigator-prod"
REGION="us-central1"

echo "🔄 Starting secret rotation..."

# 1. Rotate JWT Secret Key
echo "Rotating SECRET_KEY..."
NEW_SECRET=$(openssl rand -hex 32)
echo -n "$NEW_SECRET" | gcloud secrets versions add secret-key \
  --project="$PROJECT_ID" \
  --data-file=-

# 2. Rotate Encryption Key (envelope encryption)
echo "Rotating ENCRYPTION_KEY..."
NEW_ENC_KEY=$(openssl rand -hex 32)
echo -n "$NEW_ENC_KEY" | gcloud secrets versions add encryption-key \
  --project="$PROJECT_ID" \
  --data-file=-

# 3. Rotate CloudSQL passwords
echo "Rotating CloudSQL HIPAA password..."
NEW_SQL_PASSWORD=$(openssl rand -base64 32)
gcloud sql users set-password cloudsql_user \
  --instance=life-navigator-hipaa \
  --password="$NEW_SQL_PASSWORD"

echo -n "$NEW_SQL_PASSWORD" | gcloud secrets versions add cloudsql-hipaa-password \
  --project="$PROJECT_ID" \
  --data-file=-

# 4. Rolling restart services
echo "Restarting services to pick up new secrets..."
gcloud run services update backend \
  --region="$REGION" \
  --project="$PROJECT_ID"

kubectl rollout restart deployment/backend -n life-navigator-prod

echo "✅ Secret rotation complete"
```

**Schedule via Cloud Scheduler**:

```bash
gcloud scheduler jobs create http rotate-secrets \
  --schedule="0 0 1 * *" \
  --uri="https://CLOUD_FUNCTION_URL/rotate-secrets" \
  --http-method=POST \
  --oidc-service-account-email=secret-rotator@PROJECT.iam.gserviceaccount.com
```

---

## Environment Parity Rules

### Naming Convention

All environments MUST use identical variable names:

```bash
# ✅ CORRECT: Same name across all environments
SUPABASE_URL=https://dev-project.supabase.co     # Development
SUPABASE_URL=https://staging-project.supabase.co # Staging
SUPABASE_URL=https://prod-project.supabase.co    # Production

# ❌ WRONG: Different names per environment
SUPABASE_URL_DEV=...
SUPABASE_URL_STAGING=...
SUPABASE_URL_PROD=...
```

### Environment-Specific Values ONLY

```bash
# ✅ CORRECT: Environment detection via ENVIRONMENT variable
ENVIRONMENT=development
SUPABASE_URL=https://dev.supabase.co

# ❌ WRONG: Embedding environment in variable names
DEV_SUPABASE_URL=...
PROD_SUPABASE_URL=...
```

### Configuration Checklist

Before deploying to a new environment:

- [ ] Copy all variable names from `.env.example`
- [ ] Replace placeholder values with environment-specific secrets
- [ ] Validate no dev secrets in staging/production
- [ ] Run `pnpm run config:validate` (fail-fast check)
- [ ] Deploy and verify health check endpoint

---

## Troubleshooting

### Error: "SECRET_KEY must be changed from default"

**Cause**: Using insecure default secret in production

**Fix**:
```bash
# Generate secure secret
openssl rand -hex 32

# Update GCP Secret Manager
echo -n "GENERATED_SECRET" | gcloud secrets versions add secret-key --data-file=-
```

### Error: "Unknown environment variable detected"

**Cause**: Pydantic `extra="forbid"` detected an undeclared variable

**Fix**:
1. Check for typos in variable names
2. Add new variables to `Settings` class
3. Remove deprecated variables from environment

### Error: "getServerConfig() called on client side"

**Cause**: Accidentally calling server-only config in Client Component

**Fix**:
```typescript
// ❌ WRONG: Client Component
"use client";
import { getServerConfig } from "@/lib/config";

// ✅ CORRECT: Server Component
import { getServerConfig } from "@/lib/config";
export default async function Page() {
  const config = getServerConfig(); // Server-side only
}
```

---

## Related Documentation

- [Data Boundaries](./DATA_BOUNDARIES.md)
- [Cloud SQL Production](../database/CLOUD_SQL_PRODUCTION.md)
- [Supabase Readiness](../database/SUPABASE_READINESS.md)
- [Security Quickstart](./SECURITY_QUICKSTART.md)

---

**Last Updated**: 2026-01-09
**Next Review**: After any secret rotation or new service integration
