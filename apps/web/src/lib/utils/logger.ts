/**
 * Application logging system
 * 
 * Provides structured logging with different log levels and contextual data.
 * In production, logs can be directed to monitoring services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

// Log levels in order of verbosity
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment or default to 'info'
const getMinLogLevel = (): number => {
  const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LOG_LEVELS[configuredLevel in LOG_LEVELS ? configuredLevel : 'info'];
};

// Check if the environment is production
const isProduction = process.env.NODE_ENV === 'production';

// Format the log entry as a string
const formatLogEntry = (entry: LogEntry): string => {
  const { timestamp, level, message, context } = entry;
  const contextString = context ? ` ${JSON.stringify(context)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${contextString}`;
};

// Send log to appropriate destination based on environment
const sendLog = (entry: LogEntry) => {
  // Skip logs that are below the configured level
  if (LOG_LEVELS[entry.level] < getMinLogLevel()) {
    return;
  }

  // In production, use structured logging
  if (isProduction) {
    // In a real app, would send to logging service like CloudWatch, Datadog, etc.
    console.log(JSON.stringify(entry));
  } else {
    // In development, use formatted output
    const formattedLog = formatLogEntry(entry);
    switch (entry.level) {
      case 'debug':
        console.debug(formattedLog);
        break;
      case 'info':
        console.info(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'error':
        console.error(formattedLog);
        break;
    }
  }
};

// Create a log entry with the given level, message, and context
const createLog = (level: LogLevel, message: string, context?: LogContext) => {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = {
    timestamp,
    level,
    message,
    context,
  };
  sendLog(entry);
};

// Logger object with methods for each log level
export const logger = {
  debug: (message: string, context?: LogContext) => createLog('debug', message, context),
  info: (message: string, context?: LogContext) => createLog('info', message, context),
  warn: (message: string, context?: LogContext) => createLog('warn', message, context),
  error: (message: string, context?: LogContext) => createLog('error', message, context),
  
  // Log an Error object with stack trace
  exception: (error: Error, message?: string, context?: LogContext) => {
    const errorContext = {
      ...context,
      errorName: error.name,
      errorStack: error.stack,
    };
    createLog('error', message || error.message, errorContext);
  },
  
  // Create a child logger with additional context
  child: (baseContext: LogContext) => ({
    debug: (message: string, context?: LogContext) => 
      createLog('debug', message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) => 
      createLog('info', message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) => 
      createLog('warn', message, { ...baseContext, ...context }),
    error: (message: string, context?: LogContext) => 
      createLog('error', message, { ...baseContext, ...context }),
    exception: (error: Error, message?: string, context?: LogContext) => {
      const errorContext = {
        ...baseContext,
        ...context,
        errorName: error.name,
        errorStack: error.stack,
      };
      createLog('error', message || error.message, errorContext);
    },
  }),
};

// API request logger middleware for Next.js
export const logRequest = (req: Request, extraContext?: LogContext) => {
  if (process.env.ENABLE_API_LOGGING !== 'true') {
    return;
  }
  
  const url = new URL(req.url);
  const context = {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    userAgent: req.headers.get('user-agent'),
    ...extraContext,
  };
  
  logger.info(`API request: ${req.method} ${url.pathname}`, context);
};

// API response logger
export const logResponse = (
  req: Request,
  res: Response,
  startTime: number,
  extraContext?: LogContext
) => {
  if (process.env.ENABLE_API_LOGGING !== 'true') {
    return;
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const url = new URL(req.url);
  
  const context = {
    method: req.method,
    path: url.pathname,
    statusCode: res.status,
    duration: `${duration}ms`,
    ...extraContext,
  };
  
  logger.info(`API response: ${req.method} ${url.pathname} ${res.status}`, context);
};

// Request error logger
export const logRequestError = (
  req: Request,
  error: Error,
  extraContext?: LogContext
) => {
  const url = new URL(req.url);
  const context = {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    userAgent: req.headers.get('user-agent'),
    ...extraContext,
  };
  
  logger.exception(error, `API error: ${req.method} ${url.pathname}`, context);
};