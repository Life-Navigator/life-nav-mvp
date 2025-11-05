'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureError, ErrorSeverity, ErrorCategory } from '@/lib/errors/error-manager';
import { ArrowPathIcon, ExclamationTriangleIcon, HomeIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  isolate?: boolean; // Isolate this boundary from parent boundaries
  showDetails?: boolean; // Show error details in production
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>; // Keys that trigger reset when changed
  resetOnPropsChange?: boolean;
  maxRetries?: number;
  level?: 'page' | 'section' | 'component'; // Boundary level for better error isolation
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  isRecovering: boolean;
  lastResetKeys?: Array<string | number>;
}

export class ProductionErrorBoundary extends Component<Props, State> {
  private resetTimeoutId?: NodeJS.Timeout;
  private readonly maxRetries: number;

  constructor(props: Props) {
    super(props);
    
    this.maxRetries = props.maxRetries ?? 3;
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
      lastResetKeys: props.resetKeys,
    };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Reset error boundary when resetKeys change
    if (props.resetKeys && state.lastResetKeys) {
      const hasChanged = props.resetKeys.some(
        (key, index) => key !== state.lastResetKeys![index]
      );
      
      if (hasChanged) {
        return {
          hasError: false,
          error: null,
          errorInfo: null,
          errorId: null,
          retryCount: 0,
          isRecovering: false,
          lastResetKeys: props.resetKeys,
        };
      }
    }
    
    return null;
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      isRecovering: false,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Determine error context based on boundary level
    const level = this.props.level || 'component';
    const severity = this.determineSeverity(error, level);
    const category = this.categorizeError(error);
    
    // Capture error with production error manager
    try {
      const structuredError = await captureError(error, {
        severity,
        category,
        context: {
          componentStack: errorInfo.componentStack,
          props: this.sanitizeProps(this.props),
          state: this.sanitizeState(this.state),
          level,
          retryCount: this.state.retryCount,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        },
        recoverable: this.state.retryCount < this.maxRetries,
        metadata: {
          errorBoundaryLevel: level,
          hasCustomFallback: !!this.props.fallback,
          isolate: this.props.isolate,
        },
      });
      
      this.setState({
        errorInfo,
        errorId: structuredError.id,
      });
      
      // Call optional error handler
      if (this.props.onError) {
        this.props.onError(error, errorInfo);
      }
      
      // Auto-recovery attempt for transient errors
      if (this.shouldAttemptAutoRecovery(error)) {
        this.scheduleAutoRecovery();
      }
    } catch (captureErr) {
      console.error('[ErrorBoundary] Failed to capture error:', captureErr);
    }
  }

  /**
   * Determine error severity based on error type and boundary level
   */
  private determineSeverity(error: Error, level: string): ErrorSeverity {
    // Page-level errors are more severe
    if (level === 'page') {
      return ErrorSeverity.HIGH;
    }
    
    // Check for specific error types
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return ErrorSeverity.MEDIUM; // Code splitting errors are recoverable
    }
    
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return ErrorSeverity.MEDIUM;
    }
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return ErrorSeverity.HIGH; // Programming errors
    }
    
    return level === 'section' ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW;
  }

  /**
   * Categorize error for better tracking
   */
  private categorizeError(error: Error): ErrorCategory {
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return ErrorCategory.NETWORK;
    }
    
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return ErrorCategory.NETWORK;
    }
    
    if (error.message.includes('Cannot read') || error.message.includes('undefined')) {
      return ErrorCategory.BUSINESS_LOGIC;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Check if auto-recovery should be attempted
   */
  private shouldAttemptAutoRecovery(error: Error): boolean {
    // Auto-recover from chunk load errors
    if (error.name === 'ChunkLoadError') {
      return true;
    }
    
    // Auto-recover from network errors
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return true;
    }
    
    // Don't auto-recover from programming errors
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return false;
    }
    
    return this.state.retryCount < this.maxRetries;
  }

  /**
   * Schedule automatic recovery attempt
   */
  private scheduleAutoRecovery(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    
    this.setState({ isRecovering: true });
    
    this.resetTimeoutId = setTimeout(() => {
      this.handleReset();
    }, delay);
  }

  /**
   * Sanitize props for error reporting (remove sensitive data)
   */
  private sanitizeProps(props: Props): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const key in props) {
      if (key === 'children' || key === 'fallback') {
        sanitized[key] = '[Component]';
      } else if (typeof (props as any)[key] === 'function') {
        sanitized[key] = '[Function]';
      } else if (typeof (props as any)[key] === 'object') {
        sanitized[key] = '[Object]';
      } else {
        sanitized[key] = (props as any)[key];
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize state for error reporting
   */
  private sanitizeState(state: State): Record<string, any> {
    return {
      hasError: state.hasError,
      errorId: state.errorId,
      retryCount: state.retryCount,
      isRecovering: state.isRecovering,
    };
  }

  /**
   * Handle error reset
   */
  handleReset = (): void => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1,
      isRecovering: false,
    }));
  };

  /**
   * Handle page reload
   */
  handleReload = (): void => {
    window.location.reload();
  };

  /**
   * Handle navigation to home
   */
  handleGoHome = (): void => {
    window.location.href = '/dashboard';
  };

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      const { error, errorId, retryCount, isRecovering } = this.state;
      const level = this.props.level || 'component';
      const showDetails = this.props.showDetails || process.env.NODE_ENV === 'development';

      // Different UI based on boundary level
      if (level === 'page') {
        return <PageErrorFallback
          error={error}
          errorId={errorId}
          retryCount={retryCount}
          maxRetries={this.maxRetries}
          isRecovering={isRecovering}
          showDetails={showDetails}
          onReset={this.handleReset}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />;
      }

      if (level === 'section') {
        return <SectionErrorFallback
          error={error}
          errorId={errorId}
          retryCount={retryCount}
          maxRetries={this.maxRetries}
          isRecovering={isRecovering}
          showDetails={showDetails}
          onReset={this.handleReset}
        />;
      }

      // Component level error
      return <ComponentErrorFallback
        error={error}
        errorId={errorId}
        retryCount={retryCount}
        maxRetries={this.maxRetries}
        isRecovering={isRecovering}
        showDetails={showDetails}
        onReset={this.handleReset}
      />;
    }

    return this.props.children;
  }
}

/**
 * Page-level error fallback
 */
function PageErrorFallback({
  error,
  errorId,
  retryCount,
  maxRetries,
  isRecovering,
  showDetails,
  onReset,
  onReload,
  onGoHome,
}: any) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isRecovering 
              ? 'Attempting to recover...' 
              : 'We encountered an unexpected error while loading this page.'}
          </p>
          
          {retryCount > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Retry attempt {retryCount} of {maxRetries}
            </p>
          )}

          {errorId && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              Error ID: <code className="font-mono">{errorId}</code>
            </p>
          )}
        </div>

        {showDetails && error && (
          <div className="mt-4">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="flex items-center justify-center w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ChevronDownIcon 
                className={`h-4 w-4 mr-1 transform transition-transform ${detailsOpen ? 'rotate-180' : ''}`} 
              />
              {detailsOpen ? 'Hide' : 'Show'} error details
            </button>
            
            {detailsOpen && (
              <div className="mt-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <pre className="mt-2 text-xs text-red-700 dark:text-red-300 overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 space-y-4">
          {!isRecovering && retryCount < maxRetries && (
            <button
              onClick={onReset}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              Try Again
            </button>
          )}
          
          <button
            onClick={onReload}
            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Reload Page
          </button>
          
          <button
            onClick={onGoHome}
            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <HomeIcon className="h-5 w-5 mr-2" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Section-level error fallback
 */
function SectionErrorFallback({
  error,
  errorId,
  retryCount,
  maxRetries,
  isRecovering,
  showDetails,
  onReset,
}: any) {
  return (
    <div className="p-8 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-start">
        <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mt-1" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            This section couldn't be loaded
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {isRecovering ? 'Attempting to recover...' : 'An error occurred while loading this section.'}
          </p>
          
          {showDetails && error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error.message}
            </p>
          )}
          
          {errorId && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Error ID: {errorId}
            </p>
          )}
          
          {!isRecovering && retryCount < maxRetries && (
            <button
              onClick={onReset}
              className="mt-3 text-sm font-medium text-red-800 dark:text-red-200 hover:text-red-600 dark:hover:text-red-100"
            >
              Try again →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Component-level error fallback
 */
function ComponentErrorFallback({
  error,
  errorId,
  retryCount,
  maxRetries,
  isRecovering,
  showDetails,
  onReset,
}: any) {
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded">
      <div className="flex items-center">
        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
        <span className="ml-2 text-sm text-yellow-800 dark:text-yellow-200">
          {isRecovering ? 'Recovering...' : 'Component error'}
        </span>
        {!isRecovering && retryCount < maxRetries && (
          <button
            onClick={onReset}
            className="ml-auto text-sm text-yellow-800 dark:text-yellow-200 hover:text-yellow-600"
          >
            Retry
          </button>
        )}
      </div>
      {showDetails && error && (
        <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{error.message}</p>
      )}
    </div>
  );
}

/**
 * Hook for programmatic error handling
 */
export function useErrorHandler() {
  return (error: Error) => {
    captureError(error, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.BUSINESS_LOGIC,
      context: {
        source: 'useErrorHandler',
      },
    });
    throw error;
  };
}

/**
 * HOC for adding error boundary to components
 */
export function withProductionErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<Props>
) {
  const WrappedComponent = (props: P) => (
    <ProductionErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ProductionErrorBoundary>
  );

  WrappedComponent.displayName = `withProductionErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}