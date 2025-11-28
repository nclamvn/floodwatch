import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { RouteSegment, RouteStatus, normalizeStatus } from '@/components/RouteCard'
import { RouteSummary } from '@/components/RouteSummaryBar'
import { RouteFilters } from '@/components/RouteFilterPanel'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'

// Build query string from filters
function buildQueryString(filters: Partial<RouteFilters>): string {
  const params = new URLSearchParams()

  if (filters.province && filters.province !== 'Tất cả' && filters.province !== 'ALL') {
    params.set('province', filters.province)
  }

  if (filters.status && filters.status.length > 0) {
    params.set('status', filters.status.join(','))
  }

  if (filters.hazardType) {
    params.set('hazard_type', filters.hazardType)
  }

  if (filters.timeRange) {
    params.set('since', filters.timeRange)
  }

  if (filters.sortBy) {
    params.set('sort', filters.sortBy)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

// Response type from API (adapts to existing /road-events endpoint)
interface RoadEventsResponse {
  data: Array<{
    id: string
    segment_name: string
    status: string
    reason?: string
    province?: string
    district?: string
    lat?: number
    lon?: number
    last_verified?: string
    source: string
    // New fields (when available)
    road_name?: string
    risk_score?: number
    hazard_name?: string
    source_url?: string
    created_at?: string
    updated_at?: string
    // Lifecycle fields
    lifecycle_status?: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED'
    last_verified_at?: string
    resolved_at?: string
    archived_at?: string
  }>
  total?: number
}

// Transform API response to RouteSegment
function transformToRouteSegment(item: RoadEventsResponse['data'][0]): RouteSegment {
  return {
    id: item.id,
    segment_name: item.segment_name,
    road_name: item.road_name,
    status: normalizeStatus(item.status),
    status_reason: item.reason,
    province: item.province,
    district: item.district,
    lat: item.lat,
    lon: item.lon,
    risk_score: item.risk_score,
    hazard_name: item.hazard_name,
    source: item.source,
    source_url: item.source_url,
    verified_at: item.last_verified,
    created_at: item.created_at,
    updated_at: item.updated_at,
    // Lifecycle fields
    lifecycle_status: item.lifecycle_status,
    last_verified_at: item.last_verified_at,
    resolved_at: item.resolved_at,
    archived_at: item.archived_at
  }
}

/**
 * Hook for fetching routes with filters
 * Uses axios with auto-refresh interval (replaces SWR pattern)
 *
 * @param filters - Route filters
 * @param options - Hook options
 */
export function useRoutes(
  filters: Partial<RouteFilters> = {},
  options: { refreshInterval?: number } = {}
) {
  const [routes, setRoutes] = useState<RouteSegment[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refreshInterval = options.refreshInterval ?? 30000 // 30 seconds default
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize filters to string for dependency
  const filtersKey = JSON.stringify(filters)

  const fetchRoutes = useCallback(async (isRevalidation = false) => {
    try {
      if (isRevalidation) {
        setIsValidating(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const queryString = buildQueryString(filters)
      // Try new /routes endpoint first, fallback to /road-events
      let response: { data: RoadEventsResponse }
      try {
        response = await axios.get<RoadEventsResponse>(`${API_URL}/routes${queryString}`)
      } catch {
        // Fallback to legacy endpoint
        response = await axios.get<RoadEventsResponse>(`${API_URL}/road-events${queryString}`)
      }

      const transformedRoutes = response.data.data?.map(transformToRouteSegment) ?? []
      setRoutes(transformedRoutes)
      setTotal(response.data.total ?? transformedRoutes.length)
    } catch (err) {
      console.error('Error fetching routes:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch routes'))
    } finally {
      setIsLoading(false)
      setIsValidating(false)
    }
  }, [filtersKey])

  // Initial fetch and setup interval
  useEffect(() => {
    fetchRoutes(false)

    // Setup auto-refresh interval
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchRoutes(true)
      }, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchRoutes, refreshInterval])

  // Manual refresh function
  const mutate = useCallback(() => {
    fetchRoutes(true)
  }, [fetchRoutes])

  return {
    routes,
    total,
    isLoading,
    isValidating,
    error,
    mutate
  }
}

/**
 * Hook for fetching route summary statistics
 * Derives from /road-events data since /routes/summary doesn't exist yet.
 */
export function useRouteSummary(options: { refreshInterval?: number } = {}) {
  const [summary, setSummary] = useState<RouteSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refreshInterval = options.refreshInterval ?? 30000
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchSummary = useCallback(async (isRevalidation = false) => {
    try {
      if (isRevalidation) {
        setIsValidating(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const response = await axios.get<RoadEventsResponse>(`${API_URL}/road-events`)

      // Compute summary from data
      if (response.data.data) {
        const byStatus: Record<RouteStatus, number> = {
          OPEN: 0,
          LIMITED: 0,
          DANGEROUS: 0,
          CLOSED: 0
        }

        response.data.data.forEach(item => {
          const status = normalizeStatus(item.status)
          byStatus[status]++
        })

        setSummary({
          total: response.data.data.length,
          by_status: byStatus,
          last_updated: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Error fetching route summary:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch summary'))
    } finally {
      setIsLoading(false)
      setIsValidating(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary(false)

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchSummary(true)
      }, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchSummary, refreshInterval])

  const mutate = useCallback(() => {
    fetchSummary(true)
  }, [fetchSummary])

  return {
    summary,
    isLoading,
    isValidating,
    error,
    mutate
  }
}

/**
 * Hook for fetching nearby routes (requires lat/lon)
 * Note: This endpoint (/routes/nearby) doesn't exist yet.
 */
export function useNearbyRoutes(
  lat: number | null,
  lon: number | null,
  radiusKm: number = 50,
  options: { enabled?: boolean } = {}
) {
  const [routes, setRoutes] = useState<RouteSegment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const enabled = options.enabled !== false && lat !== null && lon !== null

  const fetchNearby = useCallback(async () => {
    if (!enabled || lat === null || lon === null) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await axios.get<{ data: RouteSegment[] }>(
        `${API_URL}/routes/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`
      )

      setRoutes(response.data.data ?? [])
    } catch (err) {
      console.error('Error fetching nearby routes:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch nearby routes'))
    } finally {
      setIsLoading(false)
    }
  }, [enabled, lat, lon, radiusKm])

  useEffect(() => {
    fetchNearby()
  }, [fetchNearby])

  const mutate = useCallback(() => {
    fetchNearby()
  }, [fetchNearby])

  return {
    routes,
    isLoading,
    error,
    mutate
  }
}

// Default filters
export const DEFAULT_ROUTE_FILTERS: RouteFilters = {
  province: 'all',
  status: [],
  hazardType: '',
  timeRange: '',
  sortBy: 'risk_score'
}
