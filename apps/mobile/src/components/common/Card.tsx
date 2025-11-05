/**
 * Life Navigator - Card Component
 *
 * Elite-level card container for content organization
 * Supports different variants, shadows, and theming
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'filled';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  variant = 'elevated',
  shadow = 'md',
  padding = 4,
  style,
  testID,
}) => {
  const getCardStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: borderRadius.lg,
      padding: spacing[padding],
    };

    const variantStyles: Record<string, ViewStyle> = {
      elevated: {
        backgroundColor: colors.light.primary,
        ...shadows[shadow],
      },
      outlined: {
        backgroundColor: colors.light.primary,
        borderWidth: 1,
        borderColor: colors.gray[200],
      },
      filled: {
        backgroundColor: colors.light.secondary,
      },
    };

    return {
      ...baseStyles,
      ...variantStyles[variant],
    };
  };

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent
      style={[getCardStyles(), style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      testID={testID}
    >
      {children}
    </CardComponent>
  );
};

export default Card;
