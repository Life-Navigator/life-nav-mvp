/**
 * Global Error Handler
 * Catches all unhandled errors and promise rejections
 */

import { captureError, ErrorSeverity, ErrorCategory, getErrorManager } from './error-manager';

/**
 * Initialize global error handlers
 */
export function initializeGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') {
    // Node.js error handlers
    initializeNodeErrorHandlers();
  } else {
    // Browser error handlers
    initializeBrowserErrorHandlers();
  }
}

/**
 * Initialize browser error handlers
 */
function initializeBrowserErrorHandlers(): void {
  const errorManager = getErrorManager();

  // Handle unhandled errors
  window.addEventListener('error', async (event: ErrorEvent) => {
    event.preventDefault();
    
    await captureError(event.error || new Error(event.message), {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.SYSTEM,
      context: {
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', async (event: PromiseRejectionEvent) => {
    event.preventDefault();
    
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    await captureError(error, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.SYSTEM,
      context: {
        source: 'unhandledrejection',
        promise: event.promise.toString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    });
  });

  // Handle network errors
  window.addEventListener('offline', () => {
    captureError(new Error('Network connection lost'), {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.NETWORK,
      context: {
        source: 'offline-event',
      },
      recoverable: true,
    });
  });

  // Handle chunk load errors (for Next.js)
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      
      // Check for failed chunk loads
      if (!response.ok && args[0] && typeof args[0] === 'string' && args[0].includes('_next/static/chunks')) {
        await captureError(new Error(`Failed to load chunk: ${args[0]}`), {
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.NETWORK,
          context: {
            source: 'chunk-load-error',
            url: args[0],
            status: response.status,
          },
          recoverable: true,
        });
      }
      
      return response;
    } catch (error) {
      // Capture fetch errors
      if (error instanceof Error) {
        await captureError(error, {
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.NETWORK,
          context: {
            source: 'fetch-error',
            url: args[0],
          },
          recoverable: true,
        });
      }
      throw error;
    }
  };

  // Monitor console errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    
    // Extract error from console
    const error = args.find(arg => arg instanceof Error) || new Error(args.join(' '));
    
    captureError(error, {
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.UNKNOWN,
      context: {
        source: 'console.error',
        args: args.map(arg => 
          arg instanceof Error ? arg.message : 
          typeof arg === 'object' ? JSON.stringify(arg) : 
          String(arg)
        ),
      },
    });
  };

  // Monitor performance issues
  if ('PerformanceObserver' in window) {
    try {
      // Long tasks (blocking main thread)
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Task longer than 50ms
            captureError(new Error(`Long task detected: ${entry.duration}ms`), {
              severity: entry.duration > 200 ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
              category: ErrorCategory.SYSTEM,
              context: {
                source: 'long-task',
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name,
              },
            });
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });

      // Layout shifts (CLS)
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as any;
          if (!shift.hadRecentInput && shift.value > 0.1) { // Significant layout shift
            captureError(new Error(`Layout shift detected: ${shift.value}`), {
              severity: shift.value > 0.25 ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
              category: ErrorCategory.SYSTEM,
              context: {
                source: 'layout-shift',
                value: shift.value,
                sources: shift.sources,
              },
            });
          }
        }
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('Performance monitoring not available');
    }
  }

  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (performance as any).memory;
      const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      
      if (usedPercent > 90) {
        captureError(new Error(`High memory usage: ${usedPercent.toFixed(1)}%`), {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.SYSTEM,
          context: {
            source: 'memory-monitor',
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          },
        });
      }
    }, 30000); // Check every 30 seconds
  }

  // Setup error manager listeners for alerts
  errorManager.on('alert', (error) => {
    console.error('[ALERT]', error);
    // Send to monitoring service
  });

  errorManager.on('error-storm', (data) => {
    console.error('[ERROR STORM]', data);
    // Trigger emergency procedures
  });

  errorManager.on('cascading-failure', (data) => {
    console.error('[CASCADING FAILURE]', data);
    // Activate circuit breakers
  });

  console.log('[GlobalErrorHandler] Browser error handlers initialized');
}

/**
 * Initialize Node.js error handlers
 */
function initializeNodeErrorHandlers(): void {
  const errorManager = getErrorManager();

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error: Error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    
    await captureError(error, {
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.SYSTEM,
      context: {
        source: 'uncaughtException',
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
    
    // Give time for error to be logged
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error 
      ? reason 
      : new Error(String(reason));
    
    await captureError(error, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.SYSTEM,
      context: {
        source: 'unhandledRejection',
        promise: promise.toString(),
      },
    });
  });

  // Handle warnings
  process.on('warning', async (warning: Error) => {
    await captureError(warning, {
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.SYSTEM,
      context: {
        source: 'warning',
        type: (warning as any).code,
      },
    });
  });

  // Monitor memory usage
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    if (heapUsedPercent > 85) {
      captureError(new Error(`High memory usage: ${heapUsedPercent.toFixed(1)}%`), {
        severity: heapUsedPercent > 95 ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
        category: ErrorCategory.SYSTEM,
        context: {
          source: 'memory-monitor',
          memoryUsage: usage,
        },
      });
    }
  }, 30000); // Check every 30 seconds

  // Monitor event loop lag
  let lastCheck = Date.now();
  setInterval(() => {
    const now = Date.now();
    const lag = now - lastCheck - 5000; // Expected 5 second interval
    
    if (lag > 100) { // More than 100ms lag
      captureError(new Error(`Event loop lag detected: ${lag}ms`), {
        severity: lag > 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        category: ErrorCategory.SYSTEM,
        context: {
          source: 'event-loop-monitor',
          lag,
        },
      });
    }
    
    lastCheck = now;
  }, 5000);

  console.log('[GlobalErrorHandler] Node.js error handlers initialized');
}

/**
 * Express.js error middleware
 */
export function createExpressErrorHandler() {
  return async (err: Error, req: any, res: any, next: any) => {
    const structuredError = await captureError(err, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.SYSTEM,
      context: {
        source: 'express-middleware',
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        body: req.body,
        query: req.query,
        params: req.params,
      },
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred processing your request' 
        : err.message,
      errorId: structuredError.id,
    });
  };
}

/**
 * Next.js API route error wrapper
 */
export function withErrorHandler(handler: Function) {
  return async (req: any, res: any) => {
    try {
      return await handler(req, res);
    } catch (error) {
      const structuredError = await captureError(error as Error, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.SYSTEM,
        context: {
          source: 'nextjs-api-route',
          method: req.method,
          url: req.url,
          query: req.query,
          body: req.body,
        },
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred processing your request' 
          : (error as Error).message,
        errorId: structuredError.id,
      });
    }
  };
}

/**
 * Async error wrapper for any async function
 */
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      await captureError(error as Error, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        context: {
          source: 'async-wrapper',
          function: fn.name,
          args: args.map(arg => 
            typeof arg === 'object' ? '[Object]' : 
            typeof arg === 'function' ? '[Function]' : 
            String(arg)
          ),
        },
      });
      throw error;
    }
  }) as T;
}