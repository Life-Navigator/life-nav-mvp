/**
 * Life Navigator - Application Constants
 *
 * Elite-level configuration and constants
 */

export const APP_CONFIG = {
  name: 'Life Navigator',
  tagline: 'Navigate Life, Intelligently',
  version: '1.0.0',
  bundleId: 'com.lifenavigator.app',
} as const;

export const API_CONFIG = {
  baseURL: __DEV__
    ? 'http://localhost:8000/api/v1'
    : 'https://api.lifenavigator.com/api/v1',
  websocketURL: __DEV__
    ? 'ws://localhost:8000'
    : 'wss://api.lifenavigator.com',
  timeout: 30000,
  retryAttempts: 3,
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@ln_auth_token',
  REFRESH_TOKEN: '@ln_refresh_token',
  USER_DATA: '@ln_user_data',
  THEME_MODE: '@ln_theme_mode',
  BIOMETRIC_ENABLED: '@ln_biometric_enabled',
  ONBOARDING_COMPLETED: '@ln_onboarding_completed',
} as const;

export const SESSION_CONFIG = {
  timeout: 8 * 60 * 60 * 1000, // 8 hours
  refreshThreshold: 15 * 60 * 1000, // 15 minutes before expiry
} as const;

export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const;

export const DOMAINS = {
  FINANCE: 'finance',
  HEALTHCARE: 'healthcare',
  CAREER: 'career',
  FAMILY: 'family',
  GOALS: 'goals',
} as const;

export const GOAL_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  AT_RISK: 'at_risk',
  COMPLETED: 'completed',
} as const;

export const GOAL_CATEGORIES = {
  FINANCIAL: 'financial',
  HEALTH: 'health',
  CAREER: 'career',
  FAMILY: 'family',
  PERSONAL: 'personal',
} as const;

export const NOTIFICATION_CHANNELS = {
  MEDICATIONS: 'medications',
  APPOINTMENTS: 'appointments',
  BUDGETS: 'budgets',
  GOALS: 'goals',
  AI_INSIGHTS: 'ai_insights',
} as const;

export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
} as const;

export default APP_CONFIG;
