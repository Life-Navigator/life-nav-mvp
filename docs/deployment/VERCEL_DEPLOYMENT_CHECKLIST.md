# Vercel Deployment Checklist - Life Navigator Web App

Complete step-by-step checklist for deploying the Next.js web application to Vercel.

## Prerequisites

- [ ] Vercel account created at [vercel.com](https://vercel.com/)
- [ ] GitHub repository access configured
- [ ] Domain purchased and DNS configured (if using custom domain)
- [ ] All required API keys and secrets prepared (see [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md))

---

## Phase 1: Pre-Deployment Setup

### 1.1 Database Setup

- [ ] **Create Vercel Postgres database**
  ```bash
  vercel postgres create life-navigator-prod
  ```

- [ ] **Get connection strings**
  - Navigate to Vercel Dashboard → Storage → Postgres
  - Copy `POSTGRES_PRISMA_URL` (with PgBouncer)
  - Copy `POSTGRES_URL_NON_POOLING` (for migrations)
  - Store securely (you'll need these for environment variables)

- [ ] **Run database migrations**
  ```bash
  cd apps/web
  export DATABASE_URL="<POSTGRES_URL_NON_POOLING>"
  pnpm prisma migrate deploy
  ```

### 1.2 OAuth Configuration

- [ ] **Configure Google OAuth**
  - Go to [Google Cloud Console](https://console.cloud.google.com/)
  - Navigate to APIs & Services → Credentials
  - Add authorized redirect URI: `https://app.lifenavigator.ai/api/auth/callback/google`
  - Copy Client ID and Secret

- [ ] **Configure other OAuth providers** (if needed)
  - Microsoft: Azure Portal → App Registrations
  - Apple: Apple Developer → Certificates, Identifiers & Profiles
  - Add redirect URIs for production domain

### 1.3 Generate Secrets

- [ ] **Generate NextAuth secret**
  ```bash
  openssl rand -base64 32
  ```

- [ ] **Generate encryption keys**
  ```bash
  # Encryption key (32 bytes hex)
  openssl rand -hex 32

  # Master encryption key
  openssl rand -hex 32

  # Encryption salt
  openssl rand -hex 16
  ```

- [ ] **Generate internal API keys**
  ```bash
  openssl rand -hex 24
  ```

### 1.4 External Services

- [ ] **Set up Sentry for error tracking**
  - Create project at [sentry.io](https://sentry.io/)
  - Get DSN from Project Settings → Client Keys
  - Configure release tracking for deployments

- [ ] **Configure email service (SendGrid)**
  - Create account at [sendgrid.com](https://sendgrid.com/)
  - Verify sender domain
  - Generate API key with Mail Send permissions

- [ ] **Set up monitoring (optional)**
  - PostHog for analytics
  - Honeybadger for uptime monitoring

---

## Phase 2: Vercel Project Configuration

### 2.1 Connect Repository

- [ ] **Link GitHub repository to Vercel**
  1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
  2. Click "Add New..." → "Project"
  3. Import `life-navigator-monorepo` repository
  4. Select repository and click "Import"

- [ ] **Configure build settings**
  - **Framework Preset**: Next.js
  - **Root Directory**: `apps/web`
  - **Build Command**: `pnpm run build`
  - **Output Directory**: `.next` (auto-detected)
  - **Install Command**: `pnpm install`
  - **Node.js Version**: 20.x

### 2.2 Environment Variables

- [ ] **Add production environment variables**

  Navigate to Project Settings → Environment Variables and add:

  #### Core Configuration
  ```
  NODE_ENV=production
  NEXT_PUBLIC_APP_URL=https://app.lifenavigator.ai
  APP_ENV=prod
  USE_MOCK_DB=false
  ```

  #### Database (from Step 1.1)
  ```
  POSTGRES_PRISMA_URL=<from-vercel-postgres>
  POSTGRES_URL_NON_POOLING=<from-vercel-postgres>
  ```

  #### Authentication (from Step 1.2 & 1.3)
  ```
  NEXTAUTH_URL=https://app.lifenavigator.ai
  NEXTAUTH_SECRET=<generated-in-step-1.3>
  GOOGLE_CLIENT_ID=<from-step-1.2>
  GOOGLE_CLIENT_SECRET=<from-step-1.2>
  ```

  #### Encryption (from Step 1.3)
  ```
  ENCRYPTION_KEY=<generated-in-step-1.3>
  ENCRYPTION_MASTER_KEY=<generated-in-step-1.3>
  ENCRYPTION_SALT=<generated-in-step-1.3>
  ENABLE_FIELD_ENCRYPTION=true
  ```

  #### Monitoring (from Step 1.4)
  ```
  SENTRY_DSN=<from-sentry>
  POSTHOG_API_KEY=<optional>
  HONEYBADGER_API_KEY=<optional>
  ```

  #### Backend API Connections
  ```
  FINANCIAL_API_URL=https://api.lifenavigator.ai/api/v1
  FINANCIAL_API_KEY=<generated-in-step-1.3>
  HEALTH_API_URL=https://api.lifenavigator.ai/api/v1
  HEALTH_API_KEY=<generated-in-step-1.3>
  CAREER_API_URL=https://api.lifenavigator.ai/api/v1
  CAREER_API_KEY=<generated-in-step-1.3>
  EDUCATION_API_URL=https://api.lifenavigator.ai/api/v1
  EDUCATION_API_KEY=<generated-in-step-1.3>
  ```

  #### Integrations (add as needed)
  ```
  PLAID_CLIENT_ID=<from-plaid-dashboard>
  PLAID_CLIENT_SECRET=<from-plaid-secret>
  PLAID_ENV=production

  STRIPE_API_KEY=<from-stripe-dashboard>
  STRIPE_WEBHOOK_SECRET=<from-stripe-webhooks>
  ```

  #### Feature Flags
  ```
  ENABLE_MULTI_AGENT=true
  ENABLE_ANALYTICS=true
  ENABLE_FIELD_ENCRYPTION=true
  ```

- [ ] **Set environment scope**
  - For each variable, select appropriate scope:
    - Production: For production deployments only
    - Preview: For preview deployments
    - Development: For local development (optional)

- [ ] **Verify all required variables are set**
  - Cross-reference with [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md)
  - Ensure no placeholder values remain

### 2.3 Domain Configuration

- [ ] **Add custom domain**
  1. Go to Project Settings → Domains
  2. Add domain: `app.lifenavigator.ai`
  3. Configure DNS records as instructed by Vercel:
     ```
     Type: CNAME
     Name: app
     Value: cname.vercel-dns.com
     ```
  4. Wait for DNS propagation (can take up to 48 hours)

- [ ] **Add www redirect (optional)**
  - Add domain: `www.app.lifenavigator.ai`
  - Configure to redirect to `app.lifenavigator.ai`

- [ ] **Verify SSL certificate**
  - Vercel automatically provisions SSL
  - Check that HTTPS works: `https://app.lifenavigator.ai`

---

## Phase 3: Initial Deployment

### 3.1 Deploy to Preview

- [ ] **Create preview deployment**
  ```bash
  cd apps/web
  vercel
  ```

- [ ] **Test preview deployment**
  - Visit the preview URL provided
  - Test authentication flow
  - Test database connections
  - Check error tracking (Sentry)
  - Verify API integrations

- [ ] **Review build logs**
  - Check for warnings or errors
  - Verify all assets compiled correctly
  - Confirm environment variables loaded

### 3.2 Deploy to Production

- [ ] **Deploy to production**
  ```bash
  vercel --prod
  ```

  Or push to `main` branch for automatic deployment:
  ```bash
  git push origin main
  ```

- [ ] **Monitor deployment**
  - Watch deployment logs in Vercel Dashboard
  - Expected build time: 2-5 minutes
  - Wait for "Deployment completed" status

- [ ] **Verify production deployment**
  - Visit `https://app.lifenavigator.ai`
  - Test all critical features
  - Check performance metrics

---

## Phase 4: Post-Deployment Configuration

### 4.1 Webhooks & Integrations

- [ ] **Configure Stripe webhooks**
  1. Go to Stripe Dashboard → Developers → Webhooks
  2. Add endpoint: `https://app.lifenavigator.ai/api/webhooks/stripe`
  3. Select events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
  4. Copy webhook secret to Vercel environment variables

- [ ] **Configure Plaid webhooks** (if using)
  - Add webhook URL: `https://app.lifenavigator.ai/api/webhooks/plaid`
  - Select webhook types

- [ ] **Test webhook delivery**
  - Send test webhooks from service dashboards
  - Verify receipt in application logs

### 4.2 Performance Optimization

- [ ] **Enable Edge Functions** (if applicable)
  - Review which API routes can run on edge
  - Update configuration in `next.config.js`

- [ ] **Configure caching**
  - Set up CDN caching rules
  - Configure ISR (Incremental Static Regeneration) for dynamic pages

- [ ] **Enable Analytics**
  - Vercel Analytics: Project Settings → Analytics
  - Web Vitals tracking enabled by default

### 4.3 Security Hardening

- [ ] **Configure security headers**
  - Add to `next.config.js`:
    ```javascript
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin'
      }
    ]
    ```

- [ ] **Set up rate limiting** (if not using middleware)
  - Consider Vercel Edge Config for rate limiting
  - Or use Upstash Redis rate limiting

- [ ] **Review CORS settings**
  - Ensure only allowed origins can access API
  - Check `CORS_ALLOWED_ORIGINS` environment variable

### 4.4 Monitoring & Alerts

- [ ] **Configure Vercel alerts**
  - Project Settings → Notifications
  - Set up alerts for:
    - Deployment failures
    - Function errors
    - Performance degradation

- [ ] **Set up Sentry alerts**
  - Configure alert rules for error spikes
  - Set up notification channels (email, Slack)

- [ ] **Configure uptime monitoring**
  - Use Honeybadger, UptimeRobot, or similar
  - Monitor critical endpoints:
    - Homepage: `https://app.lifenavigator.ai`
    - Health check: `https://app.lifenavigator.ai/api/health`
    - Auth: `https://app.lifenavigator.ai/api/auth/session`

---

## Phase 5: Database & Data Management

### 5.1 Database Backups

- [ ] **Enable Vercel Postgres backups**
  - Backups are automatic on paid plans
  - Verify backup schedule in Storage settings

- [ ] **Test database restore process**
  - Create test backup
  - Restore to staging environment
  - Verify data integrity

### 5.2 Migrations

- [ ] **Set up migration workflow**
  ```bash
  # Before deploying schema changes:
  cd apps/web
  pnpm prisma migrate deploy
  ```

- [ ] **Add migration checks to CI/CD**
  - Add to GitHub Actions workflow
  - Ensure migrations run before deployment

### 5.3 Data Seeding (if needed)

- [ ] **Create seed script for initial data**
  ```bash
  pnpm prisma db seed
  ```

- [ ] **Verify seed data in production**
  - Check that essential records exist
  - Verify data relationships

---

## Phase 6: Team & Access Management

### 6.1 Team Access

- [ ] **Add team members to Vercel project**
  - Project Settings → Team Members
  - Set appropriate role (Developer, Viewer, Owner)

- [ ] **Configure GitHub integration**
  - Ensure team has appropriate GitHub access
  - Set up branch protection rules

### 6.2 Deployment Permissions

- [ ] **Configure deployment protections**
  - Require approval for production deployments (optional)
  - Set up deployment notifications

- [ ] **Set up staging environment** (optional)
  - Create separate Vercel project for staging
  - Use staging database
  - Configure environment-specific variables

---

## Phase 7: Continuous Deployment

### 7.1 Automatic Deployments

- [ ] **Enable automatic deployments**
  - Project Settings → Git
  - Production Branch: `main`
  - Preview branches: All other branches

- [ ] **Configure deployment triggers**
  - Push to `main` → Production deployment
  - Push to other branches → Preview deployment
  - Pull requests → Preview deployment with unique URL

### 7.2 Deployment Workflow

- [ ] **Establish deployment process**
  1. Create feature branch
  2. Make changes and test locally
  3. Push branch → Creates preview deployment
  4. Test preview deployment
  5. Create PR
  6. Code review
  7. Merge to `main` → Automatic production deployment
  8. Monitor production deployment

- [ ] **Document rollback procedure**
  ```bash
  # Rollback to previous deployment
  vercel rollback

  # Or via dashboard:
  # Deployments → Select previous successful deployment → Promote to Production
  ```

---

## Phase 8: Testing & Validation

### 8.1 Smoke Tests

- [ ] **Authentication**
  - [ ] Sign up with email
  - [ ] Sign in with Google
  - [ ] Password reset flow
  - [ ] Session persistence

- [ ] **Core Features**
  - [ ] Dashboard loads correctly
  - [ ] Data fetching from API
  - [ ] Real-time updates (if applicable)
  - [ ] File uploads (if applicable)

- [ ] **Integrations**
  - [ ] Financial connections (Plaid)
  - [ ] Payment processing (Stripe)
  - [ ] Email notifications (SendGrid)
  - [ ] Error tracking (Sentry)

### 8.2 Performance Tests

- [ ] **Run Lighthouse audit**
  - Open Chrome DevTools → Lighthouse
  - Run audit for:
    - Performance: Target > 90
    - Accessibility: Target > 90
    - Best Practices: Target > 90
    - SEO: Target > 90

- [ ] **Test page load times**
  - Homepage: < 2 seconds
  - Dashboard: < 3 seconds
  - API responses: < 500ms

- [ ] **Test Core Web Vitals**
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1

### 8.3 Security Tests

- [ ] **Test authentication security**
  - [ ] CSRF protection
  - [ ] XSS prevention
  - [ ] SQL injection prevention
  - [ ] Rate limiting on auth endpoints

- [ ] **Verify encryption**
  - [ ] Field-level encryption for PHI/PII
  - [ ] HTTPS enforced
  - [ ] Secure cookies configured

- [ ] **Check security headers**
  - Use [securityheaders.com](https://securityheaders.com/)
  - Grade should be A or A+

---

## Phase 9: Documentation

### 9.1 Internal Documentation

- [ ] **Document deployment process**
  - Update team wiki/docs
  - Include troubleshooting steps
  - Document environment variables

- [ ] **Create runbook**
  - Common deployment issues and fixes
  - Emergency rollback procedure
  - Contact information for services

### 9.2 External Documentation

- [ ] **Update user documentation** (if applicable)
  - New features deployed
  - Breaking changes
  - Migration guides

---

## Phase 10: Go-Live

### 10.1 Pre-Launch Checklist

- [ ] **Verify all systems operational**
  - [ ] Application responding
  - [ ] Database connected
  - [ ] API integrations working
  - [ ] Error tracking active
  - [ ] Monitoring configured

- [ ] **Communication**
  - [ ] Notify team of go-live
  - [ ] Prepare support team
  - [ ] Monitor communication channels

### 10.2 Launch

- [ ] **Make domain live**
  - If using staged DNS, switch to production
  - Update any hardcoded URLs

- [ ] **Monitor closely for first 24 hours**
  - Watch error rates in Sentry
  - Monitor performance metrics
  - Check user feedback
  - Be ready to rollback if needed

### 10.3 Post-Launch

- [ ] **Celebrate!** 🎉
  - Document lessons learned
  - Thank the team
  - Plan next iteration

---

## Troubleshooting

### Common Issues

#### Build Failures

**Problem**: `pnpm install` fails
```
Solution:
1. Verify pnpm version in package.json matches Vercel
2. Clear Vercel cache: Project Settings → Clear Cache
3. Check for dependency conflicts
```

**Problem**: `Module not found` errors
```
Solution:
1. Verify workspace configuration
2. Check imports use correct paths
3. Ensure all dependencies in package.json
```

#### Runtime Errors

**Problem**: `NEXTAUTH_SECRET` error
```
Solution:
1. Verify NEXTAUTH_SECRET is set in environment variables
2. Must be at least 32 characters
3. Redeploy after adding
```

**Problem**: Database connection fails
```
Solution:
1. Check POSTGRES_PRISMA_URL is correct
2. Verify database is running
3. Check connection pooling settings
4. Ensure migrations have run
```

#### Performance Issues

**Problem**: Slow page loads
```
Solution:
1. Enable Vercel Analytics to identify slow pages
2. Review bundle size: pnpm run analyze
3. Implement ISR for dynamic pages
4. Optimize images with next/image
5. Enable Edge Functions for API routes
```

### Getting Help

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Vercel Support**: support@vercel.com (Pro/Enterprise)
- **Community**: [github.com/vercel/next.js/discussions](https://github.com/vercel/next.js/discussions)
- **Project Issues**: See internal documentation

---

## Rollback Procedure

If critical issues arise after deployment:

1. **Immediate Rollback**
   ```bash
   vercel rollback
   ```
   Or via dashboard: Deployments → Previous deployment → "Promote to Production"

2. **Identify Issue**
   - Check Sentry for errors
   - Review deployment logs
   - Check recent code changes

3. **Fix and Redeploy**
   - Create hotfix branch
   - Fix issue
   - Test in preview
   - Deploy to production

4. **Post-Mortem**
   - Document what went wrong
   - Update deployment checklist
   - Implement preventive measures

---

## Maintenance

### Regular Tasks

- [ ] **Weekly**
  - Review error logs in Sentry
  - Check performance metrics
  - Monitor resource usage

- [ ] **Monthly**
  - Review and update dependencies
  - Check for security updates
  - Review access permissions
  - Test backup restore process

- [ ] **Quarterly**
  - Security audit
  - Performance optimization review
  - Disaster recovery drill
  - Update documentation

---

## Success Criteria

Deployment is successful when:

- ✅ Application accessible at production URL
- ✅ All environment variables configured
- ✅ SSL certificate active and valid
- ✅ Authentication working (all providers)
- ✅ Database connected and migrations applied
- ✅ API integrations functioning
- ✅ Error tracking operational
- ✅ Performance metrics within targets
- ✅ Security headers configured
- ✅ Monitoring and alerts active
- ✅ Team has access and documentation
- ✅ Rollback procedure tested and documented

---

**Last Updated**: 2025-11-06
**Document Version**: 1.0.0
**Next Review**: Before first production deployment
