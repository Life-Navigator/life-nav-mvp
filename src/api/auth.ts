/**
 * Life Navigator - Authentication API
 *
 * Elite-level authentication API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import { User, LoginCredentials, RegisterData, ApiResponse } from '../types';

/**
 * Login with email and password
 * POST /auth/login
 */
export const login = async (
  credentials: LoginCredentials
): Promise<{
  user: User;
  token: string;
  refreshToken: string;
  requireMFA?: boolean;
}> => {
  return api.post('/auth/login', credentials);
};

/**
 * Register new user
 * POST /auth/register
 */
export const register = async (
  data: RegisterData
): Promise<{
  user: User;
  token: string;
  refreshToken: string;
}> => {
  return api.post('/auth/register', data);
};

/**
 * Verify MFA code
 * POST /auth/mfa/verify
 */
export const verifyMFA = async (
  code: string
): Promise<{
  user: User;
  token: string;
  refreshToken: string;
}> => {
  return api.post('/auth/mfa/verify', { code });
};

/**
 * Verify current token
 * GET /auth/verify
 */
export const verifyToken = async (): Promise<{ user: User }> => {
  return api.get('/auth/verify');
};

/**
 * Logout
 * POST /auth/logout
 */
export const logout = async (): Promise<ApiResponse<null>> => {
  return api.post('/auth/logout');
};

/**
 * Refresh auth token
 * POST /auth/refresh
 */
export const refreshToken = async (
  refreshToken: string
): Promise<{ token: string; refreshToken: string }> => {
  return api.post('/auth/refresh', { refreshToken });
};

/**
 * Request password reset
 * POST /auth/forgot-password
 */
export const forgotPassword = async (
  email: string
): Promise<ApiResponse<{ message: string }>> => {
  return api.post('/auth/forgot-password', { email });
};

/**
 * Reset password with token
 * POST /auth/reset-password
 */
export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<ApiResponse<{ message: string }>> => {
  return api.post('/auth/reset-password', { token, newPassword });
};

export default {
  login,
  register,
  verifyMFA,
  verifyToken,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
};
