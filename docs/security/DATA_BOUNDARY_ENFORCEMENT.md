# Data Boundary Enforcement

**Status**: Implemented
**Date**: 2026-01-09
**Compliance**: HIPAA § 164.308(a)(4), PCI-DSS Requirement 3

---

## Overview

The Data Boundary Enforcement system ensures that raw PHI/PCI data **never crosses service boundaries**. Only derived, de-identified numeric features are permitted to flow from the gateway to internal services (risk-engine, agents, analytics).

This is enforced at runtime via **FastAPI middleware** that validates all requests to internal services.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)                                         │
│  - Collects user input                                     │
│  - Sends to backend API                                    │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│  Backend Gateway (FastAPI)                                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Data Boundary Validator Middleware                  │ │
│  │  ✅ Validates all /api/v1/internal/* requests        │ │
│  │  ❌ Blocks PHI/PCI fields (ssn, diagnosis, etc.)     │ │
│  │  ❌ Blocks patterns (SSN-like, CC-like)              │ │
│  └──────────────────────────────────────────────────────┘ │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Feature Derivation Layer                            │ │
│  │  - Converts PHI → numeric features                   │ │
│  │  - age, bmi, chronic_conditions_count                │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Internal Services (VPC-private)                           │
│  - risk-engine                                             │
│  - multi-agent system                                      │
│  - analytics                                               │
│                                                             │
│  ✅ Only receives derived numeric features                │
│  ❌ NEVER receives PHI/PCI                                │
└────────────────────────────────────────────────────────────┘
```

---

## Forbidden Fields

### PHI (Health Information) - HIPAA Protected

| Field Name | Example | Why Forbidden |
|------------|---------|---------------|
| `ssn` | "123-45-6789" | Direct identifier |
| `diagnosis` | "Type 2 Diabetes" | Medical condition |
| `medications` | ["Metformin"] | Treatment information |
| `doctor_name` | "Dr. Smith" | Provider information |
| `medical_record_number` | "MRN-12345" | Medical identifier |
| `health_insurance` | "Aetna Policy #..." | Insurance information |

### PCI (Financial Information) - PCI-DSS Protected

| Field Name | Example | Why Forbidden |
|------------|---------|---------------|
| `credit_card_number` | "4111111111111111" | Primary account number (PAN) |
| `cvv` | "123" | Card verification value |
| `account_number` | "1234567890" | Bank account number |
| `routing_number` | "021000021" | Bank routing number |
| `iban` | "GB82WEST12345698765432" | International account |

### Complete List

See: `backend/app/middleware/data_boundary.py` → `FORBIDDEN_FIELD_NAMES`

---

## Forbidden Patterns

In addition to field names, the middleware detects **patterns** in text:

| Pattern | Example | Detection |
|---------|---------|-----------|
| SSN | "123-45-6789" | `\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b` |
| Credit Card | "4111-1111-1111-1111" | `\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b` |
| Account Number | "account_number: 12345678" | `\baccount[_\s]?number[:\s]+\d{8,17}\b` |
| Routing Number | "routing: 021000021" | `\brouting[_\s]?number[:\s]+\d{9}\b` |

---

## Allowed Fields (Derived Features Only)

Only **de-identified numeric features** are permitted:

### Health Features
```python
{
    "age": 30,                          # ✅ Numeric, no direct ID
    "bmi": 24.5,                        # ✅ Derived from height/weight
    "chronic_conditions_count": 2,      # ✅ Count, not specific diagnoses
    "medications_count": 3,             # ✅ Count, not medication names
    "has_diabetes": True,               # ✅ Boolean flag (if aggregated)
}
```

### Financial Features
```python
{
    "average_monthly_spending": 1500.0,     # ✅ Aggregated spending
    "total_debt": 5000.0,                   # ✅ Sum, not account details
    "credit_accounts_count": 3,             # ✅ Count, not account numbers
    "average_credit_utilization": 0.35,     # ✅ Ratio
}
```

---

## Implementation

### 1. Middleware Integration

**File**: `backend/app/main.py`

```python
from app.middleware.data_boundary import data_boundary_validator_middleware

app = FastAPI()

# Add data boundary enforcement
app.middleware("http")(data_boundary_validator_middleware)
```

### 2. Protected Routes

The middleware validates requests to:

- `/api/v1/internal/risk-engine/*`
- `/api/v1/internal/agents/*`
- `/api/v1/risk/*` (public risk API)

**All other routes** (e.g., `/api/v1/users`, `/api/v1/auth`) are **not validated** to allow normal user data operations.

### 3. Validation Logic

For each request:

1. **Check if route requires validation** (internal services only)
2. **Parse request body** (JSON or text)
3. **Scan for forbidden field names** (recursive, case-insensitive)
4. **Scan for forbidden patterns** (regex matching)
5. **Reject with 400 if violation found**
6. **Log violation** (without sensitive data)

### 4. Error Response

```json
{
  "error": "data_boundary_violation",
  "message": "Request contains forbidden sensitive data fields",
  "detail": "Field 'ssn' is not allowed across service boundaries",
  "allowed": "Only derived numeric features are permitted (e.g., age, bmi, chronic_conditions_count)"
}
```

---

## Testing

### Run Tests

```bash
cd backend
poetry run pytest tests/middleware/test_data_boundary.py -v
```

### Test Cases

| Test | Expected Result |
|------|----------------|
| POST with `ssn` field | ❌ Blocked (400) |
| POST with `diagnosis` field | ❌ Blocked (400) |
| POST with `credit_card_number` field | ❌ Blocked (400) |
| POST with SSN pattern in text | ❌ Blocked (400) |
| POST with nested forbidden field | ❌ Blocked (400) |
| POST with `age`, `bmi` (allowed) | ✅ Allowed (200) |
| POST to `/api/v1/users` (non-internal) | ✅ Allowed (200) |

### Manual Testing

```bash
# Should FAIL (ssn forbidden)
curl -X POST http://localhost:8000/api/v1/internal/risk-engine/compute \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123", "ssn": "123-45-6789", "age": 30}'

# Response: 400 Bad Request

# Should SUCCEED (only derived features)
curl -X POST http://localhost:8000/api/v1/internal/risk-engine/compute \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123", "age": 30, "bmi": 24.5, "chronic_conditions_count": 2}'

# Response: 200 OK
```

---

## Adding New Services

To add boundary enforcement to a new service:

### 1. Update Middleware

**File**: `backend/app/middleware/data_boundary.py`

```python
internal_service_routes = [
    "/api/v1/internal/risk-engine",
    "/api/v1/internal/agents",
    "/api/v1/internal/your-new-service",  # Add here
]
```

### 2. Add Tests

```python
def test_blocks_forbidden_data_to_new_service():
    response = client.post(
        "/api/v1/internal/your-new-service/endpoint",
        json={"ssn": "123-45-6789"},
    )
    assert response.status_code == 400
```

---

## Adding New Forbidden Fields

To add a new forbidden field:

### 1. Update Field Set

**File**: `backend/app/middleware/data_boundary.py`

```python
FORBIDDEN_FIELD_NAMES = {
    # ... existing fields ...
    "new_forbidden_field",  # Add here
}
```

### 2. Add Test

```python
def test_blocks_new_forbidden_field():
    response = client.post(
        "/api/v1/internal/risk-engine/compute",
        json={"new_forbidden_field": "value"},
    )
    assert response.status_code == 400
```

---

## Adding New Forbidden Patterns

To add a new regex pattern:

### 1. Update Pattern List

**File**: `backend/app/middleware/data_boundary.py`

```python
FORBIDDEN_PATTERNS = [
    # ... existing patterns ...
    (r"your_regex_pattern", "pattern_name"),
]
```

### 2. Add Test

```python
def test_blocks_new_pattern():
    response = client.post(
        "/api/v1/internal/risk-engine/compute",
        json={"notes": "Text with pattern"},
    )
    assert response.status_code == 400
```

---

## Monitoring

### Metrics

Track boundary violations in production:

```python
from prometheus_client import Counter

boundary_violations = Counter(
    "data_boundary_violations_total",
    "Total data boundary violations",
    ["route", "violation_type"],
)
```

### Alerts

Configure alerts for violations:

```yaml
# prometheus-alerts.yml
groups:
  - name: data_boundary
    rules:
      - alert: DataBoundaryViolations
        expr: rate(data_boundary_violations_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High rate of data boundary violations"
          description: "{{ $value }} violations/sec on route {{ $labels.route }}"
```

---

## Logging

All violations are logged **without sensitive data**:

```python
logger.error(
    "data_boundary_violation",
    path="/api/v1/internal/risk-engine/compute",
    method="POST",
    violation_type="forbidden_field",
    violation_field="ssn",  # Field name only (not value)
    user_id="user_123",
)
```

**Never logged**:
- Actual SSN, credit card numbers
- PHI/PCI field values
- Request bodies containing sensitive data

---

## Compliance

### HIPAA § 164.308(a)(4)

✅ **Information Access Management**: Implemented access controls to prevent unauthorized access to PHI.

### HIPAA § 164.312(a)(1)

✅ **Access Control**: Technical policies and procedures to allow access only to authorized persons.

### PCI-DSS Requirement 3.4

✅ **Render PAN Unreadable**: Primary Account Numbers (credit cards) are blocked at gateway, never stored or transmitted to internal services.

---

## Related Documentation

- [Secrets Inventory](./SECRETS_INVENTORY.md) - Secrets management
- [Data Boundaries](../04-security/DATA_BOUNDARIES.md) - Overall architecture
- [HIPAA Compliance](./HIPAA_COMPLIANCE.md) - HIPAA requirements

---

## FAQ

### Q: Can I send PHI to `/api/v1/users` endpoint?

**A**: Yes. Data boundary enforcement only applies to **internal service routes** (`/api/v1/internal/*`). User management endpoints are not restricted.

### Q: What if I need to send a diagnosis to the risk engine?

**A**: You must **derive a numeric feature** first. Instead of `"diagnosis": "diabetes"`, send `"has_diabetes": true` or `"diabetes_risk_score": 0.8`.

### Q: How do I test boundary enforcement locally?

**A**: Run the test suite:
```bash
pytest tests/middleware/test_data_boundary.py
```

Or manually with `curl` (see Testing section above).

### Q: What happens if a violation is detected?

**A**: The request is **rejected with HTTP 400**, a structured error is returned, and the violation is logged (without sensitive data).
