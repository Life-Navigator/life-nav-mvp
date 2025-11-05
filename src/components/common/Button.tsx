/**
 * Life Navigator - Button Component
 *
 * Elite-level button with multiple variants, sizes, and states
 * Full accessibility support, haptic feedback, and theming
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors } from '../../utils/colors';
import { textStyles } from '../../utils/typography';
import { spacing, borderRadius } from '../../utils/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  hapticFeedback = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const handlePress = () => {
    if (disabled || loading) return;

    if (hapticFeedback) {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    onPress();
  };

  const getButtonStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.md,
      ...styles.base,
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        minHeight: 36,
      },
      medium: {
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        minHeight: 48,
      },
      large: {
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[4],
        minHeight: 56,
      },
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: colors.primary.blue,
      },
      secondary: {
        backgroundColor: colors.gray[200],
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary.blue,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      danger: {
        backgroundColor: colors.semantic.error,
      },
    };

    // Disabled styles
    const disabledStyles: ViewStyle = disabled
      ? {
          opacity: 0.5,
        }
      : {};

    // Full width
    const widthStyles: ViewStyle = fullWidth ? { width: '100%' } : {};

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...disabledStyles,
      ...widthStyles,
    };
  };

  const getTextStyles = (): TextStyle => {
    const baseTextStyles: TextStyle = {
      ...textStyles.button,
    };

    // Size text styles
    const sizeTextStyles: Record<string, TextStyle> = {
      small: {
        fontSize: 14,
      },
      medium: {
        fontSize: 16,
      },
      large: {
        fontSize: 18,
      },
    };

    // Variant text colors
    const variantTextColors: Record<string, TextStyle> = {
      primary: {
        color: '#FFFFFF',
      },
      secondary: {
        color: colors.gray[900],
      },
      outline: {
        color: colors.primary.blue,
      },
      ghost: {
        color: colors.primary.blue,
      },
      danger: {
        color: '#FFFFFF',
      },
    };

    return {
      ...baseTextStyles,
      ...sizeTextStyles[size],
      ...variantTextColors[variant],
    };
  };

  const iconSpacing = size === 'small' ? spacing[1] : spacing[2];

  return (
    <TouchableOpacity
      style={[getButtonStyles(), style]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary.blue}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <React.Fragment>
              {icon}
              <Text style={{ width: iconSpacing }} />
            </React.Fragment>
          )}
          <Text style={[getTextStyles(), textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <React.Fragment>
              <Text style={{ width: iconSpacing }} />
              {icon}
            </React.Fragment>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export default Button;
