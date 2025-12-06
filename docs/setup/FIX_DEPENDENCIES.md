# Dependency Vulnerability Fix Guide

GitHub detected **17 vulnerabilities** (2 critical, 8 high, 5 moderate, 2 low). This guide provides step-by-step instructions to fix them.

## Why We CAN Fix These (Expert Analysis)

### The Reality
1. **Most are transitive dependencies** - Not directly in your code, but in dependencies of dependencies
2. **Automated fixes exist** - Tools like `poetry update`, `npm audit fix`, and Dependabot
3. **Low risk** - Security patches rarely introduce breaking changes
4. **High reward** - Prevents exploitation of known vulnerabilities

### The Process
1. Update dependencies to latest secure versions
2. Run automated tests to catch any breaks
3. Manual testing for critical paths
4. Deploy with confidence

---

## Step 1: Fix Python Backend Vulnerabilities

### Check Current Vulnerabilities
```bash
cd backend

# Check for outdated packages
poetry show --outdated

# Run security audit (if installed)
poetry run pip-audit || pip install pip-audit && poetry run pip-audit
```

### Update All Dependencies
```bash
# Update all dependencies to latest compatible versions
poetry update

# If specific packages need major version bumps:
# poetry add package@^X.Y.Z
```

### Test After Update
```bash
# Run tests
poetry run pytest

# Check if app starts
poetry run python -m app.main

# Run type checking
poetry run mypy app/
```

---

## Step 2: Fix Frontend JavaScript Vulnerabilities

### Check Current Vulnerabilities
```bash
# At project root
pnpm audit

# Get detailed report
pnpm audit --json > audit-report.json
```

### Automated Fix (Try First)
```bash
# Fix automatically resolvable vulnerabilities
pnpm audit --fix

# If using overrides, pnpm will respect them
```

### Manual Fix (If Automated Fails)
```bash
# Update specific vulnerable packages
pnpm update package-name@latest

# For peer dependency conflicts:
pnpm update package-name@latest --legacy-peer-deps
```

### Test After Update
```bash
# Run build
pnpm build

# Run tests
pnpm test

# Start dev server and manual test
pnpm dev
```

---

## Step 3: Common Vulnerability Patterns & Fixes

### Pattern 1: Prototype Pollution (Critical)
**Packages**: lodash, minimist, qs

**Fix**:
```bash
# Update to patched versions
pnpm update lodash@^4.17.21
pnpm update minimist@^1.2.8
pnpm update qs@^6.11.0
```

### Pattern 2: ReDoS (Regular Expression Denial of Service)
**Packages**: path-to-regexp, semver

**Fix**:
```bash
pnpm update path-to-regexp@^6.2.0
pnpm update semver@^7.5.4
```

### Pattern 3: SQL Injection (Python)
**Package**: sqlalchemy

**Fix**:
```bash
cd backend
poetry add sqlalchemy@^2.0.36  # Already done in pyproject.toml
poetry lock
poetry install
```

### Pattern 4: JWT Vulnerabilities
**Package**: python-jose

**Fix**:
```bash
cd backend
poetry add python-jose@^3.5.0  # Already done
poetry update cryptography  # Ensure latest cryptography
```

---

## Step 4: Enable Dependabot (Automatic Updates)

### Create Dependabot Config
Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  # Python dependencies
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "riffe007"
    labels:
      - "dependencies"
      - "security"
    # Auto-merge security patches
    auto-merge:
      enabled: true
      update-type: "security"

  # JavaScript dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "riffe007"
    labels:
      - "dependencies"
      - "security"
    versioning-strategy: increase
    # Group related updates
    groups:
      react:
        patterns:
          - "react*"
          - "@types/react*"
      nextjs:
        patterns:
          - "next*"
          - "@next/*"

  # Docker base images
  - package-ecosystem: "docker"
    directory: "/backend"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "docker"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## Step 5: Verify Fixes

### Check GitHub Security Tab
```bash
# After pushing updates, check:
# https://github.com/Life-Navigator/life-navigator-monorepo/security/dependabot

# Should see reduced vulnerability count
```

### Run Full Test Suite
```bash
# Backend tests
cd backend && poetry run pytest -v

# Frontend tests
pnpm test

# E2E tests (if any)
pnpm test:e2e

# Build all services
docker-compose build
```

### Security Scan
```bash
# Scan Docker images with Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image your-backend-image:latest

# Check for remaining vulnerabilities
poetry run pip-audit --fix
pnpm audit --fix
```

---

## Step 6: Specific Vulnerabilities (Likely Culprits)

### Critical #1: Cryptography Package
**Issue**: Timing attack vulnerability in RSA decryption
**CVE**: CVE-2023-50782

**Fix**:
```bash
cd backend
poetry add cryptography@^46.0.3  # Already specified
poetry update cryptography
```

### Critical #2: Pillow (PIL)
**Issue**: Buffer overflow in image processing
**CVE**: CVE-2023-50447

**Fix**:
```bash
cd backend
poetry add pillow@^11.0.0  # Already specified
poetry update pillow
```

### High #1-8: Various Transitive Dependencies
**Likely packages**:
- urllib3 (SSL verification bypass)
- requests (Header injection)
- aiohttp (Path traversal)
- pydantic (DoS via regex)

**Fix**:
```bash
# Update all transitive dependencies
poetry update

# Verify specific packages
poetry show urllib3 requests aiohttp pydantic
```

---

## Step 7: Prevent Future Vulnerabilities

### Add Pre-commit Hooks
Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/Lucas-C/pre-commit-hooks-safety
    rev: v1.3.2
    hooks:
      - id: python-safety-dependencies-check
        args: ['--full-report']

  - repo: https://github.com/pyupio/safety
    rev: 2.3.5
    hooks:
      - id: safety
        args: ['check', '--full-report']
```

Install:
```bash
pip install pre-commit
pre-commit install
```

### Add CI/CD Security Checks
Update `.github/workflows/ci.yml` to include:

```yaml
- name: Run Python Security Audit
  run: |
    cd backend
    poetry run pip-audit --fix --dry-run

- name: Run npm Security Audit
  run: |
    pnpm audit --audit-level=high

- name: Check for outdated dependencies
  run: |
    cd backend && poetry show --outdated
    pnpm outdated
```

---

## Common Questions

### Q: Will updating break my app?
**A**: Unlikely. Security patches follow semantic versioning (patch versions like X.Y.Z where Z changes). These rarely introduce breaking changes.

### Q: What if tests fail after update?
**A**:
1. Check the changelog of the updated package
2. Look for migration guides
3. Roll back that specific package: `poetry add package@X.Y.Z`
4. File an issue with the maintainer

### Q: Should I update all at once?
**A**: For security vulnerabilities, yes. For feature updates, do it incrementally.

### Q: What about Docker base images?
**A**: Update those too! Use:
```bash
# Pull latest versions
docker pull python:3.12-slim-bookworm
docker pull node:20-alpine

# Get SHA256 digests
docker inspect python:3.12-slim-bookworm | grep -i sha256
```

---

## Execution Timeline

### Day 1: Assessment
- [x] Identify vulnerable packages (GitHub already did this)
- [ ] Read changelogs for major versions
- [ ] Plan testing strategy

### Day 2: Backend Fixes
- [ ] Update Python dependencies
- [ ] Run tests
- [ ] Fix any breaking changes
- [ ] Commit: `fix(deps): update vulnerable Python packages`

### Day 3: Frontend Fixes
- [ ] Update JavaScript dependencies
- [ ] Run tests
- [ ] Fix any breaking changes
- [ ] Commit: `fix(deps): update vulnerable npm packages`

### Day 4: Verification
- [ ] Run full test suite
- [ ] Manual testing of critical paths
- [ ] Check GitHub Security tab
- [ ] Deploy to staging

### Day 5: Production
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Document any changes

---

## Quick Start (Do This Tomorrow)

```bash
# 1. Update Python dependencies
cd backend
poetry update
poetry run pytest

# 2. Update JavaScript dependencies
cd ..
pnpm audit --fix
pnpm test
pnpm build

# 3. Commit changes
git add .
git commit -m "fix(security): update vulnerable dependencies

- Update Python packages to fix 2 critical, 8 high vulnerabilities
- Update npm packages via pnpm audit --fix
- All tests passing
- See GitHub Security tab for details"

# 4. Push and verify
git push origin main
# Check: https://github.com/Life-Navigator/life-navigator-monorepo/security
```

---

## Emergency Rollback

If something breaks:

```bash
# Python
cd backend
git checkout HEAD -- poetry.lock pyproject.toml
poetry install

# JavaScript
git checkout HEAD -- package.json pnpm-lock.yaml
pnpm install

# Verify
pnpm test && cd backend && poetry run pytest
```

---

## Success Metrics

- [ ] GitHub Security shows 0 critical, 0 high vulnerabilities
- [ ] All tests passing
- [ ] App runs without errors
- [ ] No performance degradation
- [ ] Dependabot enabled for automatic updates

---

## Additional Resources

- [Poetry Dependency Management](https://python-poetry.org/docs/managing-dependencies/)
- [npm audit](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Snyk Vulnerability Database](https://security.snyk.io/)

---

**Last Updated**: 2025-11-12
**Next Review**: After fix completion
