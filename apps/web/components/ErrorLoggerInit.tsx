'use client';

import { useEffect } from 'react';
import { initErrorLogger } from '@/lib/errorLogger';

/**
 * Error Logger Initializer Component
 *
 * Place this component in your app layout to initialize
 * global error logging for the entire application.
 */
export function ErrorLoggerInit() {
  useEffect(() => {
    initErrorLogger();
  }, []);

  return null;
}
