# MCP Response Fixtures

This directory contains example MCP response data for testing both the app layer (MCP server) and agent layer (MCP client).

## Purpose

These fixtures serve multiple purposes:

1. **App Team Testing**: Validate MCP server implementation against expected response formats
2. **Agent Team Testing**: Mock MCP responses for agent unit/integration tests
3. **Documentation**: Show concrete examples of what each tool returns
4. **Contract Validation**: Ensure both teams agree on data structures

## File Organization

```
mcp_responses/
├── README.md                          # This file
├── financial_accounts.json            # get_user_accounts
├── financial_transactions.json        # get_user_transactions
├── financial_spending_categories.json # get_spending_by_category
├── financial_recurring.json           # get_recurring_transactions
├── financial_investment_portfolio.json # get_investment_portfolio
├── financial_crypto_holdings.json     # get_crypto_holdings
├── financial_crypto_transactions.json # get_crypto_transactions
├── financial_paystubs.json            # get_paystubs
├── career_resume.json                 # get_user_resume
├── career_job_applications.json       # get_job_search_history
├── health_summary.json                # get_health_summary
├── health_insurance.json              # get_insurance_coverage
├── education_courses.json             # get_courses
├── education_assignments.json         # get_assignments
├── automotive_vehicle_status.json     # get_vehicle_status
└── complete_financial_context.json    # Combined financial data for budget analysis
```

## Usage Examples

### In App Tests (Python)

```python
import json
from pathlib import Path

def load_fixture(filename: str) -> dict:
    path = Path(__file__).parent / "fixtures" / "mcp_responses" / filename
    with open(path) as f:
        return json.load(f)

# Test MCP server response format
def test_get_user_accounts_format():
    fixture = load_fixture("financial_accounts.json")
    expected_response = fixture["response"]

    # Make actual MCP call
    response = await mcp_server.execute(...)

    # Validate structure matches fixture
    assert response.keys() == expected_response.keys()
    assert all(key in response["data"][0] for key in expected_response["data"][0])
```

### In Agent Tests (Python)

```python
from tests.mocks import MockMCPClient

def test_budget_specialist():
    mock_mcp = MockMCPClient()

    # Load and set fixture
    fixture = load_fixture("financial_transactions.json")
    mock_mcp.set_response("get_user_transactions", fixture["response"]["data"])

    # Test agent
    specialist = BudgetSpecialist(mcp_client=mock_mcp)
    result = await specialist.analyze_budget(...)

    # Verify agent used MCP
    assert mock_mcp.was_called("get_user_transactions")
```

## Fixture Format

Each fixture file follows this structure:

```json
{
  "tool": "tool_name",
  "description": "What this fixture demonstrates",
  "response": {
    "request_id": "mcp_test_...",
    "success": true,
    "data": [...],  // Actual response data
    "metadata": {
      "tool": "tool_name",
      "execution_time_ms": 42,
      "cached": false
    }
  }
}
```

## Fixture Characteristics

### Realism
- Uses realistic merchant names, amounts, dates
- Includes variety of transaction types, account types, etc.
- Reflects common financial situations

### Coverage
- Covers edge cases (closed accounts, pending transactions, etc.)
- Includes null/optional fields
- Shows various enum values

### Consistency
- All UUIDs follow proper format
- Dates are ISO 8601
- Currency amounts are properly formatted
- References between fixtures are valid (e.g., transaction.account_id matches an account)

## Data Relationships

Some fixtures reference data in other fixtures:

```
financial_accounts.json
  └─ account_id: "acc_chase_checking_001"

financial_transactions.json
  └─ account_id: "acc_chase_checking_001"  // References account above

financial_investment_portfolio.json
  └─ account_id: "acc_fidelity_401k_001"   // References investment account
```

## Updating Fixtures

When updating:

1. **Validate against schema**: Ensure changes match `mcp_tools_schema.yaml`
2. **Update all affected files**: If changing account structure, update all fixtures with accounts
3. **Run tests**: Both app and agent test suites should pass
4. **Document changes**: Update this README if adding new fixtures

## Notes

- **PII Redaction**: All fixtures show sanitized data (last 4 digits, masked values)
- **Realistic Dates**: Use dates relative to 2025-10-27 (contract creation date)
- **Test User**: Fixtures represent data for a single test user
- **Amounts**: Use realistic but varied amounts to test different scenarios

## Quick Reference

| Fixture File | Tool Name | Agent Users |
|--------------|-----------|-------------|
| financial_accounts.json | get_user_accounts | All finance specialists |
| financial_transactions.json | get_user_transactions | Budget, Tax, Debt, Savings |
| financial_spending_categories.json | get_spending_by_category | Budget |
| financial_recurring.json | get_recurring_transactions | Budget, Savings |
| financial_investment_portfolio.json | get_investment_portfolio | Investment |
| financial_crypto_holdings.json | get_crypto_holdings | Investment |
| financial_paystubs.json | get_paystubs | Tax, Debt |
| career_resume.json | get_user_resume | Resume |
| career_job_applications.json | get_job_search_history | Job Search |
| health_summary.json | get_health_summary | (Future health specialist) |
| education_courses.json | get_courses | (Future education specialist) |

---

**Last Updated:** October 27, 2025
**Maintainer:** Agent Team + App Team
