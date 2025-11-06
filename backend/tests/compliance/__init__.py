"""
HIPAA Compliance Test Suite

Comprehensive tests for HIPAA (Health Insurance Portability and Accountability Act)
compliance requirements including:

- Access Controls (§164.308(a)(4))
- Audit Logging (§164.312(b))
- Data Encryption (§164.312(a)(2)(iv))
- Data Integrity (§164.312(c)(1))
- Breach Detection (§164.410)
- PHI Handling (§164.502(b))

Run all HIPAA tests:
    pytest tests/compliance/ -v -m hipaa

Generate compliance report:
    pytest tests/compliance/ --html=compliance_report.html
"""
