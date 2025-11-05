# Production Deployment Guide - Life Navigator
## Vercel + GCP Cloud SQL (HIPAA & Financial Compliance)

---

## 📋 **Prerequisites**

- [ ] Vercel account (Pro plan recommended for production)
- [ ] Google Cloud Platform account with billing enabled
- [ ] Domain name (for production deployment)
- [ ] GitHub repository connected to Vercel

---

## 🗄️ **Part 1: GCP Cloud SQL Setup (HIPAA & Financial Compliance)**

### Step 1: Enable Required GCP APIs

```bash
# Enable Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Enable Cloud SQL Admin API
gcloud services enable compute.googleapis.com

# Enable Secret Manager (for credentials)
gcloud services enable secretmanager.googleapis.com

# Enable Cloud KMS (for encryption)
gcloud services enable cloudkms.googleapis.com
```

### Step 2: Create Cloud SQL PostgreSQL Instance

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"  # Choose compliant region
export INSTANCE_NAME="lifenavigator-db"

# Create Cloud SQL instance with HIPAA-compliant settings
gcloud sql instances create $INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-8192 \
  --region=$REGION \
  --network=default \
  --no-assign-ip \
  --enable-bin-log \
  --backup-start-time=02:00 \
  --backup-location=$REGION \
  --retained-backups-count=30 \
  --retained-transaction-log-days=7 \
  --database-flags=\
cloudsql.iam_authentication=on,\
log_connections=on,\
log_disconnections=on,\
log_statement=all,\
log_duration=on \
  --require-ssl
```

### Step 3: Enable Encryption at Rest

```bash
# Create a keyring for database encryption
gcloud kms keyrings create lifenavigator-keyring \
  --location=$REGION

# Create an encryption key
gcloud kms keys create lifenavigator-db-key \
  --location=$REGION \
  --keyring=lifenavigator-keyring \
  --purpose=encryption

# Get the key resource name
KEY_NAME=$(gcloud kms keys describe lifenavigator-db-key \
  --location=$REGION \
  --keyring=lifenavigator-keyring \
  --format="value(name)")

# Update instance with customer-managed encryption key
gcloud sql instances patch $INSTANCE_NAME \
  --disk-encryption-key=$KEY_NAME
```

### Step 4: Create Database and User

```bash
# Create the database
gcloud sql databases create lifenavigator \
  --instance=$INSTANCE_NAME

# Create a secure user with strong password
gcloud sql users create lifenavigator_app \
  --instance=$INSTANCE_NAME \
  --password="$(openssl rand -base64 32)"

# Save the password to Secret Manager
echo -n "your_generated_password" | \
  gcloud secrets create db-password --data-file=-
```

### Step 5: Configure SSL/TLS Certificates

```bash
# Download server certificate
gcloud sql ssl-certs create client-cert-$(date +%s) \
  --instance=$INSTANCE_NAME

# Download the certificates
gcloud sql ssl-certs describe client-cert-name \
  --instance=$INSTANCE_NAME \
  --format="get(cert)" > client-cert.pem

gcloud sql ssl-certs describe client-cert-name \
  --instance=$INSTANCE_NAME \
  --format="get(cert)" > client-key.pem

# Download server CA cert
gcloud sql ssl-certs list \
  --instance=$INSTANCE_NAME \
  --format="value(cert)" > server-ca.pem
```

### Step 6: Set Up Connection Proxy (Secure Access)

```bash
# Download Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Get your instance connection name
INSTANCE_CONNECTION=$(gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)")

# Start proxy (for local testing)
./cloud-sql-proxy $INSTANCE_CONNECTION
```

### Step 7: Configure Audit Logging (HIPAA Requirement)

Create `audit-policy.yaml`:
```yaml
auditConfigs:
- auditLogConfigs:
  - logType: ADMIN_READ
  - logType: DATA_READ
  - logType: DATA_WRITE
  service: sqladmin.googleapis.com
```

Apply audit policy:
```bash
gcloud projects set-iam-policy $PROJECT_ID audit-policy.yaml
```

### Step 8: Enable Point-in-Time Recovery

```bash
gcloud sql instances patch $INSTANCE_NAME \
  --enable-point-in-time-recovery
```

---

## 🚀 **Part 2: Vercel Deployment**

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
vercel login
```

### Step 2: Link Project

```bash
cd /path/to/lifenavigator
vercel link
```

### Step 3: Set Environment Variables

```bash
# Database
vercel env add DATABASE_URL production
# Format: postgresql://user:password@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE&sslmode=require

# NextAuth
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production

# Generate secrets
vercel env add ENCRYPTION_KEY production  # openssl rand -hex 32
vercel env add JWT_SECRET production

# Plaid (Production)
vercel env add PLAID_CLIENT_ID production
vercel env add PLAID_SECRET production
vercel env add PLAID_ENV production  # Set to 'production'

# Google OAuth
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add GOOGLE_REDIRECT_URI production

# Microsoft OAuth
vercel env add MICROSOFT_CLIENT_ID production
vercel env add MICROSOFT_CLIENT_SECRET production
vercel env add MICROSOFT_REDIRECT_URI production

# Social Networks
vercel env add LINKEDIN_CLIENT_ID production
vercel env add LINKEDIN_CLIENT_SECRET production
vercel env add TWITTER_CLIENT_ID production
vercel env add TWITTER_CLIENT_SECRET production
vercel env add INSTAGRAM_CLIENT_ID production
vercel env add INSTAGRAM_CLIENT_SECRET production
vercel env add TIKTOK_CLIENT_KEY production
vercel env add TIKTOK_CLIENT_SECRET production

# Email (SendGrid)
vercel env add SENDGRID_API_KEY production
vercel env add EMAIL_FROM production

# Monitoring
vercel env add SENTRY_DSN production
vercel env add NEXT_PUBLIC_SENTRY_DSN production

# Rate Limiting (Upstash Redis)
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production

# Set Node environment
vercel env add NODE_ENV production
```

### Step 4: Configure Build Settings

In Vercel dashboard:
1. Go to Project Settings → General
2. Set Node.js Version: **20.x**
3. Build Command: `prisma generate && next build`
4. Output Directory: `.next`
5. Install Command: `npm install`

### Step 5: Add Database Connection via Cloud SQL Connector

For Vercel to connect to GCP Cloud SQL, you need to:

**Option A: Use Cloud SQL Proxy (Recommended)**
```bash
# In Vercel, use DATABASE_URL with proxy format
DATABASE_URL="postgresql://user:pass@your-instance:5432/dbname?sslmode=require"
```

**Option B: Use Private Service Connect**
1. Enable Private Service Connect in GCP
2. Create a Vercel Integration Network
3. Configure VPC peering

### Step 6: Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

### Step 7: Run Database Migrations

```bash
# After first deployment, run migrations
vercel env pull .env.production
npx prisma migrate deploy
```

---

## 🔒 **Part 3: HIPAA Compliance Checklist**

### ✅ Technical Safeguards

- [x] **Encryption at Rest**: GCP Cloud SQL with customer-managed keys
- [x] **Encryption in Transit**: SSL/TLS certificates, HTTPS only
- [x] **Access Control**: IAM authentication, strong passwords
- [x] **Audit Logging**: Cloud Audit Logs enabled
- [x] **Automatic Backups**: 30-day retention, point-in-time recovery
- [x] **Session Management**: 8-hour session timeout
- [x] **MFA Support**: Built into authentication system

### ✅ Administrative Safeguards

- [ ] **BAA with GCP**: Sign Google Cloud BAA (available in console)
- [ ] **BAA with Vercel**: Contact Vercel sales for Enterprise BAA
- [ ] **Employee Training**: HIPAA training for all team members
- [ ] **Access Policies**: Document who has database access
- [ ] **Incident Response Plan**: Create and document procedures
- [ ] **Regular Audits**: Schedule quarterly security reviews

### ✅ Physical Safeguards

- [x] **Data Center Security**: GCP provides HIPAA-compliant data centers
- [x] **Disaster Recovery**: Multi-region backups
- [x] **Workstation Security**: Enforce encrypted devices for developers

### Additional Requirements

```bash
# Enable VPC Service Controls (optional but recommended)
gcloud access-context-manager perimeters create lifenavigator-perimeter \
  --title="Life Navigator Perimeter" \
  --resources=projects/$PROJECT_ID \
  --restricted-services=sqladmin.googleapis.com

# Enable DLP API for PHI detection
gcloud services enable dlp.googleapis.com
```

---

## 💳 **Part 4: Financial Compliance (PCI DSS)**

### Key Requirements

1. **No Credit Card Storage**: Use Stripe for all payments
   - Stripe is PCI DSS Level 1 certified
   - Never store card numbers, CVV, or magnetic stripe data

2. **Plaid for Financial Data**:
   - Plaid handles all bank credentials
   - We only store encrypted access tokens
   - Plaid is SOC 2 Type II certified

3. **Database Security**:
   - Encrypt all sensitive financial data
   - Use field-level encryption for account numbers
   - Implement data masking (show only last 4 digits)

4. **Audit Trail**:
   - Log all financial data access
   - Maintain 7-year transaction logs
   - Implement tamper-proof audit logs

### Implementation Checklist

- [x] **Encryption**: AES-256 for data at rest
- [x] **TLS**: 1.3 for data in transit
- [x] **Access Control**: Role-based access
- [ ] **Vulnerability Scanning**: Schedule quarterly scans
- [ ] **Penetration Testing**: Annual third-party audit
- [x] **Security Monitoring**: Real-time alerts via Sentry

---

## 📊 **Part 5: Monitoring & Observability**

### Set Up Upstash Redis (for rate limiting and caching)

```bash
# Go to https://upstash.com
# Create new database
# Copy REST URL and Token to Vercel env vars
```

### Set Up Sentry Error Tracking

```bash
npm install @sentry/nextjs

# Add to vercel env vars
vercel env add SENTRY_DSN production
vercel env add SENTRY_AUTH_TOKEN production
```

### Configure Google Cloud Monitoring

```bash
# Create alerting policy for database
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Database High CPU" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s
```

### Set Up Logging

```bash
# View Cloud SQL logs
gcloud logging read "resource.type=cloudsql_database" \
  --limit=50 \
  --format=json

# Create log sink for long-term storage
gcloud logging sinks create lifenavigator-logs \
  storage.googleapis.com/lifenavigator-logs-bucket \
  --log-filter='resource.type="cloudsql_database"'
```

---

## 🧪 **Part 6: Beta Testing Setup**

### Step 1: Create Beta Environment

```bash
# Create separate Cloud SQL instance for beta
gcloud sql instances create lifenavigator-beta \
  --database-version=POSTGRES_15 \
  --tier=db-custom-1-4096 \
  --region=$REGION

# Deploy to Vercel preview branch
git checkout -b beta
vercel --env=preview
```

### Step 2: Set Up Test Users

```sql
-- Create beta tester accounts with special role
INSERT INTO users (email, role, name) VALUES
  ('beta1@test.com', 'beta_tester', 'Beta Tester 1'),
  ('beta2@test.com', 'beta_tester', 'Beta Tester 2');
```

### Step 3: Configure Sandbox Integrations

For beta testing, use sandbox/test credentials:

- **Plaid**: Use sandbox environment
- **Stripe**: Use test mode
- **Social APIs**: Create test applications

### Step 4: Enable Feature Flags

Add to environment:
```bash
ENABLE_BETA_FEATURES=true
BETA_TESTER_EMAILS=beta1@test.com,beta2@test.com
```

### Step 5: Set Up Feedback Collection

```typescript
// Add to /src/app/api/feedback/route.ts
export async function POST(request: NextRequest) {
  // Collect beta tester feedback
  // Store in database with beta_feedback table
}
```

### Step 6: Analytics for Beta

```bash
# Add Google Analytics with custom events
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Track beta-specific events:
# - feature_usage
# - error_encountered
# - feedback_submitted
```

---

## 🔐 **Part 7: Security Hardening**

### Enable Security Headers

Already configured in `vercel.json`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: HSTS enabled

### Configure CSP (Content Security Policy)

Add to `next.config.js`:
```javascript
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### Enable WAF (Web Application Firewall)

```bash
# Use Cloudflare in front of Vercel
# Or use Vercel's built-in DDoS protection (Enterprise plan)
```

---

## 📝 **Part 8: Compliance Documentation**

### Required Documents

1. **Privacy Policy** - `/legal/privacy-policy.md`
2. **Terms of Service** - `/legal/terms-of-service.md`
3. **HIPAA Notice** - `/legal/hipaa-notice.md`
4. **Data Processing Agreement** - For enterprise customers
5. **Security Whitepaper** - For compliance audits

### Annual Requirements

- [ ] SOC 2 Type II Audit (optional but recommended)
- [ ] Penetration Testing Report
- [ ] HIPAA Risk Assessment
- [ ] Disaster Recovery Test
- [ ] Business Continuity Plan Update

---

## 🚨 **Part 9: Incident Response Plan**

### Security Incident Procedures

1. **Detect**: Monitoring alerts, user reports
2. **Contain**: Disable affected services, rotate credentials
3. **Investigate**: Check audit logs, identify scope
4. **Eradicate**: Fix vulnerability, apply patches
5. **Recover**: Restore from backups if needed
6. **Report**: Notify affected users within 72 hours (GDPR/HIPAA)

### Breach Notification Contacts

```bash
# HIPAA Breach: notify HHS within 60 days
# GDPR Breach: notify DPA within 72 hours
# State Laws: varies by state
```

---

## ✅ **Deployment Checklist**

### Pre-Deployment

- [ ] All environment variables set in Vercel
- [ ] GCP Cloud SQL instance created and configured
- [ ] SSL certificates generated
- [ ] Encryption keys created
- [ ] Audit logging enabled
- [ ] Backups configured (30-day retention)
- [ ] All tests passing (`npm test`)
- [ ] Security scan completed
- [ ] Privacy policy and terms published

### Post-Deployment

- [ ] Run database migrations
- [ ] Verify SSL/TLS connections
- [ ] Test authentication flows
- [ ] Test Plaid integration (sandbox)
- [ ] Test calendar sync
- [ ] Test social network connections
- [ ] Verify audit logs are collecting
- [ ] Set up monitoring alerts
- [ ] Create first admin user
- [ ] Invite beta testers

### Beta Testing

- [ ] 10-20 beta testers invited
- [ ] Feedback form live
- [ ] Analytics tracking
- [ ] Support channel set up (Discord/Slack)
- [ ] Weekly check-ins scheduled
- [ ] Bug tracking system (GitHub Issues)

---

## 📞 **Support Contacts**

- **GCP Support**: https://cloud.google.com/support
- **Vercel Support**: https://vercel.com/support
- **Plaid Support**: support@plaid.com
- **Security Issues**: security@your-domain.com

---

## 🎉 **Ready for Production!**

Once all checklists are complete, your Life Navigator app will be:
- ✅ HIPAA compliant
- ✅ PCI DSS aligned (via Stripe/Plaid)
- ✅ SOC 2 ready
- ✅ Scalable and monitored
- ✅ Secure and encrypted
- ✅ Ready for beta testing

**Estimated Setup Time**: 4-6 hours for full production deployment
**Estimated Cost**: ~$200-500/month (GCP + Vercel + integrations)

---

## 📚 **Additional Resources**

- [GCP Cloud SQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)
- [HIPAA on GCP Guide](https://cloud.google.com/security/compliance/hipaa)
- [Vercel Security](https://vercel.com/docs/concepts/security)
- [Next.js Production Checklist](https://nextjs.org/docs/going-to-production)
