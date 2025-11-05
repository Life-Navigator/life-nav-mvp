"""
Authentication Middleware
JWT validation and user context injection
"""

from typing import Optional, Callable
from fastapi import Request, Response, HTTPException, status
from jose import JWTError, jwt
import structlog

from app.core.config import settings

logger = structlog.get_logger()

class AuthMiddleware:
    """
    Authentication middleware for JWT validation
    """
    
    # Paths that don't require authentication
    PUBLIC_PATHS = [
        "/",
        "/health",
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/market/indices",  # Allow public market data
    ]
    
    # Paths that require specific permissions
    PROTECTED_PATHS = {
        "/api/v1/admin": ["admin"],
        "/api/v1/analytics": ["admin", "analyst"],
    }
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        # Skip auth for public paths
        if self._is_public_path(request.url.path):
            return await call_next(request)
        
        # Extract token from header
        token = self._extract_token(request)
        
        if not token:
            logger.warning(
                "missing_auth_token",
                path=request.url.path,
                client=request.client.host if request.client else None
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            # Decode and validate token
            payload = self._decode_token(token)
            
            # Check token type
            if payload.get("type") != "access":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type"
                )
            
            # Check expiration (handled by jwt.decode)
            
            # Extract user information
            user_id = payload.get("sub")
            user_email = payload.get("email")
            user_roles = payload.get("roles", [])
            user_tier = payload.get("tier", "free")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload"
                )
            
            # Check path-specific permissions
            required_roles = self._get_required_roles(request.url.path)
            if required_roles and not any(role in user_roles for role in required_roles):
                logger.warning(
                    "insufficient_permissions",
                    user_id=user_id,
                    path=request.url.path,
                    user_roles=user_roles,
                    required_roles=required_roles
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            
            # Store user info in request state for downstream use
            request.state.user_id = user_id
            request.state.user_email = user_email
            request.state.user_roles = user_roles
            request.state.user_tier = user_tier
            request.state.authenticated = True
            
            # Log successful authentication
            logger.info(
                "request_authenticated",
                user_id=user_id,
                path=request.url.path
            )
            
            # Process request
            response = await call_next(request)
            
            # Add user context to response headers (optional)
            response.headers["X-User-ID"] = user_id
            
            return response
            
        except HTTPException:
            raise
        except JWTError as e:
            logger.error(
                "jwt_validation_failed",
                error=str(e),
                path=request.url.path
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            logger.error(
                "auth_middleware_error",
                error=str(e),
                path=request.url.path
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication error"
            )
    
    def _is_public_path(self, path: str) -> bool:
        """Check if path is public"""
        return any(path.startswith(public_path) for public_path in self.PUBLIC_PATHS)
    
    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from request"""
        # Check Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]
        
        # Check cookie (for web apps)
        token_cookie = request.cookies.get("access_token")
        if token_cookie:
            return token_cookie
        
        # Check query parameter (for WebSocket connections)
        token_param = request.query_params.get("token")
        if token_param:
            return token_param
        
        return None
    
    def _decode_token(self, token: str) -> dict:
        """Decode and validate JWT token"""
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
    
    def _get_required_roles(self, path: str) -> Optional[list]:
        """Get required roles for a path"""
        for protected_path, roles in self.PROTECTED_PATHS.items():
            if path.startswith(protected_path):
                return roles
        return None


class APIKeyMiddleware:
    """
    Alternative authentication using API keys
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        # Check for API key
        api_key = request.headers.get("X-API-Key")
        
        if api_key:
            # Validate API key (would check against database)
            if self._validate_api_key(api_key):
                # Set user context from API key
                request.state.api_key = api_key
                request.state.authenticated = True
                
                logger.info(
                    "api_key_authenticated",
                    api_key=api_key[:8] + "...",  # Log partial key
                    path=request.url.path
                )
        
        return await call_next(request)
    
    def _validate_api_key(self, api_key: str) -> bool:
        """
        Validate API key against database
        This is a placeholder - implement actual validation
        """
        # TODO: Check API key in database
        # TODO: Check rate limits for API key
        # TODO: Check permissions for API key
        
        # For now, just check format
        return len(api_key) == 32 and api_key.isalnum()