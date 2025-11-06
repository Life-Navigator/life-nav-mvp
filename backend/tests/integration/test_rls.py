"""
Tests for Row-Level Security (RLS) enforcement.

Tests verify that:
- Users can only access data from their own tenant
- RLS policies prevent cross-tenant data leakage
- System functions properly enforce RLS
- Audit logs are properly isolated
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.models.finance import FinancialAccount
from app.models.user import Organization, Tenant, User, UserTenant


@pytest.mark.asyncio
class TestTenantIsolation:
    """Tests for tenant data isolation via RLS."""

    async def test_user_can_only_see_own_tenant_data(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
        test_user_tenant: UserTenant,
    ):
        """Test that RLS prevents users from seeing other tenants' data."""

        # Create account in first tenant
        account1 = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Test Checking",
            account_type="checking",
            current_balance=1000.00,
        )
        db_session.add(account1)

        # Create account in second tenant
        account2 = FinancialAccount(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            account_name="Other Checking",
            account_type="checking",
            current_balance=2000.00,
        )
        db_session.add(account2)
        await db_session.commit()

        # Set RLS context for first tenant
        await set_tenant_context(db_session, str(test_tenant.id), str(test_user.id))

        # Query should only return accounts from first tenant
        result = await db_session.execute(select(FinancialAccount))
        accounts = result.scalars().all()

        assert len(accounts) == 1
        assert accounts[0].tenant_id == test_tenant.id
        assert accounts[0].account_name == "Test Checking"

    async def test_rls_context_switch(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test switching RLS context between tenants."""

        # Create accounts in both tenants
        account1 = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Tenant 1 Account",
            account_type="checking",
        )
        account2 = FinancialAccount(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            account_name="Tenant 2 Account",
            account_type="savings",
        )
        db_session.add_all([account1, account2])
        await db_session.commit()

        # Set context to first tenant
        await set_tenant_context(db_session, str(test_tenant.id), str(test_user.id))
        result = await db_session.execute(select(FinancialAccount))
        accounts = result.scalars().all()
        assert len(accounts) == 1
        assert accounts[0].account_name == "Tenant 1 Account"

        # Switch to second tenant
        await set_tenant_context(db_session, str(second_tenant.id), str(test_user.id))
        result = await db_session.execute(select(FinancialAccount))
        accounts = result.scalars().all()
        assert len(accounts) == 1
        assert accounts[0].account_name == "Tenant 2 Account"

    async def test_rls_prevents_write_to_other_tenant(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that RLS prevents writing data with wrong tenant_id."""

        # Set context for first tenant
        await set_tenant_context(db_session, str(test_tenant.id), str(test_user.id))

        # Try to create account for second tenant (should fail or be filtered)
        account = FinancialAccount(
            tenant_id=second_tenant.id,  # Wrong tenant!
            user_id=test_user.id,
            account_name="Malicious Account",
            account_type="checking",
        )
        db_session.add(account)

        # This should either fail or the insert should be filtered by RLS
        # Depending on RLS policy, this might raise an exception or silently fail
        try:
            await db_session.commit()
        except Exception:
            # RLS policy prevented insert - this is good
            pass

        # Query with correct context - malicious account should not exist
        await set_tenant_context(db_session, str(second_tenant.id), str(test_user.id))
        result = await db_session.execute(
            select(FinancialAccount).where(FinancialAccount.account_name == "Malicious Account")
        )
        accounts = result.scalars().all()
        assert len(accounts) == 0

    async def test_rls_session_functions(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test that RLS session functions work correctly."""

        # Set context
        await set_tenant_context(db_session, str(test_tenant.id), str(test_user.id))

        # Verify context is set correctly
        result = await db_session.execute(
            text("SELECT current_setting('app.current_tenant_id', true)")
        )
        tenant_id = result.scalar()
        assert tenant_id == str(test_tenant.id)

        result = await db_session.execute(
            text("SELECT current_setting('app.current_user_id', true)")
        )
        user_id = result.scalar()
        assert user_id == str(test_user.id)


@pytest.mark.asyncio
class TestAuditLogIsolation:
    """Tests for audit log isolation via RLS."""

    async def test_audit_logs_are_tenant_isolated(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that audit logs are properly isolated by tenant."""
        from app.models.user import AuditLog

        # Create audit logs for both tenants
        log1 = AuditLog(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            action="create",
            resource_type="financial_account",
            status="success",
        )
        log2 = AuditLog(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            action="create",
            resource_type="financial_account",
            status="success",
        )
        db_session.add_all([log1, log2])
        await db_session.commit()

        # Set context for first tenant
        await set_tenant_context(db_session, str(test_tenant.id), str(test_user.id))

        # Query should only return logs from first tenant
        result = await db_session.execute(select(AuditLog))
        logs = result.scalars().all()

        assert len(logs) == 1
        assert logs[0].tenant_id == test_tenant.id


@pytest.mark.asyncio
class TestRLSPerformance:
    """Tests for RLS performance characteristics."""

    async def test_rls_with_many_records(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test RLS performance with large dataset."""

        # Create many accounts across two tenants
        accounts = []
        for i in range(50):
            accounts.append(
                FinancialAccount(
                    tenant_id=test_tenant.id if i % 2 == 0 else second_tenant.id,
                    user_id=test_user.id,
                    account_name=f"Account {i}",
                    account_type="checking",
                )
            )

        db_session.add_all(accounts)
        await db_session.commit()

        # Set context and query
        await set_tenant_context(db_session, str(test_tenant.id), str(test_user.id))
        result = await db_session.execute(select(FinancialAccount))
        filtered_accounts = result.scalars().all()

        # Should only get accounts from first tenant (25 accounts)
        assert len(filtered_accounts) == 25
        assert all(acc.tenant_id == test_tenant.id for acc in filtered_accounts)


@pytest.mark.asyncio
class TestRLSBypass:
    """Tests that verify RLS cannot be bypassed."""

    async def test_cannot_query_without_context(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test that querying without RLS context returns no data or fails."""

        # Create account
        account = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Test Account",
            account_type="checking",
        )
        db_session.add(account)
        await db_session.commit()

        # Try to query WITHOUT setting RLS context
        # This should return no results or raise an error
        result = await db_session.execute(select(FinancialAccount))
        accounts = result.scalars().all()

        # With RLS enabled, should return no results without context
        assert len(accounts) == 0

    async def test_cannot_bypass_rls_with_raw_sql(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test that RLS applies even to raw SQL queries."""

        # Create account
        account = FinancialAccount(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            account_name="Test Account",
            account_type="checking",
        )
        db_session.add(account)
        await db_session.commit()

        # Set context for a DIFFERENT tenant
        fake_tenant_id = "00000000-0000-0000-0000-000000000000"
        await set_tenant_context(db_session, fake_tenant_id, str(test_user.id))

        # Raw SQL query should still be filtered by RLS
        result = await db_session.execute(
            text("SELECT * FROM financial_accounts")
        )
        accounts = result.fetchall()

        # Should return no results due to RLS
        assert len(accounts) == 0
