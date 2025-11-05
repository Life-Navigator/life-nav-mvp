import { DefaultSession } from 'next-auth';

// User model from Prisma schema
export interface User {
  id: string;
  name?: string | null;
  email: string;
  emailVerified?: Date | null;
  image?: string | null;
  password?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  setupCompleted: boolean;
  accounts?: Account[];
  sessions?: Session[];
}

// Account model from Prisma schema
export interface Account {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
  user: User;
}

// Session model from Prisma schema
export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  user: User;
}

// Augment the built-in types from next-auth
export interface ExtendedSession extends DefaultSession {
  user: {
    id: string;
    email: string;
    setupCompleted: boolean;
  } & DefaultSession['user'];
}

// Credentials for login
export interface LoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
}

// Registration input
export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Auth tokens
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// MFA settings
export interface MfaSettings {
  enabled: boolean;
  verified: boolean;
  secret?: string;
  backupCodes?: string[];
}

// CSRF token response
export interface CsrfTokenResponse {
  csrfToken: string;
}

// JWT with custom claims
export interface JwtPayload {
  id: string;
  email: string;
  name?: string;
  setupCompleted: boolean;
  iat: number;
  exp: number;
}

// Password reset request
export interface PasswordResetRequest {
  email: string;
}

// Password reset confirmation
export interface PasswordResetConfirmation {
  token: string;
  password: string;
  confirmPassword: string;
}

// Auth provider settings
export interface AuthProviderSettings {
  provider: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

// Security audit log entry
export interface SecurityAuditLogEntry {
  id: string;
  userId: string;
  eventType: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  details?: Record<string, any>;
}