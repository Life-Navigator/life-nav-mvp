# Beta Launch Compliance & GCP Migration Plan

## Executive Summary

**Goal:** Launch beta with full PHI/PII compliance by moving the app frontend to GCP (Cloud Run) while keeping the marketing site on Vercel (to be created later).

**Timeline:** 1 weekend (2 days)
**Risk Level:** Low (infrastructure patterns already exist)
**Status:** IMPLEMENTATION IN PROGRESS

---

## Architecture Overview

```
BEFORE:
┌─────────────────────────────────────────┐
│              VERCEL                     │
│  - App frontend (HAS PHI) ❌ NO BAA     │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│           GCP (BAA Signed)              │
│  - Backend APIs                         │
│  - Databases                            │
└─────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────┐
│              VERCEL (Future)            │
│  - Marketing site only (no PHI)         │
│  - lifenavigator.tech (later)           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           GCP (BAA Signed)              │
│  - App frontend (Cloud Run) ✅ HIPAA    │
│  - Backend APIs                         │
│  - All databases                        │
│  - app.lifenavigator.tech              │
└─────────────────────────────────────────┘
```

---

## Pre-Implementation Checklist

### Immediate Actions (Before Coding)

- [ ] **Sign GCP BAA** (5 minutes, $0)
  ```
  GCP Console → IAM & Admin → Compliance → Accept HIPAA BAA
  ```

- [ ] **Designate HIPAA Compliance Officer**
  - Name: _______________
  - Email: _______________

- [ ] **Verify GCP Project ID**: `lifenav-prod`

- [ ] **Verify Domain Configuration**:
  - Marketing: `lifenavigator.tech` → Vercel (future)
  - App: `app.lifenavigator.tech` → GCP Cloud Run

---

## Implementation Tasks

### Phase 1: Terraform Updates

#### Task 1.1: Add Web Frontend Service Account to IAM

**File:** `terraform/gcp/environments/beta/main.tf`

**Location:** Add to `module "iam"` → `service_accounts` list (after line ~316)

```hcl
    {
      account_id   = "ln-web-frontend-beta"
      display_name = "Web Frontend Service (Beta)"
      description  = "Service account for Web Frontend Cloud Run service"
      roles = [
        "roles/secretmanager.secretAccessor",
        "roles/run.invoker"
      ]
    }
```

#### Task 1.2: Add Web Frontend Cloud Run Module

**File:** `terraform/gcp/environments/beta/main.tf`

**Location:** Add after `module "compliance_checker"` (~line 546)

```hcl
# ===========================================================================
# Web Frontend Service (Next.js)
# ===========================================================================

module "web_frontend" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  env          = local.env
  service_name = "ln-web-frontend"

  image  = "${local.image_registry}/web-frontend:beta"
  port   = 3000
  cpu    = "1"
  memory = "512Mi"

  min_instances   = 0  # Scale to zero when idle
  max_instances   = 10
  timeout_seconds = 60
  concurrency     = 100

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account       = module.iam.service_account_emails["ln-web-frontend-beta"]
  allow_unauthenticated = true  # Public frontend

  env_vars = {
    NODE_ENV                = "production"
    NEXT_PUBLIC_APP_URL     = "https://app.lifenavigator.tech"
    NEXT_PUBLIC_API_URL     = module.api_gateway.service_uri
    NEXTAUTH_URL            = "https://app.lifenavigator.tech"
  }

  secret_env_vars = [
    {
      name        = "NEXTAUTH_SECRET"
      secret_name = "projects/${var.project_id}/secrets/nextauth-secret-beta"
      version     = "latest"
    },
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-url-beta"
      version     = "latest"
    }
  ]

  startup_probe = {
    path              = "/api/health"
    initial_delay     = 10
    period            = 10
    failure_threshold = 3
    timeout           = 5
  }

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry, module.api_gateway]
}
```

#### Task 1.3: Add Required Secrets

**File:** `terraform/gcp/environments/beta/main.tf`

**Location:** Update `module "secrets"` → `secrets` list (~line 204)

```hcl
  secrets = [
    { name = "database-password", replication = { automatic = true } },
    { name = "database-url", replication = { automatic = true } },      # ADD THIS
    { name = "jwt-secret", replication = { automatic = true } },
    { name = "nextauth-secret", replication = { automatic = true } },
    { name = "dgx-spark-api-key", replication = { automatic = true } }
  ]
```

#### Task 1.4: Add Output for Web Frontend URL

**File:** `terraform/gcp/environments/beta/main.tf`

**Location:** Add to outputs section (~line 712)

```hcl
output "web_frontend_url" {
  value = module.web_frontend.service_uri
}
```

---

### Phase 2: CI/CD Updates

#### Task 2.1: Create Web Frontend Deployment Workflow

**File:** `.github/workflows/web-frontend.yml` (NEW FILE)

```yaml
# ===========================================================================
# Web Frontend CI/CD Pipeline - Next.js to Cloud Run
# ===========================================================================
# Triggers: Push to main (apps/web changes), manual dispatch
# Steps: Lint, test, build Docker, push to Artifact Registry, deploy to Cloud Run
# ===========================================================================

name: Web Frontend CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/ui-components/**'
      - 'packages/api-client/**'
      - '.github/workflows/web-frontend.yml'
  pull_request:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/ui-components/**'
      - 'packages/api-client/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'beta'
        type: choice
        options:
          - beta
          - prod

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: us-central1
  REPOSITORY: life-navigator
  IMAGE_NAME: web-frontend
  SERVICE_NAME: ln-web-frontend

jobs:
  # ===========================================================================
  # Lint & Type Check
  # ===========================================================================
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: '8'
          run_install: false

      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter @life-navigator/web exec prisma generate

      - name: Lint
        run: pnpm --filter @life-navigator/web lint

      - name: Type check
        run: pnpm --filter @life-navigator/web typecheck

  # ===========================================================================
  # Test
  # ===========================================================================
  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: '8'
          run_install: false

      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter @life-navigator/web exec prisma generate

      - name: Run tests
        run: pnpm --filter @life-navigator/web test --passWithNoTests

  # ===========================================================================
  # Build & Push Docker Image
  # ===========================================================================
  build:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}
      full-image: ${{ steps.image.outputs.full }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Determine environment
        id: env
        run: |
          if [ "${{ github.event.inputs.environment }}" != "" ]; then
            echo "environment=${{ github.event.inputs.environment }}" >> $GITHUB_OUTPUT
          else
            echo "environment=beta" >> $GITHUB_OUTPUT
          fi

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker for Artifact Registry
        run: |
          gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=${{ steps.env.outputs.environment }}
            type=sha,prefix=${{ steps.env.outputs.environment }}-

      - name: Set full image name
        id: image
        run: |
          echo "full=${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ steps.env.outputs.environment }}" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/web/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64
          build-args: |
            NEXT_PUBLIC_APP_URL=https://app.lifenavigator.com
            NEXT_PUBLIC_API_URL=https://ln-api-gateway-${{ secrets.CLOUD_RUN_SUFFIX }}.run.app

  # ===========================================================================
  # Deploy to Cloud Run
  # ===========================================================================
  deploy:
    name: Deploy to Cloud Run
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Determine environment
        id: env
        run: |
          if [ "${{ github.event.inputs.environment }}" != "" ]; then
            echo "environment=${{ github.event.inputs.environment }}" >> $GITHUB_OUTPUT
          else
            echo "environment=beta" >> $GITHUB_OUTPUT
          fi

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image ${{ needs.build.outputs.full-image }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --allow-unauthenticated \
            --port 3000 \
            --cpu 1 \
            --memory 512Mi \
            --min-instances 0 \
            --max-instances 10 \
            --concurrency 100 \
            --timeout 60s \
            --set-env-vars "NODE_ENV=production,NEXT_PUBLIC_APP_URL=https://app.lifenavigator.com" \
            --set-secrets "NEXTAUTH_SECRET=nextauth-secret-${{ steps.env.outputs.environment }}:latest,DATABASE_URL=database-url-${{ steps.env.outputs.environment }}:latest"

      - name: Get service URL
        id: service
        run: |
          URL=$(gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region ${{ env.REGION }} \
            --format 'value(status.url)')
          echo "url=$URL" >> $GITHUB_OUTPUT

      - name: Verify deployment
        run: |
          echo "Deployed to: ${{ steps.service.outputs.url }}"
          sleep 10
          curl -f "${{ steps.service.outputs.url }}/api/health" || echo "Health check endpoint may not exist yet"

      - name: Notify deployment
        if: always()
        run: |
          echo "✅ Deployment to ${{ steps.env.outputs.environment }} completed"
          echo "🌐 URL: ${{ steps.service.outputs.url }}"
          echo "🐳 Image: ${{ needs.build.outputs.full-image }}"
```

#### Task 2.2: Update Vercel Workflow for Marketing Only

**File:** `.github/workflows/vercel-deploy.yml`

**Change:** Update the `paths` filter to exclude the app (lines 5-9)

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'apps/marketing/**'  # CHANGED: Only marketing site
      - '!apps/web/**'       # ADDED: Explicitly exclude web app
  pull_request:
    branches:
      - main
    paths:
      - 'apps/marketing/**'  # CHANGED: Only marketing site
      - '!apps/web/**'       # ADDED: Explicitly exclude web app
  workflow_dispatch:
```

**Note:** Since `apps/marketing/` doesn't exist yet, you have two options:
1. Create a basic marketing site in `apps/marketing/`
2. Or temporarily disable the Vercel workflow until you split out marketing

---

### Phase 3: Dockerfile Verification

#### Task 3.1: Verify Dockerfile Uses Standalone Output

**File:** `apps/web/Dockerfile` - Already exists and looks correct

**Verify:** Check that `next.config.ts` has `output: 'standalone'`

**File:** `apps/web/next.config.ts`

**Add if missing:**
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // ADD THIS LINE
  // ... rest of config
};
```

---

### Phase 4: Environment & Secrets Setup

#### Task 4.1: Create Secrets in GCP Secret Manager

Run this script or execute manually:

```bash
#!/bin/bash
# File: scripts/deploy/setup-web-frontend-secrets.sh

PROJECT_ID="lifenav-prod"
ENV="beta"

# Generate NextAuth secret if not exists
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Create secrets
echo "Creating nextauth-secret-${ENV}..."
echo -n "$NEXTAUTH_SECRET" | gcloud secrets create "nextauth-secret-${ENV}" \
  --project="$PROJECT_ID" \
  --data-file=- \
  --replication-policy="automatic" 2>/dev/null || \
  echo -n "$NEXTAUTH_SECRET" | gcloud secrets versions add "nextauth-secret-${ENV}" \
  --project="$PROJECT_ID" \
  --data-file=-

# Database URL (construct from existing password)
DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password-${ENV}" --project="$PROJECT_ID")
DB_URL="postgresql://postgres:${DB_PASSWORD}@/lifenavigator_${ENV}?host=/cloudsql/${PROJECT_ID}:us-central1:life-navigator-db-${ENV}"

echo "Creating database-url-${ENV}..."
echo -n "$DB_URL" | gcloud secrets create "database-url-${ENV}" \
  --project="$PROJECT_ID" \
  --data-file=- \
  --replication-policy="automatic" 2>/dev/null || \
  echo -n "$DB_URL" | gcloud secrets versions add "database-url-${ENV}" \
  --project="$PROJECT_ID" \
  --data-file=-

# Grant access to web frontend service account
gcloud secrets add-iam-policy-binding "nextauth-secret-${ENV}" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:ln-web-frontend-${ENV}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding "database-url-${ENV}" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:ln-web-frontend-${ENV}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

echo "✅ Secrets created and permissions granted"
```

#### Task 4.2: Add GitHub Secrets

Add these to GitHub repository secrets:

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `GCP_PROJECT_ID` | `lifenav-prod` | Already exists? Verify |
| `GCP_SA_KEY` | Service account JSON | Already exists? Verify |
| `CLOUD_RUN_SUFFIX` | (from Cloud Run URL) | e.g., `abc123xyz` |

---

### Phase 5: DNS Configuration

#### Task 5.1: Configure Custom Domain for Cloud Run

```bash
# Map custom domain to Cloud Run service
gcloud run domain-mappings create \
  --service ln-web-frontend \
  --domain app.lifenavigator.tech \
  --region us-central1
```

#### Task 5.2: Update DNS Records

| Record | Type | Value |
|--------|------|-------|
| `app.lifenavigator.tech` | CNAME | `ghs.googlehosted.com.` |
| `lifenavigator.tech` | (future) | Vercel when marketing site ready |

---

### Phase 6: GLBA Compliance (Financial Data)

#### Task 6.1: Add Privacy Notice Component

**File:** `apps/web/src/components/legal/PrivacyNotice.tsx` (NEW FILE)

```tsx
export function FinancialPrivacyNotice() {
  return (
    <div className="text-sm text-gray-600 mt-4 p-4 bg-gray-50 rounded">
      <h4 className="font-semibold mb-2">Financial Privacy Notice</h4>
      <p>
        We collect financial information (account balances, transactions) through
        Plaid to help you track and manage your finances. We do not sell your
        financial information. You can disconnect your accounts at any time in Settings.
      </p>
      <a href="/privacy" className="text-blue-600 underline">
        Read our full Privacy Policy
      </a>
    </div>
  );
}
```

#### Task 6.2: Add to Plaid Connection Flow

Display `FinancialPrivacyNotice` before users connect bank accounts.

---

## Deployment Sequence

### Day 1: Infrastructure & CI/CD

1. [ ] **Sign GCP BAA** (5 min)
2. [ ] **Update Terraform** - Tasks 1.1-1.4 (30 min)
3. [ ] **Run Terraform Plan** (10 min)
   ```bash
   cd terraform/gcp/environments/beta
   terraform plan
   ```
4. [ ] **Run Terraform Apply** (15 min)
   ```bash
   terraform apply
   ```
5. [ ] **Create secrets** - Task 4.1 (10 min)
6. [ ] **Create CI/CD workflow** - Task 2.1 (15 min)
7. [ ] **Update Vercel workflow** - Task 2.2 (5 min)
8. [ ] **Add GitHub secrets** - Task 4.2 (5 min)

### Day 2: Deploy & Verify

9. [ ] **Verify Dockerfile** - Task 3.1 (5 min)
10. [ ] **Push changes & trigger CI/CD** (20 min)
11. [ ] **Verify Cloud Run deployment** (10 min)
12. [ ] **Configure custom domain** - Task 5.1 (10 min)
13. [ ] **Update DNS** - Task 5.2 (5 min + propagation)
14. [ ] **Add GLBA privacy notice** - Task 6.1-6.2 (30 min)
15. [ ] **End-to-end testing** (1 hour)
    - [ ] Login/logout flow
    - [ ] Health data entry
    - [ ] Financial account connection
    - [ ] Verify audit logs

---

## Verification Checklist

### Compliance Verification

- [ ] GCP BAA signed (screenshot saved)
- [ ] All PHI/PII routes through GCP only
- [ ] Marketing site (Vercel) has no PHI
- [ ] GLBA privacy notice displayed before Plaid connection
- [ ] Audit logs capturing PHI access

### Technical Verification

- [ ] Cloud Run service healthy
- [ ] Secrets accessible
- [ ] Database connection working
- [ ] API gateway reachable from frontend
- [ ] Custom domain SSL working
- [ ] Scale-to-zero functioning

### Performance Verification

- [ ] Cold start time < 10s
- [ ] Page load time < 3s
- [ ] No errors in Cloud Logging

---

## Rollback Plan

If issues arise:

1. **Revert DNS** - Point `app.lifenavigator.com` back to Vercel
2. **Restore Vercel workflow** - Remove path filter changes
3. **Keep Terraform** - Infrastructure can stay, just not used

---

## Cost Impact

| Component | Before | After | Delta |
|-----------|--------|-------|-------|
| Vercel (Web App) | ~$20/mo | $0 | -$20 |
| Cloud Run (Frontend) | $0 | ~$5-20/mo | +$5-20 |
| **Net Change** | | | ~$0-15/mo |

Scale-to-zero means you only pay when the app is actively used.

---

## Files Changed Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `terraform/gcp/environments/beta/main.tf` | Edit | +60 |
| `.github/workflows/web-frontend.yml` | Create | +200 |
| `.github/workflows/vercel-deploy.yml` | Edit | +4, -2 |
| `scripts/deploy/setup-web-frontend-secrets.sh` | Create | +35 |
| `apps/web/next.config.ts` | Edit (maybe) | +1 |
| `apps/web/src/components/legal/PrivacyNotice.tsx` | Create | +20 |

**Total: ~320 lines of changes**

---

## Implementation Status

### Completed Tasks
- [x] Terraform: Added web frontend service account to IAM
- [x] Terraform: Added web frontend Cloud Run module
- [x] Terraform: Added required secrets (database-url, nextauth-secret)
- [x] Terraform: Added output for web frontend URL
- [x] CI/CD: Created web-frontend.yml workflow for GCP deployment
- [x] CI/CD: Disabled vercel-deploy.yml (commented out triggers)
- [x] Scripts: Created setup-web-frontend-secrets.sh
- [x] Next.js: Verified/added standalone output configuration
- [x] Compliance: Added GLBA FinancialPrivacyNotice component

### Pending Tasks
- [ ] Sign GCP BAA (5 minutes, do before deploy)
- [ ] Run Terraform apply
- [ ] Run secrets setup script
- [ ] Configure DNS for app.lifenavigator.tech
- [ ] Test deployment end-to-end

### Decisions Made
- **Domain**: `app.lifenavigator.tech` for the authenticated app
- **Marketing site**: Will be created later at `lifenavigator.tech` on Vercel
- **Vercel workflow**: Disabled (can re-enable for marketing site later)
