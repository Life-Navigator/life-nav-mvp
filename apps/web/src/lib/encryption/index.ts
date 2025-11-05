/**
 * Encryption utilities for field-level encryption of sensitive data
 * 
 * This module provides tools for encrypting and decrypting sensitive data
 * at the field level before storing in the database.
 */
import crypto from 'crypto';

// Constants for encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Environment variables or secure storage should be used for these in production
// DO NOT hardcode keys or use weak derivation in production systems
const getMasterKey = (): Buffer => {
  // In production, this should use a securely stored key or KMS
  // For development, we derive from an environment variable
  const masterKeyString = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKeyString) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is not set');
  }
  
  // Derive a key using PBKDF2
  return crypto.pbkdf2Sync(
    masterKeyString,
    process.env.ENCRYPTION_SALT || 'lifenavigator-salt',
    100000, // iterations
    KEY_LENGTH,
    'sha256'
  );
};

/**
 * Encrypt sensitive data using AES-256-GCM
 * 
 * @param plaintext The data to encrypt
 * @param context Additional context to include in AAD (provides context binding)
 * @returns Encrypted data with metadata for decryption
 */
export function encryptData(plaintext: string, context: string = ''): string {
  try {
    if (!plaintext) return '';
    
    // Generate random IV for this encryption operation
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Get the encryption key
    const key = getMasterKey();
    
    // Create cipher with key, IV, and auth tag length
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    
    // Add context as additional authenticated data (AAD)
    if (context) {
      cipher.setAAD(Buffer.from(context));
    }
    
    // Encrypt the data
    const encryptedBuffer = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Format: {iv}{authTag}{ciphertext}
    const result = Buffer.concat([iv, authTag, encryptedBuffer]);
    
    // Return as base64 encoded string
    return result.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data that was encrypted with encryptData
 * 
 * @param encryptedData Base64 encoded encrypted data
 * @param context The same context used during encryption (for AAD)
 * @returns Decrypted plaintext
 */
export function decryptData(encryptedData: string, context: string = ''): string {
  try {
    if (!encryptedData) return '';
    
    // Decode the base64 string
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    
    // Extract the components
    const iv = encryptedBuffer.subarray(0, IV_LENGTH);
    const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Get the encryption key
    const key = getMasterKey();
    
    // Create decipher with key, IV, and auth tag length
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    
    // Set the auth tag
    decipher.setAuthTag(authTag);
    
    // Add context as additional authenticated data (AAD)
    if (context) {
      decipher.setAAD(Buffer.from(context));
    }
    
    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    // Return as string
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if data is already encrypted
 * 
 * @param data Data to check
 * @returns Boolean indicating if data appears to be encrypted
 */
export function isEncrypted(data: string): boolean {
  try {
    if (!data) return false;
    
    // Try to decode as base64
    const buffer = Buffer.from(data, 'base64');
    
    // Check minimum length requirement
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return false;
    }
    
    // Check if it matches our encryption format
    // This is a heuristic and not foolproof
    return buffer.length === buffer.toString('base64').length;
  } catch (error) {
    return false;
  }
}

/**
 * Generate a data encryption key (DEK) encrypted with the master key (key encryption key)
 * This is for envelope encryption - the DEK is stored with the data but is itself encrypted
 * 
 * @returns Encrypted DEK and DEK ID
 */
export function generateDataEncryptionKey(): { 
  encryptedDek: string; 
  dekId: string; 
} {
  // Generate a random data encryption key
  const dek = crypto.randomBytes(KEY_LENGTH);
  
  // Generate a random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Get the master key (key encryption key)
  const kek = getMasterKey();
  
  // Create cipher with KEK
  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  // Encrypt the DEK
  const encryptedDekBuffer = Buffer.concat([
    cipher.update(dek),
    cipher.final(),
  ]);
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  // Format: {iv}{authTag}{encrypted-dek}
  const encryptedDek = Buffer.concat([iv, authTag, encryptedDekBuffer]).toString('base64');
  
  // Generate a unique ID for this DEK
  const dekId = crypto.randomUUID();
  
  return { encryptedDek, dekId };
}

/**
 * Decrypt a data encryption key (DEK) using the master key (key encryption key)
 * 
 * @param encryptedDek The encrypted DEK
 * @returns Decrypted DEK as a Buffer
 */
export function decryptDataEncryptionKey(encryptedDek: string): Buffer {
  try {
    // Decode the base64 string
    const encryptedDekBuffer = Buffer.from(encryptedDek, 'base64');
    
    // Extract the components
    const iv = encryptedDekBuffer.subarray(0, IV_LENGTH);
    const authTag = encryptedDekBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedKey = encryptedDekBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Get the master key
    const kek = getMasterKey();
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    
    // Set the auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt the DEK
    return Buffer.concat([
      decipher.update(encryptedKey),
      decipher.final(),
    ]);
  } catch (error) {
    console.error('DEK decryption error:', error);
    throw new Error('Failed to decrypt data encryption key');
  }
}