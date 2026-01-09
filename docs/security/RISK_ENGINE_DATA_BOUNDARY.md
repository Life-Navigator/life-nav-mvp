# Risk Engine Data Boundary

**Status:** Active
**Last Updated:** 2026-01-09
**Owner:** Security Team + Platform Engineering

---

## Purpose

This document defines the **data boundary** for the risk-engine service to ensure:

1. **HIPAA Compliance**: No Protected Health Information (PHI) crosses the boundary
2. **PCI Compliance**: No Payment Card Industry (PCI) data crosses the boundary
3. **Security**: Minimize attack surface by limiting exposure
4. **Privacy**: User anonymity through hashing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend (Next.js / Expo)                                           │
│ - NEVER calls risk-engine directly                                  │
│ - ALWAYS calls main backend /api/risk/* proxy                       │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        │ HTTPS (Public Internet)
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Main Backend (FastAPI)                                              │
│ - /api/risk/* proxy endpoints                                       │
│ - JWT validation (user auth)                                        │
│ - Data boundary validation (no PHI/PCI)                             │
│ - Request enrichment (tenant_id, user_id_hash)                      │
│ - Service-to-service JWT generation                                 │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
                        │ Private Network (K8s ClusterIP)
                        │ Service-to-Service JWT (aud="risk-engine")
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Risk Engine (Internal Service)                                      │
│ - Monte Carlo simulations                                           │
│ - Goal probability calculations                                     │
│ - Portfolio analysis                                                │
│ - Explainability (drivers, counterfactuals)                         │
│ - Recommendations                                                   │
│                                                                      │
│ ONLY receives derived numeric features                              │
│ NO PHI, NO PCI, NO raw user identifiers                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Boundary Rules

### ✅ ALLOWED (Derived Numeric Features)

Risk-engine **ONLY** receives:

| Feature | Type | Example | Rationale |
|---------|------|---------|-----------|
| `user_id_hash` | SHA256 | `abc123...` | Anonymized user identifier |
| `tenant_id` | String | `tenant-uuid` | Multi-tenancy isolation |
| `health_cost_shock_annual_max` | Float | `5000.0` | Max health expense (numeric proxy) |
| `insurance_deductible` | Float | `2000.0` | Deductible amount (not policy details) |
| `employment_stability_score` | Float 0-1 | `0.9` | Stability metric (not employer name) |
| `layoff_probability` | Float 0-1 | `0.05` | Risk metric (not employment status) |
| `annual_income` | Float | `100000.0` | Income amount (not source details) |
| `annual_spending` | Float | `60000.0` | Spending amount (not itemization) |
| `target_value` | Float | `1000000.0` | Goal target (not goal description) |
| `current_allocated` | Float | `100000.0` | Allocated amount (not account numbers) |
| `portfolio_value` | Float | `150000.0` | Total value (not holdings) |
| `asset_allocation_weights` | List[Float] | `[0.6, 0.4]` | Weights (not specific securities) |
| `risk_tolerance` | Float 0-1 | `0.7` | Tolerance score (not questionnaire) |
| `risk_capacity` | Float 0-1 | `0.8` | Capacity score (not financial details) |

### ❌ FORBIDDEN (PHI / PCI / Identifiers)

Risk-engine **NEVER** receives:

#### Protected Health Information (PHI)
- ❌ Diagnosis codes (ICD-10)
- ❌ Medical conditions (diabetes, cancer, etc.)
- ❌ Prescriptions / medications
- ❌ Medical Record Numbers (MRN)
- ❌ Treatment details
- ❌ Doctor names
- ❌ Hospital names
- ❌ Lab results
- ❌ Genetic information

**Instead**: Use numeric proxies
- ✅ `health_cost_shock_annual_max: 5000` (max expense)
- ✅ `insurance_deductible: 2000` (deductible amount)
- ✅ `insurance_coverage_ratio: 0.8` (coverage %)

#### Payment Card Industry (PCI) Data
- ❌ Credit card numbers
- ❌ CVV codes
- ❌ Bank account numbers
- ❌ Routing numbers
- ❌ Payment history

**Instead**: Use aggregated metrics
- ✅ `total_liabilities: 50000` (total debt)
- ✅ `monthly_debt_payment: 1500` (payment amount)

#### Personally Identifiable Information (PII)
- ❌ Social Security Number (SSN)
- ❌ Email addresses
- ❌ Phone numbers
- ❌ First name / Last name
- ❌ Street address
- ❌ Date of birth (exact)
- ❌ Raw user IDs

**Instead**: Use anonymized identifiers
- ✅ `user_id_hash: "sha256(user_id)"` (hashed)
- ✅ `current_age: 35` (age, not DOB)

---

## Request Enrichment

Main backend **enriches** all risk-engine requests:

```python
# Before proxy (from frontend)
{
  "goal_context": {
    "goals": [...]
  },
  "mode": "balanced"
}

# After enrichment (to risk-engine)
{
  "request_meta": {
    "request_id": "uuid-...",
    "timestamp": "2026-01-09T10:30:00Z",
    "tenant_id": "tenant-abc",  # ← Injected
    "user_id_hash": "sha256...",  # ← Injected (anonymized)
    "schema_version": "1.0"
  },
  "call_context": {
    "api_version": "v1",
    "client_type": "web",  # ← Injected
    "feature_flags": {}
  },
  "goal_context": {
    "goals": [...]
  },
  "mode": "balanced"
}
```

---

## Validation

### Backend Proxy Validation

File: `backend/app/api/v1/risk_proxy.py`

```python
def _validate_data_boundary(request_body: Dict[str, Any]):
    """
    Validate that request contains only derived numeric features.

    Raises ValueError if forbidden fields detected.
    """
    forbidden_keys = [
        "ssn", "social_security_number", "credit_card", "account_number",
        "diagnosis", "medical_condition", "prescription", "email", "phone",
        "first_name", "last_name", "address", "date_of_birth",
        "medical_record_number"
    ]

    # Recursively check all fields
    # ... (see implementation)
```

**Example violation**:
```json
{
  "household_financial_state": {
    "ssn": "123-45-6789"  # ← REJECTED
  }
}
```

**Error**: `Data boundary violation: Field 'household_financial_state.ssn' contains PHI/PCI. Use derived numeric features only.`

---

## Network Isolation

### Kubernetes NetworkPolicy

File: `infrastructure/k8s/risk-engine-network-policy.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: risk-engine-network-policy
spec:
  podSelector:
    matchLabels:
      app: risk-engine
  ingress:
    # ONLY allow from main backend
    - from:
        - podSelector:
            matchLabels:
              app: lifenav-backend
      ports:
        - protocol: TCP
          port: 8001
```

**Result**:
- ✅ Main backend **CAN** call risk-engine
- ❌ Frontend **CANNOT** call risk-engine directly
- ❌ External services **CANNOT** call risk-engine
- ❌ Internet **CANNOT** reach risk-engine

---

## Service-to-Service Authentication

### JWT Audience Enforcement

Main backend generates service-to-service JWT:

```python
payload = {
    "iss": "life-navigator-backend",
    "aud": "risk-engine",  # ← Audience
    "scope": "risk-engine:snapshot",  # ← Per-endpoint scope
    "iat": datetime.utcnow(),
    "exp": datetime.utcnow() + timedelta(minutes=5)
}

token = jwt.encode(payload, settings.RISK_ENGINE_JWT_SECRET, algorithm="HS256")
```

Risk-engine validates:
1. **Audience** (`aud`) must be `"risk-engine"`
2. **Scope** must match endpoint (e.g., `risk-engine:snapshot`)
3. **Issuer** (`iss`) must be `"life-navigator-backend"`
4. **Expiration** must be valid

**If validation fails**: `403 Forbidden`

---

## Rationale

### Why This Boundary?

1. **Regulatory Compliance**
   - HIPAA: Risk-engine doesn't handle PHI → simpler compliance
   - PCI: Risk-engine doesn't handle PCI → no PCI DSS scope

2. **Security Defense-in-Depth**
   - If risk-engine is compromised, attacker gets **only** numeric data
   - No names, SSNs, medical records, credit cards

3. **Privacy by Design**
   - User anonymity through SHA256 hashing
   - No way to reverse-engineer identity from numeric features

4. **Reduced Attack Surface**
   - Private network only (no internet exposure)
   - Single entry point (main backend proxy)
   - Network-level isolation (K8s NetworkPolicy)

5. **Operational Simplicity**
   - Easier to audit (fewer sensitive fields)
   - Faster incident response (limited blast radius)
   - Simpler logging/monitoring (no PHI redaction needed in risk-engine)

---

## Audit & Monitoring

### Validation Failures

All data boundary violations are logged:

```json
{
  "level": "ERROR",
  "timestamp": "2026-01-09T10:30:00Z",
  "event": "data_boundary_violation",
  "field": "household_financial_state.ssn",
  "user_id_hash": "sha256...",
  "tenant_id": "tenant-abc",
  "request_id": "uuid-...",
  "action": "rejected"
}
```

**Alerting**: Violations trigger PagerDuty alert to security team.

### Network Policy Violations

Attempted direct calls to risk-engine are **blocked** at network level:

```bash
# From frontend (blocked by NetworkPolicy)
curl https://risk-engine:8001/v1/risk/snapshot
# Result: Connection refused (network layer)
```

**Monitoring**: K8s audit logs capture blocked connection attempts.

---

## Testing

### Data Boundary Tests

File: `backend/tests/test_risk_proxy.py`

```python
def test_data_boundary_rejects_phi():
    """PHI in request should be rejected."""
    request = {
        "household_financial_state": {
            "ssn": "123-45-6789"  # PHI
        }
    }

    with pytest.raises(ValueError, match="Data boundary violation"):
        _validate_data_boundary(request)

def test_data_boundary_allows_numeric_proxies():
    """Numeric proxies should be allowed."""
    request = {
        "household_financial_state": {
            "health_cost_shock_annual_max": 5000,  # Numeric proxy
            "insurance_deductible": 2000
        }
    }

    _validate_data_boundary(request)  # Should not raise
```

### Network Policy Tests

File: `infrastructure/tests/test_network_policy.yaml`

```yaml
# Test: Frontend cannot call risk-engine
apiVersion: v1
kind: Pod
metadata:
  name: frontend-test
  labels:
    app: web
spec:
  containers:
    - name: curl
      image: curlimages/curl
      command: ["sh", "-c"]
      args:
        - curl -v http://risk-engine:8001/healthz
      # Expected: Connection refused or timeout
```

---

## Exception Process

### When Numeric Proxies Aren't Enough

If a legitimate use case requires PHI/PCI:

1. **Document Justification**: Why is raw PHI/PCI needed?
2. **Security Review**: Security team approval
3. **Compliance Review**: HIPAA Officer approval
4. **Architecture Update**: Modify data boundary
5. **Audit Update**: Update audit procedures

**Example**: If risk calculations require exact diagnosis codes (not likely):
- Add to allowed list with justification
- Implement field-level encryption
- Add PHI redaction middleware
- Update BAA with risk-engine vendor

---

## Related Documentation

- [3-Day Security Implementation](./3_DAY_SECURITY_IMPLEMENTATION_SUMMARY.md)
- [Security Quickstart](./SECURITY_QUICKSTART.md)
- [HIPAA Compliance](../compliance/HIPAA_COMPLIANCE_CHECKLIST.md)
- [Network Policies](../../infrastructure/k8s/README.md)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-09 | Initial version | Platform Team |

---

**Questions?** Contact security@lifenavigator.com
