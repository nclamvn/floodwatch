'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    console.error('Error caught by boundary:', error, errorInfo)

    // In production, you might want to send this to an error tracking service
    // e.g., Sentry.captureException(error, { extra: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-neutral-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-50 mb-2">
              Đã xảy ra lỗi
            </h1>
            <p className="text-slate-700 dark:text-neutral-200 mb-6">
              Xin lỗi, có gì đó đã xảy ra sai sót. Vui lòng thử tải lại trang.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-slate-100 dark:bg-neutral-700 p-4 rounded mb-4">
                <summary className="cursor-pointer font-semibold text-sm text-slate-700 dark:text-neutral-200 mb-2">
                  Chi tiết lỗi (development only)
                </summary>
                <pre className="text-xs text-slate-700 dark:text-neutral-200 overflow-auto">
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors"
              >
                Tải lại trang
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-slate-900 dark:text-neutral-50 rounded-lg font-medium transition-colors"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
