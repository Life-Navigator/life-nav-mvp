# Deprecation Log - Pre-Production Hardening

**Status:** Active - Enforced in CI
**Last Updated:** 2026-01-09
**Owner:** Platform Engineering

---

## Purpose

This document tracks all deprecated code paths, services, and patterns that violate deployment boundaries or create technical debt. All items listed here are **blocked in CI** and must not be used in new code.

---

## Deprecated Services

### 1. **services/api/** - Legacy API Gateway

**Status:** ⚠️ **DEPRECATED**
**Replacement:** `backend/app/api/v1/`
**Removal Target:** Q2 2026
**Reason:** Consolidation - Multiple API gateways create deployment complexity and security risks

**What It Was:**
- Standalone FastAPI service
- Deployed separately to Cloud Run
- Handled user auth, goals, scenarios

**Why It's Deprecated:**
- **Deployment Boundary Confusion**: Unclear which API gateway handles which endpoints
- **Security Risk**: Duplicate authentication logic creates inconsistency
- **Operational Overhead**: Two separate services to monitor and deploy
- **Technical Debt**: Migration to monolithic backend simplifies architecture

**Migration Status:**
| Endpoint | Migrated To | Status |
|----------|-------------|--------|
| POST /auth/login | backend/app/api/v1/auth.py | ✅ Complete |
| POST /auth/register | backend/app/api/v1/auth.py | ✅ Complete |
| GET /goals | backend/app/api/v1/goals.py | ✅ Complete |
| POST /goals | backend/app/api/v1/goals.py | ✅ Complete |
| GET /scenario-lab/* | backend/app/api/v1/scenario_lab.py | ✅ Complete |
| POST /scenario-lab/* | backend/app/api/v1/scenario_lab.py | ✅ Complete |

**CI Enforcement:**
```javascript
// ESLint rule blocks imports
{
  selector: "ImportDeclaration[source.value=/services\\/api/]",
  message: "⚠️  DEPRECATED: services/api is migrated to backend/"
}
```

**Removal Plan:**
1. ✅ Migrate all endpoints to `backend/`
2. ✅ Update all client calls
3. ⏳ Decommission Cloud Run service (Q1 2026)
4. ⏳ Delete directory (Q2 2026)

---

### 2. **services/shared/** - Shared Service Code

**Status:** ⚠️ **DEPRECATED**
**Replacement:** `packages/*`
**Removal Target:** Q2 2026
**Reason:** Monorepo pattern violation - shared code belongs in `packages/`

**What It Was:**
- Shared utilities and types used by services
- Mix of TypeScript and Python code

**Why It's Deprecated:**
- **Wrong Location**: Services should not share code directly
- **Deployment Coupling**: Creates hidden dependencies between services
- **Build Issues**: Not properly versioned or published

**Migration Status:**
| Code | Migrated To | Status |
|------|-------------|--------|
| Types/interfaces | packages/api-client | ✅ Complete |
| Utilities | packages/provenance | ✅ Complete |
| Schemas | packages/market-types | ✅ Complete |

**CI Enforcement:**
```javascript
{
  selector: "ImportDeclaration[source.value=/services\\/shared/]",
  message: "⚠️  DEPRECATED: Use packages/* instead"
}
```

---

### 3. **backend/app/api/v0/** - API Version 0

**Status:** ⚠️ **DEPRECATED**
**Replacement:** `backend/app/api/v1/`
**Removal Target:** Q1 2026
**Reason:** Outdated API version with security issues

**What It Was:**
- First version of REST API
- No proper auth scoping
- Inconsistent error handling

**Why It's Deprecated:**
- **Security**: JWT tokens not properly scoped
- **Consistency**: Inconsistent response formats
- **Maintenance**: Duplicates logic with v1

**Migration Status:**
- ✅ All clients migrated to v1
- ✅ v0 endpoints return 410 Gone
- ⏳ Delete code (Q1 2026)

**CI Enforcement:**
```javascript
{
  selector: "ImportDeclaration[source.value=/backend\\/app\\/api\\/v0/]",
  message: "⚠️  DEPRECATED: API v0 is deprecated. Use v1."
}
```

---

### 4. **apps/web/pages/api/legacy/** - Legacy Next.js API Routes

**Status:** ⚠️ **DEPRECATED**
**Replacement:** `apps/web/app/api/`
**Removal Target:** Q1 2026
**Reason:** Next.js 13+ App Router migration

**What It Was:**
- Pages router API routes (Next.js 12 pattern)
- Server-side handlers in `/pages/api/`

**Why It's Deprecated:**
- **Framework Update**: Next.js 16 uses App Router
- **Performance**: App Router has better caching
- **Type Safety**: Better TypeScript integration in App Router

**Migration Status:**
- ✅ Most routes migrated to `app/api/`
- ⏳ Remaining legacy routes (~5)

**CI Enforcement:**
```javascript
{
  selector: "ImportDeclaration[source.value=/pages\\/api\\/legacy/]",
  message: "⚠️  DEPRECATED: Use app/api routes"
}
```

---

## Blocked Import Patterns

### Web App → Backend (DEPLOYMENT BOUNDARY)

**Pattern:** `apps/web` importing `backend/**`

**Why It's Blocked:**
```
❌ DEPLOYMENT BOUNDARY VIOLATION

apps/web (Frontend)    →  backend/ (Backend API)
  ↓ Deployed to           ↓ Deployed to
  Cloud Run               Cloud Run (separate)

Importing backend code into web app:
1. Bundles server-only code into client bundle (security risk)
2. Exposes environment variables and secrets (HIGH RISK)
3. Breaks deployment independence
4. Violates HIPAA compliance (data boundary)
```

**Correct Pattern:**
```typescript
// ❌ WRONG - Direct import
import { getUserProfile } from 'backend/app/api/v1/users';

// ✅ CORRECT - Use API client
import { apiClient } from '@life-navigator/api-client';
const profile = await apiClient.users.getProfile();
```

**CI Enforcement:**
```javascript
{
  group: ['backend/app/**', 'backend/**'],
  message: '❌ DEPLOYMENT BOUNDARY VIOLATION: Use API clients'
}
```

---

### Web App → Internal Services (SECURITY VIOLATION)

**Pattern:** `apps/web` importing `services/**`

**Why It's Blocked:**
```
❌ SECURITY VIOLATION

apps/web (Frontend)    →  services/risk-engine (Private K8s)
  ↓ Public internet       ↓ ClusterIP only
  ↓ User auth             ↓ S2S JWT only

Importing service code:
1. Attempts to call private services from client (BLOCKED by NetworkPolicy)
2. Exposes internal service logic
3. Violates service-to-service auth requirements
4. Risk-engine MUST receive NO PHI/PCI (data boundary enforcement)
```

**Correct Pattern:**
```typescript
// ❌ WRONG - Direct import
import { computeRisk } from 'services/risk-engine/app/compute';

// ✅ CORRECT - Use backend proxy
// Web → Backend → Risk Engine (with S2S JWT)
const response = await fetch('/api/risk/compute', {
  method: 'POST',
  headers: { Authorization: `Bearer ${userToken}` },
  body: JSON.stringify(request),
});
```

**CI Enforcement:**
```javascript
{
  group: ['services/**/app/**', 'services/**'],
  message: '❌ DEPLOYMENT BOUNDARY VIOLATION: Services are private'
}
```

---

### Web App → Database (SECURITY VIOLATION)

**Pattern:** Client-side code importing `@prisma/client`

**Why It's Blocked:**
```
❌ SECURITY VIOLATION

Client-side code    →  @prisma/client
  ↓ Runs in browser     ↓ Direct database access
  ↓ User-controlled     ↓ Bypasses RLS

Direct database access from client:
1. Exposes connection strings (HIGH SECURITY RISK)
2. Bypasses Row-Level Security (RLS)
3. No audit logging
4. HIPAA/GLBA compliance violation
```

**Correct Pattern:**
```typescript
// ❌ WRONG - Direct database access
import { prisma } from '@prisma/client';
const users = await prisma.user.findMany();

// ✅ CORRECT - Use API route (server-side)
// File: apps/web/app/api/users/route.ts
import { prisma } from '@/lib/prisma'; // Server-side only
export async function GET(request: Request) {
  const users = await prisma.user.findMany({
    where: { userId: session.user.id }, // RLS enforced
  });
  return Response.json(users);
}
```

**CI Enforcement:**
```javascript
{
  group: ['**/node_modules/@prisma/client'],
  message: '❌ SECURITY VIOLATION: Use API routes only'
}
```

---

### Packages → Apps (CIRCULAR DEPENDENCY)

**Pattern:** `packages/*` importing `apps/**`

**Why It's Blocked:**
```
❌ CIRCULAR DEPENDENCY RISK

packages/ui-components  →  apps/web
  ↓ Used by                ↑ Uses
  apps/web  ───────────────┘

Circular dependency creates:
1. Build order ambiguity
2. Cannot build packages without apps
3. Breaks independent versioning
4. Deployment coupling
```

**Correct Pattern:**
```typescript
// ❌ WRONG - Package importing app
// File: packages/ui-components/Button.tsx
import { theme } from 'apps/web/src/theme';

// ✅ CORRECT - Pass props down
// File: packages/ui-components/Button.tsx
export function Button({ theme, ...props }) { ... }

// File: apps/web/src/components/MyButton.tsx
import { Button } from '@life-navigator/ui-components';
import { theme } from '@/lib/theme';
<Button theme={theme} />
```

**CI Enforcement:**
```javascript
// In packages/**
{
  group: ['apps/**'],
  message: '❌ Circular dependency: packages cannot import apps'
}
```

---

## Vercel Deployment (DISABLED)

**Platform:** Vercel
**Status:** ⚠️ **DISABLED**
**Reason:** HIPAA/GLBA compliance requirements

**Why It's Disabled:**
```
❌ COMPLIANCE VIOLATION

Vercel (Serverless)    vs    GCP Cloud Run (Compliant)
  ↓                           ↓
  - No BAA available          - HIPAA BAA signed
  - Shared infrastructure     - Isolated VPC
  - No audit logs             - Cloud Audit Logs
  - No HIPAA compliance       - GLBA certified
```

**Current Status:**
- Workflow: `.github/workflows/vercel-deploy.yml` (disabled)
- Config: `apps/web/vercel.json` (archived)
- Trigger: Manual workflow_dispatch only

**Re-enable Plan:**
- ✅ Create separate `apps/marketing/` (public marketing site)
- ⏳ Marketing site can use Vercel (no PHI/PCI)
- ⏳ Main app stays on GCP Cloud Run

**CI Note:**
```yaml
# Workflow is disabled via on: workflow_dispatch only
# Comment at top of file explains why
```

---

## Blocked Code Patterns Summary

| Pattern | Blocked | Reason | Replacement |
|---------|---------|--------|-------------|
| `apps/web` → `backend/**` | ✅ | Deployment boundary | API client (`packages/api-client`) |
| `apps/web` → `services/**` | ✅ | Security violation | Backend proxy + S2S JWT |
| Client → `@prisma/client` | ✅ | Security violation | Server-side API routes |
| `packages/**` → `apps/**` | ✅ | Circular dependency | Props/composition |
| `packages/**` → `services/**` | ✅ | Deployment coupling | Type-only imports |
| Import from `services/api` | ✅ | Deprecated | `backend/app/api/v1` |
| Import from `services/shared` | ✅ | Deprecated | `packages/*` |
| Import from `backend/app/api/v0` | ✅ | Deprecated | `backend/app/api/v1` |
| Import from `pages/api/legacy` | ✅ | Deprecated | `app/api` routes |
| Vercel deployment | ✅ | HIPAA compliance | GCP Cloud Run |

---

## CI Enforcement Summary

All blocked patterns are enforced in:

1. **ESLint** (`.eslintrc.js`)
   - `no-restricted-imports` rules
   - `no-restricted-syntax` rules
   - Per-workspace overrides

2. **Release Gate** (`.github/workflows/release-gate.yml`)
   - Lint must pass before merge
   - No exceptions allowed

3. **Pre-commit Hook** (`.pre-commit-config.yaml`)
   - Runs ESLint on staged files
   - Blocks commits with violations

---

## How to Fix Violations

### If You See: "DEPLOYMENT BOUNDARY VIOLATION"

```bash
# Error
❌ Web app cannot import server-only backend code

# Fix
1. Move shared types to packages/api-client
2. Use HTTP API calls instead of direct imports
3. Server-side code → app/api routes (allowed)
```

### If You See: "DEPRECATED" Warning

```bash
# Error
⚠️  services/api is deprecated

# Fix
1. Check migration table in this doc
2. Use replacement path
3. Update imports
```

### If You See: CI Failure

```bash
# Steps
1. Read error message carefully
2. Check this deprecation log
3. Use correct replacement pattern
4. Run `pnpm lint` locally to verify
5. Commit and push
```

---

## Related Documentation

- [Deployment Map](./DEPLOYMENT_MAP.md)
- [Services Architecture](./SERVICES.md)
- [Security Quickstart](../security/SECURITY_QUICKSTART.md)

---

**Last Updated:** 2026-01-09
**Next Review:** Quarterly (or when removing deprecated code)
