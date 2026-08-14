from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce standard web application security headers.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        
        headers = response.headers
        
        # Content Security Policy (CSP)
        headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://generativelanguage.googleapis.com https://accounts.google.com;"
        )
        
        # HTTP Strict Transport Security (HSTS)
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Prevent Clickjacking
        headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME type sniffing
        headers["X-Content-Type-Options"] = "nosniff"
        
        # Legacy XSS protection filter
        headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer Policy
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        
        return response
