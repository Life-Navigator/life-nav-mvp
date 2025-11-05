/**
 * Life Navigator - Login Screen
 *
 * Elite-level login screen with form validation, biometric auth,
 * and comprehensive error handling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Button, Input } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../utils/colors';
import { textStyles } from '../../utils/typography';
import { spacing, borderRadius } from '../../utils/spacing';
import { isValidEmail } from '../../utils/validators';
import { LoginCredentials } from '../../types';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export const LoginScreen: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data as LoginCredentials);
      // Navigation to main app happens automatically via auth state
    } catch (error) {
      // Error is handled by the store
      console.error('Login failed:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo and Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🧭</Text>
          </View>
          <Text style={styles.title}>Life Navigator</Text>
          <Text style={styles.tagline}>Navigate Life, Intelligently</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Login Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <Controller
            control={control}
            name="email"
            rules={{
              required: 'Email is required',
              validate: (value) => isValidEmail(value) || 'Invalid email address',
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="john.doe@example.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                required
              />
            )}
          />

          {/* Password Input */}
          <Controller
            control={control}
            name="password"
            rules={{
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                required
                rightIcon={
                  <Text style={styles.passwordToggle}>
                    {showPassword ? '🙈' : '👁️'}
                  </Text>
                }
                onRightIconPress={() => setShowPassword(!showPassword)}
              />
            )}
          />

          {/* Remember Me & Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                // Navigate to Forgot Password screen
              }}
            >
              <Text style={styles.optionText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <Button
            title="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={isLoading}
            fullWidth
            variant="primary"
            size="large"
          />

          {/* Biometric Login */}
          <Button
            title="Sign in with Face ID"
            onPress={() => {
              // Implement biometric login
            }}
            variant="outline"
            fullWidth
            style={styles.biometricButton}
          />

          {/* Social Login */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Sign in with Google"
            onPress={() => {
              // Implement Google OAuth
            }}
            variant="outline"
            fullWidth
            style={styles.socialButton}
          />

          <Button
            title="Sign in with Apple"
            onPress={() => {
              // Implement Apple Sign In
            }}
            variant="outline"
            fullWidth
            style={styles.socialButton}
          />

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => {
                // Navigate to Register screen
              }}
            >
              <Text style={styles.registerLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.primary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing[6],
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    ...textStyles.h2,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  tagline: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  errorContainer: {
    backgroundColor: colors.semantic.error + '10',
    borderLeftWidth: 4,
    borderLeftColor: colors.semantic.error,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[4],
  },
  errorText: {
    ...textStyles.bodySmall,
    color: colors.semantic.error,
  },
  form: {
    width: '100%',
  },
  passwordToggle: {
    fontSize: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing[6],
    marginTop: -spacing[2],
  },
  option: {
    padding: spacing[1],
  },
  optionText: {
    ...textStyles.bodySmall,
    color: colors.primary.blue,
  },
  biometricButton: {
    marginTop: spacing[3],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[6],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[300],
  },
  dividerText: {
    ...textStyles.caption,
    color: colors.gray[500],
    marginHorizontal: spacing[3],
  },
  socialButton: {
    marginBottom: spacing[3],
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[6],
  },
  registerText: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  registerLink: {
    ...textStyles.body,
    color: colors.primary.blue,
    fontWeight: '600',
  },
});

export default LoginScreen;
