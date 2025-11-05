/**
 * Life Navigator - Authentication Store
 *
 * Elite-level state management using Zustand
 * Handles authentication state, login, logout, and session management
 */

import { create } from 'zustand';
import { User, LoginCredentials, RegisterData } from '../types';
import { api } from '../api/client';
import {
  saveAuthToken,
  saveRefreshToken,
  getAuthToken,
  getUserData,
  saveUserData,
  clearAuthTokens,
  clearUserData,
} from '../services/StorageService';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  verifyMFA: (code: string) => Promise<void>;
  initialize: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial State
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,

  /**
   * Initialize authentication state from storage
   */
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      const token = await getAuthToken();
      const userData = getUserData();

      if (token && userData) {
        // Verify token is still valid
        try {
          const response = await api.get<{ user: User }>('/auth/verify');

          set({
            user: response.user,
            isAuthenticated: true,
            isInitialized: true,
            isLoading: false,
          });
        } catch (error) {
          // Token is invalid, clear everything
          await clearAuthTokens();
          clearUserData();

          set({
            user: null,
            isAuthenticated: false,
            isInitialized: true,
            isLoading: false,
          });
        }
      } else {
        set({
          isInitialized: true,
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('[AuthStore] Initialize error:', error);

      set({
        error: error.message || 'Failed to initialize authentication',
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  /**
   * Login with email and password
   */
  login: async (credentials: LoginCredentials) => {
    try {
      set({ isLoading: true, error: null });

      const response = await api.post<{
        user: User;
        token: string;
        refreshToken: string;
        requireMFA?: boolean;
      }>('/auth/login', credentials);

      // If MFA is required, don't complete login yet
      if (response.requireMFA) {
        set({
          isLoading: false,
          error: null,
        });
        return;
      }

      // Save tokens
      await saveAuthToken(response.token);
      await saveRefreshToken(response.refreshToken);
      saveUserData(response.user);

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('[AuthStore] Login error:', error);

      set({
        error: error.message || 'Login failed',
        isLoading: false,
      });

      throw error;
    }
  },

  /**
   * Register new user
   */
  register: async (data: RegisterData) => {
    try {
      set({ isLoading: true, error: null });

      const response = await api.post<{
        user: User;
        token: string;
        refreshToken: string;
      }>('/auth/register', data);

      // Save tokens
      await saveAuthToken(response.token);
      await saveRefreshToken(response.refreshToken);
      saveUserData(response.user);

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('[AuthStore] Register error:', error);

      set({
        error: error.message || 'Registration failed',
        isLoading: false,
      });

      throw error;
    }
  },

  /**
   * Verify MFA code
   */
  verifyMFA: async (code: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await api.post<{
        user: User;
        token: string;
        refreshToken: string;
      }>('/auth/mfa/verify', { code });

      // Save tokens
      await saveAuthToken(response.token);
      await saveRefreshToken(response.refreshToken);
      saveUserData(response.user);

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('[AuthStore] MFA verification error:', error);

      set({
        error: error.message || 'MFA verification failed',
        isLoading: false,
      });

      throw error;
    }
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      set({ isLoading: true });

      // Call logout API
      try {
        await api.post('/auth/logout');
      } catch (error) {
        // Continue with logout even if API call fails
        console.error('[AuthStore] Logout API error:', error);
      }

      // Clear local data
      await clearAuthTokens();
      clearUserData();

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('[AuthStore] Logout error:', error);

      set({
        error: error.message || 'Logout failed',
        isLoading: false,
      });
    }
  },

  /**
   * Update user data
   */
  updateUser: (userData: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updatedUser = { ...currentUser, ...userData };
    saveUserData(updatedUser);

    set({ user: updatedUser });
  },

  /**
   * Clear error
   */
  clearError: () => {
    set({ error: null });
  },
}));

export default useAuthStore;
