"""
Tests for finance domain endpoints.

Tests cover:
- Financial account CRUD operations
- Transaction CRUD operations
- Budget CRUD operations
- Multi-tenant isolation
- Permission enforcement
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinancialAccount, Transaction, Budget
from app.models.user import User, Tenant


class TestFinancialAccounts:
    """Tests for financial account endpoints."""

    def test_list_accounts_empty(self, authenticated_client: TestClient):
        """Test listing accounts when none exist."""
        response = authenticated_client.get("/api/v1/finance/accounts")

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_create_account(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new financial account."""
        response = authenticated_client.post(
            "/api/v1/finance/accounts",
            json={
                "account_name": "Chase Checking",
                "account_type": "checking",
                "institution_name": "Chase Bank",
                "current_balance": 5000.00,
                "currency": "USD",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["account_name"] == "Chase Checking"
        assert data["account_type"] == "checking"
        assert float(data["current_balance"]) == 5000.00
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_get_account(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific account."""
        # Create account
        account = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Test Savings",
            account_type="savings",
            current_balance=10000.00,
        )
        db_session_with_rls.add(account)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(account)

        # Get account
        response = authenticated_client.get(f"/api/v1/finance/accounts/{account.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(account.id)
        assert data["account_name"] == "Test Savings"

    def test_get_nonexistent_account(self, authenticated_client: TestClient):
        """Test getting an account that doesn't exist."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = authenticated_client.get(f"/api/v1/finance/accounts/{fake_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_account(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating an account."""
        # Create account
        account = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Old Name",
            account_type="checking",
        )
        db_session_with_rls.add(account)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(account)

        # Update account
        response = authenticated_client.patch(
            f"/api/v1/finance/accounts/{account.id}",
            json={
                "account_name": "New Name",
                "current_balance": 1500.50,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["account_name"] == "New Name"
        assert float(data["current_balance"]) == 1500.50

    @pytest.mark.asyncio
    async def test_delete_account(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test soft-deleting an account."""
        # Create account
        account = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="To Delete",
            account_type="checking",
        )
        db_session_with_rls.add(account)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(account)

        # Delete account
        response = authenticated_client.delete(f"/api/v1/finance/accounts/{account.id}")

        assert response.status_code == 204

        # Verify it's gone
        response = authenticated_client.get(f"/api/v1/finance/accounts/{account.id}")
        assert response.status_code == 404


class TestTransactions:
    """Tests for transaction endpoints."""

    @pytest.mark.asyncio
    async def test_create_transaction(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new transaction."""
        # First create an account
        account = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Test Account",
            account_type="checking",
        )
        db_session_with_rls.add(account)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(account)

        # Create transaction
        response = authenticated_client.post(
            "/api/v1/finance/transactions",
            json={
                "account_id": str(account.id),
                "transaction_date": "2025-11-05",
                "amount": -50.00,
                "description": "Grocery shopping",
                "merchant_name": "Whole Foods",
                "category": "Food & Dining",
                "transaction_type": "debit",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "Grocery shopping"
        assert float(data["amount"]) == -50.00
        assert data["merchant_name"] == "Whole Foods"

    @pytest.mark.asyncio
    async def test_list_transactions_for_account(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test listing transactions filtered by account."""
        # Create account and transactions
        account = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Test Account",
            account_type="checking",
        )
        db_session_with_rls.add(account)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(account)

        # Create transactions
        from datetime import date
        for i in range(3):
            txn = Transaction(
                tenant_id=test_tenant.id,
                user_id=test_user.id,
                account_id=account.id,
                transaction_date=date(2025, 11, i + 1),
                amount=-10.00 * (i + 1),
                description=f"Transaction {i}",
                transaction_type="debit",
            )
            db_session_with_rls.add(txn)
        await db_session_with_rls.commit()

        # List transactions
        response = authenticated_client.get(
            f"/api/v1/finance/transactions?account_id={account.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert all(txn["account_id"] == str(account.id) for txn in data)


class TestBudgets:
    """Tests for budget endpoints."""

    @pytest.mark.asyncio
    async def test_create_budget(
        self,
        authenticated_client: TestClient,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new budget."""
        response = authenticated_client.post(
            "/api/v1/finance/budgets",
            json={
                "budget_name": "Monthly Groceries",
                "category": "Food & Dining",
                "amount": 800.00,
                "period": "monthly",
                "start_date": "2025-11-01",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["budget_name"] == "Monthly Groceries"
        assert float(data["amount"]) == 800.00
        assert data["period"] == "monthly"


class TestTenantIsolation:
    """Tests for tenant isolation in finance endpoints."""

    @pytest.mark.asyncio
    async def test_cannot_access_other_tenant_account(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        second_tenant: Tenant,
    ):
        """Test that users cannot access accounts from other tenants."""
        # Create account in different tenant
        other_account = FinancialAccount(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            account_name="Other Tenant Account",
            account_type="checking",
        )
        db_session.add(other_account)
        await db_session.commit()
        await db_session.refresh(other_account)

        # Try to access it (should fail due to RLS)
        response = authenticated_client.get(f"/api/v1/finance/accounts/{other_account.id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_only_shows_own_tenant_accounts(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that listing accounts only returns accounts from user's tenant."""
        # Create account in user's tenant
        account1 = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="My Account",
            account_type="checking",
        )
        # Create account in other tenant
        account2 = FinancialAccount(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            account_name="Other Account",
            account_type="checking",
        )
        db_session.add_all([account1, account2])
        await db_session.commit()

        # List accounts
        response = authenticated_client.get("/api/v1/finance/accounts")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["account_name"] == "My Account"
