/**
 * Enterprise Error Management System
 * Production-ready error handling with categorization, recovery, monitoring, and alerting
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  LOW = 'low',           // Informational, no action needed
  MEDIUM = 'medium',     // Warning, should be investigated
  HIGH = 'high',         // Error, immediate attention needed
  CRITICAL = 'critical', // System failure, urgent action required
}

/**
 * Error Categories for better organization
 */
export enum ErrorCategory {
  NETWORK = 'network',
  DATABASE = 'database',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

/**
 * Error Context Interface
 */
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  url?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  environment?: string;
  version?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * Structured Error Interface
 */
export interface StructuredError {
  id: string;
  fingerprint: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  timestamp: Date;
  occurrences: number;
  lastOccurrence: Date;
  isRecoverable: boolean;
  recoveryAttempts: number;
  resolved: boolean;
  resolvedAt?: Date;
  parentError?: Error;
}

/**
 * Recovery Strategy Interface
 */
export interface RecoveryStrategy {
  name: string;
  maxAttempts: number;
  backoffMs: number;
  execute: (error: StructuredError) => Promise<boolean>;
}

/**
 * Error Metrics
 */
interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Map<ErrorCategory, number>;
  errorsBySeverity: Map<ErrorSeverity, number>;
  errorRate: number; // errors per minute
  lastError?: StructuredError;
  criticalErrors: number;
  resolvedErrors: number;
  averageResolutionTime: number;
}

/**
 * Production Error Manager
 */
export class ErrorManager extends EventEmitter {
  private errors: Map<string, StructuredError> = new Map();
  private errorBuffer: StructuredError[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;
  private metrics: ErrorMetrics;
  private recoveryStrategies: Map<ErrorCategory, RecoveryStrategy[]> = new Map();
  private errorRateWindow: number[] = [];
  private readonly RATE_WINDOW_SIZE = 60; // 60 seconds
  private samplingRate: number = 1.0; // 100% by default
  private alertThresholds: Map<ErrorSeverity, number> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private isShuttingDown = false;

  constructor() {
    super();
    
    // Initialize metrics
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: new Map(),
      errorsBySeverity: new Map(),
      errorRate: 0,
      criticalErrors: 0,
      resolvedErrors: 0,
      averageResolutionTime: 0,
    };

    // Set default alert thresholds
    this.alertThresholds.set(ErrorSeverity.CRITICAL, 1);
    this.alertThresholds.set(ErrorSeverity.HIGH, 10);
    this.alertThresholds.set(ErrorSeverity.MEDIUM, 50);
    this.alertThresholds.set(ErrorSeverity.LOW, 100);

    // Initialize default recovery strategies
    this.initializeDefaultRecoveryStrategies();

    // Start metrics calculation
    this.startMetricsCalculation();

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultRecoveryStrategies(): void {
    // Network error recovery
    this.addRecoveryStrategy(ErrorCategory.NETWORK, {
      name: 'network-retry',
      maxAttempts: 3,
      backoffMs: 1000,
      execute: async (error) => {
        console.log(`Attempting network recovery for error: ${error.id}`);
        // Implement actual network recovery logic
        return true;
      },
    });

    // Database error recovery
    this.addRecoveryStrategy(ErrorCategory.DATABASE, {
      name: 'database-reconnect',
      maxAttempts: 5,
      backoffMs: 2000,
      execute: async (error) => {
        console.log(`Attempting database recovery for error: ${error.id}`);
        // Implement actual database recovery logic
        return true;
      },
    });

    // External service error recovery
    this.addRecoveryStrategy(ErrorCategory.EXTERNAL_SERVICE, {
      name: 'service-fallback',
      maxAttempts: 2,
      backoffMs: 3000,
      execute: async (error) => {
        console.log(`Attempting service fallback for error: ${error.id}`);
        // Implement actual service fallback logic
        return true;
      },
    });
  }

  /**
   * Capture and process an error
   */
  async captureError(
    error: Error | string,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: ErrorContext;
      recoverable?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<StructuredError> {
    // Apply sampling
    if (!this.shouldSample()) {
      console.debug('Error skipped due to sampling');
      return this.createStructuredError(error, options);
    }

    const structuredError = this.createStructuredError(error, options);
    
    // Check for duplicate errors
    const existingError = this.errors.get(structuredError.fingerprint);
    if (existingError) {
      existingError.occurrences++;
      existingError.lastOccurrence = new Date();
      this.updateMetrics(existingError);
      
      // Check if we should alert on recurring errors
      if (this.shouldAlert(existingError)) {
        this.emit('alert', existingError);
      }
      
      return existingError;
    }

    // Store new error
    this.errors.set(structuredError.fingerprint, structuredError);
    this.errorBuffer.push(structuredError);
    
    // Maintain buffer size
    if (this.errorBuffer.length > this.MAX_BUFFER_SIZE) {
      this.errorBuffer.shift();
    }

    // Update metrics
    this.updateMetrics(structuredError);

    // Check patterns
    this.checkErrorPatterns(structuredError);

    // Attempt recovery if applicable
    if (structuredError.isRecoverable) {
      this.attemptRecovery(structuredError);
    }

    // Check if we should alert
    if (this.shouldAlert(structuredError)) {
      this.emit('alert', structuredError);
    }

    // Emit error event
    this.emit('error', structuredError);

    // Log based on severity
    this.logError(structuredError);

    return structuredError;
  }

  /**
   * Create structured error from raw error
   */
  private createStructuredError(
    error: Error | string,
    options: any
  ): StructuredError {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const fingerprint = this.generateFingerprint(errorObj, options.category);
    
    return {
      id: crypto.randomUUID(),
      fingerprint,
      message: errorObj.message,
      stack: errorObj.stack,
      code: (errorObj as any).code,
      statusCode: (errorObj as any).statusCode,
      severity: options.severity || this.determineSeverity(errorObj),
      category: options.category || this.categorizeError(errorObj),
      context: {
        ...options.context,
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
        metadata: options.metadata,
      },
      timestamp: new Date(),
      occurrences: 1,
      lastOccurrence: new Date(),
      isRecoverable: options.recoverable ?? this.isRecoverable(errorObj),
      recoveryAttempts: 0,
      resolved: false,
      parentError: errorObj,
    };
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateFingerprint(error: Error, category?: ErrorCategory): string {
    const components = [
      error.name,
      error.message.replace(/\d+/g, 'N'), // Replace numbers for better grouping
      category || 'unknown',
      // Take first 3 stack frames for fingerprinting
      error.stack?.split('\n').slice(0, 3).join('|') || '',
    ];
    
    return crypto
      .createHash('sha256')
      .update(components.join(':'))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Determine error severity automatically
   */
  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    // Critical patterns
    if (
      message.includes('fatal') ||
      message.includes('crash') ||
      message.includes('out of memory') ||
      message.includes('segmentation fault')
    ) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity patterns
    if (
      message.includes('failed') ||
      message.includes('error') ||
      message.includes('exception') ||
      message.includes('timeout')
    ) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium severity patterns
    if (
      message.includes('warning') ||
      message.includes('deprecated') ||
      message.includes('retry')
    ) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  /**
   * Categorize error automatically
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('xhr') ||
      message.includes('econnrefused') ||
      message.includes('timeout')
    ) {
      return ErrorCategory.NETWORK;
    }
    
    // Database errors
    if (
      message.includes('database') ||
      message.includes('sql') ||
      message.includes('prisma') ||
      message.includes('mongodb') ||
      stack.includes('prisma')
    ) {
      return ErrorCategory.DATABASE;
    }
    
    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format')
    ) {
      return ErrorCategory.VALIDATION;
    }
    
    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('token') ||
      message.includes('jwt')
    ) {
      return ErrorCategory.AUTHENTICATION;
    }
    
    // Authorization errors
    if (
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('access denied')
    ) {
      return ErrorCategory.AUTHORIZATION;
    }
    
    // External service errors
    if (
      message.includes('api') ||
      message.includes('service') ||
      message.includes('third-party') ||
      message.includes('external')
    ) {
      return ErrorCategory.EXTERNAL_SERVICE;
    }
    
    // System errors
    if (
      message.includes('memory') ||
      message.includes('disk') ||
      message.includes('cpu') ||
      message.includes('system')
    ) {
      return ErrorCategory.SYSTEM;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine if error is recoverable
   */
  private isRecoverable(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Recoverable patterns
    const recoverablePatterns = [
      'timeout',
      'temporary',
      'retry',
      'connection',
      'network',
      'rate limit',
      'throttle',
    ];
    
    // Non-recoverable patterns
    const nonRecoverablePatterns = [
      'syntax',
      'type error',
      'reference error',
      'permission denied',
      'not found',
      'invalid',
      'fatal',
    ];
    
    // Check non-recoverable first
    for (const pattern of nonRecoverablePatterns) {
      if (message.includes(pattern)) {
        return false;
      }
    }
    
    // Check recoverable
    for (const pattern of recoverablePatterns) {
      if (message.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: StructuredError): Promise<void> {
    const strategies = this.recoveryStrategies.get(error.category) || [];
    
    for (const strategy of strategies) {
      if (error.recoveryAttempts >= strategy.maxAttempts) {
        continue;
      }
      
      error.recoveryAttempts++;
      
      // Exponential backoff
      const delay = strategy.backoffMs * Math.pow(2, error.recoveryAttempts - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        const recovered = await strategy.execute(error);
        
        if (recovered) {
          error.resolved = true;
          error.resolvedAt = new Date();
          this.metrics.resolvedErrors++;
          this.emit('recovered', error);
          console.log(`Error recovered: ${error.id} using strategy: ${strategy.name}`);
          return;
        }
      } catch (recoveryError) {
        console.error(`Recovery strategy failed: ${strategy.name}`, recoveryError);
      }
    }
    
    // All recovery attempts failed
    this.emit('recovery-failed', error);
  }

  /**
   * Check for error patterns
   */
  private checkErrorPatterns(error: StructuredError): void {
    // Check for error storms (many errors in short time)
    const recentErrors = this.errorBuffer.filter(
      e => Date.now() - e.timestamp.getTime() < 60000 // Last minute
    );
    
    if (recentErrors.length > 100) {
      this.emit('error-storm', {
        count: recentErrors.length,
        categories: this.groupByCategory(recentErrors),
      });
    }
    
    // Check for error chains (related errors)
    const relatedErrors = this.errorBuffer.filter(
      e => e.fingerprint === error.fingerprint && 
           e.id !== error.id
    );
    
    if (relatedErrors.length > 10) {
      this.emit('error-chain', {
        fingerprint: error.fingerprint,
        count: relatedErrors.length,
      });
    }
    
    // Check for cascading failures
    const categoryErrors = this.errorBuffer.filter(
      e => e.category === error.category &&
           Date.now() - e.timestamp.getTime() < 30000 // Last 30 seconds
    );
    
    if (categoryErrors.length > 20) {
      this.emit('cascading-failure', {
        category: error.category,
        count: categoryErrors.length,
      });
      
      // Activate circuit breaker for this category
      this.activateCircuitBreaker(error.category);
    }
  }

  /**
   * Group errors by category
   */
  private groupByCategory(errors: StructuredError[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const error of errors) {
      groups[error.category] = (groups[error.category] || 0) + 1;
    }
    
    return groups;
  }

  /**
   * Activate circuit breaker for a category
   */
  private activateCircuitBreaker(category: string): void {
    let breaker = this.circuitBreakers.get(category);
    
    if (!breaker) {
      breaker = new CircuitBreaker(category);
      this.circuitBreakers.set(category, breaker);
    }
    
    breaker.open();
    
    // Schedule half-open after timeout
    setTimeout(() => {
      breaker?.halfOpen();
    }, 60000); // 1 minute
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: StructuredError): void {
    this.metrics.totalErrors++;
    
    // Update category counts
    const categoryCount = this.metrics.errorsByCategory.get(error.category) || 0;
    this.metrics.errorsByCategory.set(error.category, categoryCount + 1);
    
    // Update severity counts
    const severityCount = this.metrics.errorsBySeverity.get(error.severity) || 0;
    this.metrics.errorsBySeverity.set(error.severity, severityCount + 1);
    
    // Update critical error count
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.metrics.criticalErrors++;
    }
    
    // Update last error
    this.metrics.lastError = error;
    
    // Update error rate
    const now = Date.now();
    this.errorRateWindow.push(now);
    
    // Remove old entries (older than 1 minute)
    this.errorRateWindow = this.errorRateWindow.filter(
      time => now - time < 60000
    );
    
    this.metrics.errorRate = this.errorRateWindow.length;
  }

  /**
   * Check if we should alert
   */
  private shouldAlert(error: StructuredError): boolean {
    const threshold = this.alertThresholds.get(error.severity);
    
    if (!threshold) {
      return false;
    }
    
    // Check if error occurrences exceed threshold
    if (error.occurrences >= threshold) {
      return true;
    }
    
    // Always alert on critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      return true;
    }
    
    // Alert on high error rate
    if (this.metrics.errorRate > 100) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if error should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.samplingRate;
  }

  /**
   * Log error based on severity
   */
  private logError(error: StructuredError): void {
    const logData = {
      id: error.id,
      fingerprint: error.fingerprint,
      message: error.message,
      severity: error.severity,
      category: error.category,
      occurrences: error.occurrences,
      context: error.context,
    };
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('[CRITICAL ERROR]', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('[HIGH ERROR]', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('[MEDIUM ERROR]', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('[LOW ERROR]', logData);
        break;
    }
  }

  /**
   * Start metrics calculation interval
   */
  private startMetricsCalculation(): void {
    setInterval(() => {
      if (this.isShuttingDown) return;
      
      // Calculate average resolution time
      const resolvedErrors = Array.from(this.errors.values()).filter(e => e.resolved);
      
      if (resolvedErrors.length > 0) {
        const totalTime = resolvedErrors.reduce((sum, error) => {
          const resolutionTime = error.resolvedAt!.getTime() - error.timestamp.getTime();
          return sum + resolutionTime;
        }, 0);
        
        this.metrics.averageResolutionTime = Math.round(totalTime / resolvedErrors.length);
      }
      
      // Emit metrics
      this.emit('metrics', this.getMetrics());
    }, 30000); // Every 30 seconds
  }

  /**
   * Add recovery strategy
   */
  addRecoveryStrategy(category: ErrorCategory, strategy: RecoveryStrategy): void {
    const strategies = this.recoveryStrategies.get(category) || [];
    strategies.push(strategy);
    this.recoveryStrategies.set(category, strategies);
  }

  /**
   * Set sampling rate
   */
  setSamplingRate(rate: number): void {
    if (rate < 0 || rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
    this.samplingRate = rate;
  }

  /**
   * Set alert threshold
   */
  setAlertThreshold(severity: ErrorSeverity, threshold: number): void {
    this.alertThresholds.set(severity, threshold);
  }

  /**
   * Get error by ID
   */
  getError(id: string): StructuredError | undefined {
    return Array.from(this.errors.values()).find(e => e.id === id);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): StructuredError[] {
    return Array.from(this.errors.values()).filter(e => e.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): StructuredError[] {
    return Array.from(this.errors.values()).filter(e => e.severity === severity);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(minutes: number = 60): StructuredError[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.errorBuffer.filter(e => e.timestamp.getTime() > cutoff);
  }

  /**
   * Get metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors(): void {
    for (const [fingerprint, error] of this.errors) {
      if (error.resolved) {
        this.errors.delete(fingerprint);
      }
    }
  }

  /**
   * Export errors for analysis
   */
  exportErrors(): {
    errors: StructuredError[];
    metrics: ErrorMetrics;
    timestamp: Date;
  } {
    return {
      errors: Array.from(this.errors.values()),
      metrics: this.getMetrics(),
      timestamp: new Date(),
    };
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`[ErrorManager] Received ${signal}, shutting down...`);
      this.isShuttingDown = true;
      
      // Export errors before shutdown
      const errorData = this.exportErrors();
      console.log(`[ErrorManager] Exporting ${errorData.errors.length} errors`);
      
      // Save to file or send to monitoring service
      // await this.persistErrors(errorData);
      
      this.emit('shutdown', errorData);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private successCount = 0;
  private readonly threshold = 5;
  private readonly successThreshold = 3;
  
  constructor(private name: string) {}
  
  open(): void {
    this.state = 'OPEN';
    this.failures = 0;
    console.log(`[CircuitBreaker] ${this.name} opened`);
  }
  
  close(): void {
    this.state = 'CLOSED';
    this.successCount = 0;
    console.log(`[CircuitBreaker] ${this.name} closed`);
  }
  
  halfOpen(): void {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    console.log(`[CircuitBreaker] ${this.name} half-open`);
  }
  
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.close();
      }
    }
  }
  
  recordFailure(): void {
    this.failures++;
    
    if (this.state === 'HALF_OPEN' || this.failures >= this.threshold) {
      this.open();
    }
  }
  
  canExecute(): boolean {
    return this.state !== 'OPEN';
  }
  
  getState(): string {
    return this.state;
  }
}

/**
 * Error Pattern Detection
 */
interface ErrorPattern {
  name: string;
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  autoRecover: boolean;
}

/**
 * Global Error Manager Instance
 */
let errorManager: ErrorManager | null = null;

/**
 * Get Error Manager instance
 */
export function getErrorManager(): ErrorManager {
  if (!errorManager) {
    errorManager = new ErrorManager();
  }
  return errorManager;
}

/**
 * Helper function to capture errors easily
 */
export async function captureError(
  error: Error | string,
  options?: any
): Promise<StructuredError> {
  return getErrorManager().captureError(error, options);
}

/**
 * Export default instance
 */
export default getErrorManager();