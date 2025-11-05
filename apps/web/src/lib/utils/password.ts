/**
 * Password utility functions for secure password handling
 */
import { compare, hash } from 'bcrypt';

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return await compare(plainPassword, hashedPassword);
}

/**
 * Hash a password using bcrypt
 * @param password Plain text password to hash
 * @param saltRounds Number of salt rounds (default: 10)
 */
export async function hashPassword(password: string, saltRounds: number = 10): Promise<string> {
  return await hash(password, saltRounds);
}

/**
 * Standard password validation regex for use across the application
 * Requires at least 12 characters with uppercase, lowercase, numbers, and special characters
 */
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;

/**
 * Validates if a password meets the strong password requirements
 * @param password Password to validate
 * @returns True if password meets requirements, false otherwise
 */
export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_REGEX.test(password);
}