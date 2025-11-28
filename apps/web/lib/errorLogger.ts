/**
 * Client-side Error Logger
 *
 * Captures and reports errors to the backend for monitoring:
 * - JavaScript errors (window.onerror)
 * - Unhandled promise rejections
 * - API call failures
 * - Component errors (via ErrorBoundary)
 *
 * Errors are batched and sent periodically to reduce network overhead.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const LOG_ENDPOINT = `${API_URL}/client-log`;
const BATCH_ENDPOINT = `${API_URL}/client-log/batch`;

// Batch settings
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30 seconds

interface LogEntry {
  level: 'error' | 'warning' | 'info';
  message: string;
  error_type?: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
  timestamp?: string;
  context?: Record<string, unknown>;
}

class ErrorLogger {
  private queue: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Initialize the error logger
   * Sets up global error handlers
   */
  init() {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    // Global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.logError({
        level: 'error',
        message: String(message),
        error_type: error?.name || 'Error',
        stack_trace: error?.stack,
        url: window.location.href,
        context: {
          source,
          lineno,
          colno,
        },
      });
      return false; // Don't prevent default handling
    };

    // Unhandled promise rejection handler
    window.onunhandledrejection = (event) => {
      const error = event.reason;
      this.logError({
        level: 'error',
        message: error?.message || 'Unhandled Promise Rejection',
        error_type: 'UnhandledRejection',
        stack_trace: error?.stack,
        url: window.location.href,
        context: {
          reason: String(error),
        },
      });
    };

    // Start batch flush timer
    this.startFlushTimer();

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    this.isInitialized = true;
    console.log('[ErrorLogger] Initialized');
  }

  /**
   * Log an error
   */
  logError(entry: Omit<LogEntry, 'timestamp' | 'user_agent'>) {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    this.queue.push(logEntry);

    // Flush immediately for critical errors
    if (entry.level === 'error' && this.queue.length >= 1) {
      this.flush();
    } else if (this.queue.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: Record<string, unknown>) {
    this.logError({
      level: 'warning',
      message,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      context,
    });
  }

  /**
   * Log API error
   */
  logApiError(
    endpoint: string,
    status: number,
    message: string,
    context?: Record<string, unknown>
  ) {
    this.logError({
      level: 'error',
      message: `API Error: ${endpoint} - ${status} - ${message}`,
      error_type: 'ApiError',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      context: {
        endpoint,
        status,
        ...context,
      },
    });
  }

  /**
   * Log map-related error
   */
  logMapError(message: string, context?: Record<string, unknown>) {
    this.logError({
      level: 'error',
      message: `Map Error: ${message}`,
      error_type: 'MapError',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      context,
    });
  }

  /**
   * Log component error (from ErrorBoundary)
   */
  logComponentError(
    error: Error,
    componentStack: string,
    componentName?: string
  ) {
    this.logError({
      level: 'error',
      message: error.message,
      error_type: error.name,
      stack_trace: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      context: {
        componentStack,
        componentName,
      },
    });
  }

  /**
   * Flush queued logs to server
   */
  async flush() {
    if (this.queue.length === 0) {
      return;
    }

    const logsToSend = [...this.queue];
    this.queue = [];

    try {
      if (logsToSend.length === 1) {
        // Send single log
        await fetch(LOG_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logsToSend[0]),
        });
      } else {
        // Send batch
        await fetch(BATCH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ logs: logsToSend }),
        });
      }
    } catch (e) {
      // If logging fails, don't spam console, just silently fail
      // We don't want error logging to cause more errors
      console.warn('[ErrorLogger] Failed to send logs:', e);
      // Re-queue failed logs (up to a limit)
      if (this.queue.length < 50) {
        this.queue.push(...logsToSend);
      }
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL);
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

// Convenience exports
export const initErrorLogger = () => errorLogger.init();
export const logError = (entry: Omit<LogEntry, 'timestamp' | 'user_agent'>) =>
  errorLogger.logError(entry);
export const logWarning = (message: string, context?: Record<string, unknown>) =>
  errorLogger.logWarning(message, context);
export const logApiError = (
  endpoint: string,
  status: number,
  message: string,
  context?: Record<string, unknown>
) => errorLogger.logApiError(endpoint, status, message, context);
export const logMapError = (message: string, context?: Record<string, unknown>) =>
  errorLogger.logMapError(message, context);
export const logComponentError = (
  error: Error,
  componentStack: string,
  componentName?: string
) => errorLogger.logComponentError(error, componentStack, componentName);
