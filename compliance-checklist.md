# Production Compliance Checklist

## HIPAA Compliance (Health Data)
- [ ] **Encryption**
  - ✅ At-rest encryption (Azure TDE)
  - ✅ In-transit encryption (TLS 1.2+)
  - ✅ Application-level encryption (AES-256-GCM)
- [ ] **Access Controls**
  - ✅ Row-level security implemented
  - ✅ Role-based access control (RBAC)
  - ⚠️ Need: Regular access reviews
- [ ] **Audit Logging**
  - ✅ Audit tables created
  - ⚠️ Need: Immutable log storage
  - ⚠️ Need: 6-year retention policy
- [ ] **Business Associate Agreement (BAA)**
  - ⚠️ Need: BAA with Microsoft Azure
- [ ] **Risk Assessment**
  - ✅ Risk assessment system built
  - ⚠️ Need: Annual security risk assessment

## GDPR Compliance (EU Users)
- [ ] **Privacy Rights**
  - ✅ Data encryption
  - ⚠️ Need: Right to erasure API
  - ⚠️ Need: Data portability export
  - ⚠️ Need: Consent management
- [ ] **Data Residency**
  - ⚠️ Need: EU data stays in EU region
- [ ] **Privacy Policy**
  - ⚠️ Need: Clear privacy policy
  - ⚠️ Need: Cookie consent banner
- [ ] **Data Protection Officer**
  - ⚠️ Need: Appoint DPO if processing large scale

## PCI DSS (Payment Data)
- [ ] **If Processing Payments**
  - ✅ Network segmentation
  - ✅ Encryption of cardholder data
  - ⚠️ Need: Quarterly vulnerability scans
  - ⚠️ Need: Annual penetration testing
- [ ] **Recommendation**: Use Stripe/PayPal to avoid PCI scope

## SOC 2 Type II (Enterprise Customers)
- [ ] **Security**
  - ✅ Encryption implemented
  - ✅ Access controls
  - ⚠️ Need: Vulnerability management
- [ ] **Availability**
  - ✅ 99.9% SLA possible
  - ✅ Disaster recovery plan
- [ ] **Confidentiality**
  - ✅ Data classification
  - ✅ Encryption
- [ ] **Process Integrity**
  - ⚠️ Need: Change management process
- [ ] **Privacy**
  - ⚠️ Need: Privacy impact assessments

## Required Actions Before Production

### Immediate (Before Launch)
1. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   psql $DATABASE_URL < prisma/migrations/enable_rls.sql
   ```

2. **Enable Azure Security Center**
   ```bash
   terraform apply -var="enable_security_center=true"
   ```

3. **Configure backup verification**
   ```bash
   # Test restore procedure monthly
   az postgres flexible-server restore
   ```

4. **Set up monitoring alerts**
   - Budget alerts ✅ (configured)
   - Security alerts ⚠️ (add Security Center)
   - Compliance alerts ⚠️ (need configuration)

### Within 30 Days
1. **Security Assessment**
   - Run Azure Security Center assessment
   - Fix critical/high findings
   - Document security posture

2. **Penetration Testing**
   - Hire security firm or use Azure tools
   - Fix identified vulnerabilities
   - Retest critical findings

3. **Compliance Documentation**
   - Privacy Policy
   - Terms of Service
   - Data Processing Agreement
   - Security Policy

### Within 90 Days
1. **Certifications** (if needed)
   - HIPAA attestation
   - SOC 2 Type I assessment
   - ISO 27001 preparation

2. **Advanced Security**
   - Enable WAF ($50/month)
   - Enable DDoS Protection (if high risk)
   - Implement SIEM solution

## Compliance Costs

### Current Setup
- Infrastructure: $500/month ✅
- Basic compliance: Included ✅

### Full Compliance (Additional)
- WAF: $50/month
- Defender for Cloud: $40/month
- Audit log storage: $20/month
- Penetration testing: $5,000/year
- SOC 2 audit: $20,000/year (if needed)
- **Total additional**: ~$110/month + audits

## Data Residency Configuration

```hcl
# For GDPR compliance, deploy in EU region
location = "West Europe"  # Amsterdam

# Or multi-region deployment
regions = {
  us = "East US"       # US users
  eu = "West Europe"   # EU users (GDPR)
  ap = "Southeast Asia" # APAC users
}
```

## Validation Commands

```bash
# Check encryption at rest
az postgres flexible-server configuration show \
  --resource-group rg-lifenavigator-prod \
  --server-name psql-lifenavigator-prod \
  --name azure.extensions

# Verify SSL enforcement
psql $DATABASE_URL -c "SHOW ssl;"

# Check backup configuration
az postgres flexible-server backup list \
  --resource-group rg-lifenavigator-prod \
  --server-name psql-lifenavigator-prod

# Audit log verification
az monitor diagnostic-settings list \
  --resource $(az postgres flexible-server show \
    --resource-group rg-lifenavigator-prod \
    --name psql-lifenavigator-prod \
    --query id -o tsv)

# Security assessment
az security assessment list \
  --resource-group rg-lifenavigator-prod
```

## Sign-offs Required

- [ ] **Security Officer**: Approve security controls
- [ ] **Compliance Officer**: Approve compliance measures
- [ ] **DPO**: Approve privacy controls (if appointed)
- [ ] **CTO/Engineering**: Approve technical implementation
- [ ] **Legal**: Approve terms and policies

## Regular Audits (Post-Launch)

### Monthly
- Review access logs
- Check failed login attempts
- Verify backups are working
- Review security alerts

### Quarterly
- Access control review
- Vulnerability scanning
- Backup restoration test
- Compliance checklist review

### Annually
- Penetration testing
- Security risk assessment
- Disaster recovery drill
- Compliance audit (if required)