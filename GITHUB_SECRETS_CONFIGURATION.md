# GitHub Secrets Configuration Guide

## Overview

This guide provides complete instructions for configuring GitHub Secrets for the Life Navigator monorepo. We use GitHub Secrets instead of GCP Secret Manager for CI/CD, development, and production environments.

**Date**: January 20, 2025
**Security Level**: Enterprise Grade

---

## Why GitHub Secrets?

✅ **Centralized Management**: All secrets in one place
✅ **Environment-Specific**: Separate dev/staging/prod secrets
✅ **Encrypted at Rest**: GitHub encrypts all secrets
✅ **Audit Trail**: Full history of secret access
✅ **Easy Rotation**: Update secrets without touching code
✅ **CI/CD Integration**: Automatic injection into workflows

---

## Secret Organization Strategy

### 1. Repository Secrets (Development & CI/CD)
Used for local development and CI/CD pipelines.

### 2. Environment Secrets (Production/Staging)
Used for production and staging deployments with approval workflows.

### 3. Organization Secrets (Optional)
Shared across multiple repositories.

---

## Complete Secrets List

### Core Application Secrets

#### **SECRET_KEY** (Required)
**Purpose**: JWT signing, encryption, CSRF protection
**Generation**:
```bash
openssl rand -hex 32
```
**Format**: 64-character hex string
**Example**: `a1b2c3d4e5f6...` (64 chars)
**Environments**: ALL

#### **DATABASE_URL** (Required)
**Purpose**: PostgreSQL connection string
**Format**: `postgresql://user:password@host:port/database`
**Example Dev**: `postgresql://lifenavigator:dev_password@localhost:5432/lifenavigator`
**Example Prod**: `postgresql://lifenavigator:STRONG_PASSWORD@db.example.com:5432/lifenavigator_prod`
**Environments**: ALL

---

### Email Service (Resend)

####  **RESEND_API_KEY** (Required for email)
**Purpose**: Transactional email delivery
**How to Get**:
1. Go to [resend.com](https://resend.com)
2. Sign up / log in
3. Navigate to API Keys
4. Create new API key with permissions: `emails:send`
5. Copy key (starts with `re_`)

**Format**: `re_xxxxxxxxxx...`
**Example**: `re_123abc456def789ghi`
**Environments**: ALL
**Testing**: Use same key for dev/staging, separate for prod

---

### Database Connections

#### **REDIS_URL** (Required)
**Purpose**: Caching, session storage, Celery broker
**Format**: `redis://[:password@]host:port/db`
**Example Dev**: `redis://localhost:6379/0`
**Example Prod**: `redis://:REDIS_PASSWORD@redis.example.com:6379/0`
**Environments**: ALL

#### **NEO4J_URI** (Required for GraphRAG)
**Format**: `bolt://host:port` or `neo4j://host:port`
**Example**: `bolt://localhost:7687`
**Environments**: ALL

#### **NEO4J_PASSWORD** (Required)
**Format**: Strong password (min 12 chars)
**Example**: `Neo4j_Pr0d_P@ssw0rd`
**Environments**: ALL

---

### External API Keys

#### **RESEND_API_KEY** (Required for emails)
**Service**: Resend email API
**Get from**: [resend.com/api-keys](https://resend.com/api-keys)
**Format**: `re_...`
**Environments**: prod, staging

#### **ANTHROPIC_API_KEY** (Required for AI)
**Service**: Claude AI API
**Get from**: [console.anthropic.com](https://console.anthropic.com)
**Format**: `sk-ant-...`
**Environments**: ALL

#### **OPENAI_API_KEY** (Optional)
**Service**: OpenAI API (backup for Claude)
**Get from**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
**Format**: `sk-...`
**Environments**: ALL

#### **PLAID_CLIENT_ID** (Required for finance)
**Service**: Plaid banking connections
**Get from**: [dashboard.plaid.com/api](https://dashboard.plaid.com/api)
**Format**: UUID format
**Example**: `550e8400-e29b-41d4-a716-446655440000`
**Environments**: ALL

#### **PLAID_SECRET** (Required for finance)
**Service**: Plaid API secret
**Get from**: Same as PLAID_CLIENT_ID
**Format**: UUID format
**Environments**: ALL

#### **STRIPE_API_KEY** (Required for payments)
**Service**: Stripe payments
**Get from**: [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
**Format Dev**: `sk_test_...`
**Format Prod**: `sk_live_...`
**Environments**: ALL

#### **STRIPE_WEBHOOK_SECRET** (Required)
**Service**: Stripe webhook signature verification
**Get from**: Stripe webhook settings
**Format**: `whsec_...`
**Environments**: prod, staging

#### **TWILIO_ACCOUNT_SID** (Optional - SMS)
**Service**: Twilio SMS
**Get from**: [console.twilio.com](https://console.twilio.com)
**Format**: `AC...`
**Environments**: prod

#### **TWILIO_AUTH_TOKEN** (Optional - SMS)
**Service**: Twilio authentication
**Get from**: Same as TWILIO_ACCOUNT_SID
**Format**: 32-character hex
**Environments**: prod

---

### OAuth Providers

#### **GOOGLE_CLIENT_ID** (Optional - OAuth)
**Service**: Google Sign-In
**Get from**: [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
**Format**: `xxxxx.apps.googleusercontent.com`
**Environments**: ALL

#### **GOOGLE_CLIENT_SECRET** (Optional - OAuth)
**Service**: Google OAuth secret
**Get from**: Same as GOOGLE_CLIENT_ID
**Format**: `GOCSPX-...`
**Environments**: ALL

#### **MICROSOFT_CLIENT_ID** (Optional - OAuth)
**Service**: Microsoft/Azure AD Sign-In
**Get from**: [portal.azure.com](https://portal.azure.com)
**Format**: UUID
**Environments**: ALL

#### **MICROSOFT_CLIENT_SECRET** (Optional - OAuth)
**Service**: Microsoft OAuth secret
**Get from**: Same as MICROSOFT_CLIENT_ID
**Format**: Secret value from Azure
**Environments**: ALL

#### **APPLE_CLIENT_ID** (Optional - OAuth)
**Service**: Sign in with Apple
**Get from**: [developer.apple.com](https://developer.apple.com)
**Format**: `com.lifenavigator.service`
**Environments**: ALL

#### **APPLE_CLIENT_SECRET** (Optional - OAuth)
**Service**: Apple OAuth JWT
**Get from**: Generated from Apple private key
**Format**: JWT token
**Environments**: ALL

---

### Monitoring & Observability

#### **SENTRY_DSN** (Required for production)
**Service**: Sentry error tracking
**Get from**: [sentry.io](https://sentry.io) → Project Settings → Client Keys
**Format**: `https://xxxxx@oxxxxxx.ingest.sentry.io/xxxxxxx`
**Environments**: staging, prod

#### **OTEL_EXPORTER_OTLP_ENDPOINT** (Optional)
**Service**: OpenTelemetry collector
**Format**: `https://otel-collector.example.com:4317`
**Default**: `http://localhost:4317`
**Environments**: staging, prod

---

### Cloud Storage (Optional)

#### **GCS_PROJECT_ID** (Optional - Google Cloud Storage)
**Service**: Google Cloud Storage
**Format**: Project ID string
**Environments**: prod

#### **GCS_BUCKET_NAME** (Optional)
**Service**: GCS bucket for file storage
**Format**: Bucket name
**Environments**: prod

#### **AWS_ACCESS_KEY_ID** (Optional - S3)
**Service**: AWS S3 storage
**Format**: `AKIA...`
**Environments**: prod

#### **AWS_SECRET_ACCESS_KEY** (Optional - S3)
**Service**: AWS S3 authentication
**Format**: 40-character base64
**Environments**: prod

#### **S3_BUCKET_NAME** (Optional)
**Service**: S3 bucket for file storage
**Format**: Bucket name
**Environments**: prod

---

## How to Add Secrets to GitHub

### Repository-Level Secrets (For CI/CD)

1. **Navigate to Settings**
   ```
   GitHub Repository → Settings → Secrets and variables → Actions
   ```

2. **Click "New repository secret"**

3. **Add Each Secret**:
   - **Name**: Exact name from list above (case-sensitive!)
   - **Value**: Secret value (will be encrypted)
   - Click "Add secret"

4. **Verify**:
   - Secrets show as "Updated X time ago" (values hidden)
   - Cannot view values after creation (security feature)

### Environment-Specific Secrets (Production/Staging)

1. **Create Environment**:
   ```
   Repository → Settings → Environments → New environment
   ```
   - Name: `production` or `staging`

2. **Configure Protection Rules** (Production):
   - ✅ Required reviewers (1-6 people)
   - ✅ Wait timer (e.g., 5 minutes)
   - ✅ Deployment branches (only `main`)

3. **Add Environment Secrets**:
   - Click on environment name
   - Add secrets specific to that environment
   - These override repository secrets

### Using Secrets in GitHub Actions

```yaml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Use production environment secrets

    steps:
      - uses: actions/checkout@v4

      - name: Deploy Backend
        env:
          # Repository secrets (available to all workflows)
          SECRET_KEY: ${{ secrets.SECRET_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

          # Environment secrets (only in production environment)
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          STRIPE_API_KEY: ${{ secrets.STRIPE_API_KEY }}
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}

        run: |
          echo "Deploying with secrets..."
          # Secrets are automatically masked in logs
```

---

## Secret Rotation Strategy

### When to Rotate

| Secret Type | Rotation Frequency | Trigger |
|------------|-------------------|---------|
| API Keys (External) | Every 90 days | Calendar |
| DATABASE_URL password | Every 180 days | Calendar |
| SECRET_KEY | Every 365 days | Calendar |
| OAuth secrets | On provider update | Event-based |
| Compromised secrets | Immediately | Security incident |

### How to Rotate

1. **Generate New Secret**:
   ```bash
   # For SECRET_KEY
   openssl rand -hex 32

   # For API keys
   # Generate in provider dashboard
   ```

2. **Update GitHub Secret**:
   - Go to secret in GitHub
   - Click "Update"
   - Paste new value
   - Save

3. **Deploy Changes**:
   - Trigger deployment (or wait for next deploy)
   - Monitor for errors

4. **Revoke Old Secret**:
   - Revoke old API key in provider dashboard
   - Confirm no services using old key

---

## Security Best Practices

### ✅ DO

- **Use environment-specific secrets** (dev/staging/prod separate)
- **Rotate secrets regularly** (every 90-365 days)
- **Use strong passwords** (min 16 chars, random)
- **Monitor secret access** (GitHub audit log)
- **Test in dev first** before updating production
- **Document secret owners** (who manages each secret)
- **Use service accounts** for API keys (not personal accounts)

### ❌ DON'T

- **Never commit secrets to git** (even in `.env.example`)
- **Never log secret values** (GitHub auto-masks but be careful)
- **Never share secrets** in Slack/email
- **Never use same secret** across environments
- **Never use weak passwords** (no "password123")
- **Never store secrets** in code comments
- **Never screenshot secrets** (use password manager)

---

## Complete Secrets Checklist

### Minimum Required (Development)

```bash
✅ SECRET_KEY
✅ DATABASE_URL
✅ REDIS_URL (or use default localhost)
✅ NEO4J_PASSWORD
✅ RESEND_API_KEY (for email)
```

### Minimum Required (Production)

```bash
✅ All development secrets above
✅ SENTRY_DSN
✅ STRIPE_API_KEY (if payments enabled)
✅ PLAID_CLIENT_ID + PLAID_SECRET (if finance enabled)
✅ ANTHROPIC_API_KEY (for AI features)
```

### Optional (Based on Features)

```bash
⬜ OPENAI_API_KEY (backup AI provider)
⬜ TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (SMS notifications)
⬜ GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (Google OAuth)
⬜ MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET (Microsoft OAuth)
⬜ APPLE_CLIENT_ID + APPLE_CLIENT_SECRET (Apple Sign-In)
⬜ GCS_PROJECT_ID + GCS_BUCKET_NAME (Google Cloud Storage)
⬜ AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (AWS S3)
⬜ OTEL_EXPORTER_OTLP_ENDPOINT (Custom observability)
```

---

## Quick Setup Script

```bash
#!/bin/bash
# scripts/setup-github-secrets.sh

# Install GitHub CLI if not installed
if ! command -v gh &> /dev/null; then
    echo "Installing GitHub CLI..."
    # macOS
    brew install gh
    # Linux
    # sudo apt install gh
fi

# Login to GitHub
gh auth login

# Set repository (update this!)
REPO="your-org/life-navigator-monorepo"

# Core secrets
gh secret set SECRET_KEY -b "$(openssl rand -hex 32)" -r $REPO
echo "Enter DATABASE_URL:"
gh secret set DATABASE_URL -r $REPO
echo "Enter REDIS_URL (or press enter for default):"
gh secret set REDIS_URL -b "redis://localhost:6379/0" -r $REPO

# Email (Resend)
echo "Enter RESEND_API_KEY:"
gh secret set RESEND_API_KEY -r $REPO

# AI
echo "Enter ANTHROPIC_API_KEY:"
gh secret set ANTHROPIC_API_KEY -r $REPO

# Neo4j
echo "Enter NEO4J_PASSWORD:"
gh secret set NEO4J_PASSWORD -r $REPO

# Finance (optional)
read -p "Configure Plaid? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "\nEnter PLAID_CLIENT_ID:"
    gh secret set PLAID_CLIENT_ID -r $REPO
    echo "Enter PLAID_SECRET:"
    gh secret set PLAID_SECRET -r $REPO
fi

# Stripe (optional)
read -p "Configure Stripe? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "\nEnter STRIPE_API_KEY:"
    gh secret set STRIPE_API_KEY -r $REPO
fi

# Monitoring (optional)
read -p "Configure Sentry? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "\nEnter SENTRY_DSN:"
    gh secret set SENTRY_DSN -r $REPO
fi

echo "\n✅ Secrets configured successfully!"
echo "View secrets: https://github.com/$REPO/settings/secrets/actions"
```

**Usage**:
```bash
chmod +x scripts/setup-github-secrets.sh
./scripts/setup-github-secrets.sh
```

---

## Troubleshooting

### Secret Not Available in Workflow

**Problem**: Workflow can't access secret
**Solutions**:
1. Check secret name is **exact match** (case-sensitive)
2. Ensure workflow has permission to access secrets
3. Check if using environment secrets - need `environment:` in job
4. Verify secret exists: Settings → Secrets → Actions

### Secret Masked in Logs

**Problem**: Secret value appears as `***` in logs
**This is correct!** GitHub automatically masks secrets for security.
**To debug**: Use indirect checks, not direct value printing.

### Deployment Fails with "Missing Secret"

**Problem**: Environment variable not set
**Solutions**:
1. Check secret exists in GitHub
2. Check secret name in workflow matches config
3. Check environment (prod secrets in prod environment)
4. Restart deployment after adding secret

---

## Environment Variable Reference

### Backend (FastAPI)

**File**: `backend/app/core/config.py`

```python
# Core
SECRET_KEY: str
DATABASE_URL: PostgresDsn
REDIS_URL: RedisDsn

# Email
RESEND_API_KEY: str | None
EMAIL_FROM: str = "Life Navigator <noreply@lifenavigator.ai>"
FRONTEND_URL: str = "http://localhost:3000"

# Graph Databases
NEO4J_URI: str = "bolt://localhost:7687"
NEO4J_PASSWORD: str

# External APIs
ANTHROPIC_API_KEY: str | None
OPENAI_API_KEY: str | None
PLAID_CLIENT_ID: str | None
PLAID_SECRET: str | None
STRIPE_API_KEY: str | None
TWILIO_ACCOUNT_SID: str | None
TWILIO_AUTH_TOKEN: str | None

# OAuth
GOOGLE_CLIENT_ID: str | None
GOOGLE_CLIENT_SECRET: str | None
MICROSOFT_CLIENT_ID: str | None
MICROSOFT_CLIENT_SECRET: str | None

# Monitoring
SENTRY_DSN: str | None
OTEL_EXPORTER_OTLP_ENDPOINT: str
```

### Frontend (Next.js)

**File**: `apps/web/.env`

```bash
# Public (prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Private (server-side only)
NEXTAUTH_SECRET=<same as SECRET_KEY>
NEXTAUTH_URL=http://localhost:3000

# OAuth (if using NextAuth)
GOOGLE_CLIENT_ID=<from GitHub Secrets>
GOOGLE_CLIENT_SECRET=<from GitHub Secrets>
```

---

## Summary

**Total Secrets Required**:
- **Minimum (Dev)**: 5 secrets
- **Minimum (Prod)**: 10 secrets
- **Full Setup**: 25+ secrets

**Setup Time**:
- Manual: ~30 minutes
- Script: ~10 minutes

**Rotation Schedule**:
- Quarterly: API keys
- Biannually: Database passwords
- Annually: Core secrets (SECRET_KEY)

**Security Posture**:
- ✅ Encrypted at rest (GitHub)
- ✅ Encrypted in transit (TLS)
- ✅ Audit trail (GitHub logs)
- ✅ Environment isolation (dev/prod separate)
- ✅ Automatic masking (logs)

---

**Status**: ✅ Production-ready secrets management
**Next**: Add secrets to GitHub following this guide
