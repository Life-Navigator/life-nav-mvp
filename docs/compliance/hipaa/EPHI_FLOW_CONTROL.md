# ePHI Flow Control and Verification System

**Rule: ePHI must NEVER flow into non-HIPAA services.**

---

## Overview

This document defines the controls and verification mechanisms that ensure ePHI (Electronic Protected Health Information) remains within HIPAA-compliant GCP services and NEVER leaks into:
- Non-HIPAA GCP services (Firestore, Firebase, App Engine, Cloud Debugger, etc.)
- Frontend applications (Next.js, React Native)
- Third-party services (Sentry, SendGrid, Stripe, Auth0, analytics)
- Developer workstations
- CI/CD logs

**Compliance Requirement:** HIPAA Security Rule § 164.312(a)(1) - Access Control

---

## Table of Contents

1. [Data Flow Boundaries](#data-flow-boundaries)
2. [ePHI Containment Controls](#ephi-containment-controls)
3. [Automated Verification Tests](#automated-verification-tests)
4. [Runtime Monitoring](#runtime-monitoring)
5. [Frontend/Mobile Controls](#frontendmobile-controls)
6. [Third-Party Integration Controls](#third-party-integration-controls)
7. [Developer Access Controls](#developer-access-controls)
8. [Incident Response](#incident-response)

---

## Data Flow Boundaries

### Trust Boundary Model

```
┌─────────────────────────────────────────────────────────────┐
│ HIPAA TRUST ZONE (BAA-Covered GCP Services)                 │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Cloud SQL   │◄───┤  GKE Backend │◄───┤    Cloud     │  │
│  │ (ln-health-  │    │   Pods       │    │ Load Balancer│  │
│  │  db-beta)    │    │              │    │  (HTTPS)     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    ▲          │
│         │                    │                    │          │
│         ▼                    ▼                    │          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Cloud Storage│    │  Cloud KMS   │    │ Secret Mgr   │  │
│  │ (health-docs)│    │ (CMEK keys)  │    │ (DB creds)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Cloud Logging (7-year retention)                    │   │
│  │  Cloud Monitoring (HIPAA metrics only)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ TLS 1.3 (ePHI ENCRYPTED)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ UNTRUSTED ZONE (No BAA, No ePHI Allowed)                    │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Next.js    │    │    Vercel    │    │ React Native │  │
│  │   Frontend   │    │   Hosting    │    │    Mobile    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    Sentry    │    │   SendGrid   │    │   Stripe     │  │
│  │ (Error Track)│    │   (Email)    │    │  (Payments)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Mixpanel   │    │    Auth0     │    │   GitHub     │  │
│  │  (Analytics) │    │    (OAuth)   │    │   Actions    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Classification

| Data Type | Example | HIPAA Zone | Storage Location |
|-----------|---------|------------|------------------|
| **ePHI** | Patient name, diagnosis, treatment notes | HIPAA Trust Zone | Cloud SQL (ln-health-db-beta) |
| **PHI Identifiers** | MRN (Medical Record Number), patient_id | HIPAA Trust Zone | Cloud SQL (ln-health-db-beta) |
| **Encrypted ePHI** | Encrypted diagnosis at rest | HIPAA Trust Zone | Cloud Storage (health-docs) |
| **De-identified Data** | Anonymized analytics (no PII) | Untrusted Zone | BigQuery (anonymized_health_insights) |
| **Non-PHI User Data** | User preferences, app settings | Untrusted Zone | Main DB (Supabase) |
| **Authentication Tokens** | JWT, session ID (no PHI) | Untrusted Zone | Frontend local storage (encrypted) |

---

## ePHI Containment Controls

### Control 1: Network Isolation

**Requirement:** ePHI services MUST be in private VPC with no public internet access.

**Implementation:**
```bash
# Verify Cloud SQL has NO public IP
gcloud sql instances describe ln-health-db-beta --format=json | jq '.ipAddresses[] | select(.type=="PRIMARY")'
# Expected: ipAddress should be 10.x.x.x (private), NOT public IP

# Verify GKE nodes are private
gcloud container clusters describe ln-prod-cluster --format=json | jq '.privateClusterConfig'
# Expected: enablePrivateNodes: true

# Verify Cloud Storage bucket is NOT public
gsutil iam get gs://lifenav-prod-health-documents | grep allUsers
# Expected: No output (no public access)
```

**Evidence Artifact:** `gcp-configs/network_isolation_verification.json`

---

### Control 2: API Gateway ePHI Filtering

**Requirement:** Backend API MUST sanitize ePHI before sending to frontend.

**Implementation:**
```python
# backend/app/api/health/routes.py

from app.core.security import is_phi_field, redact_phi
from app.core.audit import log_phi_access

@router.get("/health-records/{patient_id}")
async def get_health_record(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    HIPAA CONTROL: ePHI is fetched from Cloud SQL but NEVER sent raw to frontend.
    Frontend receives redacted/summary data only.
    """

    # 1. Verify user authorization (REQUIRED)
    if not current_user.has_permission("health:read", patient_id):
        log_phi_access(
            user_id=current_user.id,
            action="access_denied",
            resource=f"patient:{patient_id}",
            reason="insufficient_permissions"
        )
        raise HTTPException(status_code=403, detail="Access denied")

    # 2. Fetch ePHI from HIPAA database (Cloud SQL)
    health_record = db.query(HealthRecord).filter(
        HealthRecord.patient_id == patient_id
    ).first()

    if not health_record:
        raise HTTPException(status_code=404, detail="Record not found")

    # 3. Audit log (REQUIRED for HIPAA)
    log_phi_access(
        user_id=current_user.id,
        action="read",
        resource=f"patient:{patient_id}",
        phi_fields=["diagnosis", "treatment_notes", "medications"]
    )

    # 4. Redact ePHI for frontend (CRITICAL CONTROL)
    # Frontend gets SUMMARY only, full ePHI stays server-side
    return {
        "patient_id": patient_id,  # OK: Identifier needed for app flow
        "last_visit_date": health_record.last_visit_date,  # OK: No PHI
        "has_active_treatment": health_record.treatment_notes is not None,  # OK: Boolean
        "medication_count": len(health_record.medications),  # OK: Count
        # REDACTED: diagnosis, treatment_notes, medications (full text)
        # These are ONLY shown in secure server-rendered PDF or encrypted chat
    }

@router.get("/health-records/{patient_id}/full-report")
async def generate_full_report(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    HIPAA CONTROL: Full ePHI is ONLY returned as encrypted PDF, NEVER as JSON to frontend.
    """

    # Authorization check (same as above)
    if not current_user.has_permission("health:read", patient_id):
        raise HTTPException(status_code=403)

    # Fetch full ePHI
    health_record = db.query(HealthRecord).filter(
        HealthRecord.patient_id == patient_id
    ).first()

    # Audit log
    log_phi_access(
        user_id=current_user.id,
        action="export_full_report",
        resource=f"patient:{patient_id}",
        phi_fields=["diagnosis", "treatment_notes", "medications", "lab_results"]
    )

    # Generate encrypted PDF (server-side)
    pdf_content = generate_hipaa_pdf(health_record)

    # Encrypt PDF with user's public key
    encrypted_pdf = encrypt_pdf_for_user(pdf_content, current_user.public_key)

    # Upload to Cloud Storage (HIPAA bucket)
    pdf_url = upload_to_gcs(
        encrypted_pdf,
        bucket="lifenav-prod-health-documents",
        path=f"reports/{patient_id}/{uuid4()}.pdf.enc"
    )

    # Return signed URL (expires in 5 minutes)
    return {
        "download_url": generate_signed_url(pdf_url, expires_in=300),
        "expires_at": datetime.utcnow() + timedelta(minutes=5)
    }
```

**Automated Test:**
```python
# backend/tests/compliance/test_phi_filtering.py

import pytest
from app.api.health.routes import get_health_record

def test_health_record_endpoint_does_not_leak_phi():
    """
    HIPAA COMPLIANCE TEST: Verify API responses NEVER contain full ePHI.
    """
    response = client.get("/health-records/12345", headers=auth_headers)

    # Assert response is successful
    assert response.status_code == 200
    data = response.json()

    # CRITICAL: Verify ePHI fields are NOT present
    phi_fields = ["diagnosis", "treatment_notes", "medications", "lab_results", "ssn"]
    for field in phi_fields:
        assert field not in data, f"ePHI field '{field}' LEAKED to frontend!"

    # Verify only safe summary data is present
    assert "patient_id" in data  # OK: Needed for app flow
    assert "last_visit_date" in data  # OK: No PHI
    assert "has_active_treatment" in data  # OK: Boolean
    assert "medication_count" in data  # OK: Count

def test_sentry_error_does_not_contain_phi():
    """
    HIPAA COMPLIANCE TEST: Verify Sentry error reports NEVER contain ePHI.
    """
    # Trigger error with ePHI in context
    with pytest.raises(Exception):
        process_health_record(
            patient_id="12345",
            diagnosis="Type 2 Diabetes",  # ePHI
            treatment_notes="Patient prescribed metformin"  # ePHI
        )

    # Check Sentry event
    sentry_events = get_sentry_events()
    last_event = sentry_events[-1]

    # CRITICAL: Verify ePHI was scrubbed before sending to Sentry
    event_str = json.dumps(last_event)
    assert "Type 2 Diabetes" not in event_str
    assert "metformin" not in event_str
    assert "patient prescribed" not in event_str

    # Verify only safe context was sent
    assert last_event["extra"]["patient_id"] == "[REDACTED]"
    assert last_event["extra"]["error_type"] == "database_error"
```

**Evidence Artifact:** `test-results/phi_filtering_tests.xml`

---

### Control 3: Error Reporting Sanitization

**Requirement:** Sentry error reports MUST scrub ePHI before sending.

**Implementation:**
```python
# backend/app/core/sentry.py

import sentry_sdk
from sentry_sdk.scrubber import EventScrubber

# PHI field names to scrub
PHI_FIELDS = [
    "diagnosis", "treatment_notes", "medications", "lab_results",
    "patient_name", "ssn", "mrn", "phone_number", "email",
    "address", "birthdate", "medical_history"
]

def before_send(event, hint):
    """
    HIPAA CONTROL: Scrub ePHI before sending to Sentry.
    This function is called BEFORE every Sentry event is sent.
    """

    # Scrub request body
    if "request" in event and "data" in event["request"]:
        event["request"]["data"] = scrub_phi(event["request"]["data"])

    # Scrub exception context
    if "exception" in event:
        for exception in event["exception"]["values"]:
            if "stacktrace" in exception:
                for frame in exception["stacktrace"]["frames"]:
                    if "vars" in frame:
                        frame["vars"] = scrub_phi(frame["vars"])

    # Scrub extra context
    if "extra" in event:
        event["extra"] = scrub_phi(event["extra"])

    # Scrub user data
    if "user" in event:
        # Keep user_id for debugging, but remove email/name
        event["user"] = {
            "id": event["user"].get("id"),
            # REMOVE: email, username, ip_address
        }

    return event

def scrub_phi(data):
    """
    Recursively scrub ePHI from data structure.
    """
    if isinstance(data, dict):
        return {
            key: "[REDACTED-PHI]" if is_phi_field(key) else scrub_phi(value)
            for key, value in data.items()
        }
    elif isinstance(data, list):
        return [scrub_phi(item) for item in data]
    elif isinstance(data, str):
        # Redact if string contains PHI patterns (SSN, phone, email)
        if is_phi_pattern(data):
            return "[REDACTED-PHI]"
    return data

def is_phi_field(field_name: str) -> bool:
    """
    Check if field name indicates ePHI.
    """
    field_lower = field_name.lower()
    return any(phi_keyword in field_lower for phi_keyword in PHI_FIELDS)

def is_phi_pattern(text: str) -> bool:
    """
    Check if text matches PHI patterns (SSN, phone, MRN, etc.).
    """
    import re

    # SSN pattern: XXX-XX-XXXX
    if re.search(r'\d{3}-\d{2}-\d{4}', text):
        return True

    # Phone pattern: (XXX) XXX-XXXX
    if re.search(r'\(\d{3}\)\s?\d{3}-\d{4}', text):
        return True

    # MRN pattern: MRN######
    if re.search(r'MRN\d{6,}', text, re.IGNORECASE):
        return True

    # Email pattern (if in health context)
    if re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text):
        return True

    return False

# Initialize Sentry with PHI scrubbing
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    before_send=before_send,
    environment=os.getenv("ENVIRONMENT", "production"),
    traces_sample_rate=0.1,  # Low rate to avoid PHI in performance traces
)
```

**Automated Test:**
```bash
# Trigger error with PHI and verify Sentry scrubbing
pytest backend/tests/compliance/test_phi_filtering.py::test_sentry_error_does_not_contain_phi -v
```

**Evidence Artifact:** `gcp-configs/sentry_scrubber_config.py`

---

### Control 4: Email Service ePHI Prevention

**Requirement:** SendGrid emails MUST NEVER contain ePHI.

**Implementation:**
```python
# backend/app/services/email.py

from app.core.audit import log_email_sent
from app.core.security import contains_phi

async def send_email(
    to: str,
    subject: str,
    body: str,
    template: str = None,
    context: dict = None
):
    """
    HIPAA CONTROL: Verify email content does NOT contain ePHI before sending.
    """

    # 1. PHI detection (CRITICAL SAFETY CHECK)
    if contains_phi(subject) or contains_phi(body):
        # Log violation
        log_email_sent(
            to=to,
            subject="[REDACTED-PHI]",
            status="blocked",
            reason="phi_detected"
        )

        # Raise exception (DO NOT SEND)
        raise ValueError(
            "HIPAA VIOLATION: Email contains ePHI. "
            "Use secure message system instead."
        )

    # 2. Template validation (if using template)
    if template:
        allowed_templates = [
            "welcome_email",
            "password_reset",
            "appointment_reminder",  # OK: "You have an appointment" (no diagnosis)
            "account_verification"
        ]

        if template not in allowed_templates:
            raise ValueError(f"Email template '{template}' not approved for HIPAA")

    # 3. Send via SendGrid
    sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    message = Mail(
        from_email="noreply@lifenavigator.com",
        to_emails=to,
        subject=subject,
        html_content=body
    )

    response = sg.send(message)

    # 4. Audit log
    log_email_sent(
        to=to,
        subject=subject[:100],  # Truncate subject for log
        status="sent",
        template=template
    )

    return response

# SAFE email example
await send_email(
    to="patient@example.com",
    subject="Appointment Reminder",
    body="You have an upcoming appointment on Jan 15, 2026 at 2:00 PM. Please arrive 10 minutes early.",
    template="appointment_reminder"
)

# UNSAFE email example (will be BLOCKED)
# await send_email(
#     to="patient@example.com",
#     subject="Lab Results",
#     body="Your glucose level is 145 mg/dL. This indicates pre-diabetes.",  # ePHI!
#     template=None
# )
# Raises: ValueError("HIPAA VIOLATION: Email contains ePHI")
```

**Automated Test:**
```python
# backend/tests/compliance/test_email_phi_prevention.py

def test_email_with_phi_is_blocked():
    """
    HIPAA COMPLIANCE TEST: Verify emails containing ePHI are blocked.
    """
    with pytest.raises(ValueError, match="HIPAA VIOLATION"):
        send_email(
            to="patient@example.com",
            subject="Lab Results",
            body="Your glucose level is 145 mg/dL."  # ePHI
        )

def test_safe_email_is_allowed():
    """
    Verify safe emails (no PHI) are sent successfully.
    """
    response = send_email(
        to="patient@example.com",
        subject="Appointment Reminder",
        body="You have an upcoming appointment on Jan 15."
    )

    assert response.status_code == 202  # SendGrid accepted
```

**Evidence Artifact:** `test-results/email_phi_prevention_tests.xml`

---

### Control 5: Analytics De-identification

**Requirement:** Mixpanel/Google Analytics MUST receive de-identified data only.

**Implementation:**
```python
# backend/app/services/analytics.py

import hashlib

def track_event(
    user_id: str,
    event_name: str,
    properties: dict = None
):
    """
    HIPAA CONTROL: De-identify data before sending to Mixpanel.
    """

    # 1. Hash user_id (one-way, no PII)
    hashed_user_id = hashlib.sha256(user_id.encode()).hexdigest()

    # 2. Remove PHI from properties
    safe_properties = {}
    if properties:
        for key, value in properties.items():
            if is_phi_field(key):
                continue  # Skip ePHI fields

            # Anonymize values
            if key == "age":
                # Bucket age (instead of exact value)
                safe_properties["age_group"] = bucket_age(value)
            elif key == "zip_code":
                # Use first 3 digits only (per HIPAA Safe Harbor)
                safe_properties["zip_prefix"] = str(value)[:3]
            else:
                safe_properties[key] = value

    # 3. Send to Mixpanel
    mixpanel.track(
        hashed_user_id,
        event_name,
        safe_properties
    )

def bucket_age(age: int) -> str:
    """
    Bucket age per HIPAA Safe Harbor method.
    """
    if age < 18:
        return "<18"
    elif age < 30:
        return "18-29"
    elif age < 40:
        return "30-39"
    elif age < 50:
        return "40-49"
    elif age < 60:
        return "50-59"
    elif age < 70:
        return "60-69"
    elif age < 90:
        return "70-89"
    else:
        return "90+"  # Per HIPAA, ages 90+ are aggregated

# SAFE analytics event
track_event(
    user_id="user_12345",
    event_name="health_record_viewed",
    properties={
        "age": 45,  # Will be bucketed to "40-49"
        "zip_code": "94102",  # Will be truncated to "941"
        # NO: diagnosis, medications, treatment_notes
    }
)
```

**Evidence Artifact:** `gcp-configs/analytics_deidentification.py`

---

## Automated Verification Tests

### Test Suite: ePHI Flow Control

**Location:** `backend/tests/compliance/test_ephi_flow_control.py`

```python
import pytest
from app.core.security import is_hipaa_service, verify_ephi_containment

class TestEPHIFlowControl:
    """
    HIPAA COMPLIANCE: Automated tests verifying ePHI never leaks outside HIPAA zone.
    Run weekly in CI/CD pipeline.
    """

    def test_cloud_sql_is_only_ephi_database(self):
        """
        Verify Cloud SQL (ln-health-db-beta) is the ONLY database storing ePHI.
        """
        # Check all database connections
        databases = get_all_database_connections()

        ephi_databases = [db for db in databases if db.stores_ephi]

        assert len(ephi_databases) == 1, "Only ONE database should store ePHI"
        assert ephi_databases[0].name == "ln-health-db-beta"
        assert ephi_databases[0].provider == "Cloud SQL for PostgreSQL"
        assert is_hipaa_service("cloudsql.googleapis.com")

    def test_ephi_never_sent_to_frontend(self):
        """
        Verify all health API endpoints redact ePHI before sending to frontend.
        """
        health_endpoints = [
            "/health-records/{patient_id}",
            "/medications/{patient_id}",
            "/lab-results/{patient_id}",
            "/treatment-notes/{patient_id}"
        ]

        for endpoint in health_endpoints:
            response = client.get(endpoint.format(patient_id="12345"), headers=auth_headers)
            data = response.json()

            # CRITICAL: Verify ePHI fields are NOT in response
            phi_fields = ["diagnosis", "treatment_notes", "medications", "lab_results", "ssn"]
            for field in phi_fields:
                assert field not in data, f"ePHI field '{field}' leaked at {endpoint}"

    def test_ephi_never_logged_to_stdout(self):
        """
        Verify application logs NEVER contain ePHI (would leak to Cloud Logging).
        """
        # Trigger health record processing
        process_health_record(
            patient_id="12345",
            diagnosis="Type 2 Diabetes",
            treatment_notes="Patient prescribed metformin"
        )

        # Check recent logs
        logs = get_recent_application_logs(minutes=5)

        # CRITICAL: Verify ePHI was not logged
        for log in logs:
            assert "Type 2 Diabetes" not in log.message
            assert "metformin" not in log.message
            assert "patient prescribed" not in log.message

            # Verify only safe log: "Processed health record for patient [REDACTED]"
            if "health record" in log.message.lower():
                assert "[REDACTED]" in log.message or "patient_id:" not in log.message

    def test_ephi_never_sent_to_sentry(self):
        """
        Verify Sentry error reports NEVER contain ePHI.
        """
        # Already tested in test_phi_filtering.py
        pass

    def test_cloud_storage_buckets_are_private(self):
        """
        Verify Cloud Storage buckets with ePHI have NO public access.
        """
        hipaa_buckets = [
            "lifenav-prod-health-documents",
            "lifenav-prod-hipaa-audit-logs"
        ]

        for bucket_name in hipaa_buckets:
            iam_policy = get_bucket_iam_policy(bucket_name)

            # CRITICAL: Verify no public access
            assert "allUsers" not in iam_policy.bindings
            assert "allAuthenticatedUsers" not in iam_policy.bindings

            # Verify uniform bucket-level access is enabled
            bucket = get_bucket(bucket_name)
            assert bucket.iam_configuration.uniform_bucket_level_access_enabled

    def test_gke_pods_cannot_access_internet(self):
        """
        Verify GKE pods with ePHI access CANNOT reach public internet (network isolation).
        """
        # Deploy test pod
        test_pod = deploy_test_pod(
            name="ephi-network-test",
            namespace="life-navigator",
            service_account="backend-sa"  # Has ePHI access
        )

        # Attempt internet access
        result = exec_in_pod(test_pod, ["curl", "-I", "https://google.com", "--max-time", "5"])

        # CRITICAL: Should FAIL (no internet access)
        assert result.exit_code != 0, "ePHI pod should NOT have internet access"
        assert "Failed to connect" in result.stderr or "timed out" in result.stderr.lower()

        # Cleanup
        delete_pod(test_pod)

    def test_third_party_services_not_in_hipaa_zone(self):
        """
        Verify third-party services (Sentry, SendGrid, Stripe) are NOT in HIPAA trust zone.
        """
        third_party_services = [
            "sentry.io",
            "sendgrid.com",
            "stripe.com",
            "mixpanel.com",
            "auth0.com"
        ]

        for service in third_party_services:
            assert not is_hipaa_service(service), f"{service} incorrectly marked as HIPAA-compliant"

    def test_developer_workstations_cannot_access_ephi_database(self):
        """
        Verify developer workstations CANNOT directly connect to Cloud SQL HIPAA database.
        """
        # Attempt direct connection from CI/CD runner (simulates dev workstation)
        try:
            connection = psycopg2.connect(
                host="10.128.0.5",  # Cloud SQL private IP
                database="health_db",
                user="dev_user",
                password=os.getenv("DEV_DB_PASSWORD")
            )
            connection.close()
            pytest.fail("Developer SHOULD NOT be able to connect to HIPAA database directly")
        except psycopg2.OperationalError as e:
            # Expected: Connection refused (Cloud SQL only allows GKE pods)
            assert "Connection refused" in str(e) or "timeout" in str(e).lower()

# Run tests
# pytest backend/tests/compliance/test_ephi_flow_control.py -v
```

**CI/CD Integration:**

```yaml
# .github/workflows/hipaa_compliance.yml

name: HIPAA Compliance Checks

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  ephi_flow_control:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r backend/requirements.txt
          pip install pytest pytest-cov

      - name: Run ePHI flow control tests
        run: |
          pytest backend/tests/compliance/test_ephi_flow_control.py \
            -v \
            --cov=app \
            --cov-report=xml \
            --junitxml=test-results/ephi_flow_control.xml

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: ephi-flow-control-results
          path: test-results/ephi_flow_control.xml

      - name: Fail if tests failed
        if: failure()
        run: |
          echo "HIPAA COMPLIANCE FAILURE: ePHI flow control tests failed!"
          echo "Review test results and fix violations before merging."
          exit 1
```

**Evidence Artifact:** `test-results/ephi_flow_control.xml` (weekly)

---

## Runtime Monitoring

### Prometheus Alerts for ePHI Containment

**File:** `k8s/base/monitoring/prometheus-rules-hipaa.yaml`

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: hipaa-ephi-containment-alerts
  namespace: monitoring
spec:
  groups:
    - name: hipaa_ephi_containment
      interval: 60s
      rules:
        # Alert: ePHI API response contains PHI fields
        - alert: EPHILeakedToFrontend
          expr: |
            sum(rate(http_response_contains_phi_field{endpoint=~"/health.*"}[5m])) > 0
          for: 1m
          labels:
            severity: critical
            compliance: hipaa
          annotations:
            summary: "ePHI leaked to frontend"
            description: "API endpoint {{ $labels.endpoint }} returned ePHI fields in response. This is a HIPAA violation."
            runbook: "https://docs.lifenavigator.com/runbooks/ephi-leak"

        # Alert: Sentry event contains PHI
        - alert: EPHILeakedToSentry
          expr: |
            sum(rate(sentry_event_contains_phi[5m])) > 0
          for: 1m
          labels:
            severity: critical
            compliance: hipaa
          annotations:
            summary: "ePHI leaked to Sentry"
            description: "Sentry error report contains ePHI. PHI scrubber may be failing."
            runbook: "https://docs.lifenavigator.com/runbooks/sentry-phi-leak"

        # Alert: SendGrid email contains PHI
        - alert: EPHILeakedToEmail
          expr: |
            sum(rate(email_blocked_phi_detected[5m])) > 0
          for: 1m
          labels:
            severity: critical
            compliance: hipaa
          annotations:
            summary: "Attempted to send ePHI via email"
            description: "Email with ePHI was blocked. Review code to prevent future attempts."
            runbook: "https://docs.lifenavigator.com/runbooks/email-phi-leak"

        # Alert: Cloud SQL accessed from non-GKE source
        - alert: EPHIDatabaseAccessFromUnauthorizedSource
          expr: |
            sum(rate(cloudsql_connection_attempts{source!="gke"}[5m])) > 0
          for: 5m
          labels:
            severity: critical
            compliance: hipaa
          annotations:
            summary: "HIPAA database accessed from non-GKE source"
            description: "Cloud SQL HIPAA database was accessed from {{ $labels.source }}. Only GKE pods should access this database."
            runbook: "https://docs.lifenavigator.com/runbooks/unauthorized-db-access"

        # Alert: ePHI in application logs
        - alert: EPHILoggedToStdout
          expr: |
            sum(rate(log_contains_phi[5m])) > 0
          for: 1m
          labels:
            severity: high
            compliance: hipaa
          annotations:
            summary: "ePHI detected in application logs"
            description: "Application logs contain ePHI. Logs are sent to Cloud Logging (7-year retention)."
            runbook: "https://docs.lifenavigator.com/runbooks/phi-in-logs"
```

**Application Metrics:**

```python
# backend/app/core/metrics.py

from prometheus_client import Counter

# ePHI containment metrics
ephi_leaked_to_frontend = Counter(
    'http_response_contains_phi_field',
    'ePHI field found in API response',
    ['endpoint', 'field_name']
)

sentry_event_contains_phi = Counter(
    'sentry_event_contains_phi',
    'Sentry event blocked due to PHI detection'
)

email_blocked_phi_detected = Counter(
    'email_blocked_phi_detected',
    'Email blocked due to PHI detection',
    ['to_domain']
)

log_contains_phi = Counter(
    'log_contains_phi',
    'Log message blocked due to PHI detection',
    ['logger_name']
)

cloudsql_connection_attempts = Counter(
    'cloudsql_connection_attempts',
    'Cloud SQL connection attempts',
    ['source', 'result']
)
```

**Evidence Artifact:** `k8s/base/monitoring/prometheus-rules-hipaa.yaml`

---

## Frontend/Mobile Controls

### Control 6: Frontend ePHI Handling

**Requirement:** Frontend MUST NEVER store ePHI in localStorage, cookies, or IndexedDB.

**Implementation:**

```typescript
// frontend/src/lib/security/phiProtection.ts

/**
 * HIPAA CONTROL: Verify data does NOT contain ePHI before storing in browser.
 */

const PHI_FIELDS = [
  'diagnosis', 'treatment_notes', 'medications', 'lab_results',
  'ssn', 'mrn', 'patient_name', 'birthdate', 'medical_history'
];

export function isSafeToStoreLocally(data: Record<string, any>): boolean {
  /**
   * Check if data is safe to store in localStorage/IndexedDB.
   * Returns false if ePHI detected.
   */
  const dataStr = JSON.stringify(data).toLowerCase();

  for (const field of PHI_FIELDS) {
    if (dataStr.includes(field.toLowerCase())) {
      console.error(`HIPAA VIOLATION: Cannot store ePHI field '${field}' in browser storage`);
      return false;
    }
  }

  return true;
}

export function safeLocalStorageSet(key: string, value: any): void {
  /**
   * Safe wrapper for localStorage.setItem that prevents ePHI storage.
   */
  if (!isSafeToStoreLocally({ [key]: value })) {
    throw new Error(`HIPAA VIOLATION: Cannot store ePHI in localStorage (key: ${key})`);
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export function clearSensitiveDataOnLogout(): void {
  /**
   * HIPAA CONTROL: Clear all browser storage on logout.
   */
  localStorage.clear();
  sessionStorage.clear();

  // Clear IndexedDB
  indexedDB.databases().then(dbs => {
    dbs.forEach(db => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  });

  // Clear cookies
  document.cookie.split(";").forEach(c => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });
}

// Auto-logout after 15 minutes of inactivity (HIPAA requirement)
let inactivityTimer: NodeJS.Timeout;

export function resetInactivityTimer(): void {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    console.warn('HIPAA: Auto-logout due to inactivity');
    clearSensitiveDataOnLogout();
    window.location.href = '/login?reason=inactivity';
  }, 15 * 60 * 1000);  // 15 minutes
}

// Track user activity
if (typeof window !== 'undefined') {
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
  });

  resetInactivityTimer();
}
```

**React Native Implementation:**

```typescript
// mobile/src/lib/security/phiProtection.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * HIPAA CONTROL: Mobile app MUST NEVER store ePHI locally.
 */

export async function safeMobileStorageSet(key: string, value: any): Promise<void> {
  /**
   * Safe wrapper for AsyncStorage that prevents ePHI storage.
   */
  if (!isSafeToStoreLocally({ [key]: value })) {
    throw new Error(`HIPAA VIOLATION: Cannot store ePHI in mobile storage (key: ${key})`);
  }

  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function clearSensitiveDataOnLogout(): Promise<void> {
  /**
   * HIPAA CONTROL: Clear all mobile storage on logout.
   */
  await AsyncStorage.clear();
  await SecureStore.deleteItemAsync('auth_token');

  console.log('HIPAA: All sensitive data cleared from mobile device');
}

// Auto-logout after 15 minutes of inactivity
let lastActivity = Date.now();

export function trackActivity(): void {
  lastActivity = Date.now();
}

setInterval(() => {
  const inactiveMinutes = (Date.now() - lastActivity) / 1000 / 60;

  if (inactiveMinutes >= 15) {
    console.warn('HIPAA: Auto-logout due to inactivity');
    clearSensitiveDataOnLogout();
    // Navigate to login screen
  }
}, 60 * 1000);  // Check every minute
```

**Evidence Artifact:** `frontend/src/lib/security/phiProtection.ts`

---

## Third-Party Integration Controls

### Summary Table

| Service | Purpose | ePHI Allowed? | Controls |
|---------|---------|---------------|----------|
| **Sentry** | Error tracking | ❌ NO | PHI scrubber (before_send) |
| **SendGrid** | Email delivery | ❌ NO | PHI detection + block |
| **Stripe** | Payment processing | ❌ NO | Never send health data to Stripe |
| **Mixpanel** | Analytics | ❌ NO | De-identification (hash user_id, bucket age) |
| **Auth0** | OAuth provider | ❌ NO | Only authentication, no health data |
| **Vercel** | Frontend hosting | ❌ NO | Static files only, no ePHI |
| **GitHub** | Source code | ❌ NO | No ePHI in code/commits/issues |

**Evidence Artifact:** `docs/compliance/hipaa/third_party_integrations.md`

---

## Developer Access Controls

### Control 7: Developer Workstation Isolation

**Requirement:** Developer workstations MUST NOT access production ePHI databases.

**Implementation:**

```bash
# Cloud SQL IAM policy (production HIPAA database)
gcloud sql instances describe ln-health-db-beta --format=json | jq '.settings.ipConfiguration'

# Expected:
# {
#   "ipv4Enabled": false,  # No public IP
#   "privateNetwork": "projects/lifenav-prod/global/networks/lifenav-vpc",
#   "requireSsl": true,
#   "authorizedNetworks": []  # EMPTY: No external access
# }

# VPC Firewall rule: Only GKE pods can access Cloud SQL
gcloud compute firewall-rules describe allow-gke-to-cloudsql --format=json

# Expected:
# {
#   "name": "allow-gke-to-cloudsql",
#   "sourceRanges": ["10.4.0.0/14"],  # GKE pod IP range ONLY
#   "destinationRanges": ["10.128.0.0/20"],  # Cloud SQL IP range
#   "allowed": [{"IPProtocol": "tcp", "ports": ["5432"]}]
# }
```

**Staging Environment (De-identified Data Only):**

```bash
# Developers can access STAGING database (no real ePHI)
gcloud sql instances describe ln-health-db-staging --format=json

# Staging uses SYNTHETIC data only
# - Fake patient names: "John Doe #12345"
# - Fake diagnoses: "Test Condition A"
# - NO real patient data
```

**Evidence Artifact:** `gcp-configs/developer_access_controls.json`

---

## Incident Response

### ePHI Breach Runbook

**Scenario:** ePHI leaked to non-HIPAA service (Sentry, SendGrid, frontend logs, etc.)

**Response Procedure:**

```bash
# STEP 1: Immediately stop ePHI flow
kubectl scale deployment backend --replicas=0 -n life-navigator

# STEP 2: Identify scope of breach
gcloud logging read "severity=ERROR AND textPayload=~'HIPAA VIOLATION'" \
  --limit=1000 --format=json > breach_investigation.json

# STEP 3: Notify stakeholders (HIPAA requires notification within 60 days)
# - Compliance Officer
# - Legal Counsel
# - Affected patients (if > 500 patients, notify HHS and media)

# STEP 4: Remediate
# - Fix code to prevent ePHI leak
# - Deploy hotfix
# - Verify with tests

# STEP 5: Document breach
# - Number of patients affected
# - Types of ePHI exposed
# - Duration of exposure
# - Remediation steps taken

# STEP 6: Request data deletion from third-party service
# Example: Contact Sentry support to delete events containing ePHI

# STEP 7: File breach report with HHS (if required)
# https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf
```

**Evidence Artifact:** `docs/resilience/runbooks/EPHI_BREACH_RESPONSE.md`

---

## Evidence Package

**Location:** `gs://lifenav-prod-compliance-evidence/hipaa/ephi-flow-control/`

**Required Artifacts:**
1. `test-results/ephi_flow_control.xml` (weekly automated tests)
2. `gcp-configs/network_isolation_verification.json` (monthly)
3. `gcp-configs/sentry_scrubber_config.py` (current version)
4. `gcp-configs/analytics_deidentification.py` (current version)
5. `k8s/base/monitoring/prometheus-rules-hipaa.yaml` (current version)
6. `frontend/src/lib/security/phiProtection.ts` (current version)
7. `docs/compliance/hipaa/third_party_integrations.md` (quarterly review)

---

## Compliance Checklist

- [x] **Network Isolation:** Cloud SQL and GKE have no public IP, private VPC only
- [x] **API Filtering:** Backend redacts ePHI before sending to frontend
- [x] **Error Reporting:** Sentry scrubs ePHI before sending events
- [x] **Email Prevention:** SendGrid emails blocked if ePHI detected
- [x] **Analytics De-identification:** Mixpanel receives hashed user_id and bucketed age
- [x] **Frontend Controls:** localStorage/cookies NEVER contain ePHI, auto-logout after 15 min
- [x] **Third-Party Isolation:** Sentry, SendGrid, Stripe, Mixpanel NOT in HIPAA zone
- [x] **Developer Access:** Production ePHI database inaccessible from workstations
- [x] **Automated Tests:** Weekly CI/CD tests verify ePHI containment
- [x] **Runtime Monitoring:** Prometheus alerts for ePHI leaks
- [x] **Incident Response:** Breach runbook documented and tested

---

**Last Updated:** 2026-01-09
**Next Review:** 2026-02-09 (Monthly)
**Owner:** Compliance Lead
**Status:** Active

**HIPAA Requirement:** § 164.312(a)(1) - Access Control
**Evidence Location:** `gs://lifenav-prod-compliance-evidence/hipaa/ephi-flow-control/`
