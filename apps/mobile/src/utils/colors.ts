/**
 * Life Navigator Design System - Colors
 *
 * Elite-level color palette matching web app branding
 * Supports light and dark themes
 */

export const colors = {
  // Primary Colors
  primary: {
    blue: '#2563EB',
    dark: '#1E40AF',
    light: '#3B82F6',
  },

  // Domain Colors
  domains: {
    finance: '#10B981',
    healthcare: '#EF4444',
    career: '#8B5CF6',
    family: '#F59E0B',
  },

  // Neutrals (Light Theme)
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Semantic Colors
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // Backgrounds (Light Theme)
  light: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    border: '#E5E7EB',
  },

  // Backgrounds (Dark Theme)
  dark: {
    primary: '#111827',
    secondary: '#1F2937',
    tertiary: '#374151',
    border: '#4B5563',
  },

  // Text Colors
  text: {
    light: {
      primary: '#111827',
      secondary: '#4B5563',
      tertiary: '#6B7280',
      disabled: '#9CA3AF',
      inverse: '#FFFFFF',
    },
    dark: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
      tertiary: '#9CA3AF',
      disabled: '#6B7280',
      inverse: '#111827',
    },
  },

  // Overlay colors
  overlay: {
    light: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
  },

  // Chart colors
  charts: {
    blue: '#3B82F6',
    green: '#10B981',
    yellow: '#F59E0B',
    red: '#EF4444',
    purple: '#8B5CF6',
    pink: '#EC4899',
    indigo: '#6366F1',
    teal: '#14B8A6',
  },
} as const;

export type ColorTheme = 'light' | 'dark';

/**
 * Get theme-aware colors
 */
export const getThemedColors = (theme: ColorTheme = 'light') => ({
  background: theme === 'light' ? colors.light : colors.dark,
  text: colors.text[theme],
  overlay: colors.overlay[theme],
});

export default colors;
