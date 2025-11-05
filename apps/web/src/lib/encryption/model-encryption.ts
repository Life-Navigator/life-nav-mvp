/**
 * Utilities for managing field-level encryption in TypeScript models
 * 
 * These functions help with encrypting and decrypting fields in
 * TypeScript models that don't go through the Prisma middleware.
 */
import { encryptData, decryptData, isEncrypted } from './index';

/**
 * Encrypt specific fields in an object
 * 
 * @param data The object containing fields to encrypt
 * @param modelName Used as part of the encryption context
 * @param fields Array of field names to encrypt
 * @returns A new object with encrypted fields
 */
export function encryptObjectFields<T extends Record<string, any>>(
  data: T,
  modelName: string,
  fields: (keyof T)[]
): T {
  if (!data) return data;

  // Create a copy to avoid modifying the original
  const result = { ...data };

  fields.forEach((field) => {
    const value = result[field];
    if (value !== undefined && value !== null) {
      // Skip already encrypted data
      if (typeof value === 'string' && isEncrypted(value)) {
        return;
      }

      // For objects, stringify before encryption
      if (typeof value === 'object') {
        result[field] = encryptData(
          JSON.stringify(value),
          `${modelName}:${String(field)}`
        ) as any;
      } else {
        result[field] = encryptData(
          String(value),
          `${modelName}:${String(field)}`
        ) as any;
      }
    }
  });

  return result;
}

/**
 * Decrypt specific fields in an object
 * 
 * @param data The object containing fields to decrypt
 * @param modelName Used as part of the decryption context
 * @param fields Array of field names to decrypt
 * @returns A new object with decrypted fields
 */
export function decryptObjectFields<T extends Record<string, any>>(
  data: T,
  modelName: string,
  fields: (keyof T)[]
): T {
  if (!data) return data;

  // Create a copy to avoid modifying the original
  const result = { ...data };

  fields.forEach((field) => {
    const value = result[field];
    if (value && typeof value === 'string') {
      try {
        if (isEncrypted(value)) {
          const decrypted = decryptData(value, `${modelName}:${String(field)}`);

          // Try to parse JSON for object fields
          try {
            result[field] = JSON.parse(decrypted) as any;
          } catch (e) {
            // Not JSON, use the string as is
            result[field] = decrypted as any;
          }
        }
      } catch (error) {
        console.error(`Error decrypting field ${String(field)} in ${modelName}:`, error);
        // On decryption error, leave the field as is
      }
    }
  });

  return result;
}

/**
 * Encrypt specific fields in an array of objects
 * 
 * @param data The array of objects to process
 * @param modelName Used as part of the encryption context
 * @param fields Array of field names to encrypt
 * @returns A new array of objects with encrypted fields
 */
export function encryptObjectsArray<T extends Record<string, any>>(
  data: T[],
  modelName: string,
  fields: (keyof T)[]
): T[] {
  if (!data || !Array.isArray(data)) return data;
  return data.map(item => encryptObjectFields(item, modelName, fields));
}

/**
 * Decrypt specific fields in an array of objects
 * 
 * @param data The array of objects to process
 * @param modelName Used as part of the decryption context
 * @param fields Array of field names to decrypt
 * @returns A new array of objects with decrypted fields
 */
export function decryptObjectsArray<T extends Record<string, any>>(
  data: T[],
  modelName: string,
  fields: (keyof T)[]
): T[] {
  if (!data || !Array.isArray(data)) return data;
  return data.map(item => decryptObjectFields(item, modelName, fields));
}