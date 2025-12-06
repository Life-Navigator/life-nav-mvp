# GitHub Secrets Setup Guide

This guide explains how to configure GitHub Secrets for secure CI/CD deployments.

## Overview

GitHub Secrets provide secure storage for sensitive values used in GitHub Actions workflows. Secrets are encrypted and only exposed to workflows during runtime.

## Required Secrets

### Development/CI Secrets

These secrets are needed for running tests and building containers in CI:

```
POSTGRES_PASSWORD       # Database password for test environment
NEO4J_PASSWORD         # Neo4j password for test environment  
SECRET_KEY             # JWT signing key for tests
```

### Production/Deployment Secrets

Additional secrets needed for deploying to production:

```
GCP_PROJECT_ID         # Google Cloud Project ID
GCP_SA_KEY             # Service Account key (JSON) for GCP deployments
DOCKER_REGISTRY        # Container registry URL (e.g., gcr.io/project-id)
ANTHROPIC_API_KEY      # Claude AI API key (optional)
OPENAI_API_KEY         # OpenAI API key (optional)
PLAID_CLIENT_ID        # Plaid API client ID (optional)
PLAID_SECRET           # Plaid API secret (optional)
ALPHA_VANTAGE_API_KEY  # Alpha Vantage API key (optional)
```

## Setting Up Secrets

### 1. Generate Strong Secrets

```bash
# Generate SECRET_KEY (64 characters)
openssl rand -hex 32

# Generate database passwords
openssl rand -base64 32  # POSTGRES_PASSWORD
openssl rand -base64 32  # NEO4J_PASSWORD
```

### 2. Add Secrets to GitHub

#### Via GitHub Web Interface:

1. Navigate to your repository on GitHub
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add each secret:
   - **Name**: `POSTGRES_PASSWORD`
   - **Value**: `<your-generated-password>`
5. Repeat for all required secrets

#### Via GitHub CLI:

```bash
# Install GitHub CLI if needed
# https://cli.github.com/

# Authenticate
gh auth login

# Add secrets
gh secret set POSTGRES_PASSWORD --body "$(openssl rand -base64 32)"
gh secret set NEO4J_PASSWORD --body "$(openssl rand -base64 32)"
gh secret set SECRET_KEY --body "$(openssl rand -hex 32)"

# For GCP Service Account (from JSON file)
gh secret set GCP_SA_KEY < path/to/service-account-key.json

# For other API keys
gh secret set ANTHROPIC_API_KEY --body "sk-ant-..."
```

### 3. Verify Secrets Are Set

```bash
# List all secrets (values are hidden)
gh secret list
```

## Using Secrets in Workflows

### Example: Backend CI Workflow

Update `.github/workflows/backend.yml`:

```yaml
name: Backend CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_USER: lifenavigator
          POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
          POSTGRES_DB: lifenavigator_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      neo4j:
        image: neo4j:5.15.0-enterprise
        env:
          NEO4J_AUTH: neo4j/${{ secrets.NEO4J_PASSWORD }}
          NEO4J_ACCEPT_LICENSE_AGREEMENT: "yes"
        ports:
          - 7687:7687
    
    env:
      DATABASE_URL: postgresql://lifenavigator:${{ secrets.POSTGRES_PASSWORD }}@localhost:5432/lifenavigator_test
      SECRET_KEY: ${{ secrets.SECRET_KEY }}
      NEO4J_URI: bolt://localhost:7687
      NEO4J_PASSWORD: ${{ secrets.NEO4J_PASSWORD }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        working-directory: ./backend
        run: |
          pip install poetry
          poetry install
      
      - name: Run tests
        working-directory: ./backend
        run: poetry run pytest
      
      - name: Run linting
        working-directory: ./backend
        run: poetry run ruff check .

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
      
      - name: Configure Docker
        run: gcloud auth configure-docker
      
      - name: Build and push Docker image
        working-directory: ./backend
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }}
```

### Example: Docker Compose with Secrets

For local development with docker-compose, you'll still use `.env` file (not committed to git).

For CI environments, create a dynamic `.env` file in the workflow:

```yaml
- name: Create .env file for testing
  run: |
    cat > .env << EOF
    POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
    NEO4J_PASSWORD=${{ secrets.NEO4J_PASSWORD }}
    SECRET_KEY=${{ secrets.SECRET_KEY }}
    EOF

- name: Start services
  run: docker compose up -d

- name: Run integration tests
  run: docker compose exec -T backend pytest tests/integration/
```

## Environment-Specific Secrets

### Using Environments

GitHub supports environment-specific secrets (dev, staging, production):

1. Go to **Settings** > **Environments**
2. Create environments: `development`, `staging`, `production`
3. Add environment-specific secrets to each
4. Configure protection rules (e.g., require approval for production)

In your workflow:

```yaml
jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production  # Uses production secrets
    steps:
      - name: Deploy
        run: |
          # Uses ${{ secrets.SECRET_KEY }} from production environment
          ./deploy.sh
```

## Secret Rotation

### Automated Rotation Schedule

1. **Every 90 days**: Rotate all development secrets
2. **Every 30 days**: Rotate production database passwords
3. **Immediately**: Rotate if compromised or employee offboarding

### Rotation Process

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update GitHub Secret
gh secret set POSTGRES_PASSWORD --body "$NEW_SECRET"

# 3. Update production environment (via Terraform/GCP Secret Manager)
echo -n "$NEW_SECRET" | gcloud secrets versions add postgres-password --data-file=-

# 4. Restart services to pick up new secret
kubectl rollout restart deployment/backend

# 5. Verify services are healthy
kubectl get pods -l app=backend
```

## Security Best Practices

### Do's ✅

- ✅ Generate unique secrets for each environment
- ✅ Use GitHub Environments for production secrets
- ✅ Rotate secrets every 90 days minimum
- ✅ Use service accounts with minimal permissions
- ✅ Enable required reviewers for production deployments
- ✅ Monitor secret access in audit logs
- ✅ Use GCP Secret Manager for production (not just GitHub Secrets)

### Don'ts ❌

- ❌ NEVER echo or log secret values in workflows
- ❌ NEVER commit secrets to git (even in private repos)
- ❌ NEVER share secrets via Slack/email
- ❌ NEVER use the same secrets across environments
- ❌ NEVER store secrets in workflow files
- ❌ NEVER use weak or default passwords

## Troubleshooting

### Secret Not Found Error

```
Error: Secret POSTGRES_PASSWORD not found
```

**Solution**: Verify the secret is set:
```bash
gh secret list
```

If missing, add it:
```bash
gh secret set POSTGRES_PASSWORD --body "your-value"
```

### Secret Value Not Updating

GitHub Actions caches secret values. To force update:

1. Delete the secret: `gh secret delete SECRET_NAME`
2. Re-add it: `gh secret set SECRET_NAME --body "new-value"`
3. Re-run the workflow

### Testing Locally

To test workflows locally using secrets:

```bash
# Install act (https://github.com/nektos/act)
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Create .secrets file (NEVER commit this)
cat > .secrets << EOF
POSTGRES_PASSWORD=local-test-password
NEO4J_PASSWORD=local-test-password
SECRET_KEY=local-test-key
