/**
 * Email verification functionality
 */
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { z } from 'zod';

// Constants
const TOKEN_EXPIRY_HOURS = 24; // 24 hours
const TOKEN_LENGTH = 32; // 32 bytes = 64 hex chars

// Validation schema
export const EmailVerificationSchema = z.object({
  token: z.string().min(32),
});

/**
 * Generate a new email verification token
 */
export async function generateEmailVerificationToken(userId: string, email: string): Promise<string> {
  // Generate random token
  const token = randomBytes(TOKEN_LENGTH).toString('hex');
  
  // Calculate expiry time (24 hours)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);
  
  // Store token in database
  await db.emailVerification.upsert({
    where: { userId },
    update: {
      token,
      expiresAt,
      email,
      updatedAt: new Date(),
    },
    create: {
      userId,
      token,
      expiresAt,
      email,
    },
  });
  
  return token;
}

/**
 * Verify email verification token
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; userId?: string; email?: string }> {
  try {
    // Find the token in the database
    const verification = await db.emailVerification.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      select: {
        id: true,
        userId: true,
        email: true,
      },
    });
    
    // If token not found or expired
    if (!verification) {
      return { success: false };
    }
    
    // Mark email as verified
    await db.user.update({
      where: { id: verification.userId },
      data: {
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    
    // Log the verification
    await db.securityAuditLog.create({
      data: {
        userId: verification.userId,
        eventType: 'email_verified',
        data: {
          email: verification.email,
        },
      },
    });
    
    // Remove the verification token
    await db.emailVerification.delete({
      where: { id: verification.id },
    });
    
    return {
      success: true,
      userId: verification.userId,
      email: verification.email,
    };
  } catch (error) {
    console.error('Email verification error:', error);
    return { success: false };
  }
}

/**
 * Send verification email
 * This is a placeholder for actual email sending functionality.
 * In production, this would use a real email service like SendGrid, Postmark, etc.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  try {
    // In production, this would send an actual email
    // For now, we'll just log the verification URL
    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
    console.log(`Email verification link for ${email}: ${verificationUrl}`);
    
    // TODO: Implement real email sending with a service like SendGrid
    
    return true;
  } catch (error) {
    console.error('Send verification email error:', error);
    return false;
  }
}

/**
 * Request email verification
 * This function generates a token and sends a verification email
 */
export async function requestEmailVerification(userId: string, email: string): Promise<boolean> {
  try {
    // Generate token
    const token = await generateEmailVerificationToken(userId, email);
    
    // Send verification email
    const emailSent = await sendVerificationEmail(email, token);
    
    // Log the verification request
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'email_verification_requested',
        data: {
          email,
          emailSent,
        },
      },
    });
    
    return emailSent;
  } catch (error) {
    console.error('Request email verification error:', error);
    return false;
  }
}