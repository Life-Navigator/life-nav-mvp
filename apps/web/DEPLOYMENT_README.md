# Life Navigator - Production Deployment
## Complete Guide to Deploying a HIPAA & Financial Compliant Application

---

## 🎯 Overview

This directory contains everything you need to deploy Life Navigator to production with full HIPAA and financial compliance.

**Tech Stack**:
- **Frontend/Backend**: Next.js 14 (deployed on Vercel)
- **Database**: GCP Cloud SQL PostgreSQL 15 (HIPAA-compliant)
- **Authentication**: NextAuth.js with MFA
- **Integrations**: Plaid, Google, Microsoft, LinkedIn, Twitter, Instagram, TikTok
- **Monitoring**: Sentry, Upstash Redis, GCP Cloud Monitoring
- **Email**: SendGrid

**Estimated Setup Time**: 4-6 hours
**Estimated Monthly Cost**: $200-500

---

## 📚 Documentation Index

| Document | Purpose | Time Required |
|----------|---------|---------------|
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Complete step-by-step deployment | 4-6 hours |
| **[OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)** | Set up all OAuth integrations | 2-3 hours |
| **[BETA_TESTING_GUIDE.md](./BETA_TESTING_GUIDE.md)** | Run beta testing program | 4 weeks |
| **[HIPAA_COMPLIANCE_CHECKLIST.md](./HIPAA_COMPLIANCE_CHECKLIST.md)** | Ensure HIPAA compliance | Ongoing |
| **[MONITORING_SETUP_GUIDE.md](./MONITORING_SETUP_GUIDE.md)** | Set up observability | 2 hours |
| **[.env.production.template](./.env.production.template)** | Production environment variables | 30 min |

---

## 🚀 Quick Start Deployment

### Prerequisites

1. **Accounts Created**:
   - [ ] Vercel account
   - [ ] Google Cloud Platform account (billing enabled)
   - [ ] Domain name (optional but recommended)

2. **Tools Installed**:
   ```bash
   # Vercel CLI
   npm i -g vercel

   # Google Cloud SDK
   # https://cloud.google.com/sdk/docs/install
   ```

3. **Repository Setup**:
   ```bash
   # Clone and navigate to project
   cd lifenavigator

   # Install dependencies
   npm install
   ```

### Step-by-Step Deployment

#### Phase 1: Database Setup (1 hour)

1. Run the GCP setup script:
   ```bash
   ./scripts/setup-gcp.sh
   ```

   This will:
   - Create Cloud SQL instance with HIPAA compliance
   - Configure encryption at rest (CMEK)
   - Enable audit logging
   - Set up 30-day backups
   - Generate secure credentials
   - Save connection info to `.env.gcp`

2. Verify database:
   ```bash
   # Download Cloud SQL Proxy
   ./cloud-sql-proxy YOUR_INSTANCE_CONNECTION_NAME

   # In another terminal, test connection
   psql "postgresql://USER:PASSWORD@localhost:5432/lifenavigator"
   ```

#### Phase 2: OAuth Setup (2 hours)

Follow [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md) to create apps for:

**Required** (for core functionality):
- [x] Plaid (financial data)
- [x] SendGrid (emails)
- [x] Upstash (rate limiting)
- [x] Sentry (error tracking)

**Optional** (for integrations):
- [ ] Google (calendar, email)
- [ ] Microsoft (Outlook, calendar)
- [ ] LinkedIn (professional network)
- [ ] Twitter (social network)
- [ ] Instagram (social network)
- [ ] TikTok (social network)

#### Phase 3: Environment Variables (30 minutes)

1. Copy the production template:
   ```bash
   cp .env.production.template .env.production.local
   ```

2. Generate secrets:
   ```bash
   # NextAuth secret
   openssl rand -base64 32

   # Encryption key
   openssl rand -hex 32

   # JWT secret
   openssl rand -base64 32
   ```

3. Fill in all variables in `.env.production.local`

4. Add to Vercel:
   ```bash
   # Interactive mode (paste values when prompted)
   vercel env add NEXTAUTH_SECRET production
   vercel env add DATABASE_URL production
   vercel env add ENCRYPTION_KEY production
   # ... (continue for all variables)

   # Or bulk import
   vercel env pull .env.vercel.production
   # Then manually add missing values
   ```

#### Phase 4: Deploy to Vercel (15 minutes)

1. Link project:
   ```bash
   vercel link
   ```

2. Preview deployment (optional):
   ```bash
   vercel
   ```

3. Production deployment:
   ```bash
   ./scripts/deploy-production.sh
   ```

   This will:
   - Check dependencies
   - Validate environment variables
   - Run tests
   - Build application
   - Deploy to Vercel
   - Run database migrations
   - Perform health check

#### Phase 5: Monitoring Setup (1 hour)

Follow [MONITORING_SETUP_GUIDE.md](./MONITORING_SETUP_GUIDE.md):

1. **Sentry** (error tracking):
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```

2. **Upstash** alerts (rate limiting):
   - Set up in Upstash Console
   - Configure alerts for memory, latency

3. **GCP Cloud Monitoring** (database):
   - Create monitoring dashboard
   - Set up CPU, memory, connection alerts

4. **Vercel Analytics** (traffic):
   - Enable in Vercel Dashboard
   - Monitor Core Web Vitals

#### Phase 6: Beta Testing (4 weeks)

Follow [BETA_TESTING_GUIDE.md](./BETA_TESTING_GUIDE.md):

1. Set up beta environment
2. Recruit 10-50 beta testers
3. Run 4-week testing program
4. Collect feedback and iterate
5. Prepare for production launch

---

## 📋 Pre-Launch Checklist

### Infrastructure
- [ ] GCP Cloud SQL instance running
- [ ] Database encrypted at rest (CMEK enabled)
- [ ] SSL/TLS required for all connections
- [ ] Backups configured (30-day retention)
- [ ] Point-in-time recovery enabled
- [ ] Vercel project deployed
- [ ] Custom domain configured (optional)
- [ ] DNS records updated

### Security
- [ ] All environment variables set
- [ ] Secrets are cryptographically random
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] MFA available
- [ ] Session timeout: 8 hours
- [ ] Audit logging enabled

### Compliance
- [ ] HIPAA compliance checklist reviewed
- [ ] BAA signed with GCP
- [ ] BAA signed with Vercel (Enterprise plan)
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie consent implemented
- [ ] Data retention policies set
- [ ] Incident response plan documented

### Integrations
- [ ] Plaid configured (production mode)
- [ ] SendGrid domain verified
- [ ] OAuth apps created
- [ ] Upstash Redis configured
- [ ] Sentry error tracking active

### Monitoring
- [ ] Sentry receiving errors
- [ ] GCP dashboards created
- [ ] Alert rules configured
- [ ] Alert channels tested
- [ ] Performance budgets set
- [ ] Log retention configured

### Testing
- [ ] All tests passing
- [ ] Manual testing complete
- [ ] OAuth flows tested
- [ ] Payment processing tested (if applicable)
- [ ] Email delivery tested
- [ ] Error alerting tested
- [ ] Backup restoration tested

---

## 🔒 HIPAA Compliance Status

Current compliance status: See [HIPAA_COMPLIANCE_CHECKLIST.md](./HIPAA_COMPLIANCE_CHECKLIST.md)

**Implemented**:
- ✅ Encryption at rest (GCP CMEK)
- ✅ Encryption in transit (TLS 1.3)
- ✅ Access control (NextAuth.js)
- ✅ MFA support
- ✅ Session timeout (8 hours)
- ✅ Database audit logging
- ✅ Automatic backups (30-day retention)
- ✅ Security headers

**In Progress**:
- 🟡 Application-level audit trail
- 🟡 Field-level encryption
- 🟡 RBAC for health data
- 🟡 HIPAA training program

**Not Started**:
- 🔴 Security policies documentation
- 🔴 Workforce security procedures
- 🔴 Contingency plan documentation

**Estimated Time to Full Compliance**: 4-6 weeks

---

## 💰 Cost Breakdown

### Monthly Operating Costs

| Service | Tier | Cost |
|---------|------|------|
| **GCP Cloud SQL** | db-custom-2-8192 | $150-200 |
| **Vercel** | Pro | $20 |
| **Upstash Redis** | Pay-as-you-go | $10-20 |
| **Sentry** | Team | $26 |
| **SendGrid** | Essentials | $15 |
| **Domain** | .com | $12/year |
| **Total** | | **~$220-280/month** |

### One-Time Costs
- Domain registration: $12
- SSL certificate: $0 (included with Vercel)
- Development tools: $0 (using free tiers)

### Scaling Costs
As you grow:
- **100 users**: ~$250/month
- **1,000 users**: ~$400/month
- **10,000 users**: ~$800/month (consider Reserved Instances)

---

## 🐛 Troubleshooting

### Common Issues

**1. Database Connection Failed**

```bash
# Check instance is running
gcloud sql instances describe lifenavigator-db

# Test connection via proxy
./cloud-sql-proxy YOUR_INSTANCE_CONNECTION
psql "postgresql://USER:PASSWORD@localhost:5432/lifenavigator"

# Verify DATABASE_URL format
# Should be: postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE&sslmode=require
```

**2. Vercel Deployment Failed**

```bash
# Check build logs
vercel logs

# Verify environment variables
vercel env ls production

# Test build locally
npm run build
```

**3. OAuth Integration Not Working**

- Verify redirect URI matches exactly (including https://)
- Check client ID and secret are correct
- Ensure app is published (not in draft mode)
- Review API permissions/scopes

**4. Plaid Sandbox Not Working**

```
Username: user_good
Password: pass_good
MFA: 1234

Institution: First Platypus Bank
```

**5. Email Delivery Failed**

- Verify SendGrid API key is correct
- Check domain is verified
- Review SendGrid activity logs
- Test with simple email first

---

## 📞 Support Resources

### Documentation
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Vercel: https://vercel.com/docs
- GCP: https://cloud.google.com/docs

### Compliance
- HIPAA: https://www.hhs.gov/hipaa
- PCI DSS: https://www.pcisecuritystandards.org

### Integrations
- Plaid: https://plaid.com/docs
- SendGrid: https://docs.sendgrid.com
- Sentry: https://docs.sentry.io

### Community
- Discord: [Create your server]
- GitHub Issues: [Your repo]/issues
- Email: support@lifenavigator.com

---

## 🎉 Launch Readiness

### Pre-Launch Timeline

**Week -4**: Infrastructure setup
- [ ] GCP Cloud SQL instance created
- [ ] Vercel project deployed
- [ ] All OAuth apps created

**Week -3**: Integration testing
- [ ] Plaid integration tested
- [ ] Calendar sync tested
- [ ] Social network integrations tested
- [ ] Email delivery tested

**Week -2**: Security & compliance
- [ ] Security audit completed
- [ ] HIPAA checklist reviewed
- [ ] BAAs signed
- [ ] Policies published

**Week -1**: Beta testing
- [ ] 10-50 beta testers recruited
- [ ] Beta environment stable
- [ ] Major bugs fixed

**Launch Day**: Go live!
- [ ] Final deployment
- [ ] Monitoring active
- [ ] Support ready
- [ ] Marketing announcement

---

## 📈 Post-Launch Checklist

### Day 1
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify all alerts working
- [ ] Be ready for support requests

### Week 1
- [ ] Review user feedback
- [ ] Fix critical bugs
- [ ] Optimize performance
- [ ] Update documentation

### Month 1
- [ ] Analyze usage metrics
- [ ] Review security logs
- [ ] Optimize costs
- [ ] Plan feature roadmap

---

## 🔄 Maintenance Schedule

### Daily
- Monitor error rates
- Check system health
- Review critical alerts

### Weekly
- Review audit logs
- Check performance metrics
- Update dependencies

### Monthly
- Security patch review
- Cost optimization review
- Backup verification test
- Team retrospective

### Quarterly
- Comprehensive security audit
- Disaster recovery drill
- HIPAA compliance review
- Penetration testing

### Annually
- Full HIPAA risk assessment
- Business continuity test
- Vendor compliance review
- Employee training refresh

---

## 🚦 Deployment Status

**Current Phase**: 🟡 Infrastructure Ready

**Completed**:
- ✅ Deployment scripts created
- ✅ Documentation complete
- ✅ Environment templates ready
- ✅ Monitoring guides written
- ✅ HIPAA checklist documented

**Next Steps**:
1. Run `./scripts/setup-gcp.sh` to create database
2. Set up OAuth applications (follow OAUTH_SETUP_GUIDE.md)
3. Configure environment variables
4. Deploy to Vercel
5. Set up monitoring
6. Start beta testing

**Ready for Beta**: After completing next steps above
**Ready for Production**: After 4-week beta testing + HIPAA compliance

---

## 📝 Quick Reference Commands

```bash
# GCP Database Setup
./scripts/setup-gcp.sh

# Deploy to Production
./scripts/deploy-production.sh

# View Database Logs
gcloud logging read "resource.type=cloudsql_database" --limit=50

# Connect to Database (via proxy)
./cloud-sql-proxy YOUR_INSTANCE_CONNECTION

# Test Health Endpoint
curl https://your-app.vercel.app/health

# View Vercel Logs
vercel logs --follow

# Run Migrations
vercel env pull .env.production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Run Tests
npm test

# Build Locally
npm run build

# Start Development
npm run dev
```

---

## 🎊 You're Ready to Deploy!

Follow the guides in order:

1. **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Start here
2. **[OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)** - Set up integrations
3. **[MONITORING_SETUP_GUIDE.md](./MONITORING_SETUP_GUIDE.md)** - Enable monitoring
4. **[BETA_TESTING_GUIDE.md](./BETA_TESTING_GUIDE.md)** - Run beta program
5. **[HIPAA_COMPLIANCE_CHECKLIST.md](./HIPAA_COMPLIANCE_CHECKLIST.md)** - Ensure compliance

**Questions?** Open an issue or contact support@lifenavigator.com

**Good luck with your launch!** 🚀
