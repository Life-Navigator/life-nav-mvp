/**
 * Life Navigator - Input Component
 *
 * Elite-level text input with validation, icons, and theming
 * Full accessibility support and proper error handling
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../../utils/colors';
import { textStyles, typography } from '../../utils/typography';
import { spacing, borderRadius } from '../../utils/spacing';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  required?: boolean;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  labelStyle,
  required = false,
  disabled = false,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!error;
  const showHelperText = !hasError && !!helperText;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, labelStyle]}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      )}

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          hasError && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
        ]}
      >
        {/* Left Icon */}
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        {/* Text Input */}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            inputStyle,
          ]}
          placeholderTextColor={colors.gray[400]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          {...textInputProps}
        />

        {/* Right Icon */}
        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            activeOpacity={0.7}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {hasError && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      {/* Helper Text */}
      {showHelperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  labelContainer: {
    marginBottom: spacing[2],
  },
  label: {
    ...textStyles.label,
    color: colors.gray[700],
  },
  required: {
    color: colors.semantic.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: colors.light.primary,
    minHeight: 48,
  },
  inputContainerFocused: {
    borderColor: colors.primary.blue,
    shadowColor: colors.primary.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerError: {
    borderColor: colors.semantic.error,
  },
  inputContainerDisabled: {
    backgroundColor: colors.gray[100],
    opacity: 0.6,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    color: colors.gray[900],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontFamily: typography.fonts.primary,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing[1],
  },
  inputWithRightIcon: {
    paddingRight: spacing[1],
  },
  leftIcon: {
    paddingLeft: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIcon: {
    paddingRight: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...textStyles.caption,
    color: colors.semantic.error,
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },
  helperText: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },
});

export default Input;
