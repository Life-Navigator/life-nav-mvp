/**
 * API request logging middleware
 * 
 * This middleware logs API requests and responses.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger, logRequest, logResponse } from '@/lib/utils/logger';

/**
 * Middleware for logging API requests and responses
 */
export function withLogging(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const startTime = Date.now();
    
    // Log the request
    logRequest(request);
    
    try {
      // Execute the handler
      const response = await handler(request, ...args);
      
      // Log the response
      logResponse(request, response, startTime);
      
      return response;
    } catch (error) {
      // Log any errors
      logger.exception(
        error instanceof Error ? error : new Error(String(error)),
        'API request error',
        {
          method: request.method,
          path: new URL(request.url).pathname,
          startTime,
          duration: `${Date.now() - startTime}ms`,
        }
      );
      
      // Re-throw the error to be handled by error handling middleware
      throw error;
    }
  };
}

/**
 * Combined middleware for both logging and error handling
 */
export function createApiHandler(handler: Function) {
  return withLogging(handler);
}