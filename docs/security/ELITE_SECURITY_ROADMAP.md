# Life Navigator - Elite Security Roadmap

## Current State: Enterprise-Grade (B+)
## Target State: Elite/Military-Grade (A+)

---

## Phase 1: Critical Infrastructure (Priority: IMMEDIATE)

### 1.1 KMS Integration (Replace Environment Keys)

**Current:** Encryption keys stored in environment variables
**Target:** HSM-backed Key Management Service

```bash
# Google Cloud KMS Setup
gcloud kms keyrings create life-navigator-prod --location=us-central1
gcloud kms keys create master-key --keyring=life-navigator-prod \
  --location=us-central1 --purpose=encryption \
  --protection-level=hsm  # Hardware Security Module

# Create keys for each database
gcloud kms keys create hipaa-kek --keyring=life-navigator-prod --purpose=encryption
gcloud kms keys create financial-kek --keyring=life-navigator-prod --purpose=encryption
```

**Code Changes Required:**
```python
# backend/app/core/kms.py
from google.cloud import kms_v1

class CloudKMSProvider:
    def __init__(self, project_id: str, location: str, keyring: str):
        self.client = kms_v1.KeyManagementServiceClient()
        self.keyring_name = f"projects/{project_id}/locations/{location}/keyRings/{keyring}"

    def encrypt_dek(self, dek: bytes, key_name: str) -> bytes:
        """Encrypt DEK using Cloud KMS (HSM-backed)."""
        key_path = f"{self.keyring_name}/cryptoKeys/{key_name}"
        response = self.client.encrypt(name=key_path, plaintext=dek)
        return response.ciphertext

    def decrypt_dek(self, encrypted_dek: bytes, key_name: str) -> bytes:
        """Decrypt DEK using Cloud KMS."""
        key_path = f"{self.keyring_name}/cryptoKeys/{key_name}"
        response = self.client.decrypt(name=key_path, ciphertext=encrypted_dek)
        return response.plaintext
```

### 1.2 Web Application Firewall (WAF)

**Option A: Cloudflare (Recommended)**
```yaml
# cloudflare-waf-rules.yaml
rules:
  - name: "Block SQL Injection"
    expression: "(http.request.uri.query contains \"UNION\" or http.request.uri.query contains \"SELECT\")"
    action: block

  - name: "Rate Limit Auth"
    expression: "(http.request.uri.path contains \"/api/auth\")"
    action: rate_limit
    characteristics: ["ip.src"]
    period: 60
    requests_per_period: 10

  - name: "Block Tor Exit Nodes"
    expression: "(ip.geoip.is_in_european_union eq false and cf.threat_score gt 50)"
    action: challenge
```

**Option B: AWS WAF**
```terraform
# terraform/modules/waf/main.tf
resource "aws_wafv2_web_acl" "main" {
  name  = "life-navigator-waf"
  scope = "CLOUDFRONT"

  default_action { allow {} }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { none {} }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
  }

  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 2
    override_action { none {} }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
      }
    }
  }
}
```

### 1.3 Content Security Policy (CSP) Hardening

```typescript
// apps/web/next.config.ts - Add strict CSP
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https: blob:;
      font-src 'self';
      connect-src 'self' https://*.supabase.co https://api.plaid.com wss://*.supabase.co;
      frame-src 'self' https://cdn.plaid.com;
      frame-ancestors 'none';
      form-action 'self';
      base-uri 'self';
      upgrade-insecure-requests;
    `.replace(/\s+/g, ' ').trim()
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  }
];
```

---

## Phase 2: Zero Trust Architecture

### 2.1 Service Mesh with mTLS (Istio)

```yaml
# k8s/istio/peer-authentication.yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: life-navigator
spec:
  mtls:
    mode: STRICT  # All service-to-service communication encrypted

---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: backend-policy
  namespace: life-navigator
spec:
  selector:
    matchLabels:
      app: backend
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/life-navigator/sa/web-frontend"]
      to:
        - operation:
            methods: ["GET", "POST", "PUT", "DELETE"]
            paths: ["/api/*"]
```

### 2.2 Workload Identity (GKE)

```yaml
# k8s/base/backend/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backend-sa
  annotations:
    iam.gke.io/gcp-service-account: backend@life-navigator.iam.gserviceaccount.com
```

```bash
# Bind GCP service account to Kubernetes service account
gcloud iam service-accounts add-iam-policy-binding \
  backend@life-navigator.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:life-navigator.svc.id.goog[life-navigator/backend-sa]"
```

---

## Phase 3: Security Monitoring & SIEM

### 3.1 Centralized Security Logging

```python
# backend/app/core/security_logging.py
import structlog
from google.cloud import logging as gcp_logging

class SecurityEventLogger:
    """SIEM-ready security event logging."""

    SEVERITY_LEVELS = {
        'info': 'INFO',
        'warning': 'WARNING',
        'critical': 'CRITICAL',
        'alert': 'ALERT',
    }

    def __init__(self):
        self.gcp_client = gcp_logging.Client()
        self.logger = self.gcp_client.logger('security-events')

    def log_security_event(
        self,
        event_type: str,
        severity: str,
        user_id: str = None,
        ip_address: str = None,
        details: dict = None,
    ):
        """Log security event to GCP Cloud Logging (SIEM-compatible)."""
        payload = {
            'event_type': event_type,
            'severity': severity,
            'user_id': user_id,
            'ip_address': ip_address,
            'timestamp': datetime.utcnow().isoformat(),
            'details': details or {},
        }

        self.logger.log_struct(
            payload,
            severity=self.SEVERITY_LEVELS.get(severity, 'INFO'),
            labels={
                'application': 'life-navigator',
                'environment': os.getenv('ENVIRONMENT', 'dev'),
                'component': 'security',
            }
        )

    def log_auth_failure(self, email: str, ip: str, reason: str):
        self.log_security_event(
            event_type='AUTH_FAILURE',
            severity='warning',
            ip_address=ip,
            details={'email': email, 'reason': reason}
        )

    def log_suspicious_activity(self, user_id: str, activity: str, ip: str):
        self.log_security_event(
            event_type='SUSPICIOUS_ACTIVITY',
            severity='alert',
            user_id=user_id,
            ip_address=ip,
            details={'activity': activity}
        )
```

### 3.2 Real-time Alerting

```yaml
# terraform/modules/monitoring/alerts.tf
resource "google_monitoring_alert_policy" "auth_failures" {
  display_name = "High Auth Failure Rate"

  conditions {
    display_name = "Auth failures > 10/min"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND jsonPayload.event_type=\"AUTH_FAILURE\""
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      duration        = "60s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.pagerduty.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_monitoring_alert_policy" "data_exfiltration" {
  display_name = "Potential Data Exfiltration"

  conditions {
    display_name = "Large data export detected"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND jsonPayload.event_type=\"DATA_EXPORT\" AND jsonPayload.record_count>1000"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.pagerduty.name,
    google_monitoring_notification_channel.security_team.name,
  ]
}
```

---

## Phase 4: CI/CD Security

### 4.1 Secret Scanning

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on: [push, pull_request]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          extra_args: --only-verified

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Semgrep SAST
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/owasp-top-ten
            p/python
            p/typescript

  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Container
        run: docker build -t app:test .

      - name: Trivy Container Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'app:test'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 4.2 DAST (Dynamic Application Security Testing)

```yaml
# .github/workflows/dast.yml
name: DAST Scan

on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM
  workflow_dispatch:

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - name: OWASP ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.7.0
        with:
          target: 'https://staging.lifenavigator.app'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
```

---

## Phase 5: Compliance & Certification

### 5.1 SOC 2 Type II Preparation

```markdown
Evidence Collection Required:
1. Access Control Policies (documented)
2. Encryption Key Management Procedures
3. Incident Response Plan
4. Business Continuity Plan
5. Vendor Management Policy
6. Employee Security Training Records
7. Penetration Test Reports
8. Vulnerability Management Process
9. Change Management Procedures
10. Data Classification Policy
```

### 5.2 HIPAA Compliance Checklist

```markdown
Administrative Safeguards:
- [x] Security Officer designated
- [x] Risk assessment completed
- [x] Workforce training program
- [x] Access management policies
- [ ] Incident response procedures (needs formalization)
- [ ] Business Associate Agreements (BAAs)

Physical Safeguards:
- [x] Cloud provider SOC 2 certified (GCP)
- [x] Encryption at rest
- [x] Access controls

Technical Safeguards:
- [x] Unique user identification
- [x] Automatic logoff
- [x] Encryption in transit (TLS)
- [x] Audit controls
- [x] Integrity controls
- [x] Access controls (RLS)
```

---

## Implementation Priority

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| **1.1** | KMS Integration | 2 days | Critical |
| **1.2** | WAF Setup | 1 day | Critical |
| **1.3** | CSP Headers | 2 hours | High |
| **2.1** | Service Mesh | 3 days | Medium |
| **3.1** | SIEM Logging | 1 day | High |
| **3.2** | Alerting | 4 hours | High |
| **4.1** | Secret Scanning | 2 hours | High |
| **4.2** | DAST | 4 hours | Medium |
| **5.x** | SOC 2 Prep | 2 weeks | Long-term |

---

## Quick Wins (Do This Week)

1. **Add CSP headers** - 2 hours
2. **Enable secret scanning in GitHub** - 30 minutes
3. **Set up Snyk for dependency scanning** - 1 hour
4. **Configure Cloud Logging alerts** - 2 hours
5. **Document incident response plan** - 4 hours

---

## Security Contacts

- Security Officer: [TBD]
- Incident Response: security@lifenavigator.app
- Bug Bounty: [Consider setting up via HackerOne]
