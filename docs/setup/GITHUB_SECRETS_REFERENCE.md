# GitHub Secrets Reference for Life Navigator

This document lists all GitHub Secrets required for the Life Navigator application to run correctly in CI/CD pipelines and production environments.

## Quick Reference Table

| Secret Name | Required | Purpose | Where Used | Example Value |
|------------|----------|---------|------------|---------------|
| `POSTGRES_PASSWORD` | ✅ Yes | PostgreSQL database password | All services | `generated-password-here` |
| `NEO4J_PASSWORD` | ✅ Yes | Neo4j graph database password | Backend, Agents, MCP | `generated-password-here` |
| `SECRET_KEY` | ✅ Yes | JWT token signing key | Backend, Finance API, Agents | `64-char-hex-string` |
| `GCP_PROJECT_ID` | Production | Google Cloud Project ID | Deployment workflows | `my-project-id` |
| `GCP_SA_KEY` | Production | GCP Service Account JSON key | Deployment workflows | `{"type":"service_account",...}` |
| `DOCKER_REGISTRY` | Production | Container registry URL | Build/Deploy workflows | `gcr.io/my-project-id` |
| `ANTHROPIC_API_KEY` | Optional | Claude AI API access | Agents service | `sk-ant-...` |
| `OPENAI_API_KEY` | Optional | OpenAI API access | Agents service | `sk-...` |
| `PLAID_CLIENT_ID` | Optional | Plaid banking integration | Finance API | `client-id-here` |
| `PLAID_SECRET` | Optional | Plaid API secret | Finance API | `secret-here` |
| `ALPHA_VANTAGE_API_KEY` | Optional | Stock market data | Finance API | `api-key-here` |

---

## Required Secrets (Must Set)

### 1. POSTGRES_PASSWORD

**Purpose:** Password for PostgreSQL database authentication

**Used By:**
- Backend service (port 8000)
- Finance API service (port 8001)
- Agents service (port 8080)
- MCP Server (port 8090)
- CI/CD test workflows

**How to Generate:**
```bash
openssl rand -base64 32
```

**Environment Variable Mapping:**
```yaml
POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
```

**Security Notes:**
- Minimum length: 20 characters
- Rotate every 90 days
- Use different passwords for dev/staging/prod

---

### 2. NEO4J_PASSWORD

**Purpose:** Password for Neo4j graph database authentication

**Used By:**
- Backend service (Neo4j client)
- GraphRAG service (port 50051)
- Agents service (knowledge graph operations)
- MCP Server (graph queries)

**How to Generate:**
```bash
openssl rand -base64 24
```

**Environment Variable Mapping:**
```yaml
NEO4J_PASSWORD: ${{ secrets.NEO4J_PASSWORD }}
NEO4J_AUTH: neo4j/${{ secrets.NEO4J_PASSWORD }}
```

**Security Notes:**
- Minimum length: 12 characters
- Cannot contain spaces or special shell characters
- Neo4j Enterprise requires strong passwords

---

### 3. SECRET_KEY

**Purpose:** JWT token signing and application secret key

**Used By:**
- Backend service (JWT tokens, session encryption)
- Finance API service (token validation)
- Agents service (authentication)

**How to Generate:**
```bash
openssl rand -hex 32  # Generates 64-character hex string
```

**Environment Variable Mapping:**
```yaml
SECRET_KEY: ${{ secrets.SECRET_KEY }}
```

**Security Notes:**
- **CRITICAL:** Must be exactly 64 characters (32 bytes as hex)
- Never reuse across environments
- Changing this invalidates all existing JWT tokens
- Rotate every 30 days in production

---

## Production/Deployment Secrets

### 4. GCP_PROJECT_ID

**Purpose:** Google Cloud Platform project identifier

**Used By:**
- Deployment workflows (`.github/workflows/backend.yml`)
- Terraform infrastructure deployment
- Container image tagging

**Format:**
```
my-project-name
```

**Environment Variable Mapping:**
```yaml
GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
```

---

### 5. GCP_SA_KEY

**Purpose:** Service Account JSON key for GCP authentication

**Used By:**
- GitHub Actions workflows for deployment
- Docker image push to GCR/Artifact Registry
- Cloud Run/GKE deployments
- Terraform state management

**How to Generate:**
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --description="GitHub Actions CI/CD" \
  --display-name="GitHub Actions"

# Grant necessary roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.developer"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@PROJECT_ID.iam.gserviceaccount.com

# Set as GitHub Secret (entire JSON contents)
gh secret set GCP_SA_KEY < github-actions-key.json
```

**Format:**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "github-actions@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**Security Notes:**
- **CRITICAL:** Treat as highly sensitive
- Service account should have minimal necessary permissions
- Rotate keys every 90 days
- Monitor usage in GCP audit logs

---

### 6. DOCKER_REGISTRY

**Purpose:** Container registry URL for pushing/pulling images

**Used By:**
- Build workflows
- Deployment workflows
- Container image references in K8s manifests

**Format Options:**
```
# Google Container Registry
gcr.io/your-project-id

# Google Artifact Registry
us-docker.pkg.dev/your-project-id/your-repository

# Docker Hub
docker.io/your-username
```

**Environment Variable Mapping:**
```yaml
DOCKER_REGISTRY: ${{ secrets.DOCKER_REGISTRY }}
```

---

## Optional API Keys

### 7. ANTHROPIC_API_KEY

**Purpose:** Access to Claude AI models via Anthropic API

**Used By:**
- Agents service (AI-powered features)
- MCP Server (conversational interfaces)

**How to Obtain:**
1. Sign up at https://console.anthropic.com/
2. Navigate to API Keys
3. Generate new key

**Format:**
```
sk-ant-api03-...
```

**Environment Variable Mapping:**
```yaml
ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Features Enabled:**
- AI-powered goal recommendations
- Natural language task creation
- Intelligent document analysis
- Conversational financial advice

---

### 8. OPENAI_API_KEY

**Purpose:** Access to OpenAI GPT models

**Used By:**
- Agents service (alternative AI backend)
- Embeddings generation (optional)

**How to Obtain:**
1. Sign up at https://platform.openai.com/
2. Navigate to API Keys
3. Generate new key

**Format:**
```
sk-...
```

**Environment Variable Mapping:**
```yaml
OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

### 9. PLAID_CLIENT_ID

**Purpose:** Plaid banking integration client identifier

**Used By:**
- Finance API service (bank account connections)

**How to Obtain:**
1. Sign up at https://dashboard.plaid.com/signup
2. Create an application
3. Get Client ID from dashboard

**Format:**
```
5f9c8c7d8e6f5a4b3c2d1e0f
```

**Environment Variable Mapping:**
```yaml
PLAID_CLIENT_ID: ${{ secrets.PLAID_CLIENT_ID }}
```

**Features Enabled:**
- Bank account linking
- Transaction synchronization
- Balance checking
- Account verification

---

### 10. PLAID_SECRET

**Purpose:** Plaid API secret key

**Used By:**
- Finance API service (Plaid API authentication)

**How to Obtain:**
- Available in Plaid dashboard alongside Client ID

**Format:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Environment Variable Mapping:**
```yaml
PLAID_SECRET: ${{ secrets.PLAID_SECRET }}
PLAID_ENVIRONMENT: sandbox  # or development, production
```

**Security Notes:**
- Keep Client ID and Secret together
- Different secrets for sandbox/production
- Rotate if compromised

---

### 11. ALPHA_VANTAGE_API_KEY

**Purpose:** Stock market data and financial metrics

**Used By:**
- Finance API service (stock prices, market data)

**How to Obtain:**
1. Sign up at https://www.alphavantage.co/support/#api-key
2. Free tier: 25 requests/day
3. Premium tiers available

**Format:**
```
ABCDEFGHIJKLMNOP
```

**Environment Variable Mapping:**
```yaml
ALPHA_VANTAGE_API_KEY: ${{ secrets.ALPHA_VANTAGE_API_KEY }}
```

**Features Enabled:**
- Real-time stock quotes
- Historical price data
- Technical indicators
- Market fundamentals

---

## Setting Up All Secrets

### Method 1: GitHub Web Interface

1. Navigate to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret one by one

### Method 2: GitHub CLI (Batch Setup)

```bash
# Install GitHub CLI if needed
# https://cli.github.com/

# Authenticate
gh auth login

# Required secrets
gh secret set POSTGRES_PASSWORD --body "$(openssl rand -base64 32)"
gh secret set NEO4J_PASSWORD --body "$(openssl rand -base64 24)"
gh secret set SECRET_KEY --body "$(openssl rand -hex 32)"

# Production secrets (replace with actual values)
gh secret set GCP_PROJECT_ID --body "your-project-id"
gh secret set GCP_SA_KEY < path/to/service-account-key.json
gh secret set DOCKER_REGISTRY --body "gcr.io/your-project-id"

# Optional API keys (if you have them)
gh secret set ANTHROPIC_API_KEY --body "sk-ant-..."
gh secret set OPENAI_API_KEY --body "sk-..."
gh secret set PLAID_CLIENT_ID --body "your-client-id"
gh secret set PLAID_SECRET --body "your-plaid-secret"
gh secret set ALPHA_VANTAGE_API_KEY --body "your-api-key"
```

### Method 3: Environment-Specific Secrets

For different environments (development, staging, production):

1. Go to **Settings** → **Environments**
2. Create environments: `development`, `staging`, `production`
3. Add environment-specific secrets to each
4. Configure protection rules (e.g., require approval for production)

Example workflow usage:
```yaml
jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production  # Uses production-specific secrets
    steps:
      - name: Deploy
        run: ./deploy.sh
        env:
          SECRET_KEY: ${{ secrets.SECRET_KEY }}  # From production environment
```

---

## Verification Checklist

After setting up secrets, verify they're configured correctly:

```bash
# List all configured secrets (values are hidden)
gh secret list

# Expected output should include at minimum:
# POSTGRES_PASSWORD
# NEO4J_PASSWORD
# SECRET_KEY
```

---

## Security Best Practices

### Do's ✅

- ✅ Generate unique secrets for each environment (dev/staging/prod)
- ✅ Use strong, random values (use `openssl rand` commands)
- ✅ Store secrets in a password manager (1Password, LastPass, Bitwarden)
- ✅ Rotate secrets every 90 days (30 days for SECRET_KEY in production)
- ✅ Use GitHub Environments for production secrets with approval gates
- ✅ Monitor secret access in GitHub audit logs
- ✅ Document which secrets are required vs optional

### Don'ts ❌

- ❌ NEVER commit secrets to git (even in private repos)
- ❌ NEVER echo or log secret values in workflows
- ❌ NEVER share secrets via Slack/email
- ❌ NEVER use the same secrets across environments
- ❌ NEVER use default or example values in production
- ❌ NEVER grant overly broad permissions to service accounts

---

## Troubleshooting

### Secret Not Found Error

```
Error: Secret POSTGRES_PASSWORD not found
```

**Solution:**
```bash
# Check if secret exists
gh secret list | grep POSTGRES_PASSWORD

# If missing, add it
gh secret set POSTGRES_PASSWORD --body "$(openssl rand -base64 32)"
```

---

### Workflow Fails with Authentication Error

**Possible Causes:**
1. GCP_SA_KEY is malformed or missing
2. Service account lacks necessary permissions
3. Secret value has extra whitespace or newlines

**Solution:**
```bash
# Re-create service account key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@PROJECT_ID.iam.gserviceaccount.com

# Delete old secret
gh secret delete GCP_SA_KEY

# Set new secret (ensure no extra newlines)
gh secret set GCP_SA_KEY < key.json

# Verify format
cat key.json | jq .  # Should be valid JSON
```

---

### Secrets Not Updating

GitHub Actions caches secret values. To force update:

```bash
# Delete the secret
gh secret delete SECRET_NAME

# Re-add with new value
gh secret set SECRET_NAME --body "new-value"

# Re-run the workflow (don't just restart failed jobs)
gh workflow run workflow-name.yml
```

---

## Migration from .env to GitHub Secrets

If you're migrating from local `.env` files:

```bash
# 1. Extract values from .env (locally, not in git)
source .env

# 2. Set as GitHub Secrets
gh secret set POSTGRES_PASSWORD --body "$POSTGRES_PASSWORD"
gh secret set NEO4J_PASSWORD --body "$NEO4J_PASSWORD"
gh secret set SECRET_KEY --body "$SECRET_KEY"

# 3. Verify secrets are set
gh secret list

# 4. Test in a workflow
gh workflow run ci.yml
```

---

## Related Documentation

- [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) - Detailed setup guide with workflow examples
- [SETUP.md](./SETUP.md) - Local development setup with .env files
- [.env.example](./.env.example) - Template for required environment variables
- [REMEDIATION_GUIDE.md](./REMEDIATION_GUIDE.md) - Security best practices and fixes

---

**Last Updated:** 2025-11-12
**Next Review:** 2026-05-12 (6 months)
**Maintained By:** DevOps/Security Team
