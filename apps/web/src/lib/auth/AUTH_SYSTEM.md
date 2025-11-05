# LifeNavigator Authentication System

## System Architecture

```
┌─────────────────────────────────────┐
│           Client Browser             │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│        Next.js Middleware            │
│                                      │
│  ┌─────────────────────────────┐     │
│  │   Route Protection Logic    │     │
│  └─────────────────────────────┘     │
│  ┌─────────────────────────────┐     │
│  │     CSRF Validation         │     │
│  └─────────────────────────────┘     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│           API Routes                 │
│                                      │
│  ┌─────────────────────────────┐     │
│  │    withAuth Middleware      │     │
│  │                             │     │
│  │ ┌─────────────────────────┐ │     │
│  │ │  Session Validation     │ │     │
│  │ └─────────────────────────┘ │     │
│  │ ┌─────────────────────────┐ │     │
│  │ │  JWT Verification       │ │     │
│  │ └─────────────────────────┘ │     │
│  │ ┌─────────────────────────┐ │     │
│  │ │  Role/Permission Check  │ │     │
│  │ └─────────────────────────┘ │     │
│  │ ┌─────────────────────────┐ │     │
│  │ │  Activity Monitoring    │ │     │
│  │ └─────────────────────────┘ │     │
│  └─────────────────────────────┘     │
│                                      │
│  ┌─────────────────────────────┐     │
│  │     Route Handler           │     │
│  └─────────────────────────────┘     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│     Authentication Services          │
│                                      │
│  ┌─────────────────────────────┐     │
│  │   NextAuth Authentication   │     │
│  └─────────────────────────────┘     │
│  ┌─────────────────────────────┐     │
│  │   MFA Verification          │     │
│  └─────────────────────────────┘     │
│  ┌─────────────────────────────┐     │
│  │   Account Lockout           │     │
│  └─────────────────────────────┘     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│          Database                    │
│  ┌─────────────────────────────┐     │
│  │      User Records           │     │
│  └─────────────────────────────┘     │
└─────────────────────────────────────┘
```

## Authentication Flow

1. **Initial Authentication**:
   - User provides credentials (email/password or OAuth)
   - System verifies credentials against database
   - For password auth, bcrypt comparison is used
   - Failed attempts are tracked for lockout
   - MFA is verified if enabled

2. **Session Creation**:
   - JWT token is generated with limited lifespan (8 hours)
   - Token includes user ID, setup status
   - Token is stored in secure, HTTP-only cookie

3. **Request Authentication**:
   - Middleware checks for valid session token
   - JWT token is validated cryptographically
   - User data is retrieved and attached to request

4. **Request Authorization**:
   - Role-based checks performed if required
   - Permission-based checks performed if required
   - Setup completion status is verified
   - Activity patterns are monitored for anomalies

5. **CSRF Protection**:
   - Double-submit cookie pattern used
   - CSRF token included in requests
   - Token validated against secret in cookie

## Security Enhancements

### 1. Session Security
- **Short-lived tokens**: 8-hour expiry instead of 30 days
- **Secure cookies**: HTTP-only, Secure, SameSite flags
- **Activity monitoring**: Pattern analysis to detect session hijacking
- **JWT verification**: Cryptographic validation of tokens

### 2. Authentication Hardening
- **Strong password policy**: 12+ chars with mixed character types
- **MFA implementation**: TOTP-based second factor
- **Account lockout**: Temporary lockout after 5 failed attempts
- **Recovery codes**: Backup access for MFA-enabled accounts

### 3. Authorization Controls
- **Role-based access**: Restrict routes to specific user roles
- **Permission-based access**: Fine-grained control over actions
- **Setup requirement**: Force completion of onboarding
- **Method restrictions**: Limit endpoints to specific HTTP methods

### 4. Attack Prevention
- **CSRF protection**: Double-submit cookie pattern
- **Rate limiting**: Prevent brute force and DoS attempts
- **Error minimization**: Limited exposure of system details
- **Audit logging**: Record security events for investigation

## Implementation Details

### Next.js Middleware
- Protects routes based on authentication status
- Validates CSRF tokens for mutation endpoints
- Redirects based on authentication and setup status

### withAuth Middleware
- Validates user authentication for API routes
- Verifies JWT tokens from Authorization header
- Checks user roles and permissions
- Monitors for suspicious activity patterns

### Route Helpers
- Provides consistent application of security policies
- Simplifies protection of API endpoints
- Ensures proper method restrictions