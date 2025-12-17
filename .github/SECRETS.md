# GitHub Actions Secrets Configuration

This document lists all required secrets for CI/CD pipelines.

## Required Secrets

### GCP Infrastructure
| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `GCP_PROJECT_ID` | Google Cloud Project ID (e.g., `lifenav-prod`) | All deployments |
| `GCP_SA_KEY` | Service Account JSON key for GCP authentication | All GCP operations |
| `GKE_CLUSTER_NAME` | GKE cluster name | K8s deployments |

### Application Secrets (Production)
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SECRET_KEY` | JWT signing key (min 32 chars) | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | AES-256 encryption key (64 hex chars) | `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://user:pass@host:6379/0` |

### Third-Party Services
| Secret Name | Description | Required |
|-------------|-------------|----------|
| `SENTRY_DSN` | Sentry error tracking DSN | Recommended |
| `RESEND_API_KEY` | Resend email service API key | For emails |
| `OPENAI_API_KEY` | OpenAI API key for embeddings/LLM | For AI features |
| `PLAID_CLIENT_ID` | Plaid financial data API | For banking |
| `PLAID_SECRET` | Plaid API secret | For banking |
| `STRIPE_API_KEY` | Stripe payments API key | For payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | For payments |

### OAuth Providers (Optional)
| Secret Name | Description |
|-------------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth secret |

### Cloud Storage
| Secret Name | Description |
|-------------|-------------|
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket name |
| `STORAGE_PROVIDER` | Storage provider (`gcs`, `s3`, or `local`) |

### OCR Processing (Google Cloud Vision)
| Secret Name | Description |
|-------------|-------------|
| `GOOGLE_CLOUD_VISION_ENABLED` | Enable OCR processing (`true`) |
| `GCP_VISION_SA_KEY` | Service account key for Vision API (can use same as `GCP_SA_KEY`) |

## Setting Secrets via GitHub CLI

```bash
# Set a secret
gh secret set SECRET_NAME --body "secret_value"

# Set from file
gh secret set GCP_SA_KEY < service-account-key.json

# List existing secrets
gh secret list
```

## Setting Secrets via GitHub UI

1. Go to repository Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Enter name and value
4. Click "Add secret"

## Environment-Specific Secrets

For environment-specific secrets, use GitHub Environments:

- **Production**: `prod` environment with required reviewers
- **Staging**: `staging` environment
- **Development**: `dev` environment

## Generating Secure Values

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate ENCRYPTION_KEY (64 hex chars = 32 bytes)
openssl rand -hex 32

# Generate random password
openssl rand -base64 24
```

## Verification Checklist

Before launching, verify these secrets are set:

- [ ] `GCP_PROJECT_ID`
- [ ] `GCP_SA_KEY`
- [ ] `SECRET_KEY` (NOT the default value)
- [ ] `ENCRYPTION_KEY` (NOT all zeros)
- [ ] `DATABASE_URL` (NOT localhost)
- [ ] `REDIS_URL` (NOT localhost for production)
- [ ] `SENTRY_DSN` (recommended)
- [ ] `RESEND_API_KEY` (if using email)
- [ ] `OPENAI_API_KEY` (if using AI features)
