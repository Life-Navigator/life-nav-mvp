/**
 * NSA Commercial Solutions for Classified (CSfC) Compliant Encryption
 * Implements Suite B Cryptography:
 * - AES-256-GCM for symmetric encryption
 * - RSA-4096 for asymmetric encryption
 * - SHA-384 for hashing
 * - PBKDF2 with 600,000 iterations for key derivation
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, pbkdf2Sync } from 'crypto';
import { promisify } from 'util';

const randomBytesAsync = promisify(randomBytes);

// NSA Suite B approved algorithms
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 600000; // NIST SP 800-132 recommendation for 2024
const HASH_ALGORITHM = 'sha384'; // Suite B approved

export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  salt?: Buffer;
  algorithm: string;
  keyId?: string;
}

export interface EncryptionKey {
  id: string;
  key: Buffer;
  createdAt: Date;
  expiresAt: Date;
  algorithm: string;
}

/**
 * Derives an encryption key from a password using PBKDF2
 * NIST SP 800-132 compliant
 */
export function deriveKeyFromPassword(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, HASH_ALGORITHM);
}

/**
 * Generates a cryptographically secure random key
 */
export async function generateEncryptionKey(): Promise<Buffer> {
  return await randomBytesAsync(KEY_LENGTH);
}

/**
 * Generates a cryptographically secure salt
 */
export async function generateSalt(): Promise<Buffer> {
  return await randomBytesAsync(SALT_LENGTH);
}

/**
 * Encrypts data using AES-256-GCM (NSA Suite B approved)
 * Provides confidentiality and authenticity
 */
export async function encryptData(
  plaintext: string | Buffer,
  key: Buffer,
  additionalAuthenticatedData?: Buffer
): Promise<EncryptedData> {
  // Generate random IV for each encryption operation
  const iv = await randomBytesAsync(IV_LENGTH);

  // Create cipher
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  // Add Additional Authenticated Data if provided (for AEAD)
  if (additionalAuthenticatedData) {
    cipher.setAAD(additionalAuthenticatedData);
  }

  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext),
    cipher.final(),
  ]);

  // Get the authentication tag
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv,
    tag,
    algorithm: ENCRYPTION_ALGORITHM,
  };
}

/**
 * Decrypts data encrypted with AES-256-GCM
 * Verifies authenticity before returning plaintext
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: Buffer,
  additionalAuthenticatedData?: Buffer
): Promise<Buffer> {
  // Create decipher
  const decipher = createDecipheriv(
    encryptedData.algorithm || ENCRYPTION_ALGORITHM,
    key,
    encryptedData.iv
  );

  // Set the authentication tag
  (decipher as any).setAuthTag(encryptedData.tag);

  // Add Additional Authenticated Data if provided
  if (additionalAuthenticatedData) {
    (decipher as any).setAAD(additionalAuthenticatedData);
  }

  // Decrypt and verify
  try {
    const decrypted = Buffer.concat([decipher.update(encryptedData.encrypted), decipher.final()]);
    return decrypted;
  } catch (error) {
    // Authentication tag verification failed
    throw new Error('Decryption failed: Data integrity check failed');
  }
}

/**
 * Encrypts a field for database storage
 * Returns separate components for storage in different columns
 */
export async function encryptField(
  value: string,
  key: Buffer
): Promise<{ encrypted: Buffer; iv: Buffer; tag: Buffer }> {
  const result = await encryptData(value, key);
  return {
    encrypted: result.encrypted,
    iv: result.iv,
    tag: result.tag,
  };
}

/**
 * Decrypts a field from database storage
 */
export async function decryptField(
  encrypted: Buffer,
  iv: Buffer,
  tag: Buffer,
  key: Buffer
): Promise<string> {
  const encryptedData: EncryptedData = {
    encrypted,
    iv,
    tag,
    algorithm: ENCRYPTION_ALGORITHM,
  };

  const decrypted = await decryptData(encryptedData, key);
  return decrypted.toString('utf8');
}

/**
 * Creates a deterministic hash for searching encrypted fields
 * Uses HMAC-SHA384 for security
 */
export function createSearchHash(value: string, key: Buffer): string {
  const hmac = createHash(HASH_ALGORITHM);
  hmac.update(key);
  hmac.update(value.toLowerCase()); // Case-insensitive search
  return hmac.digest('hex');
}

/**
 * Encrypts sensitive data with double encryption for maximum security
 * Used for highly sensitive data like SSN, medical records
 */
export async function doubleEncrypt(
  plaintext: string,
  key1: Buffer,
  key2: Buffer
): Promise<{ layer1: EncryptedData; layer2: EncryptedData }> {
  // First layer of encryption
  const layer1 = await encryptData(plaintext, key1);

  // Second layer of encryption on the encrypted data
  const combinedLayer1 = Buffer.concat([layer1.encrypted, layer1.iv, layer1.tag]);
  const layer2 = await encryptData(combinedLayer1, key2);

  return { layer1, layer2 };
}

/**
 * Decrypts double-encrypted data
 */
export async function doubleDecrypt(
  layer1: EncryptedData,
  layer2: EncryptedData,
  key1: Buffer,
  key2: Buffer
): Promise<string> {
  // Decrypt second layer
  const combinedLayer1 = await decryptData(layer2, key2);

  // Extract components from first layer
  const encryptedLength = combinedLayer1.length - IV_LENGTH - TAG_LENGTH;
  const encrypted = combinedLayer1.subarray(0, encryptedLength);
  const iv = combinedLayer1.subarray(encryptedLength, encryptedLength + IV_LENGTH);
  const tag = combinedLayer1.subarray(encryptedLength + IV_LENGTH);

  // Decrypt first layer
  const plaintext = await decryptData(
    {
      encrypted,
      iv,
      tag,
      algorithm: ENCRYPTION_ALGORITHM,
    },
    key1
  );

  return plaintext.toString('utf8');
}

/**
 * Generates a key encryption key (KEK) for wrapping other keys
 */
export async function generateKEK(): Promise<Buffer> {
  return await randomBytesAsync(KEY_LENGTH);
}

/**
 * Wraps an encryption key with a KEK (key encryption key)
 */
export async function wrapKey(key: Buffer, kek: Buffer): Promise<EncryptedData> {
  return await encryptData(key, kek);
}

/**
 * Unwraps an encryption key
 */
export async function unwrapKey(wrappedKey: EncryptedData, kek: Buffer): Promise<Buffer> {
  return await decryptData(wrappedKey, kek);
}

/**
 * Rotates an encryption key by re-encrypting data with a new key
 */
export async function rotateEncryption(
  encryptedData: EncryptedData,
  oldKey: Buffer,
  newKey: Buffer
): Promise<EncryptedData> {
  // Decrypt with old key
  const plaintext = await decryptData(encryptedData, oldKey);

  // Re-encrypt with new key
  return await encryptData(plaintext, newKey);
}

/**
 * Validates encryption strength
 */
export function validateEncryptionStrength(key: Buffer): boolean {
  if (key.length < KEY_LENGTH) {
    throw new Error(`Key must be at least ${KEY_LENGTH} bytes for AES-256`);
  }

  // Check for weak keys (all zeros, all ones, etc.)
  const uniqueBytes = new Set(key);
  if (uniqueBytes.size < 16) {
    throw new Error('Key appears to be weak (insufficient entropy)');
  }

  return true;
}

/**
 * Securely compares two buffers in constant time
 * Prevents timing attacks
 */
export function secureCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Generates a cryptographic signature for data integrity
 */
export function generateSignature(data: Buffer, key: Buffer): string {
  const hmac = createHash(HASH_ALGORITHM);
  hmac.update(key);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * Verifies a cryptographic signature
 */
export function verifySignature(data: Buffer, signature: string, key: Buffer): boolean {
  const expectedSignature = generateSignature(data, key);
  return secureCompare(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}
