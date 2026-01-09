# Incident Response Plan

**Plan Number:** IRP-001
**Effective Date:** 2026-01-09
**Last Review:** 2026-01-09
**Next Review:** 2027-01-09 (Annual)
**Owner:** Security Officer
**Approval:** CEO

**Regulatory References:** HIPAA § 164.308(a)(6) - Security Incident Procedures

---

## Executive Summary

This Incident Response Plan defines procedures for detecting, responding to, and recovering from security incidents affecting LifeNavigator systems. The plan ensures rapid containment of threats, minimal business impact, and compliance with regulatory notification requirements.

**Key Principles:**
- **Speed:** Acknowledge incidents within 5 minutes (SEV 1)
- **Communication:** Clear roles, escalation paths, status updates
- **Containment:** Isolate affected systems before eradication
- **Evidence:** Preserve logs and forensic data for investigation
- **Learning:** Post-incident review for every SEV 1/2

---

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Incident Response Team](#incident-response-team)
3. [Incident Response Workflow](#incident-response-workflow)
4. [Detection and Analysis](#detection-and-analysis)
5. [Containment](#containment)
6. [Eradication](#eradication)
7. [Recovery](#recovery)
8. [Post-Incident Activity](#post-incident-activity)
9. [Communication Protocols](#communication-protocols)
10. [Evidence Preservation](#evidence-preservation)
11. [Runbook Index](#runbook-index)
12. [Tabletop Exercise Plan](#tabletop-exercise-plan)

---

## 1. Incident Classification

### 1.1 Severity Levels

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| **SEV 1 (Critical)** | Complete outage OR confirmed ePHI breach | < 5 min acknowledge<br>< 30 min mitigation start | - Cloud SQL HIPAA database down<br>- Ransomware encrypting production systems<br>- Confirmed unauthorized ePHI access<br>- All users unable to access application |
| **SEV 2 (High)** | Partial degradation OR potential ePHI exposure | < 15 min acknowledge<br>< 1 hour mitigation start | - GKE cluster degraded (50% pods down)<br>- Suspected phishing attack (credentials submitted)<br>- Cloud Storage bucket misconfigured (public access) |
| **SEV 3 (Moderate)** | Minor degradation OR low-risk security event | < 1 hour acknowledge<br>< 4 hours mitigation start | - Background jobs failing<br>- Suspicious login activity (single user)<br>- Dependency vulnerability (non-critical CVE) |
| **SEV 4 (Low)** | No user impact OR informational security alert | < 4 hours acknowledge<br>Next business day mitigation | - Staging environment down<br>- Security scan finding (false positive)<br>- Documentation typo in runbook |

### 1.2 Incident Types

| Type | Description | Examples |
|------|-------------|----------|
| **Availability** | Service outage or degradation | DDoS attack, infrastructure failure, database corruption |
| **Confidentiality** | Unauthorized access or disclosure of data | ePHI breach, stolen credentials, accidental email disclosure |
| **Integrity** | Unauthorized modification or destruction of data | Ransomware, database tampering, code injection |
| **Malware** | Malicious software infection | Ransomware, trojan, spyware, cryptominer |
| **Phishing** | Social engineering attack | Phishing email, spear phishing, business email compromise (BEC) |
| **Insider Threat** | Malicious or negligent workforce member | Unauthorized ePHI access, data exfiltration, sabotage |
| **Physical** | Physical security breach | Stolen laptop, unauthorized data center access |
| **Supply Chain** | Third-party or dependency compromise | Compromised npm package, vendor breach |

---

## 2. Incident Response Team

### 2.1 Core Team

| Role | Responsibilities | Primary | Backup |
|------|------------------|---------|---------|
| **Incident Commander (IC)** | Overall incident response leadership, decision-making, status updates | Security Officer | CTO |
| **Technical Lead (TL)** | Hands-on technical investigation, containment, eradication | SRE Lead | Senior SRE Engineer |
| **Communications Lead** | Internal/external communications, customer notifications | VP Marketing | CEO |
| **Legal Advisor** | Legal implications, regulatory compliance, law enforcement | General Counsel | External Legal Counsel |
| **Privacy Officer** | HIPAA breach assessment, patient notification, HHS reporting | Privacy Officer | Compliance Officer |
| **Executive Sponsor** | Business decisions, resource allocation, media statements | CEO | COO |

### 2.2 On-Call Rotation

**Primary On-Call:** SRE Engineer (24/7 PagerDuty rotation)
**Secondary On-Call:** Security Officer (24/7 PagerDuty rotation)

**Escalation Policy:**
1. Alert fires in Prometheus/Grafana
2. PagerDuty notifies Primary On-Call (SMS + phone call)
3. If no acknowledge within 5 min, escalate to Secondary On-Call
4. If no acknowledge within 10 min, escalate to Incident Commander + CTO

---

## 3. Incident Response Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    1. DETECTION                              │
│  - Automated alerts (Prometheus, Sentry, Cloud Monitoring)  │
│  - Manual reports (workforce member, customer, vendor)      │
│  - Security scanning (vulnerability scans, pen tests)       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    2. TRIAGE                                 │
│  - On-Call acknowledges alert (< 5 min for SEV 1)           │
│  - Initial assessment: Real incident or false positive?     │
│  - Determine severity (SEV 1-4)                             │
│  - Escalate if SEV 1/2                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────┴────────┐
         │  SEV 1/2?       │
         └────┬───────┬────┘
              │       │
        YES   │       │  NO (SEV 3/4)
              │       │
              ▼       ▼
   ┌──────────────┐  ┌──────────────┐
   │ DECLARE      │  │ CREATE       │
   │ INCIDENT     │  │ TICKET       │
   │ (War Room)   │  │ (Jira)       │
   └──────┬───────┘  └──────┬───────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    3. CONTAINMENT                            │
│  - Isolate affected systems (disconnect from network)       │
│  - Revoke compromised credentials                           │
│  - Block malicious IPs/domains                              │
│  - Preserve evidence (logs, memory dumps, disk images)      │
│  - Prevent further damage                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    4. ERADICATION                            │
│  - Remove malware/malicious code                            │
│  - Patch vulnerabilities                                    │
│  - Close attack vectors                                     │
│  - Verify threat eliminated                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    5. RECOVERY                               │
│  - Restore systems from clean backups                       │
│  - Rebuild compromised systems from scratch                 │
│  - Re-enable services gradually                             │
│  - Monitor closely for re-infection                         │
│  - Validate functionality (smoke tests)                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    6. POST-INCIDENT                          │
│  - Declare incident resolved                                │
│  - Document timeline and actions taken                      │
│  - Conduct post-incident review (< 48 hours)                │
│  - Identify root cause and preventative measures            │
│  - Update runbooks and procedures                           │
│  - Create action items with owners and deadlines            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Detection and Analysis

### 4.1 Detection Sources

**Automated Monitoring:**
- **Prometheus/Grafana:** Application metrics, infrastructure health
- **Cloud Monitoring:** GCP service health, Cloud SQL performance
- **Cloud Logging:** Audit logs, application logs
- **Sentry:** Application errors and exceptions
- **PagerDuty:** Alert aggregation and on-call notifications

**Manual Reports:**
- **Workforce members:** security@lifenavigator.com
- **Customers:** support@lifenavigator.com
- **Vendors:** vendor reports of compromise
- **Security researchers:** Responsible disclosure program

**Proactive Detection:**
- **Vulnerability scans:** Weekly automated scans (Nessus, Qualys)
- **Penetration testing:** Annual third-party pen tests
- **Code scanning:** Snyk, Dependabot, CodeQL
- **Threat intelligence:** CISA alerts, vendor advisories

### 4.2 Triage Checklist

When alert fires or incident reported, On-Call performs initial triage:

**Step 1: Verify (5 min)**
- [ ] Is this a real incident or false positive?
- [ ] Can I reproduce the issue?
- [ ] What systems are affected?
- [ ] Are users impacted?

**Step 2: Classify (5 min)**
- [ ] Determine incident type (Availability, Confidentiality, Integrity, Malware, Phishing, etc.)
- [ ] Determine severity (SEV 1-4)
  - **SEV 1:** Complete outage OR confirmed ePHI breach?
  - **SEV 2:** Partial outage OR potential ePHI breach?
  - **SEV 3:** Minor degradation OR low-risk security event?
  - **SEV 4:** No impact?

**Step 3: Escalate (if SEV 1/2)**
- [ ] Page Incident Commander (Security Officer)
- [ ] Page Technical Lead (SRE Lead)
- [ ] Create Slack channel: `#incident-YYYY-MM-DD-HHMM`
- [ ] Post initial status update in channel

**Step 4: Document**
- [ ] Create incident ticket in Jira Service Management
- [ ] Log initial findings in incident notes

---

## 5. Containment

**Goal:** Stop the bleeding. Prevent further damage.

**Containment Strategies:**

### 5.1 Network Isolation

**Scenario:** Compromised GKE pod or VM

**Actions:**
```bash
# Isolate pod (block all network egress)
kubectl label pod <pod-name> quarantine=true

# Network policy blocks quarantined pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quarantine-policy
spec:
  podSelector:
    matchLabels:
      quarantine: "true"
  policyTypes:
  - Ingress
  - Egress
  # No ingress/egress rules = deny all

# Verify isolation
kubectl exec <pod-name> -- curl https://google.com
# Expected: Connection timeout
```

---

### 5.2 Credential Revocation

**Scenario:** Compromised user account or service account

**Actions:**
```bash
# Revoke user access (Google Workspace)
gcloud auth revoke user@lifenavigator.com

# Delete service account key
gcloud iam service-accounts keys delete <key-id> \
  --iam-account=<service-account-email>

# Force password reset (all users if mass phishing)
# Via Google Workspace Admin Console

# Revoke JWT tokens (invalidate all sessions)
# Update JWT secret in Secret Manager, restart backend pods
kubectl rollout restart deployment backend -n life-navigator
```

---

### 5.3 Firewall Rules

**Scenario:** Malicious IP attacking API

**Actions:**
```bash
# Block IP in Cloud Armor
gcloud compute security-policies rules create 1000 \
  --security-policy=hipaa-security-policy \
  --expression="origin.ip == '203.0.113.0'" \
  --action=deny-403 \
  --description="Block malicious IP from incident-2026-01-09"

# Verify block
curl -I https://api.lifenavigator.com -x 203.0.113.0
# Expected: HTTP 403 Forbidden
```

---

### 5.4 Database Isolation

**Scenario:** SQL injection attack detected

**Actions:**
```bash
# Enable Cloud SQL query logs (if not already enabled)
gcloud sql instances patch ln-health-db-beta \
  --database-flags=log_statement=all

# Take read replica snapshot (preserve evidence)
gcloud sql backups create --instance=ln-health-db-beta \
  --description="Incident-2026-01-09-SQLi"

# Block application access (if needed to stop attack)
# Remove Cloud SQL IAM role from backend service account
gcloud sql instances remove-iam-policy-binding ln-health-db-beta \
  --member=serviceAccount:backend-sa@lifenav-prod.iam.gserviceaccount.com \
  --role=roles/cloudsql.client

# WARNING: This breaks application. Only use if actively under attack.
```

---

### 5.5 Evidence Preservation

**CRITICAL:** Preserve evidence BEFORE taking containment actions.

**Actions:**
```bash
# Export audit logs (last 24 hours)
gcloud logging read "resource.type=cloudsql_database
                     AND timestamp>=\"$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)\"" \
  --limit=100000 --format=json \
  > incident-2026-01-09-audit-logs.json

# Upload to evidence bucket
gsutil cp incident-2026-01-09-audit-logs.json \
  gs://lifenav-prod-compliance-evidence/incidents/2026-01-09/

# Image compromised disk (for VMs, if applicable)
gcloud compute disks snapshot <disk-name> \
  --snapshot-names=incident-2026-01-09-disk-snapshot \
  --zone=us-central1-a

# Capture memory dump (for malware analysis, if applicable)
kubectl exec <pod-name> -- cat /proc/<pid>/maps > memory-dump.txt
```

---

## 6. Eradication

**Goal:** Remove the threat entirely.

### 6.1 Malware Removal

**Scenario:** Ransomware detected on workstation

**Actions:**
1. **Isolate:** Disconnect from network (unplug Ethernet, disable WiFi)
2. **Preserve:** Image hard drive for forensics
3. **Wipe:** Reformat hard drive (don't attempt to clean, re-infection risk)
4. **Rebuild:** Reinstall OS from trusted media
5. **Restore:** Restore user data from clean backup (verify no malware)
6. **Scan:** Run full antivirus scan before reconnecting to network

**Tools:** Malwarebytes, CrowdStrike Falcon, Carbon Black

---

### 6.2 Vulnerability Patching

**Scenario:** Exploited vulnerability in Python dependency

**Actions:**
```bash
# Identify vulnerable package
pip list --outdated

# Update to patched version
pip install <package>==<patched-version>

# Rebuild Docker image
docker build -t backend:v1.2.3-patched .

# Deploy to staging (test)
kubectl set image deployment/backend backend=backend:v1.2.3-patched -n staging

# Verify fix
pytest tests/security/test_<vulnerability>.py

# Deploy to production
kubectl set image deployment/backend backend=backend:v1.2.3-patched -n life-navigator
```

---

### 6.3 Access Control Hardening

**Scenario:** Overly permissive IAM roles exploited

**Actions:**
```bash
# Remove excessive permissions
gcloud projects remove-iam-policy-binding lifenav-prod \
  --member=serviceAccount:backend-sa@lifenav-prod.iam.gserviceaccount.com \
  --role=roles/editor  # Too permissive!

# Grant least-privilege role
gcloud projects add-iam-policy-binding lifenav-prod \
  --member=serviceAccount:backend-sa@lifenav-prod.iam.gserviceaccount.com \
  --role=roles/cloudsql.client  # Just what's needed

# Verify
gcloud projects get-iam-policy lifenav-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:backend-sa@lifenav-prod.iam.gserviceaccount.com"
```

---

## 7. Recovery

**Goal:** Restore systems to normal operation.

### 7.1 Backup Restoration

**Scenario:** Ransomware encrypted Cloud SQL database

**Runbook:** See `docs/resilience/runbooks/RESTORE_HIPAA_DATABASE.md`

**Steps:**
```bash
# 1. Verify backups are NOT infected (check backup timestamps vs infection time)
gcloud sql backups list --instance=ln-health-db-beta

# 2. Restore from backup (point-in-time recovery to before infection)
gcloud sql backups restore <backup-id> \
  --backup-instance=ln-health-db-beta \
  --backup-target-instance=ln-health-db-beta-restored \
  --pitr-timestamp=2026-01-09T08:00:00Z

# 3. Verify data integrity
psql -h <restored-db-ip> -U postgres -d health_db -c "SELECT COUNT(*) FROM health_records;"

# 4. Switch application to restored database (update connection string)
kubectl set env deployment/backend DATABASE_HOST=<restored-db-ip> -n life-navigator

# 5. Delete infected database (after confirmation)
gcloud sql instances delete ln-health-db-beta
```

---

### 7.2 System Rebuild

**Scenario:** Compromised GKE node (rootkit detected)

**Actions:**
```bash
# 1. Cordon node (prevent new pods from scheduling)
kubectl cordon <node-name>

# 2. Drain node (evict all pods gracefully)
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# 3. Delete node
kubectl delete node <node-name>

# 4. GKE auto-healing creates new node automatically
# Verify new node is healthy
kubectl get nodes
kubectl get pods -A  # Verify all pods rescheduled
```

---

### 7.3 Service Restoration

**Order of Operations:**
1. **Core Infrastructure:** VPC, Load Balancer, Cloud KMS
2. **Data Layer:** Cloud SQL, Cloud Storage
3. **Application Layer:** GKE backend, FastAPI services
4. **Frontend:** Vercel deployment
5. **Monitoring:** Prometheus, Grafana, Sentry
6. **Non-Critical Services:** Background jobs, analytics

**Validation:**
```bash
# Smoke tests
curl https://api.lifenavigator.com/health
# Expected: HTTP 200 OK

# Database connectivity
psql -h <db-ip> -U postgres -d health_db -c "SELECT 1;"

# ePHI access (manual test)
# Login to frontend, access a patient record
# Verify data loads correctly

# Monitoring
# Check Grafana dashboards for normal metrics
# Verify no alerts firing in PagerDuty
```

---

### 7.4 Enhanced Monitoring (Post-Recovery)

**Scenario:** Elevated risk of re-infection

**Actions:**
- **Increase alert sensitivity:** Lower thresholds for anomaly detection
- **Manual log review:** Daily review of audit logs for 1 week
- **Endpoint monitoring:** Deploy EDR agent if not already present
- **Network traffic analysis:** Monitor for C2 beaconing, data exfiltration
- **File integrity monitoring:** Alert on unexpected file changes

---

## 8. Post-Incident Activity

### 8.1 Incident Closure

**When to Close:**
- Threat fully eradicated
- Systems restored to normal operation
- No evidence of ongoing attacker activity
- Enhanced monitoring in place

**Closure Checklist:**
- [ ] All systems restored and validated
- [ ] Root cause identified
- [ ] Preventative measures implemented
- [ ] Stakeholders notified of resolution
- [ ] Incident timeline documented
- [ ] Post-incident review scheduled (< 48 hours)

---

### 8.2 Post-Incident Review (PIR)

**Timeline:** Within 48 hours of incident resolution (for SEV 1/2)

**Attendees:**
- Incident Commander
- Technical Lead
- All responders
- Engineering/SRE leadership
- CEO (for SEV 1)

**Agenda (90 min):**
1. **Timeline Review (20 min):** What happened, when, and how?
2. **What Went Well (15 min):** Effective actions, good decisions
3. **What Went Wrong (30 min):** Mistakes, delays, confusion
4. **Root Cause Analysis (15 min):** Why did this happen? (5 Whys)
5. **Action Items (10 min):** Preventative measures, runbook updates, training needs

**Deliverable:** Post-Incident Review Report

**Template:**
```markdown
# Post-Incident Review: [Incident Name]

**Incident ID:** INC-2026-001
**Date:** 2026-01-09
**Duration:** 4 hours (08:00 - 12:00 UTC)
**Severity:** SEV 1
**Type:** Ransomware

## Summary
Brief (2-3 sentence) summary of incident.

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 08:00 | Ransomware detected by antivirus alert |
| 08:05 | On-call acknowledges, escalates to IC |
| 08:10 | Incident declared, war room created |
| 08:15 | Affected systems isolated (network disconnect) |
| 09:00 | Backup restoration started |
| 10:30 | Systems restored, smoke tests passed |
| 12:00 | Incident closed |

## Impact
- **Users Affected:** 500+ patients unable to access portal
- **Downtime:** 4 hours
- **Data Loss:** 0 (restored from backup)
- **ePHI Exposed:** 0 (no exfiltration detected)

## Root Cause
Workforce member clicked phishing link, downloaded malware.

## What Went Well
- Backups restored successfully (tested monthly)
- Incident response team mobilized quickly
- Clear communication in war room

## What Went Wrong
- Antivirus did not block initial malware download
- Phishing email bypassed spam filter
- No EDR deployed (malware not detected until encryption started)

## Action Items
| Action | Owner | Deadline | Priority |
|--------|-------|----------|----------|
| Deploy EDR solution (CrowdStrike) | Security Lead | 2026-02-01 | P0 |
| Enhance email security (Proofpoint) | IT Lead | 2026-02-15 | P0 |
| Mandatory phishing training | HR | 2026-01-31 | P1 |
| Update ransomware runbook | SRE Lead | 2026-01-20 | P1 |

## Lessons Learned
- Monthly backup tests saved us from data loss
- Need faster detection (EDR)
- Human error remains biggest risk (phishing training needed)
```

**Storage:** `gs://lifenav-prod-compliance-evidence/incidents/{year}/{incident-id}/PIR.md`

---

## 9. Communication Protocols

### 9.1 Internal Communication

**War Room (Slack Channel):**
- Channel name: `#incident-YYYY-MM-DD-HHMM`
- Purpose: Real-time coordination during active incident
- Participants: Incident Response Team + relevant stakeholders
- Discipline:
  - IC posts status updates every 30 min (SEV 1), every hour (SEV 2)
  - Use threads for side conversations (keep main channel clean)
  - All critical decisions documented in channel
  - No speculation, facts only

**Example Status Update:**
```
STATUS UPDATE (10:00 UTC) - SEV 1

Current Status: Containment in progress
Impact: All users unable to access portal (500+ patients affected)
Actions Taken:
  - Ransomware isolated (network disconnect at 08:15)
  - Backup restoration started (09:00)
  - Estimated completion: 10:30
  - Next status update: 10:30 or when restoration complete

No questions please - focus on resolution. Updates every 30 min.
```

---

### 9.2 External Communication

**Customer Notifications:**

**SEV 1 (Complete Outage):**
- **Status Page:** Update status.lifenavigator.com within 15 min
- **Email:** Send to all affected customers within 1 hour (if > 4 hour outage)
- **In-App Banner:** "We're experiencing technical difficulties. Our team is working to resolve this. Updates: status.lifenavigator.com"

**Template:**
```
Subject: Service Disruption - [Date]

Dear LifeNavigator User,

We are currently experiencing a service disruption affecting the
LifeNavigator platform. Our engineering team is actively working to
resolve this issue.

Impact: All users are unable to access the portal.
Start Time: [Time]
Expected Resolution: [Time] (we will update if this changes)
Updates: status.lifenavigator.com

We apologize for the inconvenience and will provide updates as soon
as more information is available.

- LifeNavigator Team
```

**SEV 2 (Partial Degradation):**
- **Status Page:** Update within 30 min
- **Email:** Only if degradation lasts > 4 hours

---

### 9.3 Executive Communication

**Notify CEO/Exec Team:**
- **SEV 1:** Immediately (within 10 min of incident declaration)
- **SEV 2:** Within 1 hour
- **SEV 3/4:** Daily summary email (if any)

**Executive Summary Format:**
```
Subject: SEV 1 INCIDENT - [Brief Description]

CEO/Exec Team,

We are responding to a SEV 1 incident:

WHAT: Ransomware attack encrypting production database
WHEN: Started 08:00 UTC (30 min ago)
IMPACT: All 500+ users unable to access portal
STATUS: Containment in progress, backup restoration underway
ETA RESOLUTION: 10:30 UTC (2 hours)
BUSINESS IMPACT: $50/hour revenue loss, customer trust at risk
REGULATORY: No ePHI breach detected (so far)

I will update you hourly or sooner if status changes.

- [Incident Commander]
```

---

### 9.4 Media Statements

**Media Inquiries:** Refer all to Communications Lead (VP Marketing)

**Prepared Statement (if ePHI breach):**
```
"LifeNavigator takes the security and privacy of patient information
very seriously. We are investigating a recent security incident and
are working with law enforcement and cybersecurity experts. We will
notify affected individuals in accordance with HIPAA requirements.
We have no further comment at this time."
```

**DO NOT say:**
- Number of patients affected (until HHS notification)
- Technical details of attack (aids attackers)
- Blame (third-party vendor, workforce member)
- "No patient data was compromised" (unless 100% certain)

---

## 10. Evidence Preservation

### 10.1 Chain of Custody

**Why:** For criminal prosecution, lawsuits, regulatory investigations

**Requirements:**
- Document WHO collected evidence, WHEN, WHERE, HOW
- Maintain integrity (hash checksums, write-protect)
- Limit access (only authorized personnel)
- Track transfers (if evidence handed off to law enforcement, forensic consultant)

**Chain of Custody Form:**
```
EVIDENCE COLLECTION FORM

Incident ID: INC-2026-001
Collected By: John Smith (SRE Lead)
Date/Time: 2026-01-09 08:30 UTC
Location: GCP project lifenav-prod

Evidence Description:
- Cloud SQL audit logs (2026-01-08 to 2026-01-09)
- GKE pod logs for backend-7d8f9c5b-q4k8p
- Disk snapshot: incident-2026-01-09-disk-snapshot

Storage Location:
- gs://lifenav-prod-compliance-evidence/incidents/2026-01-09/

Hash (SHA-256):
- audit-logs.json: a1b2c3d4e5f6...
- pod-logs.txt: b2c3d4e5f6a1...
- disk-snapshot: c3d4e5f6a1b2...

Transferred To: [Name, if applicable]
Date Transferred: [Date, if applicable]
Purpose: [e.g., Forensic analysis by Mandiant]

Signature: _________________ Date: __________
```

---

### 10.2 Log Preservation

**Scope:** Preserve all logs relevant to incident (90 days before and 30 days after)

**Logs to Preserve:**
- **Cloud Audit Logs:** Admin Activity, Data Access, System Events
- **Application Logs:** FastAPI logs, Celery worker logs
- **Network Logs:** VPC Flow Logs, Load Balancer logs
- **Database Logs:** Cloud SQL query logs, slow query logs
- **Container Logs:** GKE pod logs, Docker logs
- **Authentication Logs:** Google Workspace login logs, Auth0 logs

**Preservation:**
```bash
# Export logs to GCS (immutable storage)
gcloud logging read "resource.type=cloudsql_database
                     AND timestamp>=\"2026-01-08T00:00:00Z\"
                     AND timestamp<=\"2026-02-10T00:00:00Z\"" \
  --limit=1000000 --format=json \
  | gsutil cp - gs://lifenav-prod-compliance-evidence/incidents/2026-01-09/audit-logs.json

# Retention lock (cannot be deleted)
gsutil retention set 2592000 gs://lifenav-prod-compliance-evidence/incidents/2026-01-09/
# 2592000 seconds = 30 days retention minimum
```

---

### 10.3 Forensic Evidence

**When to Collect:**
- **Malware incidents:** Memory dumps, disk images, network traffic captures
- **Unauthorized access:** Access logs, session recordings, compromised credentials
- **Data breaches:** Database exports, file access logs, exfiltration evidence

**Forensic Tools:**
- **Memory Acquisition:** LiME (Linux Memory Extractor), Volatility
- **Disk Imaging:** dd, FTK Imager
- **Network Capture:** tcpdump, Wireshark
- **Log Analysis:** Splunk, ELK Stack, grep

**External Forensics:**
- For SEV 1 incidents with criminal activity (ransomware, insider theft), engage third-party forensic firm (Mandiant, CrowdStrike Services, etc.)

---

## 11. Runbook Index

**Critical Runbooks:**

| Runbook | Scenario | Location |
|---------|----------|----------|
| **RESTORE_HIPAA_DATABASE.md** | Cloud SQL database failure, ransomware | `docs/resilience/runbooks/` |
| **DB_POOL_SATURATION.md** | Database connection pool exhausted | `docs/runbooks/` |
| **HIGH_ERROR_RATE.md** | API error rate spike | `docs/runbooks/` |
| **GRAPHRAG_UNREACHABLE.md** | GraphRAG service down | `docs/runbooks/` |
| **EPHI_BREACH_RESPONSE.md** | HIPAA breach (see separate plan) | `docs/incident_response/` |
| **RANSOMWARE_RESPONSE.md** | Ransomware attack | `docs/incident_response/runbooks/` |
| **PHISHING_RESPONSE.md** | Phishing attack (credentials compromised) | `docs/incident_response/runbooks/` |
| **DDOS_RESPONSE.md** | DDoS attack | `docs/incident_response/runbooks/` |

---

## 12. Tabletop Exercise Plan

**Purpose:** Practice incident response without real incident

**Frequency:** Quarterly (Jan, Apr, Jul, Oct)

**Participants:** Incident Response Team + invited stakeholders

**Duration:** 2 hours

**Facilitator:** Security Officer (or external consultant for realism)

---

### 12.1 Tabletop Exercise Template

**Exercise 1: Ransomware Attack (SEV 1)**

**Scenario Briefing:**
> "It's 8:00 AM on a Monday. You receive a PagerDuty alert: 'Cloud SQL database unreachable.' You SSH into a backend pod and see this message: 'Your files have been encrypted. Pay 10 BTC to decrypt.' What do you do?"

**Injects (timed throughout exercise):**
1. **T+10 min:** "CEO asks: 'Can we just pay the ransom?' How do you respond?"
2. **T+30 min:** "Customer calls support: 'I can't access my health records!' How do you respond?"
3. **T+60 min:** "News reporter tweets: 'LifeNavigator reportedly hit by ransomware.' How do you respond?"
4. **T+90 min:** "FBI calls: 'We'd like to investigate. Don't touch the evidence.' How do you respond?"

**Evaluation Criteria:**
- Did team follow incident response workflow?
- How long to declare incident and mobilize team?
- Were containment actions appropriate?
- Was evidence preserved?
- Was communication clear and timely?
- What gaps/weaknesses were identified?

---

**Exercise 2: Phishing Attack (SEV 2)**

**Scenario Briefing:**
> "You receive a report from a workforce member: 'I think I clicked a phishing link and entered my password.' The email claimed to be from IT asking users to verify their credentials. What do you do?"

**Injects:**
1. **T+15 min:** "We found 20 other workforce members clicked the same link. How do you respond?"
2. **T+45 min:** "We detected unauthorized Cloud SQL access from one of the compromised accounts. Escalate?"
3. **T+90 min:** "Should we notify all customers that workforce member credentials were compromised?"

---

**Exercise 3: Insider Threat (SEV 1)**

**Scenario Briefing:**
> "Cloud Logging alerts: 'SRE engineer downloaded entire ePHI database (500,000 patient records) to personal laptop.' The engineer resigned last week. What do you do?"

**Injects:**
1. **T+15 min:** "Engineer's manager says: 'They were upset about not getting a raise.' Potential motive?"
2. **T+45 min:** "Legal asks: 'Should we call the police?' How do you respond?"
3. **T+90 min:** "Do we need to notify HHS? Patients? Media?"

---

### 12.2 Tabletop Exercise Deliverables

**After each exercise:**
1. **Exercise Report:** What happened, what team decided, evaluation
2. **Action Items:** Gaps identified, improvements needed, training required
3. **Runbook Updates:** Add new scenarios, update procedures

**Storage:** `gs://lifenav-prod-compliance-evidence/tabletop-exercises/{year}/`

---

## Related Documents

- **HIPAA Breach Response Plan:** `docs/incident_response/HIPAA_BREACH_RESPONSE.md`
- **Disaster Recovery Plan:** `docs/resilience/README.md`
- **Workforce Sanctions Policy:** `docs/policies/workforce_sanctions.md`
- **Security Awareness Training Policy:** `docs/policies/security_awareness_training.md`

---

**Plan Version:** 1.0
**Effective Date:** 2026-01-09
**Next Review:** 2027-01-09 (Annual)
**Classification:** INTERNAL - INCIDENT RESPONSE
**Evidence Location:** `gs://lifenav-prod-compliance-evidence/incident-response/`
