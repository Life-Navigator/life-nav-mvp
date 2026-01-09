# Secrets and Environment Variables Configuration

This document outlines all required secrets and environment variables for the Life Navigator monorepo across different environments and platforms.

## Table of Contents
- [GitHub Secrets](#github-secrets)
- [Vercel Environment Variables](#vercel-environment-variables)
- [Supabase Configuration](#supabase-configuration)
- [GCP Secret Manager](#gcp-secret-manager)
- [Local Development (.env files)](#local-development-env-files)

---

## GitHub Secrets

Configure these in GitHub repository settings → Secrets and variables → Actions.

### Required GitHub Actions Secrets

```
# GCP Authentication
GCP_PROJECT_ID=your-gcp-project-id
GCP_SA_KEY=<JSON key for GCP service account with Cloud Run, Cloud Build, Secret Manager permissions>
GCP_REGION=us-central1

# Docker Registry
DOCKER_REGISTRY=us-central1-docker.pkg.dev
DOCKER_REPOSITORY=life-navigator

# Deployment Configuration
ENVIRONMENT=beta  # or production
CLOUD_RUN_REGION=us-central1

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Database (Cloud SQL)
DATABASE_URL=postgresql://user:password@/dbname?host=/cloudsql/project:region:instance
POSTGRES_USER=your-db-user
POSTGRES_PASSWORD=<your-db-password>
POSTGRES_DB=life_navigator

# Redis (Optional for beta)
REDIS_URL=redis://redis-host:6379

# Backend API
BACKEND_URL=https://api.your-domain.com
NEXT_PUBLIC_BACKEND_URL=https://api.your-domain.com

# NextAuth
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com

# OAuth Providers
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>
```

---

## Vercel Environment Variables

Configure these in Vercel project settings → Environment Variables.

### Production Environment

| Variable Name | Value | Environment | Description |
|--------------|-------|-------------|-------------|
| `NODE_ENV` | `production` | Production | Node environment |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | All | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key>` | All | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | All | Supabase service role key (secret) |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` | All | PostgreSQL connection string |
| `DIRECT_URL` | `postgresql://user:pass@host:5432/db?schema=public` | All | Direct database connection |
| `NEXTAUTH_SECRET` | `<secret>` | All | NextAuth.js secret |
| `NEXTAUTH_URL` | `https://your-domain.com` | Production | Production URL |
| `NEXT_PUBLIC_BACKEND_URL` | `https://api.your-domain.com` | All | Backend API URL |
| `BACKEND_URL` | `https://api.your-domain.com` | All | Backend API URL (server-side) |
| `GOOGLE_CLIENT_ID` | `<client-id>` | All | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | `<client-secret>` | All | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | `<client-id>` | All | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | `<client-secret>` | All | GitHub OAuth client secret |
| `JWT_SECRET` | `<secret>` | All | JWT signing secret |
| `ENCRYPTION_KEY` | `<32-byte-hex>` | All | Data encryption key |
| `AWS_ACCESS_KEY_ID` | `<key-id>` | All | AWS S3 access key (if using S3) |
| `AWS_SECRET_ACCESS_KEY` | `<secret>` | All | AWS S3 secret key |
| `AWS_REGION` | `us-east-1` | All | AWS region |
| `AWS_S3_BUCKET` | `your-bucket-name` | All | S3 bucket name |
| `GCP_PROJECT_ID` | `your-project-id` | All | GCP project ID (if using GCS) |
| `GCP_STORAGE_BUCKET` | `your-bucket-name` | All | GCS bucket name |
| `GOOGLE_APPLICATION_CREDENTIALS` | `<base64-encoded-json>` | All | GCP service account credentials |
| `REDIS_URL` | `redis://host:6379` | All | Redis connection string (optional) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | All | Claude API key |
| `OPENAI_API_KEY` | `sk-...` | All | OpenAI API key |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Production | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production | Stripe webhook secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Production | Stripe publishable key |

### Preview/Development Environment

Same as production, but use development/staging values:
- `NEXTAUTH_URL` = Vercel preview URL (auto-set)
- `STRIPE_SECRET_KEY` = `sk_test_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_test_...`

---

## Supabase Configuration

### Project Settings

1. **Authentication Providers**
   - Configure in Supabase Dashboard → Authentication → Providers

   **Google OAuth:**
   - Client ID: From Google Cloud Console
   - Client Secret: From Google Cloud Console
   - Redirect URL: `https://your-project.supabase.co/auth/v1/callback`

   **GitHub OAuth:**
   - Client ID: From GitHub OAuth Apps
   - Client Secret: From GitHub OAuth Apps
   - Redirect URL: `https://your-project.supabase.co/auth/v1/callback`

2. **Database Connection Pooling**
   - Enable connection pooling in Supabase Dashboard → Project Settings → Database
   - Use pooled connection string for Prisma: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
   - Use direct connection string for migrations: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

3. **Row Level Security (RLS)**
   - All tables should have RLS enabled
   - Policies should be configured for user-specific data access

4. **Supabase Environment Variables**
   ```
   # Get from Supabase Dashboard → Project Settings → API
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # Keep secret!
   ```

---

## GCP Secret Manager

Store sensitive credentials in GCP Secret Manager for Cloud Run services.

### Required Secrets

| Secret Name | Description | Value Example |
|------------|-------------|---------------|
| `database-url` | PostgreSQL connection string | `postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance` |
| `redis-url` | Redis connection string | `redis://10.x.x.x:6379` |
| `nextauth-secret` | NextAuth.js secret | `<random-32-byte-string>` |
| `jwt-secret` | JWT signing secret | `<random-secret>` |
| `supabase-service-role-key` | Supabase service role key | `eyJhbGc...` |
| `google-oauth-client-secret` | Google OAuth secret | From Google Cloud Console |
| `github-oauth-client-secret` | GitHub OAuth secret | From GitHub OAuth Apps |
| `anthropic-api-key` | Claude API key | `sk-ant-...` |
| `openai-api-key` | OpenAI API key | `sk-...` |
| `stripe-secret-key` | Stripe secret key | `sk_live_...` |
| `stripe-webhook-secret` | Stripe webhook secret | `whsec_...` |
| `encryption-key` | AES-256 encryption key | `<32-byte-hex-string>` |
| `aws-access-key-id` | AWS access key | If using S3 |
| `aws-secret-access-key` | AWS secret key | If using S3 |

### Creating Secrets

```bash
# Create a secret
echo -n "secret-value" | gcloud secrets create secret-name \
  --data-file=- \
  --replication-policy="automatic"

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding secret-name \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Cloud Run Service Configuration

Secrets are mounted as environment variables in `cloudbuild.yaml`:

```yaml
secretEnv:
  - DATABASE_URL=database-url:latest
  - REDIS_URL=redis-url:latest
  - NEXTAUTH_SECRET=nextauth-secret:latest
  # etc...
```

---

## Local Development (.env files)

### `/apps/web/.env.local`

```bash
# Node Environment
NODE_ENV=development

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/life_navigator?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/life_navigator?schema=public"

# NextAuth
NEXTAUTH_SECRET=local-dev-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000

# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
BACKEND_URL=http://localhost:8000

# OAuth (Development Apps)
GOOGLE_CLIENT_ID=your-dev-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-dev-client-secret
GITHUB_CLIENT_ID=your-dev-github-client-id
GITHUB_CLIENT_SECRET=your-dev-github-client-secret

# JWT
JWT_SECRET=local-jwt-secret-change-in-production

# Storage (Local/Development)
# Option 1: Local filesystem
STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads

# Option 2: GCS (development bucket)
# STORAGE_PROVIDER=gcs
# GCP_PROJECT_ID=your-dev-project
# GCP_STORAGE_BUCKET=life-navigator-dev
# GOOGLE_APPLICATION_CREDENTIALS=./path/to/dev-service-account.json

# Option 3: AWS S3 (development bucket)
# STORAGE_PROVIDER=s3
# AWS_ACCESS_KEY_ID=your-dev-access-key
# AWS_SECRET_ACCESS_KEY=your-dev-secret
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=life-navigator-dev

# AI APIs (use test/free tier keys)
ANTHROPIC_API_KEY=sk-ant-your-dev-key
OPENAI_API_KEY=sk-your-dev-key

# Redis (optional for local dev)
REDIS_URL=redis://localhost:6379

# Stripe (test keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Feature Flags
ENABLE_ANALYTICS=false
ENABLE_AI_FEATURES=true
```

### `/services/api/.env`

```bash
# FastAPI Backend Environment
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/life_navigator
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=life_navigator

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET_KEY=local-jwt-secret-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# AI APIs
ANTHROPIC_API_KEY=sk-ant-your-dev-key
OPENAI_API_KEY=sk-your-dev-key

# Storage
STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads

# Feature Flags
ENABLE_CELERY=false
ENABLE_BACKGROUND_TASKS=true
```

---

## Security Best Practices

### Secret Generation

```bash
# Generate random secrets
openssl rand -base64 32  # For NEXTAUTH_SECRET, JWT_SECRET

# Generate encryption key (256-bit)
openssl rand -hex 32  # For ENCRYPTION_KEY

# Generate UUID
uuidgen
```

### Secret Rotation

1. **Regular Rotation Schedule:**
   - JWT secrets: Every 90 days
   - Database passwords: Every 180 days
   - API keys: When compromised or annually
   - OAuth secrets: When compromised

2. **Rotation Process:**
   - Generate new secret
   - Update in all environments (GCP Secret Manager, Vercel, GitHub)
   - Deploy services with new secret
   - Revoke old secret after grace period

### Access Control

1. **Principle of Least Privilege:**
   - Service accounts should only have access to secrets they need
   - Use separate service accounts for different services
   - Never commit secrets to git

2. **Secret Scoping:**
   - Development secrets should be separate from production
   - Use different databases for dev/staging/prod
   - Never use production API keys in development

---

## Checklist for Deployment

### Before First Deployment

- [ ] Create Supabase project
- [ ] Configure authentication providers in Supabase
- [ ] Set up GCP project and enable required APIs
- [ ] Create Cloud SQL instance
- [ ] Set up Redis (if using)
- [ ] Create GCS or S3 bucket for file storage
- [ ] Generate all required secrets
- [ ] Add secrets to GCP Secret Manager
- [ ] Configure GitHub Actions secrets
- [ ] Configure Vercel environment variables
- [ ] Set up custom domain and SSL
- [ ] Configure OAuth redirect URLs
- [ ] Run database migrations
- [ ] Test authentication flow
- [ ] Verify file upload functionality

### After Deployment

- [ ] Monitor error logs
- [ ] Verify all integrations work
- [ ] Test user signup/login
- [ ] Verify database connections
- [ ] Check API endpoints
- [ ] Test file uploads
- [ ] Verify AI features (if enabled)
- [ ] Set up monitoring and alerting
- [ ] Document any deployment issues
- [ ] Update this document with actual values used

---

## Troubleshooting

### Common Issues

**"Invalid Supabase URL"**
- Verify NEXT_PUBLIC_SUPABASE_URL matches your project
- Check for trailing slashes (should not have one)
- Ensure URL is accessible from deployment environment

**"Database connection failed"**
- For Vercel: Use pooled connection string (port 6543)
- For Cloud Run: Use Unix socket path for Cloud SQL
- Check database credentials in secrets

**"OAuth redirect mismatch"**
- Verify redirect URLs in OAuth provider settings
- Format: `https://your-domain.com/api/auth/callback/[provider]`
- Also add Supabase callback URL

**"NextAuth secret missing"**
- Ensure NEXTAUTH_SECRET is set in environment
- Must be at least 32 characters
- Should be different in each environment

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [GCP Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
