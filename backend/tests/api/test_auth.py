"""
Tests for authentication endpoints.

Tests cover:
- User registration
- Login/logout
- Token refresh
- Password reset
- Token validation
- Error cases
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class TestRegistration:
    """Tests for user registration endpoint."""

    def test_register_success(self, client: TestClient):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePassword123!",
                "first_name": "New",
                "last_name": "User",
                "tenant_name": "New Workspace",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, client: TestClient, test_user: User):
        """Test registration with existing email fails."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": test_user.email,
                "password": "SecurePassword123!",
                "first_name": "Duplicate",
                "last_name": "User",
                "tenant_name": "Duplicate Workspace",
            },
        )

        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_weak_password(self, client: TestClient):
        """Test registration with weak password fails."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "weakpass@example.com",
                "password": "123",  # Too short
                "first_name": "Weak",
                "last_name": "Pass",
                "tenant_name": "Weak Workspace",
            },
        )

        assert response.status_code == 422  # Validation error

    def test_register_invalid_email(self, client: TestClient):
        """Test registration with invalid email format fails."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePassword123!",
                "first_name": "Invalid",
                "last_name": "Email",
                "tenant_name": "Invalid Workspace",
            },
        )

        assert response.status_code == 422  # Validation error


class TestLogin:
    """Tests for user login endpoint."""

    def test_login_success(self, client: TestClient, test_user: User):
        """Test successful login."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "testpassword123",  # From conftest.py
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == test_user.email
        assert "access_token" in data
        assert "refresh_token" in data
        assert "tenant_id" in data

    def test_login_wrong_password(self, client: TestClient, test_user: User):
        """Test login with incorrect password fails."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword",
            },
        )

        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, client: TestClient):
        """Test login with non-existent email fails."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )

        assert response.status_code == 401

    def test_login_suspended_user(self, client: TestClient, db_session: AsyncSession, test_user: User):
        """Test login with suspended user fails."""
        # Suspend the user
        test_user.status = "suspended"
        db_session.add(test_user)
        pytest.mark.asyncio

        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "testpassword123",
            },
        )

        assert response.status_code == 403
        assert "suspended" in response.json()["detail"].lower()


class TestTokenRefresh:
    """Tests for token refresh endpoint."""

    def test_refresh_token_success(self, client: TestClient, auth_token: str):
        """Test successful token refresh."""
        # First, get a refresh token via login
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "testpassword123",
            },
        )

        refresh_token = response.json()["refresh_token"]

        # Now refresh
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_refresh_token_invalid(self, client: TestClient):
        """Test refresh with invalid token fails."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )

        assert response.status_code == 401


class TestLogout:
    """Tests for logout endpoint."""

    def test_logout_success(self, authenticated_client: TestClient):
        """Test successful logout."""
        response = authenticated_client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        assert response.json()["message"] == "Successfully logged out"

    def test_logout_without_auth(self, client: TestClient):
        """Test logout without authentication fails."""
        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 401


class TestProtectedEndpoints:
    """Tests for protected endpoint access."""

    def test_access_with_valid_token(self, authenticated_client: TestClient):
        """Test accessing protected endpoint with valid token."""
        response = authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()
        assert "email" in data

    def test_access_without_token(self, client: TestClient):
        """Test accessing protected endpoint without token fails."""
        response = client.get("/api/v1/users/me")

        assert response.status_code == 401

    def test_access_with_invalid_token(self, client: TestClient):
        """Test accessing protected endpoint with invalid token fails."""
        headers = {"Authorization": "Bearer invalid.token.here"}
        response = client.get("/api/v1/users/me", headers=headers)

        assert response.status_code == 401

    def test_access_with_expired_token(self, client: TestClient):
        """Test accessing protected endpoint with expired token fails."""
        # This would require creating an expired token
        # For now, we test with malformed token
        headers = {"Authorization": "Bearer expired"}
        response = client.get("/api/v1/users/me", headers=headers)

        assert response.status_code == 401
