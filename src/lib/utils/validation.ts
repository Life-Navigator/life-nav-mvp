/**
 * Request validation utilities
 * 
 * Provides a lightweight validation system for API request data.
 */
import { ValidationError } from './error-handling';

// Validation rule types
type ValidationRule<T> = (value: any, field: string, data: T) => string | undefined;

// Validation schema definition
export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T>[];
};

// Validation result
type ValidationResult = {
  valid: boolean;
  errors?: Record<string, string[]>;
};

/**
 * Validate an object against a schema
 */
export function validate<T extends Record<string, any>>(
  data: T,
  schema: ValidationSchema<T>
): ValidationResult {
  const errors: Record<string, string[]> = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    if (!rules || !rules.length) continue;
    
    const fieldErrors: string[] = [];
    
    for (const rule of rules) {
      const error = rule(data[field], field, data);
      if (error) {
        fieldErrors.push(error);
      }
    }
    
    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length === 0 ? undefined : errors,
  };
}

/**
 * Safely parse JSON from a request body
 * Throws ValidationError if JSON is invalid
 */
export async function safeParseJSON<T = any>(request: Request): Promise<T> {
  try {
    const data = await request.json() as T;
    return data;
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Parse and validate a request body
 * Throws ValidationError if validation fails
 */
export async function validateRequestBody<T extends Record<string, any>>(
  request: Request,
  schema: ValidationSchema<T>
): Promise<T> {
  const data = await safeParseJSON<T>(request);

  const validationResult = validate(data, schema);

  if (!validationResult.valid) {
    throw new ValidationError('Validation failed', validationResult.errors);
  }

  return data;
}

// Common validation rules
export const rules = {
  // Required field
  required: <T>(value: any, field: string): string | undefined => {
    if (value === undefined || value === null || value === '') {
      return `${field} is required`;
    }
  },
  
  // String minimum length
  minLength: (min: number) => <T>(value: any, field: string): string | undefined => {
    if (value !== undefined && value !== null && String(value).length < min) {
      return `${field} must be at least ${min} characters`;
    }
  },
  
  // String maximum length
  maxLength: (max: number) => <T>(value: any, field: string): string | undefined => {
    if (value !== undefined && value !== null && String(value).length > max) {
      return `${field} must be no more than ${max} characters`;
    }
  },
  
  // Pattern match
  pattern: (regex: RegExp, message: string) => <T>(value: any, field: string): string | undefined => {
    if (value !== undefined && value !== null && !regex.test(String(value))) {
      return message || `${field} is invalid`;
    }
  },
  
  // Email format
  email: <T>(value: any, field: string): string | undefined => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (value !== undefined && value !== null && !emailRegex.test(String(value))) {
      return `${field} must be a valid email address`;
    }
  },
  
  // Number minimum value
  min: (min: number) => <T>(value: any, field: string): string | undefined => {
    if (value !== undefined && value !== null && Number(value) < min) {
      return `${field} must be at least ${min}`;
    }
  },
  
  // Number maximum value
  max: (max: number) => <T>(value: any, field: string): string | undefined => {
    if (value !== undefined && value !== null && Number(value) > max) {
      return `${field} must be no more than ${max}`;
    }
  },
  
  // Custom validation rule
  custom: <T>(validator: (value: any, field: string, data: T) => boolean, message: string) => 
    (value: any, field: string, data: T): string | undefined => {
      if (!validator(value, field, data)) {
        return message;
      }
    },
};