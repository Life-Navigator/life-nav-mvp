/**
 * Error handling utilities
 * 
 * Provides structured error handling and standardized error responses.
 */
import { NextResponse } from 'next/server';
import { logger } from './logger';

// Base application error class
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  
  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Ensure proper stack trace capturing
    Error.captureStackTrace(this, this.constructor);
    
    // Set the prototype explicitly for better instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Known error types with specific status codes and error codes
export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(message, 400, code, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(message, 401, code, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(message, 403, code, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, 409, code, true);
  }
}

export class ValidationError extends AppError {
  details?: Record<string, string[]>;
  
  constructor(message: string, details?: Record<string, string[]>, code = 'VALIDATION_ERROR') {
    super(message, 422, code, true);
    this.details = details;
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code, true);
  }
}

// Function to create standardized error responses for API routes
export function createErrorResponse(error: any, req?: Request): NextResponse {
  // If it's already an AppError, use its properties
  if (error instanceof AppError) {
    const response = {
      error: {
        message: error.message,
        code: error.code,
      },
    };
    
    // Add validation details if available
    if (error instanceof ValidationError && error.details) {
      response.error = {
        ...response.error,
        details: error.details,
      };
    }
    
    // Log the error with request info if available
    if (req) {
      logger.error(`API error: ${error.statusCode} ${error.code}`, {
        path: new URL(req.url).pathname,
        method: req.method,
        error: error.message,
      });
    } else {
      logger.error(`Error: ${error.statusCode} ${error.code}`, { error: error.message });
    }
    
    return NextResponse.json(response, { status: error.statusCode });
  }
  
  // For unknown errors, create a generic error response
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log the error
  if (error instanceof Error) {
    logger.exception(error, 'Unexpected error', req ? { 
      path: new URL(req.url).pathname,
      method: req.method 
    } : undefined);
  } else {
    logger.error('Unknown error', { error });
  }
  
  // In production, don't expose error details
  const message = isProduction 
    ? 'An unexpected error occurred' 
    : error instanceof Error ? error.message : String(error);
  
  return NextResponse.json(
    {
      error: {
        message,
        code: 'INTERNAL_SERVER_ERROR',
      },
    },
    { status: 500 }
  );
}

// Higher-order function to wrap API route handlers with error handling
export function withErrorHandling(handler: Function) {
  return async (req: Request, ...args: any[]) => {
    const startTime = Date.now();
    
    try {
      const result = await handler(req, ...args);
      return result;
    } catch (error) {
      return createErrorResponse(error, req);
    }
  };
}