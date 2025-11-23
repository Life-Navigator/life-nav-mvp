/**
 * Pilot Access Control Utilities
 *
 * Handles all pilot-specific access control logic for the LifeNavigator pilot program.
 * This module provides functions to check pilot eligibility, role-based route access,
 * and pilot window validation.
 */

import { User } from '@prisma/client';

// Pilot role hierarchy (higher index = more access)
export const PILOT_ROLES = ['waitlist', 'investor', 'pilot', 'admin'] as const;
export type PilotRole = typeof PILOT_ROLES[number];

// User types for segmentation
export const USER_TYPES = ['civilian', 'military', 'veteran'] as const;
export type UserType = typeof USER_TYPES[number];

// Route access definitions
export const ROUTE_ACCESS: Record<string, PilotRole[]> = {
  '/dashboard': ['waitlist', 'investor', 'pilot', 'admin'],
  '/dashboard/investor': ['investor', 'admin'],
  '/app': ['pilot', 'admin'],
  '/admin': ['admin'],
};

/**
 * Minimal user type for pilot checks (works with JWT tokens and full User objects)
 */
export interface PilotUser {
  id?: string;
  pilotRole?: string;
  pilotEnabled?: boolean;
  pilotStartAt?: Date | string | null;
  pilotEndAt?: Date | string | null;
  userType?: string;
}

/**
 * Check if a user has pilot access (role = pilot or admin, enabled, and within window)
 */
export function isPilotUser(user: PilotUser | null | undefined): boolean {
  if (!user) return false;

  const role = user.pilotRole || 'waitlist';
  if (!['pilot', 'admin'].includes(role)) return false;
  if (!user.pilotEnabled) return false;

  return isPilotWindowActive(user);
}

/**
 * Check if the pilot access window is currently active
 */
export function isPilotWindowActive(user: PilotUser | null | undefined): boolean {
  if (!user) return false;

  // Admins always have access regardless of window
  if (user.pilotRole === 'admin') return true;

  const now = new Date();

  // Check start date
  if (user.pilotStartAt) {
    const startDate = new Date(user.pilotStartAt);
    if (now < startDate) return false;
  }

  // Check end date
  if (user.pilotEndAt) {
    const endDate = new Date(user.pilotEndAt);
    if (now > endDate) return false;
  }

  return true;
}

/**
 * Check if a user is an investor or admin
 */
export function isInvestorOrAdmin(user: PilotUser | null | undefined): boolean {
  if (!user) return false;
  const role = user.pilotRole || 'waitlist';
  return ['investor', 'admin'].includes(role);
}

/**
 * Check if a user is an admin
 */
export function isAdmin(user: PilotUser | null | undefined): boolean {
  if (!user) return false;
  return user.pilotRole === 'admin';
}

/**
 * Check if a user can access a specific route based on their pilot role
 */
export function canAccessRoute(user: PilotUser | null | undefined, path: string): boolean {
  if (!user) return false;

  const userRole = (user.pilotRole || 'waitlist') as PilotRole;

  // Find the most specific matching route
  const matchingRoutes = Object.keys(ROUTE_ACCESS)
    .filter(route => path.startsWith(route))
    .sort((a, b) => b.length - a.length); // Sort by specificity (longer = more specific)

  if (matchingRoutes.length === 0) {
    // No route restriction defined, allow access
    return true;
  }

  const route = matchingRoutes[0];
  const allowedRoles = ROUTE_ACCESS[route];

  // Check if user's role is in allowed roles
  if (!allowedRoles.includes(userRole)) {
    return false;
  }

  // For /app routes, also check pilot window
  if (path.startsWith('/app') && userRole === 'pilot') {
    return isPilotWindowActive(user);
  }

  return true;
}

/**
 * Get the appropriate redirect URL for a user based on their role
 */
export function getRedirectForRole(user: PilotUser | null | undefined): string {
  if (!user) return '/auth/login';

  const role = user.pilotRole || 'waitlist';

  switch (role) {
    case 'admin':
      return '/app'; // Admins go to full app
    case 'pilot':
      if (isPilotWindowActive(user) && user.pilotEnabled) {
        return '/app';
      }
      return '/dashboard'; // Expired pilots go to waitlist dashboard
    case 'investor':
      return '/dashboard/investor';
    case 'waitlist':
    default:
      return '/dashboard';
  }
}

/**
 * Get days remaining in pilot access window
 */
export function getPilotDaysRemaining(user: PilotUser | null | undefined): number | null {
  if (!user || !user.pilotEndAt) return null;

  const now = new Date();
  const endDate = new Date(user.pilotEndAt);
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Check if pilot access is expiring soon (within 7 days)
 */
export function isPilotExpiringSoon(user: PilotUser | null | undefined): boolean {
  const daysRemaining = getPilotDaysRemaining(user);
  return daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
}

/**
 * Validate pilot role value
 */
export function isValidPilotRole(role: string): role is PilotRole {
  return PILOT_ROLES.includes(role as PilotRole);
}

/**
 * Validate user type value
 */
export function isValidUserType(type: string): type is UserType {
  return USER_TYPES.includes(type as UserType);
}

/**
 * Get role hierarchy level (for comparison)
 */
export function getRoleLevel(role: PilotRole): number {
  return PILOT_ROLES.indexOf(role);
}

/**
 * Check if a role has at least the required access level
 */
export function hasMinimumRole(userRole: string, requiredRole: PilotRole): boolean {
  const userLevel = getRoleLevel(userRole as PilotRole);
  const requiredLevel = getRoleLevel(requiredRole);
  return userLevel >= requiredLevel;
}
