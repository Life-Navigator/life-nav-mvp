"""
Tests for relationships domain endpoints.

Tests cover:
- Contact CRUD operations
- Contact interaction CRUD operations
- Multi-tenant isolation
- Permission enforcement
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.relationships import Contact, ContactInteraction
from app.models.user import User, Tenant


@pytest.mark.asyncio
@pytest.mark.api
class TestContacts:
    """Tests for contact endpoints."""

    def test_list_contacts_empty(self, authenticated_client: TestClient):
        """Test listing contacts when none exist."""
        response = authenticated_client.get("/api/v1/relationships/contacts")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_contact(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new contact."""
        response = authenticated_client.post(
            "/api/v1/relationships/contacts",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.doe@example.com",
                "phone_number": "+1-555-0123",
                "relationship_type": "friend",
                "company": "Acme Corp",
                "job_title": "Software Engineer",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "Jane"
        assert data["last_name"] == "Doe"
        assert data["email"] == "jane.doe@example.com"
        assert data["relationship_type"] == "friend"
        assert "id" in data

    async def test_get_contact(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific contact."""
        # Create contact
        contact = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="John",
            last_name="Smith",
            email="john.smith@example.com",
            relationship_type="colleague",
        )
        db_session_with_rls.add(contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact)

        # Get contact
        response = authenticated_client.get(
            f"/api/v1/relationships/contacts/{contact.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(contact.id)
        assert data["first_name"] == "John"
        assert data["last_name"] == "Smith"

    async def test_update_contact(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a contact."""
        # Create contact
        contact = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="Alice",
            last_name="Johnson",
            email="alice.j@example.com",
            relationship_type="friend",
        )
        db_session_with_rls.add(contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact)

        # Update contact
        response = authenticated_client.patch(
            f"/api/v1/relationships/contacts/{contact.id}",
            json={
                "phone_number": "+1-555-9999",
                "company": "New Company",
                "job_title": "Senior Engineer",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["phone_number"] == "+1-555-9999"
        assert data["company"] == "New Company"

    async def test_delete_contact(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a contact."""
        # Create contact
        contact = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="Old",
            last_name="Contact",
            email="old@example.com",
            relationship_type="acquaintance",
        )
        db_session_with_rls.add(contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact)

        # Delete contact
        response = authenticated_client.delete(
            f"/api/v1/relationships/contacts/{contact.id}"
        )

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(
            f"/api/v1/relationships/contacts/{contact.id}"
        )
        assert response.status_code == 404

    def test_get_nonexistent_contact(self, authenticated_client: TestClient):
        """Test getting a contact that doesn't exist."""
        from uuid import uuid4

        fake_id = uuid4()
        response = authenticated_client.get(f"/api/v1/relationships/contacts/{fake_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_list_contacts_with_pagination(
        self,
        authenticated_client: TestClient,
    ):
        """Test listing contacts with pagination."""
        # Create multiple contacts
        for i in range(5):
            authenticated_client.post(
                "/api/v1/relationships/contacts",
                json={
                    "first_name": f"Contact{i}",
                    "last_name": "Test",
                    "email": f"contact{i}@test.com",
                    "relationship_type": "friend",
                },
            )

        # Test pagination
        response = authenticated_client.get(
            "/api/v1/relationships/contacts?skip=0&limit=3"
        )
        assert response.status_code == 200
        assert len(response.json()) == 3

        response = authenticated_client.get(
            "/api/v1/relationships/contacts?skip=3&limit=3"
        )
        assert response.status_code == 200
        assert len(response.json()) == 2


@pytest.mark.asyncio
@pytest.mark.api
class TestContactInteractions:
    """Tests for contact interaction endpoints."""

    def test_list_interactions_empty(self, authenticated_client: TestClient):
        """Test listing interactions when none exist."""
        response = authenticated_client.get("/api/v1/relationships/interactions")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_interaction(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new interaction."""
        # Create contact first
        contact = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="Bob",
            last_name="Wilson",
            email="bob@example.com",
            relationship_type="colleague",
        )
        db_session_with_rls.add(contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact)

        # Create interaction
        response = authenticated_client.post(
            "/api/v1/relationships/interactions",
            json={
                "contact_id": str(contact.id),
                "interaction_type": "meeting",
                "interaction_date": "2025-02-01T14:00:00",
                "title": "Project discussion",
                "notes": "Discussed Q1 roadmap and priorities",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["contact_id"] == str(contact.id)
        assert data["interaction_type"] == "meeting"
        assert data["title"] == "Project discussion"
        assert "id" in data

    async def test_get_interaction(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific interaction."""
        # Create contact and interaction
        contact = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="Carol",
            last_name="Brown",
            email="carol@example.com",
            relationship_type="mentor",
        )
        db_session_with_rls.add(contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact)

        interaction = ContactInteraction(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            contact_id=contact.id,
            interaction_type="call",
            interaction_date=datetime(2025, 1, 15, 10, 0, 0),
            title="Mentorship session",
        )
        db_session_with_rls.add(interaction)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(interaction)

        # Get interaction
        response = authenticated_client.get(
            f"/api/v1/relationships/interactions/{interaction.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(interaction.id)
        assert data["interaction_type"] == "call"
        assert data["title"] == "Mentorship session"

    async def test_update_interaction(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating an interaction."""
        # Create contact and interaction
        contact = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="David",
            last_name="Lee",
            email="david@example.com",
            relationship_type="friend",
        )
        db_session_with_rls.add(contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact)

        interaction = ContactInteraction(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            contact_id=contact.id,
            interaction_type="email",
            interaction_date=datetime(2025, 1, 20, 9, 0, 0),
            title="Quick check-in",
        )
        db_session_with_rls.add(interaction)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(interaction)

        # Update interaction
        response = authenticated_client.patch(
            f"/api/v1/relationships/interactions/{interaction.id}",
            json={
                "notes": "Discussed weekend plans and upcoming events",
                "follow_up_required": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "upcoming events" in data["notes"]
        assert data["follow_up_required"] is True

    async def test_delete_interaction(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting an interaction."""
        # Create contact and interaction
        contact = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="Emma",
            last_name="Davis",
            email="emma@example.com",
            relationship_type="acquaintance",
        )
        db_session_with_rls.add(contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact)

        interaction = ContactInteraction(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            contact_id=contact.id,
            interaction_type="social",
            interaction_date=datetime(2020, 6, 1, 18, 0, 0),
            title="Old interaction",
        )
        db_session_with_rls.add(interaction)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(interaction)

        # Delete interaction
        response = authenticated_client.delete(
            f"/api/v1/relationships/interactions/{interaction.id}"
        )

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(
            f"/api/v1/relationships/interactions/{interaction.id}"
        )
        assert response.status_code == 404

    async def test_list_interactions_by_contact(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test filtering interactions by contact."""
        # Create two contacts
        contact1 = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="Frank",
            last_name="Miller",
            email="frank@example.com",
            relationship_type="colleague",
        )
        contact2 = Contact(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            first_name="Grace",
            last_name="Taylor",
            email="grace@example.com",
            relationship_type="friend",
        )
        db_session_with_rls.add_all([contact1, contact2])
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(contact1)
        await db_session_with_rls.refresh(contact2)

        # Create interactions
        interaction1 = ContactInteraction(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            contact_id=contact1.id,
            interaction_type="meeting",
            interaction_date=datetime(2025, 2, 1, 14, 0, 0),
            title="Work meeting",
        )
        interaction2 = ContactInteraction(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            contact_id=contact2.id,
            interaction_type="social",
            interaction_date=datetime(2025, 2, 2, 19, 0, 0),
            title="Dinner",
        )
        db_session_with_rls.add_all([interaction1, interaction2])
        await db_session_with_rls.commit()

        # Filter by contact1
        response = authenticated_client.get(
            f"/api/v1/relationships/interactions?contact_id={contact1.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["contact_id"] == str(contact1.id)


@pytest.mark.asyncio
@pytest.mark.api
class TestRelationshipsTenantIsolation:
    """Tests for multi-tenant isolation in relationships endpoints."""

    async def test_contact_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see contacts from their tenant."""
        # Create contact in second tenant
        other_contact = Contact(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            first_name="Secret",
            last_name="Contact",
            email="secret@example.com",
            relationship_type="colleague",
        )
        db_session_with_rls.add(other_contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_contact)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/relationships/contacts")

        assert response.status_code == 200
        contacts = response.json()
        # Should not see the contact from other tenant
        assert len(contacts) == 0

    async def test_interaction_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see interactions from their tenant."""
        # Create contact and interaction in second tenant
        other_contact = Contact(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            first_name="Other",
            last_name="Person",
            email="other@example.com",
            relationship_type="friend",
        )
        db_session_with_rls.add(other_contact)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_contact)

        other_interaction = ContactInteraction(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            contact_id=other_contact.id,
            interaction_type="meeting",
            interaction_date=datetime(2025, 1, 1, 10, 0, 0),
            title="Secret meeting",
        )
        db_session_with_rls.add(other_interaction)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_interaction)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/relationships/interactions")

        assert response.status_code == 200
        interactions = response.json()
        # Should not see the interaction from other tenant
        assert len(interactions) == 0
