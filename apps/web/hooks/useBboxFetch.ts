/**
 * useBboxFetch Hook
 *
 * Phase 5: Advanced Map Optimization
 * Viewport-driven data fetching:
 * - Only fetch data within visible bounds
 * - Debounced to prevent excessive API calls
 * - Caches previous results
 * - Expands bbox slightly to pre-fetch nearby data
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getCachedResponse, setCachedResponse } from '@/lib/apiCache'

// ============================================
// TYPES
// ============================================

export type Bbox = [number, number, number, number] // [minLon, minLat, maxLon, maxLat]

export interface BboxFetchOptions<T> {
  /** API endpoint base URL */
  endpoint: string
  /** Enable fetching */
  enabled?: boolean
  /** Debounce delay in ms */
  debounceMs?: number
  /** Bbox expansion factor (1.2 = 20% larger) */
  expansionFactor?: number
  /** Additional query params */
  params?: Record<string, string | number | boolean>
  /** Cache TTL in ms */
  cacheTtlMs?: number
  /** Transform response data */
  transform?: (data: unknown) => T[]
}

export interface BboxFetchResult<T> {
  data: T[]
  isLoading: boolean
  error: string | null
  /** Current bbox being fetched */
  bbox: Bbox | null
  /** Manually trigger refetch */
  refetch: () => void
}

// ============================================
// HELPERS
// ============================================

/**
 * Expand bbox by a factor
 */
function expandBbox(bbox: Bbox, factor: number): Bbox {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const lonRange = maxLon - minLon
  const latRange = maxLat - minLat

  const lonExpansion = (lonRange * (factor - 1)) / 2
  const latExpansion = (latRange * (factor - 1)) / 2

  return [
    minLon - lonExpansion,
    minLat - latExpansion,
    maxLon + lonExpansion,
    maxLat + latExpansion,
  ]
}

/**
 * Check if bbox A contains bbox B
 */
function bboxContains(a: Bbox, b: Bbox): boolean {
  return (
    a[0] <= b[0] && // minLon
    a[1] <= b[1] && // minLat
    a[2] >= b[2] && // maxLon
    a[3] >= b[3] // maxLat
  )
}

/**
 * Build URL with bbox params
 */
function buildBboxUrl(
  endpoint: string,
  bbox: Bbox,
  params?: Record<string, string | number | boolean>
): string {
  const url = new URL(endpoint, process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')

  // Add bbox params
  url.searchParams.set('min_lon', bbox[0].toString())
  url.searchParams.set('min_lat', bbox[1].toString())
  url.searchParams.set('max_lon', bbox[2].toString())
  url.searchParams.set('max_lat', bbox[3].toString())

  // Add additional params
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

// ============================================
// HOOK
// ============================================

/**
 * Hook for viewport-driven data fetching
 *
 * @param bbox - Current viewport bounding box
 * @param options - Fetch options
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useBboxFetch<HelpRequest>(bbox, {
 *   endpoint: '/help/requests',
 *   enabled: true,
 *   params: { status: 'active' },
 * })
 * ```
 */
export function useBboxFetch<T>(
  bbox: Bbox | null,
  options: BboxFetchOptions<T>
): BboxFetchResult<T> {
  const {
    endpoint,
    enabled = true,
    debounceMs = 300,
    expansionFactor = 1.3,
    params,
    cacheTtlMs = 60000,
    transform,
  } = options

  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentBbox, setCurrentBbox] = useState<Bbox | null>(null)

  // Track last fetched bbox (with expansion)
  const lastFetchedBboxRef = useRef<Bbox | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(
    async (fetchBbox: Bbox) => {
      // Expand bbox for pre-fetching
      const expandedBbox = expandBbox(fetchBbox, expansionFactor)

      // Check if we already have data for this area
      if (
        lastFetchedBboxRef.current &&
        bboxContains(lastFetchedBboxRef.current, fetchBbox)
      ) {
        // Current bbox is within last fetched area, no need to refetch
        return
      }

      const url = buildBboxUrl(endpoint, expandedBbox, params)

      // Check cache first
      const cached = getCachedResponse<{ data: T[] }>(url)
      if (cached) {
        const items = transform ? transform(cached.data) : cached.data || []
        setData(items)
        lastFetchedBboxRef.current = expandedBbox
        return
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(url, {
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`)
        }

        const json = await response.json()

        // Cache response
        setCachedResponse(url, json, cacheTtlMs)

        const items = transform ? transform(json.data) : json.data || []
        setData(items)
        lastFetchedBboxRef.current = expandedBbox
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return // Ignore abort errors
        }
        console.error(`[useBboxFetch] Error fetching ${endpoint}:`, err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    },
    [endpoint, expansionFactor, params, cacheTtlMs, transform]
  )

  // Debounced fetch on bbox change
  useEffect(() => {
    if (!enabled || !bbox) {
      return
    }

    setCurrentBbox(bbox)

    // Clear previous debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Debounce fetch
    debounceTimeoutRef.current = setTimeout(() => {
      fetchData(bbox)
    }, debounceMs)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [bbox, enabled, debounceMs, fetchData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  const refetch = useCallback(() => {
    if (bbox) {
      lastFetchedBboxRef.current = null // Force refetch
      fetchData(bbox)
    }
  }, [bbox, fetchData])

  return {
    data,
    isLoading,
    error,
    bbox: currentBbox,
    refetch,
  }
}

// ============================================
// SPECIALIZED HOOKS
// ============================================

/**
 * Hook for fetching help requests within viewport
 */
export function useBboxHelpRequests(
  bbox: Bbox | null,
  options?: Partial<BboxFetchOptions<unknown>>
) {
  return useBboxFetch(bbox, {
    endpoint: '/help/requests',
    params: { status: 'active,in_progress', limit: 200 },
    ...options,
  })
}

/**
 * Hook for fetching help offers within viewport
 */
export function useBboxHelpOffers(
  bbox: Bbox | null,
  options?: Partial<BboxFetchOptions<unknown>>
) {
  return useBboxFetch(bbox, {
    endpoint: '/help/offers',
    params: { status: 'active', limit: 200 },
    ...options,
  })
}

/**
 * Hook for fetching traffic disruptions within viewport
 */
export function useBboxTraffic(
  bbox: Bbox | null,
  options?: Partial<BboxFetchOptions<unknown>>
) {
  return useBboxFetch(bbox, {
    endpoint: '/traffic/disruptions',
    params: { is_active: true, limit: 100 },
    ...options,
  })
}
