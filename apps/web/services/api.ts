/**
 * Base API helper functions
 * Centralized API configuration and fetch utilities
 */

// Fallback to production API if env not set (for local development)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'

export interface ApiResponse<T> {
  data: T
  total?: number
  pagination?: {
    total: number
    limit: number
    offset: number
  }
}

export interface ApiError {
  detail: string
  status?: number
}

/**
 * Generic fetch wrapper with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `API Error: ${response.status}`)
  }

  return response.json()
}

/**
 * Build URL search params from object
 */
export function buildParams(params: Record<string, string | number | boolean | null | undefined>): URLSearchParams {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  return searchParams
}
