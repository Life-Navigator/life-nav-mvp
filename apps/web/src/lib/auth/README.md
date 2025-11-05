# Authentication & Authorization System

This directory contains the core security implementation for the LifeNavigator application, providing a robust system for authentication, authorization, and session management.

## Key Components

### 1. Session Management (`session.ts`)

This module provides tools for validating and working with user sessions:

- **withAuth Middleware**: A higher-order function that wraps API route handlers to enforce authentication and authorization rules.
- **Activity Tracking**: Monitors user activity patterns to detect potential session hijacking.
- **Authorization Controls**: Supports role-based and permission-based access control.
- **Utility Functions**: Helpers for checking authentication status, roles, and permissions.

### 2. CSRF Protection (`csrf.ts`)

Implements Cross-Site Request Forgery protection using the double-submit cookie pattern:

- **Token Generation**: Creates CSRF tokens for form submissions and API requests.
- **Token Validation**: Verifies that requests include valid CSRF tokens.
- **Cookie Management**: Handles secure cookie storage of CSRF secrets.

### 3. Multi-Factor Authentication (`mfa.ts`)

Provides TOTP-based multi-factor authentication:

- **Secret Generation**: Creates and stores TOTP secrets.
- **Token Verification**: Validates user-submitted TOTP codes.
- **QR Code Generation**: Creates QR codes for easy setup with authenticator apps.
- **Recovery Codes**: Manages backup codes for account recovery.

### 4. Account Lockout (`lockout.ts`)

Prevents brute force attacks with an account lockout mechanism:

- **Failed Attempt Tracking**: Records unsuccessful login attempts.
- **Automatic Lockout**: Temporarily locks accounts after multiple failures.
- **Reset Functions**: Methods to reset failed attempts after successful authentication.

### 5. Route Helpers (`route-helpers.ts`)

Utilities for applying auth middleware consistently across API routes:

- **createSecureHandlers**: Creates secure route handlers with specified auth options.
- **createMethodLimitedEndpoint**: Restricts endpoints to specific HTTP methods.

## Usage Examples

### Securing an API Route

```typescript
// Import the createSecureHandlers utility
import { createSecureHandlers } from '@/lib/auth/route-helpers';

// Define your handler functions
async function getHandler(request: NextRequest) {
  // Access authenticated user from request
  const userId = (request as any).user.id;
  
  // Rest of your handler implementation...
}

// Export secure handlers
export const { GET, POST } = createSecureHandlers(
  { GET: getHandler, POST: postHandler },
  { requireSetupComplete: true }
);
```

### Checking Authentication Status in Server Components

```typescript
import { getAuthenticatedUser } from '@/lib/auth/session';

export default async function AdminPage() {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    redirect('/auth/login');
  }
  
  // Rest of your component...
}
```

## Security Features

1. **JWT Token Validation**: Verifies JWT tokens from Authorization header against session data.
2. **Activity Monitoring**: Tracks user activity patterns to detect suspicious behavior.
3. **Setup Requirement**: Enforces completion of account setup process.
4. **Role-Based Authorization**: Restricts access based on user roles.
5. **Permission-Based Controls**: Fine-grained access control using permission flags.
6. **Method Restrictions**: Limits endpoints to specific HTTP methods.
7. **CSRF Protection**: Prevents cross-site request forgery attacks.
8. **Centralized Security Logic**: Consistent enforcement of security rules.
9. **Detailed Error Handling**: Clear security-related error messages.
10. **Audit Logging**: Comprehensive logging of security events.

## Best Practices

1. **Always use createSecureHandlers** for API routes that require authentication.
2. **Specify required roles and permissions** when access should be restricted.
3. **Set requireSetupComplete: false** for onboarding-related endpoints.
4. **Use direct session validation functions** (isAuthenticated, hasRole, etc.) in server components.
5. **Never bypass the auth middleware** by implementing custom session checks in route handlers.