/**
 * Life Navigator - Storage Service
 *
 * Elite-level secure storage service using react-native-keychain
 * for sensitive data (tokens) and MMKV for general app data
 */

import * as Keychain from 'react-native-keychain';
import { MMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '../utils/constants';

// Initialize MMKV storage
const storage = new MMKV();

/**
 * Secure Token Storage (using Keychain)
 */

export const saveAuthToken = async (token: string): Promise<boolean> => {
  try {
    await Keychain.setGenericPassword('auth_token', token, {
      service: 'com.lifenavigator.app',
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
    return true;
  } catch (error) {
    console.error('[StorageService] Failed to save auth token:', error);
    return false;
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: 'com.lifenavigator.app',
    });

    if (credentials) {
      return credentials.password;
    }
    return null;
  } catch (error) {
    console.error('[StorageService] Failed to get auth token:', error);
    return null;
  }
};

export const saveRefreshToken = async (token: string): Promise<boolean> => {
  try {
    await Keychain.setGenericPassword('refresh_token', token, {
      service: 'com.lifenavigator.app.refresh',
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
    return true;
  } catch (error) {
    console.error('[StorageService] Failed to save refresh token:', error);
    return false;
  }
};

export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: 'com.lifenavigator.app.refresh',
    });

    if (credentials) {
      return credentials.password;
    }
    return null;
  } catch (error) {
    console.error('[StorageService] Failed to get refresh token:', error);
    return null;
  }
};

export const clearAuthTokens = async (): Promise<boolean> => {
  try {
    await Keychain.resetGenericPassword({
      service: 'com.lifenavigator.app',
    });
    await Keychain.resetGenericPassword({
      service: 'com.lifenavigator.app.refresh',
    });
    return true;
  } catch (error) {
    console.error('[StorageService] Failed to clear auth tokens:', error);
    return false;
  }
};

export const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    // Call refresh token API endpoint
    const response = await fetch(`${process.env.API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.token) {
      await saveAuthToken(data.token);
      return data.token;
    }

    return null;
  } catch (error) {
    console.error('[StorageService] Failed to refresh auth token:', error);
    return null;
  }
};

/**
 * General Storage (using MMKV)
 */

export const setItem = (key: string, value: string): void => {
  try {
    storage.set(key, value);
  } catch (error) {
    console.error(`[StorageService] Failed to set item ${key}:`, error);
  }
};

export const getItem = (key: string): string | undefined => {
  try {
    return storage.getString(key);
  } catch (error) {
    console.error(`[StorageService] Failed to get item ${key}:`, error);
    return undefined;
  }
};

export const setObject = <T>(key: string, value: T): void => {
  try {
    storage.set(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[StorageService] Failed to set object ${key}:`, error);
  }
};

export const getObject = <T>(key: string): T | null => {
  try {
    const value = storage.getString(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`[StorageService] Failed to get object ${key}:`, error);
    return null;
  }
};

export const setBoolean = (key: string, value: boolean): void => {
  try {
    storage.set(key, value);
  } catch (error) {
    console.error(`[StorageService] Failed to set boolean ${key}:`, error);
  }
};

export const getBoolean = (key: string): boolean => {
  try {
    return storage.getBoolean(key) ?? false;
  } catch (error) {
    console.error(`[StorageService] Failed to get boolean ${key}:`, error);
    return false;
  }
};

export const setNumber = (key: string, value: number): void => {
  try {
    storage.set(key, value);
  } catch (error) {
    console.error(`[StorageService] Failed to set number ${key}:`, error);
  }
};

export const getNumber = (key: string): number | undefined => {
  try {
    return storage.getNumber(key);
  } catch (error) {
    console.error(`[StorageService] Failed to get number ${key}:`, error);
    return undefined;
  }
};

export const removeItem = (key: string): void => {
  try {
    storage.delete(key);
  } catch (error) {
    console.error(`[StorageService] Failed to remove item ${key}:`, error);
  }
};

export const clearAll = (): void => {
  try {
    storage.clearAll();
  } catch (error) {
    console.error('[StorageService] Failed to clear all storage:', error);
  }
};

/**
 * App-specific storage helpers
 */

export const saveUserData = (user: any): void => {
  setObject(STORAGE_KEYS.USER_DATA, user);
};

export const getUserData = (): any => {
  return getObject(STORAGE_KEYS.USER_DATA);
};

export const clearUserData = (): void => {
  removeItem(STORAGE_KEYS.USER_DATA);
};

export const setThemeMode = (mode: 'light' | 'dark' | 'auto'): void => {
  setItem(STORAGE_KEYS.THEME_MODE, mode);
};

export const getThemeMode = (): 'light' | 'dark' | 'auto' => {
  return (getItem(STORAGE_KEYS.THEME_MODE) as 'light' | 'dark' | 'auto') || 'auto';
};

export const setBiometricEnabled = (enabled: boolean): void => {
  setBoolean(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled);
};

export const isBiometricEnabled = (): boolean => {
  return getBoolean(STORAGE_KEYS.BIOMETRIC_ENABLED);
};

export const setOnboardingCompleted = (completed: boolean): void => {
  setBoolean(STORAGE_KEYS.ONBOARDING_COMPLETED, completed);
};

export const isOnboardingCompleted = (): boolean => {
  return getBoolean(STORAGE_KEYS.ONBOARDING_COMPLETED);
};

export default {
  // Secure storage
  saveAuthToken,
  getAuthToken,
  saveRefreshToken,
  getRefreshToken,
  clearAuthTokens,
  refreshAuthToken,

  // General storage
  setItem,
  getItem,
  setObject,
  getObject,
  setBoolean,
  getBoolean,
  setNumber,
  getNumber,
  removeItem,
  clearAll,

  // App-specific
  saveUserData,
  getUserData,
  clearUserData,
  setThemeMode,
  getThemeMode,
  setBiometricEnabled,
  isBiometricEnabled,
  setOnboardingCompleted,
  isOnboardingCompleted,
};
