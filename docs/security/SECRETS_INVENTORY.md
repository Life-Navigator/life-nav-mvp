# Secrets Inventory - Production Configuration

**Last Updated**: 2026-01-09
**Status**: Production Ready
**Owner**: Platform Engineering

---

## Overview

This document catalogs all secrets used across the Life Navigator platform, their storage locations, consuming services, and rotation policies. **No `.env` files are used in production runtime.**

## Secret Storage Strategy

| Environment | Storage Location | Access Method |
|------------|------------------|---------------|
| **Local Dev** | `.env.local` (gitignored) | Direct file read |
| **CI/CD** | GitHub Actions Secrets | `${{ secrets.SECRET_NAME }}` |
| **Vercel (Frontend)** | Vercel Environment Variables | Runtime env vars |
| **GCP (Backend)** | GCP Secret Manager | Application Default Credentials |
| **Supabase** | Supabase Dashboard | Database native secrets |

---

## Secret Categories

### 1. Database Credentials

#### Supabase (Primary Database)
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `SUPABASE_URL` | Vercel + GCP SM | Backend, Frontend | N/A | Public endpoint |
| `SUPABASE_KEY` | Vercel (public) | Frontend | 90 days | Anon/public key |
| `SUPABASE_SERVICE_KEY` | GCP SM + GitHub | Backend | 90 days | Admin operations |
| `SUPABASE_JWT_SECRET` | GCP SM | Backend | 90 days | JWT verification |

**Local Dev Fallback**: Use Supabase project-specific `.env.local` with test credentials

#### CloudSQL HIPAA Database
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `DATABASE_HIPAA_URL` | GCP SM | Backend | 30 days | Private IP connection |
| `CLOUDSQL_HIPAA_INSTANCE` | GCP SM | Backend | N/A | Instance connection name |

**Local Dev Fallback**: Use local PostgreSQL or Supabase dev instance

#### CloudSQL Financial Database
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `DATABASE_FINANCIAL_URL` | GCP SM | Backend | 30 days | Private IP connection |
| `CLOUDSQL_FINANCIAL_INSTANCE` | GCP SM | Backend | N/A | Instance connection name |

**Local Dev Fallback**: Use local PostgreSQL or Supabase dev instance

### 2. Authentication & Security

| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `SECRET_KEY` | GCP SM + GitHub | Backend | 90 days | JWT signing (64-char hex) |
| `ENCRYPTION_KEY` | GCP SM | Backend | 90 days | Field-level encryption (64-char hex) |
| `NEXTAUTH_SECRET` | Vercel | Frontend | 90 days | NextAuth session signing |
| `NEXTAUTH_URL` | Vercel | Frontend | N/A | Deployment URL |

**Local Dev Fallback**: Use development keys from `.env.example` (never production keys)

### 3. External Service Integrations

#### Plaid (Financial Data)
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `PLAID_CLIENT_ID` | GCP SM + Vercel | Backend, Frontend | Manual | From Plaid dashboard |
| `PLAID_SECRET` | GCP SM | Backend | Manual | Keep in sync with Plaid |
| `PLAID_WEBHOOK_SECRET` | GCP SM | Backend | Manual | Webhook signature verification |

**Local Dev Fallback**: Use Plaid sandbox credentials from `.env.local`

#### Stripe (Payments)
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `STRIPE_API_KEY` | GCP SM | Backend | Manual | Secret key (sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | GCP SM | Backend | Manual | Webhook signature |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel | Frontend | Manual | Public key (pk_live_...) |

**Local Dev Fallback**: Use Stripe test mode keys

#### Google OAuth
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `GOOGLE_CLIENT_ID` | Vercel + GCP SM | Frontend, Backend | Manual | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | GCP SM | Backend | Manual | OAuth client secret |

**Local Dev Fallback**: Create separate OAuth app for localhost

### 4. Infrastructure

#### Redis Cache
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `REDIS_URL` | GCP SM | Backend | Manual | Connection string |
| `REDIS_PASSWORD` | GCP SM | Backend | 90 days | If AUTH enabled |

**Local Dev Fallback**: Use local Redis without auth (`redis://localhost:6379/0`)

#### Qdrant Vector Database
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `QDRANT_URL` | GCP SM | Backend | N/A | Cluster endpoint |
| `QDRANT_API_KEY` | GCP SM | Backend | 90 days | API key |

**Local Dev Fallback**: Use local Qdrant or mock client

#### Neo4j Knowledge Graph
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `NEO4J_URI` | GCP SM | Backend | N/A | Bolt connection URI |
| `NEO4J_PASSWORD` | GCP SM | Backend | 90 days | Database password |

**Local Dev Fallback**: Use local Neo4j or skip graph features

### 5. Monitoring & Observability

#### Sentry (Error Tracking)
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `SENTRY_DSN` | Vercel + GCP SM | Frontend, Backend | Manual | Public DSN |
| `SENTRY_AUTH_TOKEN` | GitHub | CI/CD | Manual | For source maps |

**Local Dev Fallback**: Skip Sentry or use dev project

#### OpenTelemetry
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | GCP SM | Backend | N/A | Collector endpoint |

**Local Dev Fallback**: Use local collector or disable

### 6. Email & SMS

#### Resend (Email)
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `RESEND_API_KEY` | GCP SM | Backend | 90 days | API key |

**Local Dev Fallback**: Use test mode or log emails to console

#### Twilio (SMS)
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `TWILIO_ACCOUNT_SID` | GCP SM | Backend | Manual | Account identifier |
| `TWILIO_AUTH_TOKEN` | GCP SM | Backend | 90 days | Auth token |
| `TWILIO_FROM_NUMBER` | GCP SM | Backend | N/A | Verified phone number |

**Local Dev Fallback**: Use Twilio test credentials

### 7. Storage

#### Google Cloud Storage
| Secret Name | Storage | Consumed By | Rotation | Notes |
|------------|---------|-------------|----------|-------|
| `GCS_BUCKET_NAME` | GCP SM | Backend | N/A | Bucket name |
| `GCS_PROJECT_ID` | GCP SM | Backend | N/A | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Workload Identity | Backend | Automatic | Service account key (GKE only) |

**Local Dev Fallback**: Use local filesystem storage (`STORAGE_PROVIDER=local`)

---

## Secret Rotation Schedule

| Frequency | Secrets | Method |
|-----------|---------|--------|
| **30 days** | Database passwords (CloudSQL) | `gcloud sql users set-password` |
| **90 days** | JWT keys, encryption keys, API keys | GCP Secret Manager versioning + rolling restart |
| **Manual** | External service keys (Plaid, Stripe, OAuth) | Update in service dashboard + GCP SM |
| **Automatic** | GKE Service Account tokens | Workload Identity auto-rotation |

### Rotation Procedure

1. **Generate New Secret**:
   ```bash
   # Example: Rotate SECRET_KEY
   NEW_KEY=$(openssl rand -hex 32)
   echo -n "$NEW_KEY" | gcloud secrets versions add SECRET_KEY --data-file=-
   ```

2. **Update Application**:
   ```bash
   # Backend (Cloud Run)
   gcloud run services update life-navigator-backend \
     --update-secrets=SECRET_KEY=SECRET_KEY:latest \
     --region=us-central1

   # Frontend (Vercel)
   vercel env add SECRET_KEY production
   ```

3. **Verify**:
   ```bash
   # Test with new secret
   curl -H "Authorization: Bearer $NEW_JWT" https://api.life-navigator.com/health
   ```

4. **Revoke Old Secret**:
   ```bash
   # Disable previous version after 7 days grace period
   gcloud secrets versions disable 1 --secret=SECRET_KEY
   ```

---

## CI/CD Secret Requirements

### GitHub Actions Secrets

Required for all workflows:

```yaml
# Backend deployment
GCP_PROJECT_ID: life-navigator-prod
GCP_SERVICE_ACCOUNT_KEY: <base64-encoded-json>
GCP_REGION: us-central1

# Frontend deployment
VERCEL_TOKEN: <vercel-api-token>
VERCEL_ORG_ID: <vercel-org-id>
VERCEL_PROJECT_ID: <vercel-project-id>

# Sentry source maps
SENTRY_AUTH_TOKEN: <sentry-token>
SENTRY_ORG: life-navigator
SENTRY_PROJECT: backend

# Database migrations
DATABASE_URL: <ci-test-database-url>
```

### Vercel Environment Variables

Required for frontend runtime:

```bash
# Public (NEXT_PUBLIC_* prefix)
NEXT_PUBLIC_API_URL=https://api.life-navigator.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PLAID_ENV=production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Private (server-side only)
NEXTAUTH_SECRET=<64-char-hex>
NEXTAUTH_URL=https://app.life-navigator.com
SUPABASE_SERVICE_KEY=<service-role-key>
DATABASE_URL=<vercel-postgres-url>
```

### GCP Secret Manager

Backend runtime secrets (accessed via Application Default Credentials):

```bash
# Create secrets
gcloud secrets create SECRET_KEY --data-file=-
gcloud secrets create DATABASE_HIPAA_URL --data-file=-
gcloud secrets create DATABASE_FINANCIAL_URL --data-file=-
gcloud secrets create ENCRYPTION_KEY --data-file=-
gcloud secrets create PLAID_SECRET --data-file=-
gcloud secrets create STRIPE_API_KEY --data-file=-

# Grant access to Cloud Run service account
gcloud secrets add-iam-policy-binding SECRET_KEY \
  --member="serviceAccount:backend@life-navigator-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Local Development Setup

### Backend

1. **Copy example env**:
   ```bash
   cd backend
   cp .env.example .env.local
   ```

2. **Update with dev credentials**:
   ```bash
   # Use local services
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifenavigator_dev
   REDIS_URL=redis://localhost:6379/0

   # Use sandbox/test external services
   PLAID_ENV=sandbox
   STRIPE_API_KEY=sk_test_...

   # Generate dev keys
   SECRET_KEY=$(openssl rand -hex 32)
   ENCRYPTION_KEY=$(openssl rand -hex 32)
   ```

3. **Never commit `.env.local`**:
   ```bash
   # Already in .gitignore
   echo ".env.local" >> .gitignore
   ```

### Frontend

1. **Copy example env**:
   ```bash
   cd apps/web
   cp .env.example .env.local
   ```

2. **Update with dev credentials**:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   NEXTAUTH_SECRET=$(openssl rand -hex 32)
   NEXTAUTH_URL=http://localhost:3000
   ```

---

## Production Deployment Checklist

- [ ] All secrets exist in GCP Secret Manager
- [ ] Cloud Run service account has `secretAccessor` role
- [ ] Vercel environment variables configured
- [ ] GitHub Actions secrets configured
- [ ] No `.env` files in production build artifacts
- [ ] CI enforces "no .env" rule
- [ ] Rotation schedule documented and automated
- [ ] Emergency rotation procedure tested
- [ ] Secrets never logged or printed

---

## Security Best Practices

1. **Never commit secrets to git** (use `.gitignore`)
2. **Use separate secrets for each environment** (dev, staging, prod)
3. **Rotate secrets regularly** (30-90 days)
4. **Use short-lived tokens where possible** (JWT, OAuth)
5. **Grant least-privilege access** (IAM roles)
6. **Monitor secret access** (Cloud Audit Logs)
7. **Encrypt secrets at rest** (GCP SM auto-encrypts)
8. **Use Workload Identity** (no service account JSON files)

---

## Emergency Secret Rotation

If a secret is compromised:

1. **Immediate**:
   ```bash
   # Revoke compromised secret
   gcloud secrets versions disable <version> --secret=<name>
   ```

2. **Within 1 hour**:
   ```bash
   # Generate new secret
   NEW_SECRET=$(openssl rand -hex 32)
   echo -n "$NEW_SECRET" | gcloud secrets versions add <name> --data-file=-

   # Rolling restart
   gcloud run services update life-navigator-backend \
     --update-secrets=<name>=<name>:latest
   ```

3. **Within 24 hours**:
   - Audit all access logs
   - Notify security team
   - Update incident response docs

---

## References

- [GCP Secret Manager Docs](https://cloud.google.com/secret-manager/docs)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
