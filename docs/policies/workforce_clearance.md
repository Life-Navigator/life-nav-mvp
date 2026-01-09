# Workforce Clearance and Authorization Policy

**Policy Number:** POL-SEC-004
**Effective Date:** 2026-01-09
**Last Review:** 2026-01-09
**Next Review:** 2027-01-09 (Annual)
**Owner:** Security Officer
**Approval:** CEO

**HIPAA Reference:** 45 CFR § 164.308(a)(3)(ii)(B) - Workforce Clearance Procedure

---

## 1. Purpose and Scope

### 1.1 Purpose

This policy establishes procedures for determining that workforce members' access to electronic Protected Health Information (ePHI) is appropriate based on their role, responsibilities, and need-to-know. The purpose is to:
- Ensure only authorized individuals access ePHI
- Implement least-privilege access controls
- Verify workforce members are trustworthy before granting ePHI access
- Maintain compliance with HIPAA Security Rule requirements

### 1.2 Scope

This policy applies to:
- **All workforce members** requiring access to ePHI: Employees, contractors, temporary workers, interns, volunteers
- **All systems processing ePHI:** Cloud SQL, GKE backend, Cloud Storage, Cloud KMS
- **Initial clearance:** Before granting ePHI access
- **Ongoing clearance:** Quarterly access reviews, annual re-clearance

### 1.3 Regulatory Requirement

The HIPAA Security Rule § 164.308(a)(3)(ii)(B) requires:
> "Implement procedures to determine that the access of a workforce member to electronic protected health information is appropriate."

---

## 2. Roles and Responsibilities

### 2.1 Security Officer

**Responsibilities:**
- Oversee workforce clearance process
- Approve/deny ePHI access requests
- Conduct quarterly access reviews
- Maintain clearance records
- Investigate clearance violations

### 2.2 Human Resources

**Responsibilities:**
- Conduct background checks for all new hires
- Verify education and employment history
- Screen for criminal convictions
- Document clearance evidence in personnel files
- Coordinate with Security Officer on clearance decisions

### 2.3 Direct Managers

**Responsibilities:**
- Determine workforce member's job duties and ePHI access needs
- Submit access requests to Security Officer
- Attest that workforce member requires ePHI access
- Monitor workforce member's access usage
- Report changes in job duties (promotions, transfers, terminations)

### 2.4 IT/SRE Team

**Responsibilities:**
- Provision access based on approved access requests
- Implement least-privilege access controls (IAM roles)
- Revoke access upon termination or role change
- Maintain audit logs of all access provisioning/deprovisioning

---

## 3. Clearance Levels

### 3.1 Clearance Tiers

| Tier | Description | Access Granted | Examples |
|------|-------------|----------------|----------|
| **Tier 0: No Access** | No ePHI access required | None | Marketing, Sales (non-clinical), Finance, HR |
| **Tier 1: Read-Only (Limited)** | View ePHI for specific patients only | Read-only access to assigned patients | Customer Support (case-based access) |
| **Tier 2: Read-Only (Full)** | View all ePHI for support/operations | Read-only access to all ePHI | Clinical Operations Manager, Compliance Auditor |
| **Tier 3: Read/Write (Limited)** | Create/modify ePHI for specific patients | Read/write access to assigned patients | Nurses, Care Coordinators |
| **Tier 4: Read/Write (Full)** | Create/modify all ePHI | Read/write access to all ePHI | Physicians, Clinical Admins |
| **Tier 5: Administrative** | Full system access including infrastructure | Database admin, IAM admin, Cloud KMS | SRE Team, Security Team |

### 3.2 Access Matrix

| Role | Tier | Cloud SQL Access | Cloud Storage Access | Cloud KMS Access | Justification |
|------|------|------------------|---------------------|------------------|---------------|
| **Physician** | 4 | Read/write all tables | Read/write health documents | No access | Treats patients, needs full ePHI access |
| **Nurse** | 3 | Read/write assigned patients | Read/write assigned patients | No access | Treats assigned patients only |
| **Care Coordinator** | 3 | Read/write assigned patients | Read/write assigned patients | No access | Coordinates care for assigned patients |
| **Customer Support** | 1 | Read-only assigned patients | Read-only assigned patients | No access | Resolves support tickets |
| **Clinical Ops Manager** | 2 | Read-only all tables | Read-only all documents | No access | Oversees operations, audits quality |
| **SRE Engineer** | 5 | Full admin access | Full admin access | Key management | Maintains infrastructure, troubleshoots issues |
| **Security Analyst** | 2 | Read-only audit logs | Read-only audit logs | Audit logs only | Monitors security, investigates incidents |
| **Compliance Officer** | 2 | Read-only all tables | Read-only all documents | Audit logs only | Audits HIPAA compliance |
| **Developer (Backend)** | 0 | No production access | No production access | No access | Develops in staging only |
| **Developer (Frontend)** | 0 | No access | No access | No access | Frontend receives redacted data |
| **Marketing** | 0 | No access | No access | No access | No ePHI access needed |

---

## 4. Clearance Procedures

### 4.1 Pre-Employment Screening

All workforce members must pass pre-employment screening before receiving ePHI access.

**Step 1: Background Check (HR)**

**Required for ALL roles with ePHI access:**
- Criminal background check (federal and state)
  - **Automatic disqualification:** Felony convictions related to fraud, theft, identity theft, healthcare fraud, HIPAA violations
  - **Case-by-case review:** Misdemeanor convictions, other felonies (review age, relevance, rehabilitation)
- Social Security Number verification
- Education verification (for clinical roles)
- Employment history verification (7 years)
- Professional license verification (for clinical roles: physicians, nurses)
- Reference checks (3 professional references)

**For Tier 4-5 roles (high-privilege):**
- Credit check (for financial crimes risk)
- Drug screening
- Enhanced reference checks (5 references)

**Timeline:** Background checks must be completed before first day of employment.

**Evidence:** Background check report stored in personnel file (HR secure drive).

---

**Step 2: Job Description Review (Manager + Security Officer)**

**Required:**
- Manager completes **Access Request Form** (see Appendix A)
- Manager attests that workforce member requires ePHI access for job duties
- Security Officer reviews and approves/denies based on:
  - Least-privilege principle (minimum access needed)
  - Role-based access (does this role typically require ePHI access?)
  - Background check results

**Timeline:** Access request must be submitted 3 business days before access needed.

---

**Step 3: Security Training (Before Access Granted)**

**Required training:**
- HIPAA Security and Privacy Training (2 hours, online)
- ePHI Handling Best Practices (1 hour, online)
- Role-specific training (e.g., Clinical Workflows for clinicians)
- Quiz (80% passing score required)

**Timeline:** Training must be completed within 7 days of hire, before ePHI access granted.

**Evidence:** Training completion certificate stored in `gs://lifenav-prod-compliance-evidence/training/`

---

**Step 4: Access Provisioning (IT/SRE)**

**Required:**
- Create GCP user account (Google Workspace)
- Assign IAM roles based on approved tier:
  - Tier 1: `roles/cloudsql.viewer` (read-only, row-level security for assigned patients)
  - Tier 2: `roles/cloudsql.viewer` (read-only, all tables)
  - Tier 3: `roles/cloudsql.client` (read/write, row-level security for assigned patients)
  - Tier 4: `roles/cloudsql.client` (read/write, all tables)
  - Tier 5: `roles/cloudsql.admin` (admin access, restricted)
- Enable MFA (mandatory for all ePHI access)
- Issue hardware security key (FIDO2) for Tier 4-5 roles
- Configure session timeout (15 minutes for all roles)
- Add workforce member to audit log monitoring

**Timeline:** Access provisioned within 1 business day of approval.

**Evidence:** IAM policy change logged in Cloud Audit Logs.

---

**Step 5: Acknowledgment (Workforce Member)**

**Required:**
- Workforce member signs **Confidentiality Agreement** (see Appendix B)
- Workforce member acknowledges understanding of:
  - ePHI access restrictions
  - Sanctions for policy violations
  - Duty to report suspected breaches
  - No personal use of ePHI

**Evidence:** Signed confidentiality agreement stored in personnel file.

---

### 4.2 Ongoing Clearance Reviews

#### Quarterly Access Reviews

**Process:**
1. **First Monday of Each Quarter:** Security Officer exports IAM policies for all GCP projects
2. **Week 1:** Security Officer sends access review email to all managers:
   - List of workforce members with ePHI access (by team)
   - Current access level (tier)
   - Request: "Confirm each workforce member still requires this access level, or request change"
3. **Week 2:** Managers review and respond with:
   - ✅ Confirmed - access still needed
   - ⬇️ Reduce - workforce member no longer needs this access level (e.g., role change)
   - ❌ Revoke - workforce member no longer requires ePHI access (e.g., transferred to Marketing)
4. **Week 3:** IT/SRE processes access changes
5. **Week 4:** Security Officer documents review in **Access Review Log** (see Section 6)

**Timeline:** Quarterly (January, April, July, October)

**Evidence:** Access review log, manager attestation emails stored in `gs://lifenav-prod-compliance-evidence/access-reviews/`

---

#### Annual Re-Clearance

**Process:**
All workforce members with ePHI access must complete annual re-clearance:
1. **Annual HIPAA training** (refresher, 1 hour)
2. **Re-sign Confidentiality Agreement**
3. **Manager re-attestation** that workforce member still requires ePHI access
4. **Background check** (every 3 years for Tier 4-5 roles)

**Timeline:** Anniversary of hire date

**Evidence:** Training certificate, signed agreement, manager attestation

---

### 4.3 Access Modification

**Triggering Events:**
- Promotion (may require higher tier)
- Role change (may require different access)
- Termination (immediate revocation)
- Leave of absence (temporary revocation)
- Disciplinary action (temporary revocation pending investigation)

**Process:**
1. Manager submits **Access Change Request** to Security Officer
2. Security Officer approves/denies within 2 business days
3. IT/SRE modifies access within 1 business day
4. Workforce member notified of access change
5. Change logged in audit trail

**Timeline:** Access changes must be processed within 3 business days (1 business day for terminations).

---

### 4.4 Access Revocation (Termination)

**Triggering Events:**
- Voluntary termination (resignation)
- Involuntary termination (firing)
- End of contract (contractors)
- Last day of employment

**Process:**
1. **Day of Termination (or before):** HR notifies Security Officer + IT/SRE
2. **Within 1 hour:** IT/SRE revokes ALL access:
   - Disable Google Workspace account
   - Revoke all GCP IAM roles
   - Revoke VPN access
   - Disable MFA devices
   - Revoke API tokens/keys
   - Remove from Slack, GitHub, etc.
3. **Within 24 hours:** Collect company assets:
   - Laptop, hardware security keys, badge
   - Remote wipe of mobile devices (if company-owned)
4. **Within 1 week:** Manager confirms no residual access
5. **Document:** Termination checklist completed, filed in personnel file

**Emergency Termination (for cause):** Access revoked immediately, before workforce member notified of termination.

**Evidence:** Termination checklist, IAM audit logs, asset return receipt

---

## 5. Exceptions and Temporary Access

### 5.1 Emergency Access

**Scenario:** On-call SRE needs temporary elevated access to troubleshoot production incident involving ePHI.

**Process:**
1. **Incident declared:** Incident Commander approves emergency access
2. **Break-glass access:** SRE uses **break-glass account** with full admin access (monitored)
3. **Time-limited:** Access automatically revoked after 4 hours
4. **Audit:** All actions logged and reviewed post-incident
5. **Justification:** SRE documents reason for emergency access in incident report

**Evidence:** Incident report, break-glass access logs

---

### 5.2 Contractor/Vendor Access

**Scenario:** Third-party security consultant needs temporary access to audit HIPAA compliance.

**Process:**
1. **Business Associate Agreement (BAA):** Vendor must sign BAA before access granted
2. **Access Request:** Vendor submits request detailing:
   - Scope of access needed
   - Duration (start/end dates)
   - Justification
3. **Approval:** Security Officer + Legal review and approve
4. **Provisioning:** IT/SRE creates temporary account with expiration date
5. **Monitoring:** Vendor access logs reviewed weekly
6. **Revocation:** Access automatically revoked on end date (or sooner if work completed)

**Evidence:** BAA, access request form, access logs

---

## 6. Documentation and Recordkeeping

### 6.1 Clearance Records

**For each workforce member with ePHI access, maintain:**

| Record Type | Location | Retention |
|-------------|----------|-----------|
| Background check report | HR personnel file (Google Drive - restricted) | 7 years after termination |
| Access Request Form (initial) | `gs://lifenav-prod-compliance-evidence/access-requests/` | 7 years after termination |
| Training certificates | `gs://lifenav-prod-compliance-evidence/training/` | 7 years after termination |
| Signed Confidentiality Agreement | HR personnel file | 7 years after termination |
| Quarterly Access Reviews | `gs://lifenav-prod-compliance-evidence/access-reviews/` | 7 years |
| Access Change Requests | `gs://lifenav-prod-compliance-evidence/access-requests/` | 7 years |
| Termination checklist | HR personnel file | 7 years after termination |
| IAM audit logs | Cloud Logging (7-year retention lock) | 7 years |

---

### 6.2 Access Review Log

**File:** `gs://lifenav-prod-compliance-evidence/access-reviews/access-review-log.xlsx`

**Columns:**
- Review quarter (e.g., 2026-Q1)
- Review date
- Workforce member name
- Current role
- Current tier
- Manager attestation (Confirmed / Reduce / Revoke)
- Action taken
- Completed date
- Reviewed by (Security Officer)

**Access Control:** Security Officer, Privacy Officer, CEO only

---

### 6.3 Audit Trails

All access provisioning/revocation automatically logged in:
- **Cloud Audit Logs:** IAM policy changes (who granted access to whom)
- **Google Workspace Admin Logs:** Account creation/deletion
- **Incident tracking system (Jira):** Access requests and approvals

---

## 7. Enforcement

### 7.1 Violations

Violations of this policy will result in sanctions per **Workforce Sanctions Policy (POL-SEC-001)**:

| Violation | Example | Sanction |
|-----------|---------|----------|
| **Accessing ePHI without clearance** | Employee accesses Cloud SQL before background check complete | Written warning + immediate access revocation |
| **Providing access without approval** | Manager grants database access without Security Officer approval | Written warning (manager) |
| **Sharing credentials** | Workforce member shares password with coworker | Suspension + final warning |
| **Unauthorized access** | Workforce member accesses ePHI outside job duties (curiosity) | Termination (Level 3 violation) |

---

## 8. Related Policies

- Workforce Sanctions Policy (POL-SEC-001)
- Acceptable Use Policy (POL-SEC-002)
- Security Awareness Training Policy (POL-SEC-005)
- Incident Response Policy (POL-SEC-003)

---

## 9. Review and Updates

**Annual Review:** This policy will be reviewed annually by Security Officer, Privacy Officer, HR, and Legal.

**Update Triggers:**
- Changes in workforce structure (new roles)
- Changes in technology (new systems processing ePHI)
- Changes in regulations (HIPAA updates)
- Audit findings or incidents

**Evidence:** Policy review meeting notes stored in `gs://lifenav-prod-compliance-evidence/policies/`

---

## 10. Appendices

### Appendix A: Access Request Form

```
WORKFORCE ePHI ACCESS REQUEST FORM

SECTION 1: WORKFORCE MEMBER INFORMATION
Name: _______________________
Role/Title: _______________________
Department: _______________________
Manager: _______________________
Hire Date: _______________________

SECTION 2: ACCESS REQUESTED
Requested Tier: ☐ Tier 1  ☐ Tier 2  ☐ Tier 3  ☐ Tier 4  ☐ Tier 5
Systems Requiring Access:
☐ Cloud SQL (ln-health-db-beta)
☐ Cloud Storage (health documents)
☐ Cloud KMS (encryption keys)
☐ Cloud Logging (audit logs)

SECTION 3: BUSINESS JUSTIFICATION
Job duties requiring ePHI access:
_____________________________________________________________
_____________________________________________________________

Least-privilege justification (why this tier and not lower?):
_____________________________________________________________
_____________________________________________________________

SECTION 4: APPROVALS
Manager Attestation: I attest that this workforce member requires ePHI access
for their job duties and has completed required training.

Manager Signature: _____________________ Date: __________

Security Officer Approval:
☐ Approved (Tier: _____) ☐ Denied
Reason if denied: ____________________________________

Security Officer Signature: _____________________ Date: __________

SECTION 5: PROVISIONING (IT/SRE USE ONLY)
Date access provisioned: __________
IAM roles granted: ____________________________________
MFA enabled: ☐ Yes  ☐ No
Provisioned by: _______________________
```

---

### Appendix B: Confidentiality Agreement

```
CONFIDENTIALITY AGREEMENT

I, _________________________ (Workforce Member Name), acknowledge and agree:

1. I have been granted access to electronic Protected Health Information (ePHI)
   to perform my job duties at LifeNavigator.

2. I will only access ePHI when necessary for my job duties. I will not access
   ePHI out of curiosity or for personal reasons.

3. I will not disclose ePHI to any unauthorized person, including family,
   friends, or other workforce members without a need-to-know.

4. I will protect ePHI by:
   - Using strong passwords and MFA
   - Locking my workstation when unattended
   - Not storing ePHI on personal devices
   - Not emailing ePHI to personal email accounts
   - Not sharing ePHI on social media

5. I will immediately report any suspected ePHI breach or security incident
   to the Security Officer.

6. I understand that violations of this agreement may result in sanctions
   including termination and criminal prosecution.

7. This agreement remains in effect during my employment and after termination.

Workforce Member Signature: _____________________ Date: __________

Workforce Member Name (Print): _______________________

Witness Signature: _____________________ Date: __________
```

---

**Policy Version:** 1.0
**Effective Date:** 2026-01-09
**Next Review:** 2027-01-09
**Classification:** INTERNAL - POLICY
**Evidence Location:** `gs://lifenav-prod-compliance-evidence/policies/workforce_clearance.md`
