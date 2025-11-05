/**
 * Multi-factor authentication implementation
 */
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { db } from '@/lib/db';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';

// Organization name for authenticator apps
const APP_NAME = 'LifeNavigator';

// Validation schemas
export const MfaSetupSchema = z.object({
  secret: z.string().min(16),
  token: z.string().length(6).regex(/^\d+$/)
});

export const MfaVerifySchema = z.object({
  token: z.string().length(6).regex(/^\d+$/)
});

export const MfaDisableSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/)
});

/**
 * Generate new MFA secret for user
 */
export async function generateMfaSecret(userId: string): Promise<string> {
  // Generate a random secret
  const secret = authenticator.generateSecret();
  
  // Hash the secret for storage
  const hashedSecret = hashMfaSecret(secret);
  
  // Store the hashed secret in the database (temporary until verified)
  await db.mfaSetup.upsert({
    where: { userId },
    update: {
      secret: hashedSecret,
      verified: false,
      updatedAt: new Date()
    },
    create: {
      userId,
      secret: hashedSecret,
      verified: false
    }
  });
  
  // Generate and store recovery codes
  const recoveryCodes = generateRecoveryCodes();
  const hashedCodes = recoveryCodes.map(code => hashRecoveryCode(code));
  
  // Store recovery codes in database (pending activation)
  await db.mfaRecoveryCode.deleteMany({
    where: { userId, used: false }
  });
  
  await Promise.all(
    hashedCodes.map(code => 
      db.mfaRecoveryCode.create({
        data: {
          userId,
          code,
          used: false
        }
      })
    )
  );
  
  // Return the plain secret for QR code generation
  return secret;
}

/**
 * Generate QR code for MFA setup
 */
export async function generateQrCode(secret: string, email: string): Promise<string> {
  // Create the otpauth URL for authenticator apps
  const otpauth = authenticator.keyuri(email, APP_NAME, secret);
  
  // Generate QR code from the otpauth URL
  const qrCode = await toDataURL(otpauth);
  
  return qrCode;
}

/**
 * Verify MFA token during setup
 */
export async function verifyMfaSetup(userId: string, token: string, secret: string): Promise<boolean> {
  try {
    // Verify the token against the provided secret
    const isValid = authenticator.verify({
      token,
      secret
    });
    
    if (!isValid) {
      return false;
    }
    
    // Hash the secret for storage
    const hashedSecret = hashMfaSecret(secret);
    
    // Activate MFA for the user
    await db.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: hashedSecret,
        updatedAt: new Date()
      }
    });
    
    // Clean up the temporary setup record
    await db.mfaSetup.delete({
      where: { userId }
    });
    
    // Log the MFA activation
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'mfa_enabled',
        data: {}
      }
    });
    
    return true;
  } catch (error) {
    console.error('MFA setup verification error:', error);
    return false;
  }
}

/**
 * Verify MFA token during login
 */
export async function verifyMfaToken(userId: string, token: string): Promise<boolean> {
  try {
    // Get the user's MFA secret
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true }
    });
    
    // If MFA is not enabled or secret is not set
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }
    
    // Check if token is a recovery code
    const isRecoveryCode = await verifyRecoveryCode(userId, token);
    if (isRecoveryCode) {
      return true;
    }
    
    // Otherwise, verify TOTP token
    // First we need to retrieve the original secret
    // In production, this would use a reversible encryption rather than comparison
    // For MVP we use a comparison approach
    const mfaSecrets = await db.mfaSecret.findMany({
      where: { userId },
      select: { secret: true }
    });
    
    // Try each stored secret
    for (const { secret } of mfaSecrets) {
      const isValid = authenticator.verify({
        token,
        secret
      });
      
      if (isValid) {
        // Log the successful verification
        await db.securityAuditLog.create({
          data: {
            userId,
            eventType: 'mfa_verified',
            data: {}
          }
        });
        
        return true;
      }
    }
    
    // Log the failed verification
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'mfa_failed_verification',
        data: {}
      }
    });
    
    return false;
  } catch (error) {
    console.error('MFA verification error:', error);
    return false;
  }
}

/**
 * Disable MFA for a user
 */
export async function disableMfa(userId: string, token: string): Promise<boolean> {
  try {
    // Verify the token first
    const isValid = await verifyMfaToken(userId, token);
    
    if (!isValid) {
      return false;
    }
    
    // Disable MFA for the user
    await db.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        updatedAt: new Date()
      }
    });
    
    // Clean up MFA data
    await db.mfaSecret.deleteMany({
      where: { userId }
    });
    
    await db.mfaRecoveryCode.deleteMany({
      where: { userId }
    });
    
    // Log the MFA deactivation
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'mfa_disabled',
        data: {}
      }
    });
    
    return true;
  } catch (error) {
    console.error('MFA disable error:', error);
    return false;
  }
}

/**
 * Hash MFA secret for secure storage
 */
function hashMfaSecret(secret: string): string {
  return createHash('sha256')
    .update(secret)
    .digest('hex');
}

/**
 * Generate recovery codes
 */
function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate a random 8-character code (4 bytes = 8 hex chars)
    const code = randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    const formattedCode = `${code.substring(0, 4)}-${code.substring(4)}`;
    codes.push(formattedCode);
  }
  
  return codes;
}

/**
 * Hash recovery code for secure storage
 */
function hashRecoveryCode(code: string): string {
  // Remove dashes for storage
  const normalizedCode = code.replace(/-/g, '');
  
  return createHash('sha256')
    .update(normalizedCode)
    .digest('hex');
}

/**
 * Verify and use a recovery code
 */
async function verifyRecoveryCode(userId: string, inputCode: string): Promise<boolean> {
  try {
    // Normalize the input code (remove dashes if present)
    const normalizedCode = inputCode.replace(/-/g, '');
    
    // Hash the normalized code
    const hashedCode = hashRecoveryCode(normalizedCode);
    
    // Find the recovery code in the database
    const recoveryCode = await db.mfaRecoveryCode.findFirst({
      where: {
        userId,
        code: hashedCode,
        used: false
      }
    });
    
    if (!recoveryCode) {
      return false;
    }
    
    // Mark the code as used
    await db.mfaRecoveryCode.update({
      where: { id: recoveryCode.id },
      data: { 
        used: true,
        usedAt: new Date()
      }
    });
    
    // Log the recovery code usage
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'mfa_recovery_code_used',
        data: { 
          recoveryCodeId: recoveryCode.id 
        }
      }
    });
    
    return true;
  } catch (error) {
    console.error('Recovery code verification error:', error);
    return false;
  }
}