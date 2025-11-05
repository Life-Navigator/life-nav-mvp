/**
 * Life Navigator - Validation Utilities
 *
 * Elite-level validation functions for forms and data
 */

import { REGEX } from './constants';

/**
 * Validate email address
 */
export const isValidEmail = (email: string): boolean => {
  return REGEX.EMAIL.test(email.trim());
};

/**
 * Validate phone number
 */
export const isValidPhone = (phone: string): boolean => {
  return REGEX.PHONE.test(phone.replace(/\D/g, ''));
};

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const isValidPassword = (password: string): boolean => {
  return REGEX.PASSWORD.test(password);
};

/**
 * Get password strength score (0-4)
 */
export const getPasswordStrength = (password: string): {
  score: number;
  label: 'weak' | 'fair' | 'good' | 'strong' | 'very strong';
  feedback: string[];
} => {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score++;
  else feedback.push('Use at least 8 characters');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');

  if (/\d/.test(password)) score++;
  else feedback.push('Add numbers');

  if (/[@$!%*?&]/.test(password)) score++;
  else feedback.push('Add special characters (@$!%*?&)');

  const labels: Array<'weak' | 'fair' | 'good' | 'strong' | 'very strong'> = [
    'weak',
    'fair',
    'good',
    'strong',
    'very strong',
  ];

  return {
    score,
    label: labels[Math.max(0, score - 1)],
    feedback,
  };
};

/**
 * Validate URL
 */
export const isValidURL = (url: string): boolean => {
  return REGEX.URL.test(url.trim());
};

/**
 * Validate age (must be 18+)
 */
export const isValidAge = (birthDate: Date): boolean => {
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 18;
  }
  return age >= 18;
};

/**
 * Validate credit card number (Luhn algorithm)
 */
export const isValidCreditCard = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

/**
 * Validate currency amount
 */
export const isValidAmount = (amount: number): boolean => {
  return !isNaN(amount) && amount >= 0 && isFinite(amount);
};

/**
 * Validate required field
 */
export const isRequired = (value: any): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

/**
 * Validate min length
 */
export const minLength = (value: string, min: number): boolean => {
  return value.trim().length >= min;
};

/**
 * Validate max length
 */
export const maxLength = (value: string, max: number): boolean => {
  return value.trim().length <= max;
};

/**
 * Validate range
 */
export const inRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

export default {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  getPasswordStrength,
  isValidURL,
  isValidAge,
  isValidCreditCard,
  isValidAmount,
  isRequired,
  minLength,
  maxLength,
  inRange,
};
