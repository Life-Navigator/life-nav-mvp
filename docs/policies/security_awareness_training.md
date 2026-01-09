# Security Awareness and Training Policy

**Policy Number:** POL-SEC-005
**Effective Date:** 2026-01-09
**Last Review:** 2026-01-09
**Next Review:** 2027-01-09 (Annual)
**Owner:** Security Officer
**Approval:** CEO

**HIPAA Reference:** 45 CFR § 164.308(a)(5) - Security Awareness and Training

---

## 1. Purpose and Scope

### 1.1 Purpose

This policy establishes requirements for security awareness and training programs to ensure all workforce members understand their responsibilities for protecting electronic Protected Health Information (ePHI). The purpose is to:
- Educate workforce members on security threats and vulnerabilities
- Train workforce members on security policies and procedures
- Build a security-aware culture
- Reduce risk of human error causing ePHI breaches
- Maintain compliance with HIPAA Security Rule requirements

### 1.2 Scope

This policy applies to:
- **All workforce members:** Employees (full-time, part-time), contractors, temporary workers, interns, volunteers
- **All levels:** Executives, managers, individual contributors
- **All departments:** Clinical, engineering, operations, marketing, finance, HR

### 1.3 Regulatory Requirement

The HIPAA Security Rule § 164.308(a)(5) requires:
> "Implement a security awareness and training program for all members of its workforce (including management)."

Specific training requirements:
- § 164.308(a)(5)(ii)(A): Security reminders
- § 164.308(a)(5)(ii)(B): Protection from malicious software
- § 164.308(a)(5)(ii)(C): Log-in monitoring
- § 164.308(a)(5)(ii)(D): Password management

---

## 2. Roles and Responsibilities

### 2.1 Security Officer

**Responsibilities:**
- Develop and maintain security awareness training program
- Select training vendors/platforms
- Track training completion rates
- Enforce training requirements
- Update training content annually based on:
  - New threats (e.g., ransomware trends)
  - Incident lessons learned
  - Policy changes
  - Regulatory updates

### 2.2 Human Resources

**Responsibilities:**
- Ensure all new hires complete onboarding training before accessing systems
- Track training completion in HRIS (BambooHR)
- Send training deadline reminders to workforce members
- Report non-compliance to Security Officer
- Include training requirements in offer letters

### 2.3 Managers

**Responsibilities:**
- Ensure direct reports complete training on time
- Provide time during work hours for training
- Reinforce security practices in team meetings
- Lead by example (complete training first)
- Escalate training non-compliance to HR

### 2.4 Workforce Members

**Responsibilities:**
- Complete all required training by deadlines
- Achieve minimum passing score (80%) on quizzes
- Apply training to daily work
- Ask questions if security procedures are unclear
- Report suspected security incidents

---

## 3. Training Requirements

### 3.1 Training Categories

| Training Type | Audience | Frequency | Duration | Passing Score | Deadline |
|---------------|----------|-----------|----------|---------------|----------|
| **New Hire Onboarding** | All new workforce members | Once (upon hire) | 3 hours | 80% | Within 7 days of start date |
| **Annual Refresher** | All workforce members | Annually | 2 hours | 80% | Within 30 days of anniversary |
| **Role-Specific** | Job-specific (clinicians, engineers, etc.) | Annually | 1-2 hours | 80% | Within 30 days of assignment |
| **Phishing Simulation** | All workforce members | Quarterly | 15 min (if clicked) | N/A | Immediate (upon failing) |
| **Incident Response** | SRE, Security, Compliance teams | Annually | 2 hours | 80% | January 31 each year |
| **Remedial Training** | Workforce members who violated policy | As needed | 1-2 hours | 90% | Within 14 days of violation |

---

### 3.2 New Hire Onboarding Training

**Required for:** All new workforce members (employees, contractors, interns)
**Deadline:** Must be completed within 7 days of start date, before accessing any ePHI systems
**Duration:** 3 hours (self-paced online)
**Platform:** KnowBe4 (or equivalent LMS)

**Modules:**

| Module | Topic | Duration | Key Learning Objectives |
|--------|-------|----------|------------------------|
| **1. HIPAA Overview** | HIPAA basics, PHI vs ePHI, penalties | 30 min | Understand HIPAA requirements, recognize PHI, know consequences of violations |
| **2. ePHI Handling** | Accessing, storing, transmitting ePHI | 30 min | Use secure methods for ePHI (no personal email, encrypt USB drives, use VPN) |
| **3. Access Control** | Passwords, MFA, least privilege | 30 min | Create strong passwords, enable MFA, never share credentials |
| **4. Phishing Awareness** | Recognizing phishing, reporting suspicious emails | 30 min | Identify phishing red flags, report to security@lifenavigator.com |
| **5. Malware Protection** | Ransomware, viruses, safe browsing | 15 min | Don't click unknown links, don't download unauthorized software, keep systems updated |
| **6. Physical Security** | Workstation security, clean desk, device loss | 15 min | Lock screen when away (Ctrl+Alt+Del), don't leave PHI visible, report lost devices |
| **7. Incident Response** | Recognizing incidents, reporting, breach response | 15 min | Know what constitutes a breach, report within 1 hour, preserve evidence |
| **8. Company Policies** | Acceptable Use, Sanctions, Confidentiality | 30 min | Understand policy violations and consequences |
| **9. Assessment** | Quiz covering all modules | 15 min | Achieve 80% passing score (retake if failed) |

**Evidence:**
- Training completion certificate (PDF) exported from LMS
- Quiz results (score, date, time spent)
- Certificate stored in: `gs://lifenav-prod-compliance-evidence/training/{year}/new-hire/{employee-id}/`

**Non-Compliance:**
- Access to ePHI systems will not be granted until training completed
- If not completed within 7 days, manager notified daily
- If not completed within 14 days, escalation to HR + Security Officer

---

### 3.3 Annual Refresher Training

**Required for:** All workforce members (employees, contractors)
**Deadline:** Within 30 days of hire date anniversary
**Duration:** 2 hours (self-paced online)
**Platform:** KnowBe4

**Modules:**

| Module | Topic | Duration | Key Learning Objectives |
|--------|-------|----------|------------------------|
| **1. What's New** | Policy updates, new threats, recent incidents | 20 min | Stay current on security landscape |
| **2. Phishing Deep Dive** | Advanced phishing techniques (spear phishing, BEC) | 30 min | Recognize sophisticated attacks |
| **3. Ransomware** | Ransomware trends, prevention, response | 20 min | Prevent ransomware, know how to respond |
| **4. Mobile Security** | Securing smartphones/tablets with ePHI access | 20 min | Enable device encryption, use mobile device management (MDM) |
| **5. Cloud Security** | Securing cloud apps (Google Workspace, Slack, GitHub) | 15 min | Understand shared responsibility model, secure cloud configurations |
| **6. Social Engineering** | Vishing, smishing, pretexting | 15 min | Recognize social engineering tactics beyond email |
| **7. Policy Review** | Review updated policies | 15 min | Acknowledge policy changes |
| **8. Assessment** | Quiz covering all modules | 15 min | Achieve 80% passing score |

**Evidence:** Same as onboarding, stored in `gs://lifenav-prod-compliance-evidence/training/{year}/annual/{employee-id}/`

**Non-Compliance:**
- Reminder emails sent 30, 14, 7 days before deadline
- If not completed by deadline:
  - Day 1-7 overdue: Manager notified daily
  - Day 8-14 overdue: ePHI access suspended (read-only)
  - Day 15+ overdue: ePHI access revoked, written warning

---

### 3.4 Role-Specific Training

#### 3.4.1 Clinical Staff (Physicians, Nurses, Care Coordinators)

**Additional Training:**
- Patient privacy best practices
- Clinical workflows (EHR usage, documentation)
- Telehealth security (securing video calls, HIPAA-compliant platforms)
- Minimum necessary principle (only access ePHI needed for treatment)
- Patient rights (right to access, amend, accounting of disclosures)

**Duration:** 1 hour
**Frequency:** Annually

---

#### 3.4.2 Engineering/SRE Team

**Additional Training:**
- Secure coding practices (OWASP Top 10, SQL injection prevention)
- ePHI data flow control (Sentry PHI scrubbing, SendGrid blocking)
- GCP security best practices (IAM, encryption, VPC)
- Incident response for engineers (preserve logs, don't delete evidence)
- Container security (image scanning, Kubernetes RBAC)

**Duration:** 2 hours
**Frequency:** Annually

**Platform:** Secure Code Warrior, SANS training, or custom

---

#### 3.4.3 Executives and Board Members

**Additional Training:**
- HIPAA executive responsibilities
- Breach notification requirements (60-day rule)
- Regulatory penalties (OCR fines, criminal penalties)
- Cyber insurance and risk management
- Board-level cybersecurity oversight

**Duration:** 1 hour
**Frequency:** Annually

**Delivery Method:** Live session with CISO/Security Officer

---

#### 3.4.4 Customer Support

**Additional Training:**
- Verifying patient identity before disclosing ePHI
- Handling ePHI in support tickets (use secure portal, not email)
- De-escalation techniques (angry patients demanding ePHI over phone)
- Minimum necessary (don't give more ePHI than requested)

**Duration:** 1 hour
**Frequency:** Annually

---

### 3.5 Phishing Simulation Training (Quarterly)

**Required for:** All workforce members with email access
**Frequency:** Quarterly (Jan, Apr, Jul, Oct)
**Platform:** KnowBe4 PhishER, Cofense, or similar

**Process:**
1. **Simulation:** Security Officer sends simulated phishing email to all workforce members
   - Examples: Fake Microsoft login, fake HR benefits update, fake invoice, CEO impersonation
2. **Results Tracking:**
   - **Passed:** Did not click link or enter credentials
   - **Failed:** Clicked link or entered credentials
3. **Remedial Training:** Workforce members who fail must:
   - Complete 15-minute "Phishing Awareness" module immediately
   - Re-take simulation within 1 week
   - If fail again: Manager notified, verbal warning

**Evidence:**
- Simulation results report (who clicked, who reported)
- Remedial training completion certificates
- Trend analysis (are click rates improving?)

**Metrics Tracked:**
- Phish-prone percentage (% who clicked)
- Reporting rate (% who reported to security@)
- Repeat offenders (workforce members who fail multiple simulations)

**Target:** < 5% phish-prone percentage by end of year

---

### 3.6 Incident Response Training

**Required for:** SRE Team, Security Team, Compliance Team, Executives
**Frequency:** Annually + after major incidents
**Duration:** 2 hours
**Delivery Method:** Live tabletop exercise

**Topics:**
- Incident classification (SEV 1-4)
- Incident response workflow (detect, contain, eradicate, recover, lessons learned)
- HIPAA breach assessment decision tree
- Breach notification requirements (60-day timeline)
- Evidence preservation and chain of custody
- Communication protocols (internal, external, media)
- Tabletop exercise: Simulated ransomware attack

**Evidence:**
- Tabletop exercise report
- Participant signatures (attendance)
- Lessons learned document

**Schedule:** January each year (before incident season)

---

### 3.7 Remedial Training

**Required for:** Workforce members who violate security policies
**Trigger:** Security incident, policy violation, failed audit
**Deadline:** Within 14 days of violation
**Duration:** 1-2 hours (depends on violation)

**Examples:**
- **Clicked phishing link:** Phishing awareness training (15 min)
- **Weak password:** Password management training (30 min)
- **Emailed ePHI:** ePHI handling training (1 hour)
- **Lost laptop:** Physical security training (1 hour)
- **Unauthorized ePHI access:** HIPAA overview + ethics training (2 hours)

**Evidence:** Remedial training completion certificate attached to incident report

---

## 4. Training Content Requirements

### 4.1 HIPAA Security Rule Required Topics

Per § 164.308(a)(5)(ii), training must address:

#### (A) Security Reminders (§ 164.308(a)(5)(ii)(A))

**Requirement:** Periodic security updates

**Implementation:**
- **Monthly Security Newsletter:** Tips, recent threats, policy updates (email)
- **Quarterly Security Town Halls:** Live Q&A with Security Officer (30 min)
- **Slack #security-updates channel:** Real-time alerts, articles, best practices
- **Security posters:** Physical office (if applicable), digital screens

**Evidence:** Newsletter archive, town hall recordings, Slack message logs

---

#### (B) Protection from Malicious Software (§ 164.308(a)(5)(ii)(B))

**Requirement:** Procedures for guarding against, detecting, and reporting malicious software

**Training Content:**
- **Recognize malware:** Ransomware, trojans, spyware, adware
- **Prevention:**
  - Don't click suspicious links or download unauthorized software
  - Keep systems updated (auto-updates enabled)
  - Use antivirus software (Crowdstrike, Carbon Black, or similar)
- **Detection:** Slow system, pop-ups, unusual network activity
- **Reporting:** Immediately report to security@lifenavigator.com, don't attempt to remove yourself

**Evidence:** Training completion, anti-malware incident reports

---

#### (C) Log-in Monitoring (§ 164.308(a)(5)(ii)(C))

**Requirement:** Procedures for monitoring log-in attempts and reporting discrepancies

**Training Content:**
- **Monitor your own activity:** Review "Recent activity" in Google Workspace (weekly)
- **Report suspicious logins:**
  - Login from unfamiliar location (different country)
  - Login at unusual time (3 AM)
  - Multiple failed login attempts
- **Response:** Immediately change password, notify security@

**Implementation:**
- **Automated alerts:** Security team monitors all logins via SIEM
- **Workforce member responsibility:** Self-monitor weekly, report anomalies

**Evidence:** Training completion, login monitoring SOPs

---

#### (D) Password Management (§ 164.308(a)(5)(ii)(D))

**Requirement:** Procedures for creating, changing, and safeguarding passwords

**Training Content:**
- **Strong passwords:**
  - Minimum 12 characters (16+ recommended)
  - Mix of uppercase, lowercase, numbers, symbols
  - No dictionary words or personal info (name, birthday)
  - Use passphrases: "Coffee!Mug$Purple27"
- **Password managers:** Use 1Password or similar (company-provided)
- **Never share passwords:** Not with coworkers, not with IT (we'll never ask)
- **Change passwords:**
  - Immediately if compromised
  - Every 90 days (enforced by policy)
  - Don't reuse last 5 passwords
- **MFA required:** Enable MFA on all accounts

**Evidence:** Training completion, password policy compliance audits

---

## 5. Training Delivery Methods

### 5.1 Online Self-Paced Training

**Platform:** KnowBe4, SANS Securing The Human, or similar LMS

**Advantages:**
- Flexible timing (workforce members choose when to complete)
- Scalable (supports 1000+ users)
- Automated tracking and reminders
- Built-in quizzes and certificates

**Used For:** New hire onboarding, annual refresher, most role-specific training

---

### 5.2 Live Instructor-Led Training

**Delivery:** In-person (if office) or Zoom

**Advantages:**
- Interactive Q&A
- Real-time demonstrations
- Team building
- Complex topics (incident response)

**Used For:** Incident response tabletop exercises, executive training, advanced security topics

---

### 5.3 Phishing Simulations

**Platform:** KnowBe4 PhishER, Cofense PhishMe

**Delivery:** Automated emails sent quarterly

---

### 5.4 Security Reminders

**Channels:**
- **Email:** Monthly newsletter (first Monday of each month)
- **Slack:** #security-updates channel (real-time alerts)
- **Posters:** Digital screens in office (if applicable)
- **Town Halls:** Quarterly live sessions (30 min)

---

## 6. Training Tracking and Enforcement

### 6.1 Training Tracking System

**System:** BambooHR (HRIS) + KnowBe4 (LMS)

**Tracked Metrics:**
- Training completion rate (%)
- Average time to completion (days)
- Quiz pass rates (%)
- Phishing simulation click rates (%)
- Overdue training (# workforce members)

**Reports:**
- **Weekly:** Overdue training report to managers
- **Monthly:** Executive dashboard (completion rates by department)
- **Quarterly:** Phishing simulation results
- **Annual:** Compliance report (100% completion?)

**Evidence:** Exported reports stored in `gs://lifenav-prod-compliance-evidence/training/{year}/reports/`

---

### 6.2 Enforcement

**Non-Compliance Sanctions:**

| Days Overdue | Action | Responsible |
|--------------|--------|-------------|
| **0 (deadline)** | Automated reminder email | LMS |
| **1-7 days** | Daily reminder to workforce member + manager | LMS |
| **8-14 days** | ePHI access suspended (read-only mode) | Security Officer |
| **15-30 days** | ePHI access revoked + written warning | Security Officer + HR |
| **30+ days** | Escalation to CEO + performance improvement plan | HR |

**Documentation:** Non-compliance sanctions documented in personnel file and sanctions log (per Workforce Sanctions Policy POL-SEC-001)

---

## 7. Training Effectiveness Assessment

### 7.1 Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Training completion rate** | 100% | % workforce members who completed required training on time |
| **Average quiz score** | ≥ 85% | Average score across all quizzes |
| **Phish-prone percentage** | < 5% | % workforce members who clicked simulated phishing emails |
| **Time to complete training** | < 3 days | Average days from assignment to completion |
| **Repeat offenders** | 0 | # workforce members who fail 3+ phishing simulations |
| **Security incidents caused by human error** | < 5/year | # incidents where root cause was untrained workforce member |

---

### 7.2 Annual Assessment

**Process:**
1. **Q4 Review:** Security Officer reviews training effectiveness metrics
2. **Identify Gaps:**
   - Which topics had lowest quiz scores?
   - Which departments had highest phish-prone %?
   - Which incidents could have been prevented by better training?
3. **Update Training:** Enhance weak areas, add new threat scenarios
4. **Benchmark:** Compare to industry averages (SANS Security Awareness Report)
5. **Executive Report:** Present findings to CEO and Board

**Evidence:** Annual training effectiveness report stored in `gs://lifenav-prod-compliance-evidence/training/{year}/`

---

## 8. Training Budget

**Annual Budget:** $50,000 (estimated)

**Breakdown:**
- **LMS Platform (KnowBe4):** $15,000/year (for 50 users)
- **Role-Specific Training (SANS, Coursera):** $10,000/year
- **Phishing Simulation Platform:** $5,000/year (included in KnowBe4)
- **Incident Response Tabletop Facilitator:** $5,000/year
- **Security Awareness Materials (posters, swag):** $2,000/year
- **Executive Training (conference, workshops):** $8,000/year
- **Contingency (new tools, vendors):** $5,000/year

**Budget Owner:** Security Officer (approved by CFO annually)

---

## 9. Required Records and Evidence

### 9.1 Records to Maintain

For HIPAA compliance and audits, maintain:

| Record Type | Storage Location | Retention |
|-------------|------------------|-----------|
| **Training completion certificates** | `gs://lifenav-prod-compliance-evidence/training/{year}/{category}/{employee-id}/` | 7 years after termination |
| **Quiz results** | LMS + exported to GCS (same path) | 7 years |
| **Phishing simulation results** | `gs://lifenav-prod-compliance-evidence/training/{year}/phishing-simulations/` | 7 years |
| **Attendance sheets (live training)** | `gs://lifenav-prod-compliance-evidence/training/{year}/attendance/` | 7 years |
| **Training materials (slides, videos)** | `gs://lifenav-prod-compliance-evidence/training/{year}/materials/` | 7 years |
| **Policy acknowledgments** | Personnel files (HR Google Drive) | 7 years after termination |
| **Training effectiveness reports** | `gs://lifenav-prod-compliance-evidence/training/{year}/reports/` | 7 years |
| **Remedial training certificates** | Incident reports + training folder | 7 years |

---

### 9.2 Evidence for Auditors

When auditors request proof of security training:

**Provide:**
1. **Training roster:** List of all workforce members with completion status
2. **Sample certificates:** Random sample of 10 workforce members (redact SSN)
3. **Quiz results:** Show passing scores
4. **Phishing simulation report:** Show improving trend (click rate decreasing)
5. **Training materials:** Syllabus, slides, quiz questions
6. **Policy acknowledgments:** Signed forms
7. **Enforcement evidence:** Sanctions for non-compliance (if any)

**Response Time:** Provide within 48 hours of request

---

## 10. Related Policies

- Workforce Sanctions Policy (POL-SEC-001)
- Workforce Clearance Policy (POL-SEC-004)
- Incident Response Policy (POL-SEC-003)
- Acceptable Use Policy (POL-SEC-002)

---

## 11. Review and Updates

**Annual Review:** This policy will be reviewed annually by Security Officer, Privacy Officer, and HR.

**Update Triggers:**
- New HIPAA regulations
- Emerging threats (new ransomware variants, sophisticated phishing)
- Incident lessons learned (what training could have prevented this?)
- Training effectiveness assessment (low quiz scores on certain topics)
- Technology changes (new systems processing ePHI)

**Evidence:** Policy review meeting notes stored in `gs://lifenav-prod-compliance-evidence/policies/`

---

## 12. Contact Information

**For questions about training:**
- Security Officer: security@lifenavigator.com
- Training Administrator (HR): training@lifenavigator.com

**For technical issues with LMS:**
- IT Support: support@lifenavigator.com

**To report security incidents:**
- Security Officer: security@lifenavigator.com
- Phone: [Security Hotline]

---

## Acknowledgment

I acknowledge that I have read and understand the Security Awareness and Training Policy. I agree to complete all required training by the specified deadlines and understand that non-compliance may result in sanctions including access suspension and termination.

**Workforce Member Signature:** _______________________ **Date:** __________

**Workforce Member Name (Print):** _______________________

---

**Policy Version:** 1.0
**Effective Date:** 2026-01-09
**Next Review:** 2027-01-09
**Classification:** INTERNAL - POLICY
**Evidence Location:** `gs://lifenav-prod-compliance-evidence/policies/security_awareness_training.md`
