/**
 * HIPAA Compliance Layer
 * Ensures all PHI (Protected Health Information) is handled according to HIPAA requirements
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { db } from '../db';

/**
 * HIPAA Compliance Configuration
 */
export const HIPAA_CONFIG = {
  // Encryption settings
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  ENCRYPTION_KEY: process.env.PHI_ENCRYPTION_KEY || '',
  
  // Audit requirements
  AUDIT_RETENTION_DAYS: 2190, // 6 years as per HIPAA
  
  // Access control
  MIN_PASSWORD_LENGTH: 12,
  PASSWORD_COMPLEXITY_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  SESSION_TIMEOUT_MINUTES: 15,
  MAX_LOGIN_ATTEMPTS: 5,
  
  // Data classification
  PHI_FIELDS: [
    'healthRecords',
    'healthMetrics',
    'medications',
    'vitalSigns',
    'medicalAppointments',
    'diagnoses',
    'procedures',
    'allergies',
    'immunizations',
    'labResults',
    'insurance',
    'emergencyContacts'
  ],
  
  // Minimum necessary standard
  ROLE_PERMISSIONS: {
    patient: ['read:own', 'write:own'],
    provider: ['read:assigned', 'write:assigned'],
    admin: ['read:audit', 'write:config'],
    agent: ['read:deidentified'] // AI agents only get de-identified data
  }
};

/**
 * Encrypt PHI data
 */
export function encryptPHI(data: string): { encrypted: string; iv: string; authTag: string } {
  if (!HIPAA_CONFIG.ENCRYPTION_KEY) {
    throw new Error('PHI_ENCRYPTION_KEY not configured');
  }
  
  const iv = randomBytes(16);
  const cipher = createCipheriv(
    HIPAA_CONFIG.ENCRYPTION_ALGORITHM,
    Buffer.from(HIPAA_CONFIG.ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = (cipher as any).getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt PHI data
 */
export function decryptPHI(encryptedData: string, iv: string, authTag: string): string {
  if (!HIPAA_CONFIG.ENCRYPTION_KEY) {
    throw new Error('PHI_ENCRYPTION_KEY not configured');
  }
  
  const decipher = createDecipheriv(
    HIPAA_CONFIG.ENCRYPTION_ALGORITHM,
    Buffer.from(HIPAA_CONFIG.ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  
  (decipher as any).setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Create audit log entry for PHI access
 */
export async function auditPHIAccess(
  userId: string,
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, any>
) {
  try {
    await db.securityAuditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: metadata?.ipAddress || null,
        userAgent: metadata?.userAgent || null,
        timestamp: new Date(),
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit failures shouldn't break the app
    // But should trigger alerts in production
  }
}

/**
 * De-identify PHI for AI processing
 */
export function deidentifyPHI(data: any): any {
  // Remove direct identifiers
  const deidentified = { ...data };
  
  // List of fields to remove for de-identification
  const identifierFields = [
    'name',
    'email',
    'phone',
    'address',
    'ssn',
    'dob',
    'mrn', // Medical Record Number
    'insurance_id',
    'emergency_contact'
  ];
  
  // Remove identifier fields
  identifierFields.forEach(field => {
    delete deidentified[field];
  });
  
  // Replace dates with age ranges
  if (deidentified.dateOfBirth) {
    const age = calculateAge(deidentified.dateOfBirth);
    deidentified.ageRange = getAgeRange(age);
    delete deidentified.dateOfBirth;
  }
  
  // Generalize location to state level
  if (deidentified.zipCode) {
    deidentified.state = getStateFromZip(deidentified.zipCode);
    delete deidentified.zipCode;
  }
  
  return deidentified;
}

/**
 * Check if user has permission to access PHI
 */
export async function checkPHIPermission(
  userId: string,
  resourceOwnerId: string,
  action: 'read' | 'write',
  role: string
): Promise<boolean> {
  // Patient can always access their own data
  if (userId === resourceOwnerId && role === 'patient') {
    return true;
  }
  
  // Check role-based permissions
  const permissions = HIPAA_CONFIG.ROLE_PERMISSIONS[role as keyof typeof HIPAA_CONFIG.ROLE_PERMISSIONS];
  if (!permissions) {
    return false;
  }
  
  // Check if action is allowed for role
  const allowedAction = `${action}:${userId === resourceOwnerId ? 'own' : 'assigned'}`;
  return permissions.includes(allowedAction) || permissions.includes(`${action}:all`);
}

/**
 * Validate password complexity per HIPAA requirements
 */
export function validatePasswordComplexity(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < HIPAA_CONFIG.MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${HIPAA_CONFIG.MIN_PASSWORD_LENGTH} characters`);
  }
  
  if (!HIPAA_CONFIG.PASSWORD_COMPLEXITY_REGEX.test(password)) {
    errors.push('Password must contain uppercase, lowercase, number, and special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate secure token for password reset with audit
 */
export async function generateSecureToken(userId: string, purpose: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const hashedToken = createHash('sha256').update(token).digest('hex');
  
  // Store hashed token with expiry
  await db.securityToken.create({
    data: {
      userId,
      token: hashedToken,
      purpose,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour expiry
      used: false
    }
  });
  
  // Audit token generation
  await auditPHIAccess(userId, 'CREATE', 'SecurityToken', hashedToken, { purpose });
  
  return token;
}

/**
 * Implement automatic logoff after inactivity
 */
export function setupInactivityTimer(logoutCallback: () => void): NodeJS.Timeout {
  let timer: NodeJS.Timeout;
  
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(logoutCallback, HIPAA_CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000);
  };
  
  // Monitor user activity
  if (typeof window !== 'undefined') {
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });
  }
  
  resetTimer();
  return timer;
}

/**
 * Data retention and disposal
 */
export async function disposePHI(userId: string, dataType: string): Promise<void> {
  // Audit the disposal request
  await auditPHIAccess(userId, 'DELETE', dataType, userId, { 
    reason: 'User requested data disposal' 
  });
  
  // Implement secure deletion based on data type
  switch (dataType) {
    case 'all':
      // Full account deletion
      await db.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${Date.now()}@disposed.local`,
          name: 'DISPOSED',
          password: null,
          // Keep audit logs for 6 years per HIPAA
        }
      });
      break;
    case 'health':
      // Delete health records
      await db.healthRecord.deleteMany({ where: { userId } });
      await db.healthMetric.deleteMany({ where: { userId } });
      break;
    // Add more cases as needed
  }
}

// Helper functions
function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

function getAgeRange(age: number): string {
  if (age < 18) return 'Under 18';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  if (age < 65) return '55-64';
  return '65+';
}

function getStateFromZip(zipCode: string): string {
  // Simplified - in production, use a proper ZIP to state mapping
  const firstThree = zipCode.substring(0, 3);
  // This would be a full mapping in production
  if (firstThree >= '100' && firstThree <= '149') return 'NY';
  if (firstThree >= '200' && firstThree <= '209') return 'DC';
  // ... etc
  return 'Unknown';
}

export default {
  encryptPHI,
  decryptPHI,
  auditPHIAccess,
  deidentifyPHI,
  checkPHIPermission,
  validatePasswordComplexity,
  generateSecureToken,
  setupInactivityTimer,
  disposePHI
};