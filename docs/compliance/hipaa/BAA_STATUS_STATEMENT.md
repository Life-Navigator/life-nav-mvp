# HIPAA BAA Status Statement

**Rule: Every compliance claim must be defensible and legally accurate.**

---

## Overview

This document provides legally-vetted statements regarding LifeNavigator's HIPAA Business Associate Agreement (BAA) with Google Cloud Platform. These statements are approved for use in:
- Internal communications (employees, executives, board)
- External communications (customers, prospects, partners)
- Privacy policies and terms of service
- Security questionnaires and RFPs
- SOC 2 / ISO 27001 reports
- Marketing materials

**Legal Review Required:** Any deviation from these exact statements must be reviewed by General Counsel.

---

## Table of Contents

1. [Internal Statements](#internal-statements)
2. [External Statements](#external-statements)
3. [Customer-Facing Statements](#customer-facing-statements)
4. [Privacy Policy Language](#privacy-policy-language)
5. [Security Questionnaire Responses](#security-questionnaire-responses)
6. [SOC 2 Report Language](#soc-2-report-language)
7. [Marketing Material Guidelines](#marketing-material-guidelines)
8. [Prohibited Statements](#prohibited-statements)
9. [Statement Approval Process](#statement-approval-process)

---

## Internal Statements

### For: Internal emails, Slack, team meetings, employee onboarding

#### Statement 1: General HIPAA Compliance Status

**Approved Statement:**
> LifeNavigator is HIPAA compliant. We have executed a Business Associate Agreement (BAA) with Google Cloud, effective January 15, 2026, covering all GCP services that process Protected Health Information (PHI). Our technical, administrative, and physical safeguards comply with the HIPAA Security Rule (45 CFR Part 164).

**Usage Context:** General internal communication about HIPAA status.

**Do NOT say:**
- ❌ "We are fully HIPAA compliant" (implies 100% perfection, legally risky)
- ❌ "We are HIPAA certified" (HIPAA has no certification)
- ❌ "We guarantee HIPAA compliance" (no absolute guarantees in law)

---

#### Statement 2: BAA Coverage Scope

**Approved Statement:**
> Our BAA with Google Cloud covers the following services that process ePHI: Cloud SQL for PostgreSQL, Google Kubernetes Engine (GKE), Cloud Storage, Cloud Key Management Service (KMS), Secret Manager, VPC Network, Cloud Load Balancing, Cloud Logging, and Cloud Monitoring. All other services (e.g., Firestore, Firebase, App Engine) are prohibited from processing ePHI per our HIPAA Service Policy.

**Usage Context:** Explaining to engineers which GCP services are allowed for ePHI.

---

#### Statement 3: Developer Responsibilities

**Approved Statement:**
> All engineers working with ePHI must follow our HIPAA Service Policy and ePHI Flow Control procedures. ePHI must NEVER be processed by non-HIPAA services (Sentry, SendGrid, Stripe, Mixpanel, etc.), stored in browser localStorage, or logged to stdout. Violations may result in disciplinary action and must be reported immediately to the Compliance Officer.

**Usage Context:** Engineering team meetings, code review guidelines.

---

#### Statement 4: Incident Reporting

**Approved Statement:**
> If you suspect ePHI has been exposed to a non-HIPAA service (e.g., leaked to Sentry logs, sent via email, stored in frontend cache), immediately notify the Compliance Officer and Security Lead. HIPAA requires breach notification within 60 days if 500+ patients are affected. Early detection is critical.

**Usage Context:** Security training, incident response procedures.

---

## External Statements

### For: Customer communications, sales calls, partner discussions, public statements

#### Statement 5: General HIPAA Compliance (External)

**Approved Statement:**
> LifeNavigator maintains HIPAA compliance for all Protected Health Information (PHI). We have executed a Business Associate Agreement with our cloud infrastructure provider and implement technical, administrative, and physical safeguards in accordance with the HIPAA Security Rule. We conduct regular audits, backup verification tests, and disaster recovery drills to ensure ongoing compliance.

**Usage Context:** Customer-facing website, sales presentations, security questionnaires.

**Legal Note:** We do NOT name Google Cloud publicly to avoid implying endorsement. We use "cloud infrastructure provider" instead.

---

#### Statement 6: Subcontractors (Business Associate Chain)

**Approved Statement:**
> LifeNavigator's Business Associate Agreement with our cloud infrastructure provider (Google Cloud) ensures that all subcontractors in the chain of data processing are also HIPAA-compliant and have executed BAAs. We maintain a comprehensive inventory of all services processing PHI and verify their HIPAA eligibility quarterly.

**Usage Context:** Customer due diligence, legal negotiations.

---

#### Statement 7: Encryption

**Approved Statement:**
> All PHI is encrypted at rest using AES-256 encryption with customer-managed encryption keys (CMEK) stored in a FIPS 140-2 validated Hardware Security Module (HSM). PHI is encrypted in transit using TLS 1.2 or higher. Encryption keys are rotated every 90 days.

**Usage Context:** Security questionnaires, SOC 2 reports.

---

#### Statement 8: Audit Logging

**Approved Statement:**
> All access to PHI is logged and retained for 7 years in compliance with HIPAA requirements. Audit logs include user identity, timestamp, action performed, and resource accessed. Logs are encrypted, tamper-proof (retention lock), and accessible only to authorized personnel.

**Usage Context:** Compliance audits, customer due diligence.

---

#### Statement 9: Backup and Disaster Recovery

**Approved Statement:**
> LifeNavigator maintains automated daily backups with point-in-time recovery (PITR) for all PHI databases. Backups are encrypted, geographically redundant, and tested monthly via restoration drills. Our Recovery Time Objective (RTO) for PHI databases is 15 minutes, and Recovery Point Objective (RPO) is 1 minute.

**Usage Context:** Business continuity discussions, RFP responses.

---

## Customer-Facing Statements

### For: Marketing website, customer portal, support documentation

#### Statement 10: Privacy and Security Commitment

**Approved Statement:**
> At LifeNavigator, protecting your health information is our top priority. We are HIPAA compliant and use industry-leading security practices including encryption, access controls, audit logging, and regular security assessments. Your Protected Health Information (PHI) is stored in secure, HIPAA-compliant infrastructure with multiple layers of protection.

**Usage Context:** Homepage, About Us page, customer onboarding.

---

#### Statement 11: Data Storage Location

**Approved Statement:**
> Your Protected Health Information (PHI) is stored in secure, HIPAA-compliant data centers located in the United States (us-central1 region). PHI is NOT transferred outside the United States. All data is encrypted at rest and in transit.

**Usage Context:** Privacy policy, customer FAQ.

---

#### Statement 12: Customer BAA Availability

**Approved Statement:**
> LifeNavigator offers a Business Associate Agreement (BAA) to all customers who are HIPAA Covered Entities. If you are a healthcare provider, health plan, or healthcare clearinghouse subject to HIPAA, please contact our Compliance team at compliance@lifenavigator.com to execute a BAA.

**Usage Context:** Sales page, customer onboarding, legal documentation.

---

## Privacy Policy Language

### For: Website privacy policy, terms of service

#### Privacy Policy Section: HIPAA Compliance

**Approved Language:**

```markdown
## HIPAA Compliance

LifeNavigator is committed to protecting Protected Health Information (PHI) in accordance with the Health Insurance Portability and Accountability Act (HIPAA).

### Business Associate Agreements

If you are a HIPAA Covered Entity (e.g., healthcare provider, health plan), LifeNavigator will execute a Business Associate Agreement (BAA) with you prior to processing any PHI. Our BAA ensures that:
- We implement appropriate safeguards to protect PHI
- We report security incidents and breaches as required by HIPAA
- We provide access to PHI for amendments and accounting of disclosures
- We make our internal practices available for HHS compliance reviews

To request a BAA, contact: compliance@lifenavigator.com

### Technical Safeguards

LifeNavigator implements the following technical safeguards for PHI:
- **Encryption at Rest:** AES-256 encryption with customer-managed keys
- **Encryption in Transit:** TLS 1.2+ for all PHI transmissions
- **Access Control:** Role-based access control (RBAC) with multi-factor authentication (MFA)
- **Audit Logging:** 7-year retention of all PHI access logs
- **Backup and Recovery:** Daily automated backups with point-in-time recovery

### Administrative Safeguards

- **Security Officer:** Designated Privacy and Security Officer responsible for HIPAA compliance
- **Workforce Training:** Annual HIPAA training for all employees with PHI access
- **Risk Assessments:** Annual HIPAA risk assessments and security reviews
- **Incident Response:** Documented incident response plan with 60-day breach notification

### Physical Safeguards

- **Data Center Security:** PHI is stored in HIPAA-compliant data centers with 24/7 physical security, biometric access control, and video surveillance
- **Workstation Security:** Workstations with PHI access require full-disk encryption and automatic screen locks
- **Device and Media Controls:** Secure disposal of media containing PHI (NIST SP 800-88 sanitization)

### Your Rights

If you are a patient whose PHI is processed by LifeNavigator, you have the right to:
- **Access:** Request a copy of your PHI
- **Amendment:** Request corrections to your PHI
- **Accounting of Disclosures:** Request a list of PHI disclosures
- **Restriction:** Request restrictions on PHI use/disclosure
- **Confidential Communications:** Request alternative communication methods

To exercise these rights, contact: privacy@lifenavigator.com

### Breach Notification

In the event of a breach of unsecured PHI affecting 500 or more individuals, LifeNavigator will:
- Notify affected individuals within 60 days
- Notify the Department of Health and Human Services (HHS)
- Notify prominent media outlets (if applicable)

For breaches affecting fewer than 500 individuals, we will notify affected individuals within 60 days and submit an annual breach report to HHS.

### Questions

For questions about our HIPAA compliance practices, contact:
- **Compliance Officer:** compliance@lifenavigator.com
- **Privacy Officer:** privacy@lifenavigator.com
```

---

## Security Questionnaire Responses

### For: Customer security assessments, vendor risk questionnaires, RFP responses

#### Question: "Do you have a Business Associate Agreement (BAA) with your cloud provider?"

**Approved Response:**
> Yes. LifeNavigator has executed a Business Associate Agreement (BAA) with our cloud infrastructure provider (Google Cloud), effective January 15, 2026. The BAA covers all services that process Protected Health Information (PHI), including database, compute, storage, encryption, and networking services.

---

#### Question: "Which cloud services are covered by your BAA?"

**Approved Response:**
> Our BAA covers the following Google Cloud Platform (GCP) services:
> - Cloud SQL for PostgreSQL (PHI database)
> - Google Kubernetes Engine / GKE (application compute)
> - Cloud Storage (encrypted PHI documents)
> - Cloud Key Management Service / KMS (encryption key management)
> - Secret Manager (credential storage)
> - VPC Network (private networking)
> - Cloud Load Balancing (HTTPS ingress)
> - Cloud Logging (audit logs with 7-year retention)
> - Cloud Monitoring (HIPAA metrics)

---

#### Question: "How is PHI encrypted at rest?"

**Approved Response:**
> All PHI is encrypted at rest using AES-256 encryption with customer-managed encryption keys (CMEK). Encryption keys are stored in Google Cloud Key Management Service (Cloud KMS) with FIPS 140-2 Level 3 validated Hardware Security Modules (HSMs). Keys are rotated every 90 days. We maintain complete control over encryption keys and can revoke access at any time.

---

#### Question: "How is PHI encrypted in transit?"

**Approved Response:**
> All PHI in transit is encrypted using TLS 1.2 or higher with modern cipher suites (TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 or stronger). We enforce HTTPS for all client connections and mTLS (mutual TLS) for internal service-to-service communication. Database connections use SSL/TLS with certificate verification.

---

#### Question: "How long do you retain audit logs?"

**Approved Response:**
> LifeNavigator retains audit logs for 7 years in compliance with HIPAA requirements. Audit logs are stored in immutable storage with retention lock (cannot be deleted or modified before the retention period expires). Logs include Cloud SQL access logs, Cloud Storage data access logs, Cloud KMS encryption/decryption logs, and administrative activity logs.

---

#### Question: "How often do you test backups?"

**Approved Response:**
> LifeNavigator conducts weekly automated backup verification tests and monthly backup restoration drills. Our HIPAA database backups are tested by restoring to a staging environment and verifying data integrity. We maintain documentation of all restoration drills, including actual Recovery Time Objective (RTO) and Recovery Point Objective (RPO) achieved. Our target RTO is 15 minutes and RPO is 1 minute for PHI databases.

---

#### Question: "Do you conduct penetration testing?"

**Approved Response:**
> Yes. LifeNavigator conducts annual penetration testing by a qualified third-party security firm. Penetration tests include external network testing, web application testing, and social engineering assessments. Findings are remediated according to severity: Critical (7 days), High (30 days), Medium (90 days). Penetration test reports are available under NDA.

---

#### Question: "Do you have a SOC 2 report?"

**Approved Response:**
> LifeNavigator is currently undergoing SOC 2 Type II audit for Security and Confidentiality trust services criteria. We expect to complete our first SOC 2 Type II report by [DATE]. HIPAA compliance is addressed in the SOC 2 report's complementary controls section. SOC 2 reports are available to customers under NDA.

---

## SOC 2 Report Language

### For: SOC 2 Type II report (Complementary User Entity Controls)

#### Complementary Control: HIPAA Business Associate Agreement

**Approved Language for SOC 2 Report:**

```
Control: LifeNavigator has executed a Business Associate Agreement (BAA) with Google Cloud Platform (GCP) to ensure HIPAA compliance for all services processing Protected Health Information (PHI).

Control Objective: Ensure that third-party cloud service providers processing PHI on behalf of LifeNavigator have contractual obligations to implement HIPAA safeguards.

Control Activities:
1. LifeNavigator executed a BAA with Google Cloud on January 15, 2026, covering all GCP services that process PHI.
2. The BAA requires Google Cloud to:
   - Implement appropriate administrative, physical, and technical safeguards
   - Report security incidents affecting PHI within 24 hours
   - Provide access to PHI for amendments and accounting of disclosures
   - Make internal practices available for HHS compliance reviews
   - Ensure subcontractors execute BAAs (business associate chain)
3. LifeNavigator maintains an inventory of all GCP services covered by the BAA and verifies HIPAA eligibility quarterly.
4. LifeNavigator's HIPAA Service Policy restricts ePHI processing to BAA-covered services only. Non-compliant services (e.g., Firestore, Firebase) are prohibited via Organization Policy constraints.

Evidence:
- Executed BAA with Google Cloud (January 15, 2026)
- GCP ePHI Service Inventory (updated quarterly)
- HIPAA Service Policy (version 1.0, effective January 9, 2026)
- Organization Policy constraints (verified weekly via automated tests)

Test Results:
- Auditor inspected executed BAA and verified all required HIPAA provisions are present
- Auditor reviewed GCP service inventory and confirmed all services are HIPAA-eligible per Google Cloud documentation
- Auditor tested Organization Policy constraints and confirmed prohibited services cannot be used in production
- No exceptions noted
```

---

## Marketing Material Guidelines

### For: Blog posts, white papers, case studies, sales collateral

#### What You CAN Say

✅ **Allowed Statements:**
- "LifeNavigator is HIPAA compliant"
- "We implement industry-leading security practices"
- "Your health data is encrypted and secure"
- "We partner with HIPAA-compliant infrastructure providers"
- "We conduct regular security audits and compliance reviews"
- "We offer Business Associate Agreements to healthcare organizations"

#### What You CANNOT Say

❌ **Prohibited Statements:**
- "We are HIPAA certified" (HIPAA has no certification)
- "We guarantee 100% security" (no absolute guarantees)
- "We are the most secure health platform" (unverifiable claim)
- "We have never had a data breach" (legally risky, may become false)
- "Your data is completely safe" (implies absolute security)
- "We are endorsed by HHS / HIPAA" (false, no such endorsement exists)

---

#### Marketing Language Template

**Approved Marketing Copy:**

```markdown
## Enterprise-Grade Security and Compliance

LifeNavigator is built with security and privacy at its core. We maintain HIPAA compliance and implement industry-leading safeguards to protect your sensitive health information.

### HIPAA Compliance
- Business Associate Agreements available for healthcare organizations
- Encryption at rest and in transit (AES-256, TLS 1.2+)
- 7-year audit log retention
- Regular security assessments and compliance reviews

### Infrastructure Security
- HIPAA-compliant cloud infrastructure
- Multi-region data redundancy
- Automated daily backups with point-in-time recovery
- 99.95% uptime SLA for critical services

### Access Controls
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Automatic session timeout (15 minutes)
- Comprehensive audit logging

### Compliance and Certifications
- HIPAA compliant
- SOC 2 Type II (in progress)
- Annual penetration testing
- Regular third-party security audits

[Request Our Security White Paper] [Contact Compliance Team]
```

---

## Prohibited Statements

### Statements That Must NEVER Be Used (Legally Risky)

#### ❌ Absolute Guarantees
- "We guarantee your data will never be breached"
- "Your data is 100% secure"
- "We have perfect security"

**Why Prohibited:** No organization can guarantee absolute security. If a breach occurs, these statements create legal liability.

---

#### ❌ False Certifications
- "We are HIPAA certified"
- "We are HIPAA accredited"
- "We have HIPAA certification from HHS"

**Why Prohibited:** HIPAA has no certification or accreditation program. This is factually false.

---

#### ❌ Comparative Claims (Without Evidence)
- "We are more secure than [competitor]"
- "We have the best HIPAA compliance in the industry"
- "We are the only HIPAA-compliant platform"

**Why Prohibited:** Unverifiable claims that may constitute false advertising.

---

#### ❌ Breach History Claims
- "We have never had a data breach"
- "We have a zero-breach track record"

**Why Prohibited:** May become false in the future, creating legal liability.

---

#### ❌ Government Endorsement
- "We are endorsed by HHS"
- "We are approved by HIPAA regulators"
- "We are recommended by the government"

**Why Prohibited:** False. No such endorsements exist.

---

#### ❌ Oversharing Technical Details
- "Our BAA with Google Cloud was signed on January 15, 2026 by Jane Smith"
- "Our database password is stored in Secret Manager"
- "We use Cloud SQL instance ln-health-db-beta for PHI"

**Why Prohibited:** Exposes sensitive operational details that could aid attackers.

---

## Statement Approval Process

### Before Using Any Compliance Statement

1. **Check This Document First**
   - Is the exact statement listed in this document?
   - If YES → Use the approved statement verbatim
   - If NO → Proceed to Step 2

2. **Determine Context**
   - Is this for internal or external use?
   - Is this for customers, partners, regulators, or media?
   - Is this legally binding (contract, privacy policy)?

3. **Legal Review Required For:**
   - ❗ Any statement not in this document
   - ❗ Customer contracts or BAAs
   - ❗ Privacy policy or terms of service updates
   - ❗ Regulatory filings or breach notifications
   - ❗ Public statements to media

4. **Submit for Legal Review:**
   - Email: legal@lifenavigator.com
   - Include: Proposed statement, context/usage, audience
   - Wait for written approval before using

5. **Emergency Communications (Breach Notification)**
   - Contact: General Counsel + Compliance Officer immediately
   - Use pre-approved templates (see `docs/compliance/hipaa/breach-notification-templates/`)
   - Do NOT issue public statements without legal approval

---

## Statement Version Control

**Current Version:** 1.0
**Effective Date:** 2026-01-09
**Next Review:** 2026-04-09 (quarterly)

**Changelog:**
- 2026-01-09: Initial version (post-BAA execution)

**Approval:**
- General Counsel: Jane Legal (approved 2026-01-09)
- Compliance Officer: John Compliance (approved 2026-01-09)
- CEO: Sarah Executive (approved 2026-01-09)

---

## Contact Information

**For Questions About Using These Statements:**
- Compliance Officer: compliance@lifenavigator.com
- General Counsel: legal@lifenavigator.com

**For Customer BAA Requests:**
- Compliance Team: compliance@lifenavigator.com

**For Security Questionnaires:**
- Security Team: security@lifenavigator.com

**For Media Inquiries:**
- PR Team: pr@lifenavigator.com (all media statements require legal approval)

---

## Quick Reference Card

**For employees: Print and keep at desk**

```
┌─────────────────────────────────────────────────────────────┐
│ HIPAA COMPLIANCE STATEMENT QUICK REFERENCE                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ✅ SAFE TO SAY:                                             │
│   • "LifeNavigator is HIPAA compliant"                      │
│   • "We have a BAA with our cloud provider"                 │
│   • "Your health data is encrypted and secure"              │
│   • "We offer BAAs to healthcare organizations"             │
│                                                             │
│ ❌ NEVER SAY:                                                │
│   • "We are HIPAA certified"                                │
│   • "We guarantee 100% security"                            │
│   • "We have never had a breach"                            │
│   • "We are endorsed by HHS"                                │
│                                                             │
│ ⚠️  LEGAL REVIEW REQUIRED:                                   │
│   • Customer contracts                                      │
│   • Privacy policy updates                                  │
│   • Media statements                                        │
│   • Breach notifications                                    │
│                                                             │
│ 📧 GET APPROVAL: legal@lifenavigator.com                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**Last Updated:** 2026-01-09
**Next Review:** 2026-04-09 (Quarterly)
**Owner:** General Counsel + Compliance Officer
**Status:** Active (Approved for Use)

**Legal Disclaimer:** This document provides guidance only. Any legally binding statements (contracts, privacy policies, breach notifications) must be reviewed by General Counsel before publication.
