/**
 * Life Navigator Design System - Theme
 *
 * Complete theme combining colors, typography, spacing
 * Elite-level design system for production mobile app
 */

import { colors, getThemedColors, ColorTheme } from './colors';
import { typography, textStyles } from './typography';
import { spacing, borderRadius, shadows, zIndex } from './spacing';

export interface Theme {
  colors: typeof colors;
  themedColors: ReturnType<typeof getThemedColors>;
  typography: typeof typography;
  textStyles: typeof textStyles;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  zIndex: typeof zIndex;
  mode: ColorTheme;
}

/**
 * Create theme with specified mode
 */
export const createTheme = (mode: ColorTheme = 'light'): Theme => ({
  colors,
  themedColors: getThemedColors(mode),
  typography,
  textStyles,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  mode,
});

// Default themes
export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');

/**
 * Common layout constants
 */
export const layout = {
  // Screen padding
  screenPadding: spacing[4],
  screenPaddingHorizontal: spacing[4],
  screenPaddingVertical: spacing[6],

  // Card spacing
  cardPadding: spacing[4],
  cardMargin: spacing[3],
  cardGap: spacing[3],

  // Bottom tab bar
  tabBarHeight: 60,
  tabBarPadding: spacing[2],

  // Header
  headerHeight: 56,
  headerPadding: spacing[4],

  // Input
  inputHeight: 48,
  inputPadding: spacing[3],

  // Button
  buttonHeight: 48,
  buttonPadding: spacing[4],
  buttonRadius: borderRadius.md,

  // Avatar
  avatarSmall: 32,
  avatarMedium: 48,
  avatarLarge: 64,
  avatarXLarge: 96,

  // Icon
  iconSmall: 16,
  iconMedium: 24,
  iconLarge: 32,
  iconXLarge: 48,
} as const;

/**
 * Animation durations (milliseconds)
 */
export const animations = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

/**
 * Breakpoints (not commonly used in mobile, but useful for tablets)
 */
export const breakpoints = {
  small: 0,
  medium: 768,
  large: 1024,
} as const;

export type ThemeType = typeof lightTheme;

export default lightTheme;
