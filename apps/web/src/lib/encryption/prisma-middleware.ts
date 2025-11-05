/**
 * Prisma middleware for automatic field-level encryption/decryption
 * 
 * This middleware transparently handles encryption and decryption of
 * sensitive fields when reading from or writing to the database.
 */
import { PrismaClient } from '@prisma/client';
import { encryptData, decryptData, isEncrypted } from './index';

// Map of model names to fields that should be encrypted
// The context string ensures encryption is tied to specific fields
export const encryptedFields: Record<string, string[]> = {
  User: ['metadata'],
  Account: ['refresh_token', 'access_token', 'id_token', 'session_state'],
  IntegrationToken: ['accessToken', 'refreshToken', 'scopes'],
  CareerRecord: ['salaryRange'],
  EmailConnection: ['credentials'],
  EmailMessage: ['subject', 'body', 'htmlBody', 'to', 'cc', 'bcc'],
  HealthRecord: ['bloodType', 'allergies', 'medications'],
  TaxProfile: ['w4', 'income', 'deductions', 'credits'],
  SecureDocument: [], // Already handled by custom encryption
};

/**
 * Apply encryption middleware to a Prisma client instance
 */
export function applyEncryptionMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    // Get the model name and sensitive fields for this model
    const modelName = params.model;
    const sensitiveFields = encryptedFields[modelName] || [];
    
    // Skip if no fields need encryption for this model
    if (sensitiveFields.length === 0) {
      return next(params);
    }

    // Handle create and update operations (encrypt data before saving)
    if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
      let data = params.args.data;
      
      // For upsert, we need to handle both create and update data
      if (params.action === 'upsert') {
        if (data.create) {
          encryptFields(data.create, modelName, sensitiveFields);
        }
        if (data.update) {
          encryptFields(data.update, modelName, sensitiveFields);
        }
      } else {
        // Regular create or update
        encryptFields(data, modelName, sensitiveFields);
      }
    }

    // Execute the database operation
    const result = await next(params);

    // Handle find operations (decrypt data after retrieval)
    if (
      params.action === 'findUnique' || 
      params.action === 'findFirst' || 
      params.action === 'findMany'
    ) {
      if (result) {
        if (Array.isArray(result)) {
          // Handle array of results (findMany)
          result.forEach((item) => {
            decryptFields(item, modelName, sensitiveFields);
          });
        } else {
          // Handle single result
          decryptFields(result, modelName, sensitiveFields);
        }
      }
    }

    return result;
  });
}

/**
 * Encrypt sensitive fields in an object
 */
function encryptFields(
  data: Record<string, any>,
  modelName: string,
  sensitiveFields: string[]
): void {
  sensitiveFields.forEach((field) => {
    if (data[field] !== undefined && data[field] !== null) {
      // Skip already encrypted data
      if (typeof data[field] === 'string' && isEncrypted(data[field])) {
        return;
      }
      
      // For JSON fields, stringify before encryption
      if (typeof data[field] === 'object') {
        data[field] = encryptData(
          JSON.stringify(data[field]),
          `${modelName}:${field}`
        );
      } else {
        data[field] = encryptData(
          String(data[field]),
          `${modelName}:${field}`
        );
      }
    }
  });
}

/**
 * Decrypt sensitive fields in an object
 */
function decryptFields(
  data: Record<string, any>,
  modelName: string,
  sensitiveFields: string[]
): void {
  sensitiveFields.forEach((field) => {
    if (data[field] && typeof data[field] === 'string') {
      try {
        if (isEncrypted(data[field])) {
          const decrypted = decryptData(data[field], `${modelName}:${field}`);
          
          // Try to parse JSON for object fields
          try {
            data[field] = JSON.parse(decrypted);
          } catch (e) {
            // Not JSON, use the string as is
            data[field] = decrypted;
          }
        }
      } catch (error) {
        console.error(`Error decrypting field ${field} in ${modelName}:`, error);
        // On decryption error, leave the field as is
      }
    }
  });
}