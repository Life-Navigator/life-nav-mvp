"""
CSRF Protection Tests
===========================================================================
Tests for CSRF middleware and token validation.

Coverage:
- Token generation and validation
- Double-submit cookie pattern
- HMAC signature verification
- Middleware enforcement
- Safe methods exempt
- Path exemptions

Run:
    pytest tests/test_csrf.py -v
"""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from fastapi.responses import JSONResponse

from app.middleware.csrf import (
    CSRFMiddleware,
    generate_csrf_token,
    generate_csrf_token_with_signature,
    verify_csrf_token,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
)


# ===========================================================================
# Test App Setup
# ===========================================================================

@pytest.fixture
def test_app():
    """Create test FastAPI app with CSRF middleware."""
    app = FastAPI()

    # Add CSRF middleware
    app.add_middleware(
        CSRFMiddleware,
        secret_key="test-secret-key-minimum-32-characters",
        cookie_secure=False,  # Disable for testing
        cookie_httponly=True,
        cookie_samesite='lax',
        exempt_paths={"/api/webhook"}
    )

    # Test endpoints
    @app.get("/api/test")
    async def get_test():
        return {"message": "GET request - no CSRF required"}

    @app.post("/api/test")
    async def post_test():
        return {"message": "POST request - CSRF required"}

    @app.post("/api/webhook")
    async def webhook():
        return {"message": "Webhook - exempt from CSRF"}

    @app.get("/api/csrf-token")
    async def get_csrf_token(request: Request):
        """Generate new CSRF token."""
        from app.middleware.csrf import generate_csrf_token_with_signature

        session_id = "test-session-123"
        token = generate_csrf_token_with_signature(
            "test-secret-key-minimum-32-characters",
            session_id
        )

        response = JSONResponse({"csrf_token": token})
        response.set_cookie(
            key=CSRF_COOKIE_NAME,
            value=token,
            httponly=True,
            samesite='lax'
        )
        return response

    return app


@pytest.fixture
def client(test_app):
    """Create test client."""
    return TestClient(test_app)


# ===========================================================================
# Token Generation Tests
# ===========================================================================

class TestTokenGeneration:
    """Test CSRF token generation."""

    def test_generate_csrf_token_length(self):
        """Generated token should be 64 hex characters."""
        token = generate_csrf_token()
        assert len(token) == 64
        assert all(c in '0123456789abcdef' for c in token)

    def test_generate_csrf_token_uniqueness(self):
        """Each generated token should be unique."""
        tokens = [generate_csrf_token() for _ in range(100)]
        assert len(set(tokens)) == 100

    def test_generate_csrf_token_with_signature_format(self):
        """Token with signature should have correct format: token:signature."""
        secret_key = "test-secret-key"
        session_id = "test-session-123"

        token = generate_csrf_token_with_signature(secret_key, session_id)

        # Should be token:signature
        parts = token.split(':')
        assert len(parts) == 2
        assert len(parts[0]) == 64  # Token
        assert len(parts[1]) == 64  # HMAC SHA256 signature


# ===========================================================================
# Token Validation Tests
# ===========================================================================

class TestTokenValidation:
    """Test CSRF token validation."""

    def test_verify_valid_token(self):
        """Valid token should pass verification."""
        secret_key = "test-secret-key-minimum-32-characters"
        session_id = "test-session-123"

        token = generate_csrf_token_with_signature(secret_key, session_id)

        # Same token in cookie and submission
        assert verify_csrf_token(token, token, secret_key, session_id)

    def test_verify_token_mismatch(self):
        """Mismatched tokens should fail verification."""
        secret_key = "test-secret-key-minimum-32-characters"
        session_id = "test-session-123"

        token1 = generate_csrf_token_with_signature(secret_key, session_id)
        token2 = generate_csrf_token_with_signature(secret_key, session_id)

        # Different tokens
        assert not verify_csrf_token(token1, token2, secret_key, session_id)

    def test_verify_token_invalid_signature(self):
        """Token with invalid signature should fail."""
        secret_key = "test-secret-key-minimum-32-characters"
        session_id = "test-session-123"

        token = generate_csrf_token_with_signature(secret_key, session_id)

        # Tamper with token (change signature)
        token_part, _ = token.split(':')
        tampered_token = f"{token_part}:{'0' * 64}"

        assert not verify_csrf_token(
            tampered_token,
            tampered_token,
            secret_key,
            session_id
        )

    def test_verify_token_wrong_session(self):
        """Token for different session should fail."""
        secret_key = "test-secret-key-minimum-32-characters"

        token = generate_csrf_token_with_signature(secret_key, "session-1")

        # Verify with different session ID
        assert not verify_csrf_token(token, token, secret_key, "session-2")

    def test_verify_token_invalid_format(self):
        """Token without signature should fail."""
        secret_key = "test-secret-key-minimum-32-characters"
        session_id = "test-session-123"

        # Token without ':' separator
        invalid_token = generate_csrf_token()

        assert not verify_csrf_token(
            invalid_token,
            invalid_token,
            secret_key,
            session_id
        )


# ===========================================================================
# Middleware Tests
# ===========================================================================

class TestCSRFMiddleware:
    """Test CSRF middleware enforcement."""

    def test_get_request_no_csrf_required(self, client):
        """GET requests should not require CSRF token."""
        response = client.get("/api/test")
        assert response.status_code == 200
        assert response.json() == {"message": "GET request - no CSRF required"}

    def test_post_without_csrf_blocked(self, client):
        """POST without CSRF token should be blocked."""
        response = client.post("/api/test")
        assert response.status_code == 403
        assert "CSRF" in response.json()["detail"]

    def test_post_with_valid_csrf_allowed(self, client):
        """POST with valid CSRF token should succeed."""
        # Step 1: Get CSRF token
        token_response = client.get("/api/csrf-token")
        assert token_response.status_code == 200

        csrf_token = token_response.json()["csrf_token"]
        csrf_cookie = token_response.cookies.get(CSRF_COOKIE_NAME)

        # Step 2: Make POST with token
        response = client.post(
            "/api/test",
            headers={CSRF_HEADER_NAME: csrf_token},
            cookies={CSRF_COOKIE_NAME: csrf_cookie}
        )

        assert response.status_code == 200
        assert response.json() == {"message": "POST request - CSRF required"}

    def test_post_with_mismatched_tokens_blocked(self, client):
        """POST with mismatched cookie/header tokens should be blocked."""
        # Get two different tokens
        token1_response = client.get("/api/csrf-token")
        token2_response = client.get("/api/csrf-token")

        token1 = token1_response.json()["csrf_token"]
        cookie2 = token2_response.cookies.get(CSRF_COOKIE_NAME)

        # Use token1 in header, token2 in cookie (mismatch)
        response = client.post(
            "/api/test",
            headers={CSRF_HEADER_NAME: token1},
            cookies={CSRF_COOKIE_NAME: cookie2}
        )

        assert response.status_code == 403
        assert "CSRF" in response.json()["detail"]

    def test_exempt_path_no_csrf_required(self, client):
        """Exempt paths should not require CSRF token."""
        response = client.post("/api/webhook")
        assert response.status_code == 200
        assert response.json() == {"message": "Webhook - exempt from CSRF"}

    def test_options_request_no_csrf_required(self, client):
        """OPTIONS requests (CORS preflight) should not require CSRF."""
        response = client.options("/api/test")
        # OPTIONS should pass through (may return 405 Method Not Allowed)
        # but should NOT be blocked by CSRF
        assert response.status_code != 403

    def test_head_request_no_csrf_required(self, client):
        """HEAD requests should not require CSRF token."""
        response = client.head("/api/test")
        # HEAD should not be blocked by CSRF
        assert response.status_code != 403


# ===========================================================================
# Integration Tests
# ===========================================================================

class TestCSRFIntegration:
    """Integration tests for CSRF protection."""

    def test_complete_workflow(self, client):
        """Test complete CSRF workflow: get token → use token → verify."""
        # Step 1: Get CSRF token
        token_response = client.get("/api/csrf-token")
        assert token_response.status_code == 200

        csrf_token = token_response.json()["csrf_token"]
        csrf_cookie = token_response.cookies.get(CSRF_COOKIE_NAME)

        assert csrf_token is not None
        assert csrf_cookie is not None
        assert ':' in csrf_token  # Has signature

        # Step 2: Use token in POST request
        post_response = client.post(
            "/api/test",
            headers={CSRF_HEADER_NAME: csrf_token},
            cookies={CSRF_COOKIE_NAME: csrf_cookie}
        )

        assert post_response.status_code == 200

        # Step 3: Reuse same token (should still work)
        reuse_response = client.post(
            "/api/test",
            headers={CSRF_HEADER_NAME: csrf_token},
            cookies={CSRF_COOKIE_NAME: csrf_cookie}
        )

        assert reuse_response.status_code == 200

    def test_token_without_cookie_blocked(self, client):
        """Token in header without cookie should be blocked."""
        # Get token
        token_response = client.get("/api/csrf-token")
        csrf_token = token_response.json()["csrf_token"]

        # Submit token WITHOUT cookie
        response = client.post(
            "/api/test",
            headers={CSRF_HEADER_NAME: csrf_token}
            # No cookies
        )

        assert response.status_code == 403

    def test_cookie_without_token_blocked(self, client):
        """Cookie without token in header should be blocked."""
        # Get token
        token_response = client.get("/api/csrf-token")
        csrf_cookie = token_response.cookies.get(CSRF_COOKIE_NAME)

        # Submit cookie WITHOUT header
        response = client.post(
            "/api/test",
            cookies={CSRF_COOKIE_NAME: csrf_cookie}
            # No headers
        )

        assert response.status_code == 403

    def test_multiple_safe_methods(self, client):
        """Multiple safe methods should not require CSRF."""
        safe_methods = ['GET', 'HEAD', 'OPTIONS']

        for method in safe_methods:
            response = client.request(method, "/api/test")
            # Should not be blocked by CSRF (may return other errors)
            assert response.status_code != 403

    def test_multiple_unsafe_methods_require_csrf(self, client):
        """All unsafe methods should require CSRF."""
        unsafe_methods = ['POST', 'PUT', 'DELETE', 'PATCH']

        for method in unsafe_methods:
            response = client.request(method, "/api/test")
            assert response.status_code == 403
            assert "CSRF" in response.json()["detail"]


# ===========================================================================
# Security Tests
# ===========================================================================

class TestCSRFSecurity:
    """Security-focused CSRF tests."""

    def test_timing_attack_resistance(self):
        """Token comparison should be timing-attack resistant."""
        import time

        secret_key = "test-secret-key-minimum-32-characters"
        session_id = "test-session-123"

        token = generate_csrf_token_with_signature(secret_key, session_id)

        # Measure time for correct token
        start = time.time()
        verify_csrf_token(token, token, secret_key, session_id)
        correct_time = time.time() - start

        # Measure time for incorrect token
        wrong_token = generate_csrf_token_with_signature(secret_key, "wrong-session")
        start = time.time()
        verify_csrf_token(token, wrong_token, secret_key, session_id)
        wrong_time = time.time() - start

        # Times should be similar (constant-time comparison)
        time_difference = abs(correct_time - wrong_time)
        assert time_difference < 0.001  # < 1ms difference

    def test_token_replay_attack_prevented(self, client):
        """Captured token should not work with different session."""
        # This is implicitly tested by signature verification
        # Token is bound to session ID via HMAC
        # Replaying token with different session will fail signature check
        pass  # Covered by test_verify_token_wrong_session

    def test_csrf_token_not_logged(self, client, caplog):
        """CSRF tokens should not appear in logs."""
        import logging

        with caplog.at_level(logging.INFO):
            # Get token
            token_response = client.get("/api/csrf-token")
            csrf_token = token_response.json()["csrf_token"]

            # Use token
            csrf_cookie = token_response.cookies.get(CSRF_COOKIE_NAME)
            client.post(
                "/api/test",
                headers={CSRF_HEADER_NAME: csrf_token},
                cookies={CSRF_COOKIE_NAME: csrf_cookie}
            )

        # Check logs don't contain full token
        # (First 8 chars might be ok for debugging, but not full token)
        for record in caplog.records:
            assert csrf_token not in record.message
