"""
Logging Middleware
Comprehensive request/response logging with performance metrics
"""

import time
import json
import uuid
from typing import Callable
from fastapi import Request, Response
from fastapi.routing import APIRoute
import structlog
from datetime import datetime

logger = structlog.get_logger()

class LoggingMiddleware:
    """
    Production-grade logging middleware with structured logging
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID for tracing
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Log request
        await self._log_request(request, request_id)
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate processing time
            process_time = time.time() - start_time
            
            # Log response
            await self._log_response(request, response, process_time, request_id)
            
            # Add headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            
            # Log error
            logger.error(
                "request_failed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                error=str(e),
                error_type=type(e).__name__,
                process_time=process_time
            )
            
            # Re-raise the exception
            raise
    
    async def _log_request(self, request: Request, request_id: str):
        """Log incoming request details"""
        
        # Get request body for POST/PUT/PATCH
        body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body_bytes = await request.body()
                if body_bytes:
                    # Store body for later use by the actual handler
                    request._body = body_bytes
                    
                    # Try to parse as JSON for logging
                    try:
                        body = json.loads(body_bytes)
                        # Mask sensitive fields
                        body = self._mask_sensitive_data(body)
                    except json.JSONDecodeError:
                        body = f"<binary: {len(body_bytes)} bytes>"
            except:
                body = "<could not read body>"
        
        logger.info(
            "request_received",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            query_params=dict(request.query_params),
            headers=self._get_safe_headers(request.headers),
            body=body,
            client_host=request.client.host if request.client else None,
            timestamp=datetime.utcnow().isoformat()
        )
    
    async def _log_response(self, request: Request, response: Response, process_time: float, request_id: str):
        """Log response details"""
        
        # Determine log level based on status code
        if response.status_code >= 500:
            log_level = logger.error
        elif response.status_code >= 400:
            log_level = logger.warning
        else:
            log_level = logger.info
        
        log_level(
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            process_time=process_time,
            process_time_ms=process_time * 1000,
            timestamp=datetime.utcnow().isoformat()
        )
    
    def _mask_sensitive_data(self, data: dict) -> dict:
        """Mask sensitive fields in logged data"""
        if not isinstance(data, dict):
            return data
        
        sensitive_fields = [
            'password', 'token', 'secret', 'api_key', 'apikey',
            'authorization', 'credit_card', 'ssn', 'tax_id',
            'account_number', 'routing_number'
        ]
        
        masked_data = data.copy()
        
        for key in masked_data:
            if any(field in key.lower() for field in sensitive_fields):
                if isinstance(masked_data[key], str):
                    masked_data[key] = "***MASKED***"
                elif isinstance(masked_data[key], dict):
                    masked_data[key] = self._mask_sensitive_data(masked_data[key])
        
        return masked_data
    
    def _get_safe_headers(self, headers: dict) -> dict:
        """Get headers with sensitive values masked"""
        safe_headers = {}
        sensitive_headers = ['authorization', 'cookie', 'x-api-key', 'api-key']
        
        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                safe_headers[key] = "***MASKED***"
            else:
                safe_headers[key] = value
        
        return safe_headers


class LoggingRoute(APIRoute):
    """
    Custom route class for detailed endpoint logging
    """
    
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()
        
        async def custom_route_handler(request: Request) -> Response:
            # Add endpoint-specific logging here if needed
            response = await original_route_handler(request)
            return response
        
        return custom_route_handler