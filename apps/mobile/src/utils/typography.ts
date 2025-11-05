/**
 * Life Navigator Design System - Typography
 *
 * Elite-level typography system with Inter font family
 * Mobile-optimized font sizes and line heights
 */

import { TextStyle } from 'react-native';

export const typography = {
  // Font Families
  fonts: {
    primary: 'Inter',
    monospace: 'FiraCode',
    system: 'System',
  },

  // Font Sizes (Mobile)
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Font Weights
  weights: {
    normal: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
  },

  // Line Heights
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;

/**
 * Predefined text styles for common use cases
 */
export const textStyles = {
  // Headings
  h1: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    lineHeight: typography.sizes['4xl'] * typography.lineHeights.tight,
    letterSpacing: typography.letterSpacing.tight,
  },
  h2: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    lineHeight: typography.sizes['3xl'] * typography.lineHeights.tight,
    letterSpacing: typography.letterSpacing.tight,
  },
  h3: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.semibold,
    lineHeight: typography.sizes['2xl'] * typography.lineHeights.tight,
  },
  h4: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.sizes.xl * typography.lineHeights.tight,
  },

  // Body Text
  bodyLarge: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.normal,
    lineHeight: typography.sizes.lg * typography.lineHeights.normal,
  },
  body: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },
  bodySmall: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.normal,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },

  // Labels
  label: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  labelSmall: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    lineHeight: typography.sizes.xs * typography.lineHeights.normal,
  },

  // Caption
  caption: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.normal,
    lineHeight: typography.sizes.xs * typography.lineHeights.normal,
  },

  // Monospace (for numbers, code)
  monospace: {
    fontFamily: typography.fonts.monospace,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },

  // Button
  button: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.sizes.base * typography.lineHeights.tight,
    textTransform: 'none' as TextStyle['textTransform'],
  },
  buttonSmall: {
    fontFamily: typography.fonts.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.sizes.sm * typography.lineHeights.tight,
    textTransform: 'none' as TextStyle['textTransform'],
  },
} as const;

export default typography;
