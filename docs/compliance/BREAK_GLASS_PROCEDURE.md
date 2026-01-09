# Break-Glass Emergency Access Procedure

**Policy Number:** POL-SEC-006
**Effective Date:** 2026-01-09
**Last Review:** 2026-01-09
**Next Review:** 2027-01-09 (Annual)
**Owner:** Security Officer
**Approval:** CEO

**HIPAA Reference:** 45 CFR § 164.312(a)(2)(ii) - Emergency Access Procedure

---

## Executive Summary

This procedure defines the break-glass emergency access mechanism for ePHI when normal access controls would prevent critical patient care or system recovery. Break-glass access is **RARE, LOUD, and REVERSIBLE** by design.

**Core Principle:** Default deny remains. Emergency access requires dual approval, is time-limited, scope-limited, heavily audited, and automatically revoked.

---

## Table of Contents

1. [When to Use Break-Glass](#when-to-use-break-glass)
2. [Design Principles](#design-principles)
3. [Access Request Process](#access-request-process)
4. [Technical Implementation](#technical-implementation)
5. [Audit and Monitoring](#audit-and-monitoring)
6. [Post-Access Review](#post-access-review)
7. [Abuse Prevention](#abuse-prevention)

---

## 1. When to Use Break-Glass

### 1.1 Valid Use Cases

**Emergency access is ONLY permitted for:**

| Scenario | Example | Approval Required |
|----------|---------|-------------------|
| **Life-Threatening Emergency** | Patient in ER needs allergy info, treating physician locked out | Security Officer + Privacy Officer |
| **System Recovery (SEV 1)** | Cloud SQL database corruption, need admin access to restore | Security Officer + CTO |
| **Security Incident Response** | Active breach, need elevated access to contain threat | Security Officer + CEO |
| **Regulatory Investigation** | HHS OCR audit demands immediate data export | Privacy Officer + Legal Counsel |

**NOT valid:**
- ❌ Convenience ("normal login is slow")
- ❌ Troubleshooting non-critical issues
- ❌ Training or demos
- ❌ Curiosity or research
- ❌ After-hours work without proper planning

---

### 1.2 Alternatives to Break-Glass

**Always exhaust these options first:**

| Instead of Break-Glass | Try This |
|------------------------|----------|
| "I need to query production DB" | Use read replica with normal credentials |
| "I need to troubleshoot API issue" | Check logs in Cloud Logging (no DB access needed) |
| "I need to access patient record" | Request access via normal IAM process (Security Officer approval) |
| "I need emergency access on weekend" | Plan ahead, get approval during business hours |

**Rule:** If you have time to request break-glass access, it's not an emergency.

---

## 2. Design Principles

### 2.1 Two-Person Rule

**Requirement:** Break-glass access requires approval from TWO authorized individuals.

**Authorized Approvers:**
- Security Officer
- Privacy Officer
- CTO
- CEO
- Legal Counsel (for regulatory investigations only)

**Constraint:** Requester CANNOT be an approver. Minimum 2 approvers, neither is the requester.

**Example:**
- ✅ SRE Engineer requests → Security Officer + CTO approve
- ❌ Security Officer requests → Security Officer + CTO approve (Security Officer cannot self-approve)

---

### 2.2 Time-Limited Access

**Default Duration:** 4 hours
**Maximum Duration:** 24 hours (requires CEO approval)
**Automatic Revocation:** Access expires at end of duration, no manual revocation needed

**Implementation:** GCP IAM Condition with expiration timestamp

```json
{
  "condition": {
    "title": "Break-glass expires 2026-01-09 12:00 UTC",
    "expression": "request.time < timestamp('2026-01-09T12:00:00Z')"
  }
}
```

---

### 2.3 Scope-Limited Access (Least Privilege)

**Principle:** Grant ONLY the minimum access needed to resolve emergency.

**Scope Dimensions:**
1. **Resource Scope:** Specific patient record, specific database, specific project
2. **Permission Scope:** Read-only vs. read/write vs. admin
3. **Time Scope:** Shortest duration sufficient

**Examples:**

| Emergency | Access Granted | Justification |
|-----------|----------------|---------------|
| Query single patient's allergy data | `roles/cloudsql.viewer` + row-level filter (`patient_id='12345'`) | Read-only, single patient |
| Restore corrupted database | `roles/cloudsql.admin` (4 hours) | Admin access needed for PITR, time-limited |
| Investigate security breach | `roles/logging.viewer` + `roles/cloudsql.viewer` (read-only) | No write access needed for investigation |

**Anti-Pattern:**
- ❌ Granting `roles/owner` on entire GCP project
- ❌ Granting permanent access "just in case"
- ❌ Granting write access when read-only sufficient

---

### 2.4 Mandatory Justification

**Requirements:**
- **Reason:** Free-text description of emergency (min 50 chars)
- **Ticket ID:** JIRA incident ticket or support ticket (e.g., `INC-2026-001`, `SUPPORT-5678`)
- **Patient ID (if applicable):** Specific patient record(s) being accessed
- **Approver Comments:** Why approvers granted access (audit trail)

**Validation:**
- Reason cannot be generic ("emergency access", "need access")
- Ticket ID must exist and be open (verified via JIRA API)
- Patient ID must exist in database (if accessing patient data)

---

## 3. Access Request Process

### 3.1 Request Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. REQUESTER: Submit Break-Glass Request                   │
│     - POST /api/v1/emergency-access/request                 │
│     - Provide: reason, ticket_id, scope, duration           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. SYSTEM: Create Pending Request                          │
│     - Generate request_id                                   │
│     - Send notifications to approvers (Slack + email)       │
│     - Log request in audit trail (severity=CRITICAL)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. APPROVER 1: Review and Approve/Deny                     │
│     - POST /api/v1/emergency-access/approve                 │
│     - Provide: request_id, decision, comments               │
│     - Notify Approver 2                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. APPROVER 2: Review and Approve/Deny                     │
│     - POST /api/v1/emergency-access/approve                 │
│     - If BOTH approve → Grant access                        │
│     - If EITHER denies → Reject request                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────┴───────────┐
         │  Both Approved?       │
         └───┬───────────────┬───┘
             │               │
           YES              NO
             │               │
             ▼               ▼
┌─────────────────────┐  ┌─────────────────────┐
│  5a. GRANT ACCESS   │  │  5b. DENY REQUEST   │
│  - Add IAM binding  │  │  - Log denial       │
│  - Set expiration   │  │  - Notify requester │
│  - Notify requester │  └─────────────────────┘
│  - Log grant        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  6. REQUESTER: Use Emergency Access                         │
│     - Access granted for limited time/scope                 │
│     - All actions logged with severity=CRITICAL             │
│     - Enhanced monitoring active                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  7. SYSTEM: Auto-Revoke Access (at expiration)              │
│     - Remove IAM binding at end of duration                 │
│     - Log revocation                                        │
│     - Trigger post-access review                            │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.2 Request Submission

**API Endpoint:** `POST /api/v1/emergency-access/request`

**Request Body:**
```json
{
  "requester_email": "engineer@lifenavigator.com",
  "reason": "Life-threatening emergency: Patient 12345 in ER with allergic reaction, treating physician unable to access allergy history due to account lockout. Need immediate read access to patient_demographics and medications tables.",
  "ticket_id": "INC-2026-001",
  "scope": {
    "resource": "cloudsql.instances/ln-health-db-beta",
    "role": "roles/cloudsql.viewer",
    "condition": "resource.name.startsWith('patients/12345')"
  },
  "duration_hours": 4,
  "patient_id": "12345"
}
```

**Response (Pending Approval):**
```json
{
  "request_id": "bgr-2026-01-09-001",
  "status": "pending",
  "created_at": "2026-01-09T08:00:00Z",
  "approvals_required": 2,
  "approvals_received": 0,
  "notified_approvers": [
    "security@lifenavigator.com",
    "privacy@lifenavigator.com",
    "cto@lifenavigator.com"
  ],
  "message": "Your emergency access request has been submitted. Approvers have been notified via Slack and email. You will be notified when a decision is made."
}
```

---

### 3.3 Approval Process

**API Endpoint:** `POST /api/v1/emergency-access/approve`

**Request Body:**
```json
{
  "request_id": "bgr-2026-01-09-001",
  "approver_email": "security@lifenavigator.com",
  "decision": "approved",
  "comments": "Verified with ER physician. Life-threatening emergency confirmed. Granting read-only access to patient 12345 for 4 hours."
}
```

**Response (After First Approval):**
```json
{
  "request_id": "bgr-2026-01-09-001",
  "status": "pending",
  "approvals_received": 1,
  "approvals_required": 2,
  "message": "1 of 2 approvals received. Waiting for second approval."
}
```

**Response (After Second Approval - Access Granted):**
```json
{
  "request_id": "bgr-2026-01-09-001",
  "status": "granted",
  "granted_at": "2026-01-09T08:05:00Z",
  "expires_at": "2026-01-09T12:05:00Z",
  "iam_binding": {
    "member": "user:engineer@lifenavigator.com",
    "role": "roles/cloudsql.viewer",
    "condition": {
      "expression": "request.time < timestamp('2026-01-09T12:05:00Z') && resource.name.startsWith('patients/12345')"
    }
  },
  "message": "Emergency access granted. Access expires at 2026-01-09 12:05 UTC. All actions will be logged."
}
```

---

### 3.4 Denial Process

**If EITHER approver denies:**

**Response:**
```json
{
  "request_id": "bgr-2026-01-09-001",
  "status": "denied",
  "denied_at": "2026-01-09T08:03:00Z",
  "denied_by": "privacy@lifenavigator.com",
  "denial_reason": "Not a life-threatening emergency. Patient can be accessed via normal physician credentials. Requester should follow standard access request process.",
  "message": "Your emergency access request has been denied. See denial_reason for details."
}
```

---

## 4. Technical Implementation

### 4.1 Database Schema

**Table: `emergency_access_requests`**

```sql
CREATE TABLE emergency_access_requests (
    request_id VARCHAR(50) PRIMARY KEY,  -- bgr-2026-01-09-001
    requester_email VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL CHECK (LENGTH(reason) >= 50),
    ticket_id VARCHAR(50) NOT NULL,
    patient_id VARCHAR(50),  -- NULL if not patient-specific

    -- Scope
    resource VARCHAR(255) NOT NULL,  -- GCP resource name
    role VARCHAR(100) NOT NULL,      -- IAM role to grant
    condition_expression TEXT,       -- GCP IAM condition expression
    duration_hours INT NOT NULL CHECK (duration_hours BETWEEN 1 AND 24),

    -- Status
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'granted', 'denied', 'expired', 'revoked')),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    granted_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,

    -- Approvals
    approvals_required INT NOT NULL DEFAULT 2,
    approvals_received INT NOT NULL DEFAULT 0,

    -- Audit
    created_by VARCHAR(255) NOT NULL,  -- System/API user
    grant_reason TEXT,   -- Combined approver comments
    denial_reason TEXT,
    revocation_reason TEXT,

    -- Indexes for searching
    INDEX idx_status (status),
    INDEX idx_requester (requester_email),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at)
);

CREATE TABLE emergency_access_approvals (
    approval_id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL REFERENCES emergency_access_requests(request_id),
    approver_email VARCHAR(255) NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'denied')),
    comments TEXT NOT NULL,
    approved_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Prevent duplicate approvals from same person
    UNIQUE (request_id, approver_email)
);

CREATE TABLE emergency_access_audit_log (
    log_id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL REFERENCES emergency_access_requests(request_id),
    event_type VARCHAR(50) NOT NULL,  -- 'request_created', 'approval_received', 'access_granted', 'access_used', 'access_revoked'
    actor_email VARCHAR(255) NOT NULL,
    details JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Immutability (no DELETE, no UPDATE allowed)
    INDEX idx_request_id (request_id),
    INDEX idx_timestamp (timestamp)
);

-- Prevent modifications to audit log (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Cannot modify or delete audit log entries (immutable)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE ON emergency_access_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_log_delete
BEFORE DELETE ON emergency_access_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

---

### 4.2 FastAPI Implementation

**File: `backend/app/api/emergency_access.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, validator
from typing import Optional
import uuid
from datetime import datetime, timedelta
import logging

from app.core.security import get_current_user, is_authorized_approver
from app.core.audit import log_emergency_access_event
from app.core.gcp import grant_iam_role, revoke_iam_role
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/emergency-access", tags=["emergency-access"])

logger = logging.getLogger(__name__)

# ============================================================================
# REQUEST MODELS
# ============================================================================

class EmergencyAccessScope(BaseModel):
    resource: str = Field(..., description="GCP resource name (e.g., cloudsql.instances/ln-health-db-beta)")
    role: str = Field(..., description="IAM role to grant (e.g., roles/cloudsql.viewer)")
    condition: Optional[str] = Field(None, description="IAM condition expression for scope limiting")

class EmergencyAccessRequest(BaseModel):
    reason: str = Field(..., min_length=50, description="Detailed justification for emergency access (min 50 chars)")
    ticket_id: str = Field(..., description="JIRA incident ticket ID (e.g., INC-2026-001)")
    scope: EmergencyAccessScope
    duration_hours: int = Field(4, ge=1, le=24, description="Access duration in hours (1-24, default 4)")
    patient_id: Optional[str] = Field(None, description="Patient ID if accessing specific patient data")

    @validator('reason')
    def validate_reason(cls, v):
        # Prevent generic reasons
        generic_reasons = ['emergency access', 'need access', 'urgent', 'asap']
        if any(generic in v.lower() for generic in generic_reasons) and len(v) < 100:
            raise ValueError('Reason is too generic. Provide specific details of the emergency.')
        return v

    @validator('ticket_id')
    def validate_ticket_id(cls, v):
        # Verify ticket exists and is open (call JIRA API)
        # Simplified validation here
        if not v.startswith(('INC-', 'SUPPORT-', 'SEC-')):
            raise ValueError('Invalid ticket ID format. Must start with INC-, SUPPORT-, or SEC-')
        return v

class EmergencyAccessApproval(BaseModel):
    request_id: str
    decision: str = Field(..., regex='^(approved|denied)$')
    comments: str = Field(..., min_length=20, description="Approver comments (min 20 chars)")

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/request")
async def request_emergency_access(
    request: EmergencyAccessRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Request emergency break-glass access to ePHI.

    Requirements:
    - Detailed justification (min 50 chars)
    - Valid incident ticket ID
    - Specific scope (resource + role + optional condition)
    - Duration (1-24 hours, default 4)

    Process:
    - Request created with status='pending'
    - Notifications sent to authorized approvers (Slack + email)
    - Requires 2 approvals to grant access
    - All actions logged with severity=CRITICAL
    """

    # Generate request ID
    request_id = f"bgr-{datetime.utcnow().strftime('%Y-%m-%d')}-{uuid.uuid4().hex[:6]}"

    # Verify requester is not an approver (prevent self-approval)
    if is_authorized_approver(current_user.email):
        logger.warning(f"Break-glass request denied: {current_user.email} is an authorized approver (cannot self-approve)")
        raise HTTPException(
            status_code=403,
            detail="Authorized approvers cannot request break-glass access for themselves. Request must come from non-approver."
        )

    # Insert request into database
    db.execute("""
        INSERT INTO emergency_access_requests (
            request_id, requester_email, reason, ticket_id, patient_id,
            resource, role, condition_expression, duration_hours,
            status, created_by
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', 'api'
        )
    """, (
        request_id,
        current_user.email,
        request.reason,
        request.ticket_id,
        request.patient_id,
        request.scope.resource,
        request.scope.role,
        request.scope.condition,
        request.duration_hours
    ))
    db.commit()

    # Audit log (severity=CRITICAL)
    log_emergency_access_event(
        request_id=request_id,
        event_type='request_created',
        actor_email=current_user.email,
        details={
            'reason': request.reason,
            'ticket_id': request.ticket_id,
            'scope': request.scope.dict(),
            'duration_hours': request.duration_hours,
            'patient_id': request.patient_id
        },
        severity='CRITICAL'
    )

    # Send notifications to approvers (background task)
    background_tasks.add_task(
        notify_approvers,
        request_id=request_id,
        requester_email=current_user.email,
        reason=request.reason,
        ticket_id=request.ticket_id
    )

    logger.critical(f"BREAK-GLASS REQUEST: {request_id} by {current_user.email} - Reason: {request.reason[:100]}...")

    return {
        "request_id": request_id,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "approvals_required": 2,
        "approvals_received": 0,
        "notified_approvers": get_authorized_approvers(),
        "message": "Your emergency access request has been submitted. Approvers have been notified."
    }


@router.post("/approve")
async def approve_emergency_access(
    approval: EmergencyAccessApproval,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Approve or deny emergency access request.

    Requirements:
    - Current user must be authorized approver
    - Cannot approve own request
    - Requires 2 approvals to grant access
    - If ANY approver denies, request is denied
    """

    # Verify current user is authorized approver
    if not is_authorized_approver(current_user.email):
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to approve emergency access requests. Only Security Officer, Privacy Officer, CTO, CEO can approve."
        )

    # Fetch request
    request_row = db.execute("""
        SELECT * FROM emergency_access_requests WHERE request_id = %s
    """, (approval.request_id,)).fetchone()

    if not request_row:
        raise HTTPException(status_code=404, detail="Request not found")

    # Prevent self-approval
    if request_row['requester_email'] == current_user.email:
        raise HTTPException(
            status_code=403,
            detail="Cannot approve your own emergency access request (two-person rule)"
        )

    # Check if already decided
    if request_row['status'] != 'pending':
        raise HTTPException(
            status_code=400,
            detail=f"Request already {request_row['status']}. Cannot approve."
        )

    # Check if approver already approved/denied
    existing_approval = db.execute("""
        SELECT * FROM emergency_access_approvals
        WHERE request_id = %s AND approver_email = %s
    """, (approval.request_id, current_user.email)).fetchone()

    if existing_approval:
        raise HTTPException(
            status_code=400,
            detail="You have already provided approval/denial for this request"
        )

    # Insert approval/denial
    db.execute("""
        INSERT INTO emergency_access_approvals (request_id, approver_email, decision, comments)
        VALUES (%s, %s, %s, %s)
    """, (approval.request_id, current_user.email, approval.decision, approval.comments))

    # Audit log
    log_emergency_access_event(
        request_id=approval.request_id,
        event_type=f'approval_{approval.decision}',
        actor_email=current_user.email,
        details={
            'decision': approval.decision,
            'comments': approval.comments
        },
        severity='CRITICAL'
    )

    # If DENIED, reject request immediately
    if approval.decision == 'denied':
        db.execute("""
            UPDATE emergency_access_requests
            SET status = 'denied', denial_reason = %s
            WHERE request_id = %s
        """, (approval.comments, approval.request_id))
        db.commit()

        # Notify requester
        background_tasks.add_task(
            notify_requester_denied,
            request_id=approval.request_id,
            requester_email=request_row['requester_email'],
            denial_reason=approval.comments
        )

        logger.critical(f"BREAK-GLASS DENIED: {approval.request_id} by {current_user.email} - Reason: {approval.comments}")

        return {
            "request_id": approval.request_id,
            "status": "denied",
            "denied_by": current_user.email,
            "denial_reason": approval.comments,
            "message": "Emergency access request has been denied."
        }

    # If APPROVED, check if we have 2 approvals
    approvals_count = db.execute("""
        SELECT COUNT(*) as count FROM emergency_access_approvals
        WHERE request_id = %s AND decision = 'approved'
    """, (approval.request_id,)).fetchone()['count']

    db.execute("""
        UPDATE emergency_access_requests
        SET approvals_received = %s
        WHERE request_id = %s
    """, (approvals_count, approval.request_id))
    db.commit()

    # If we have 2 approvals, GRANT ACCESS
    if approvals_count >= 2:
        expires_at = datetime.utcnow() + timedelta(hours=request_row['duration_hours'])

        # Grant IAM role with expiration condition
        iam_binding = grant_iam_role(
            member=f"user:{request_row['requester_email']}",
            role=request_row['role'],
            resource=request_row['resource'],
            condition_expression=request_row['condition_expression'],
            expires_at=expires_at
        )

        # Update request status
        db.execute("""
            UPDATE emergency_access_requests
            SET status = 'granted', granted_at = NOW(), expires_at = %s
            WHERE request_id = %s
        """, (expires_at, approval.request_id))
        db.commit()

        # Audit log
        log_emergency_access_event(
            request_id=approval.request_id,
            event_type='access_granted',
            actor_email='system',
            details={
                'iam_binding': iam_binding,
                'expires_at': expires_at.isoformat(),
                'approvers': [row['approver_email'] for row in db.execute(
                    "SELECT approver_email FROM emergency_access_approvals WHERE request_id = %s AND decision = 'approved'",
                    (approval.request_id,)
                ).fetchall()]
            },
            severity='CRITICAL'
        )

        # Schedule auto-revocation
        background_tasks.add_task(
            schedule_auto_revocation,
            request_id=approval.request_id,
            expires_at=expires_at
        )

        # Notify requester
        background_tasks.add_task(
            notify_requester_granted,
            request_id=approval.request_id,
            requester_email=request_row['requester_email'],
            expires_at=expires_at
        )

        logger.critical(f"BREAK-GLASS GRANTED: {approval.request_id} to {request_row['requester_email']} - Expires: {expires_at.isoformat()}")

        return {
            "request_id": approval.request_id,
            "status": "granted",
            "granted_at": datetime.utcnow().isoformat(),
            "expires_at": expires_at.isoformat(),
            "iam_binding": iam_binding,
            "message": f"Emergency access granted. Access expires at {expires_at.isoformat()} UTC."
        }
    else:
        # Still pending second approval
        logger.info(f"BREAK-GLASS: {approval.request_id} - 1 of 2 approvals received")

        return {
            "request_id": approval.request_id,
            "status": "pending",
            "approvals_received": approvals_count,
            "approvals_required": 2,
            "message": "1 of 2 approvals received. Waiting for second approval."
        }


@router.post("/revoke")
async def revoke_emergency_access(
    request_id: str,
    reason: str = Field(..., min_length=20),
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Manually revoke emergency access before expiration.

    Use cases:
    - Emergency resolved earlier than expected
    - Suspected abuse
    - Security incident

    Requirements:
    - Must be authorized approver
    - Reason required (min 20 chars)
    """

    # Verify current user is authorized approver
    if not is_authorized_approver(current_user.email):
        raise HTTPException(status_code=403, detail="Only authorized approvers can revoke access")

    # Fetch request
    request_row = db.execute("""
        SELECT * FROM emergency_access_requests WHERE request_id = %s
    """, (request_id,)).fetchone()

    if not request_row:
        raise HTTPException(status_code=404, detail="Request not found")

    if request_row['status'] != 'granted':
        raise HTTPException(status_code=400, detail=f"Cannot revoke request with status '{request_row['status']}'")

    # Revoke IAM role
    revoke_iam_role(
        member=f"user:{request_row['requester_email']}",
        role=request_row['role'],
        resource=request_row['resource']
    )

    # Update request status
    db.execute("""
        UPDATE emergency_access_requests
        SET status = 'revoked', revoked_at = NOW(), revocation_reason = %s
        WHERE request_id = %s
    """, (reason, request_id))
    db.commit()

    # Audit log
    log_emergency_access_event(
        request_id=request_id,
        event_type='access_revoked',
        actor_email=current_user.email,
        details={
            'revocation_reason': reason,
            'revoked_by': current_user.email
        },
        severity='CRITICAL'
    )

    logger.critical(f"BREAK-GLASS REVOKED: {request_id} by {current_user.email} - Reason: {reason}")

    return {
        "request_id": request_id,
        "status": "revoked",
        "revoked_at": datetime.utcnow().isoformat(),
        "revoked_by": current_user.email,
        "message": "Emergency access has been revoked."
    }


@router.get("/requests")
async def list_emergency_access_requests(
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    List emergency access requests.

    Filters:
    - status: pending, granted, denied, expired, revoked

    Permissions:
    - Authorized approvers: See all requests
    - Regular users: See only their own requests
    """

    if is_authorized_approver(current_user.email):
        # Approvers see all requests
        query = "SELECT * FROM emergency_access_requests"
        params = []

        if status:
            query += " WHERE status = %s"
            params.append(status)

        query += " ORDER BY created_at DESC LIMIT 100"

        requests = db.execute(query, params).fetchall()
    else:
        # Regular users see only their own requests
        query = "SELECT * FROM emergency_access_requests WHERE requester_email = %s"
        params = [current_user.email]

        if status:
            query += " AND status = %s"
            params.append(status)

        query += " ORDER BY created_at DESC LIMIT 100"

        requests = db.execute(query, params).fetchall()

    return {
        "requests": [dict(row) for row in requests],
        "total": len(requests)
    }

# ============================================================================
# BACKGROUND TASKS
# ============================================================================

def notify_approvers(request_id: str, requester_email: str, reason: str, ticket_id: str):
    """Send Slack + email notifications to authorized approvers"""
    approvers = get_authorized_approvers()

    message = f"""
🚨 **EMERGENCY ACCESS REQUEST** 🚨

**Request ID:** {request_id}
**Requester:** {requester_email}
**Ticket:** {ticket_id}
**Reason:** {reason[:200]}...

**Action Required:** Review and approve/deny at:
https://app.lifenavigator.com/admin/emergency-access/{request_id}

**Two-Person Rule:** Requires 2 approvals to grant access.
    """

    # Send Slack notification
    send_slack_message(channel='#security-alerts', message=message, severity='critical')

    # Send email
    for approver in approvers:
        send_email(
            to=approver,
            subject=f"[URGENT] Emergency Access Request: {request_id}",
            body=message
        )

def schedule_auto_revocation(request_id: str, expires_at: datetime):
    """Schedule automatic revocation at expiration time"""
    # Use Cloud Tasks or Celery to schedule revocation
    # Simplified here
    pass

def get_authorized_approvers():
    """Return list of authorized approver emails"""
    return [
        'security@lifenavigator.com',
        'privacy@lifenavigator.com',
        'cto@lifenavigator.com',
        'ceo@lifenavigator.com'
    ]
```

---

### 4.3 Enhanced Audit Logging

**File: `backend/app/core/audit.py`**

```python
import logging
from datetime import datetime
from typing import Dict, Any
import json

from app.db.session import get_db

logger = logging.getLogger(__name__)

def log_emergency_access_event(
    request_id: str,
    event_type: str,
    actor_email: str,
    details: Dict[str, Any],
    severity: str = 'CRITICAL',
    ip_address: str = None,
    user_agent: str = None
):
    """
    Log emergency access event with severity=CRITICAL.

    Event types:
    - request_created
    - approval_approved
    - approval_denied
    - access_granted
    - access_used
    - access_revoked
    - access_expired

    All events are logged to:
    - emergency_access_audit_log table (immutable)
    - Cloud Logging (severity=CRITICAL, 7-year retention)
    - Slack #security-alerts (real-time notifications)
    """

    db = get_db()

    # Insert into audit log table (immutable)
    db.execute("""
        INSERT INTO emergency_access_audit_log (
            request_id, event_type, actor_email, details, ip_address, user_agent
        ) VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        request_id,
        event_type,
        actor_email,
        json.dumps(details),
        ip_address,
        user_agent
    ))
    db.commit()

    # Log to Cloud Logging (severity=CRITICAL)
    logger.critical(
        f"EMERGENCY_ACCESS: {event_type}",
        extra={
            'request_id': request_id,
            'event_type': event_type,
            'actor_email': actor_email,
            'details': details,
            'severity': severity,
            'labels': {
                'emergency_access': 'true',
                'compliance': 'hipaa',
                'audit': 'critical'
            }
        }
    )

    # Send Slack alert for critical events
    if event_type in ['request_created', 'access_granted', 'access_revoked']:
        send_slack_alert(
            channel='#security-alerts',
            message=f"🔴 EMERGENCY ACCESS: {event_type} - Request {request_id} by {actor_email}",
            severity='critical'
        )
```

---

## 5. Audit and Monitoring

### 5.1 Real-Time Monitoring

**Prometheus Alerts:**

```yaml
# k8s/base/monitoring/prometheus-rules-break-glass.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: break-glass-alerts
  namespace: monitoring
spec:
  groups:
    - name: break_glass
      interval: 60s
      rules:
        # Alert when emergency access is requested
        - alert: EmergencyAccessRequested
          expr: |
            sum(rate(emergency_access_request_total[5m])) > 0
          for: 1m
          labels:
            severity: critical
            compliance: hipaa
          annotations:
            summary: "Emergency access requested"
            description: "Break-glass access request created: {{ $labels.request_id }}"
            runbook: "https://docs.lifenavigator.com/runbooks/break-glass-review"

        # Alert when emergency access is granted
        - alert: EmergencyAccessGranted
          expr: |
            sum(rate(emergency_access_granted_total[5m])) > 0
          for: 1m
          labels:
            severity: critical
            compliance: hipaa
          annotations:
            summary: "Emergency access GRANTED"
            description: "Break-glass access granted to {{ $labels.requester_email }}"
            runbook: "https://docs.lifenavigator.com/runbooks/break-glass-review"

        # Alert if emergency access is used
        - alert: EmergencyAccessUsed
          expr: |
            sum(rate(cloudsql_query_total{user=~".*break-glass.*"}[5m])) > 0
          for: 1m
          labels:
            severity: critical
            compliance: hipaa
          annotations:
            summary: "Emergency access USED"
            description: "User {{ $labels.user }} accessed Cloud SQL via break-glass"
            runbook: "https://docs.lifenavigator.com/runbooks/break-glass-review"

        # Alert if >3 break-glass requests in 24 hours (potential abuse)
        - alert: ExcessiveBreakGlassRequests
          expr: |
            sum(increase(emergency_access_request_total[24h])) > 3
          for: 5m
          labels:
            severity: warning
            compliance: hipaa
          annotations:
            summary: "Excessive break-glass requests"
            description: "More than 3 break-glass requests in 24 hours. Investigate for abuse."
            runbook: "https://docs.lifenavigator.com/runbooks/break-glass-abuse"
```

---

### 5.2 Daily Audit Report

**Automated Daily Report (sent to Security Officer + Privacy Officer):**

```
BREAK-GLASS DAILY AUDIT REPORT
Date: 2026-01-09

SUMMARY:
- Total Requests: 2
- Granted: 1
- Denied: 0
- Pending: 1
- Expired: 0
- Revoked: 0

DETAILED EVENTS:

REQUEST: bgr-2026-01-09-001
  Requester: engineer@lifenavigator.com
  Reason: Life-threatening emergency - Patient 12345 allergic reaction
  Ticket: INC-2026-001
  Status: GRANTED
  Granted At: 2026-01-09 08:05 UTC
  Expires At: 2026-01-09 12:05 UTC
  Approvers: security@lifenavigator.com, privacy@lifenavigator.com
  Access Used: Yes (3 SQL queries executed)

REQUEST: bgr-2026-01-09-002
  Requester: sre@lifenavigator.com
  Reason: Cloud SQL database corruption - need admin access for PITR
  Ticket: INC-2026-002
  Status: PENDING
  Created At: 2026-01-09 14:00 UTC
  Approvals: 1 of 2 (security@lifenavigator.com approved)

RECOMMENDATIONS:
- Review request bgr-2026-01-09-001: Verify emergency was legitimate
- Follow up on pending request bgr-2026-01-09-002: Second approval needed
```

---

## 6. Post-Access Review

**Mandatory Review:** All granted break-glass access requests must be reviewed within 48 hours of expiration.

**Review Checklist:**
- [ ] Was emergency legitimate?
- [ ] Was access scope appropriate (least privilege)?
- [ ] Was access used? (Check audit logs)
- [ ] Were any unauthorized actions performed?
- [ ] Could emergency have been prevented? (Process improvement)
- [ ] Should any remedial training be provided?

**Review Meeting:** Security Officer + Privacy Officer + requester's manager

**Documentation:** Review notes stored in `gs://lifenav-prod-compliance-evidence/break-glass/{year}/{request-id}/review.md`

---

## 7. Abuse Prevention

### 7.1 Abuse Indicators

**Monitor for:**
- Frequent requests from same user (> 3/month)
- Denied requests followed by immediate re-request
- Generic justifications ("urgent", "emergency")
- Invalid ticket IDs
- Access used for non-emergency purposes
- Access used outside business hours without justification

**Automated Detection:**
```sql
-- Find users with excessive break-glass requests
SELECT requester_email, COUNT(*) as request_count
FROM emergency_access_requests
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY requester_email
HAVING COUNT(*) > 3
ORDER BY request_count DESC;

-- Find requests with suspicious patterns
SELECT request_id, requester_email, reason
FROM emergency_access_requests
WHERE LENGTH(reason) < 100  -- Too short
   OR reason ILIKE '%urgent%'  -- Generic
   OR status = 'denied';  -- Denied requests
```

---

### 7.2 Sanctions for Abuse

**Violations:**
- Requesting break-glass for non-emergencies: Written warning + remedial training
- Providing false justification: Suspension + final warning
- Using break-glass access for unauthorized purposes: Termination + possible criminal referral

**Reference:** See Workforce Sanctions Policy (POL-SEC-001)

---

## 8. Testing Requirements

**File: `backend/tests/test_emergency_access.py`**

See separate test file for comprehensive test suite.

---

## 9. Compliance Mapping

| HIPAA Requirement | Implementation |
|-------------------|----------------|
| § 164.312(a)(2)(ii) - Emergency Access Procedure | Break-glass process documented and implemented |
| § 164.308(a)(1)(ii)(C) - Sanctions | Abuse results in sanctions per POL-SEC-001 |
| § 164.312(b) - Audit Controls | All break-glass events logged with severity=CRITICAL, immutable |
| § 164.308(a)(5)(ii)(C) - Log-in Monitoring | Real-time Prometheus alerts for break-glass usage |
| § 164.308(a)(3)(ii)(B) - Workforce Clearance | Only authorized approvers can grant access |

---

## 10. Review and Updates

**Annual Review:** This procedure will be reviewed annually by Security Officer, Privacy Officer, and Legal.

**Update Triggers:**
- Break-glass abuse incidents
- Changes in technology (new GCP IAM features)
- Audit findings
- Regulatory changes

---

**Procedure Version:** 1.0
**Effective Date:** 2026-01-09
**Next Review:** 2027-01-09
**Classification:** INTERNAL - SECURITY PROCEDURE
**Evidence Location:** `gs://lifenav-prod-compliance-evidence/policies/break-glass/`
