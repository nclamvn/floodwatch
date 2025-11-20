'use client'

import { useState, useEffect } from 'react'
import { HazardEvent, GetHazardsParams } from '@/types/hazard'

interface UseHazardsOptions extends Omit<GetHazardsParams, 'page' | 'limit'> {
  enabled?: boolean
  refreshInterval?: number // Auto-refresh every X ms
}

interface UseHazardsReturn {
  hazards: HazardEvent[]
  isLoading: boolean
  error: string | null
  total: number
  refetch: () => void
}

/**
 * Hook to fetch hazard events from the API
 *
 * @param options - Query parameters and options
 * @returns Hazard events, loading state, and refetch function
 *
 * @example
 * ```tsx
 * const { hazards, isLoading } = useHazards({
 *   lat: userLocation.latitude,
 *   lng: userLocation.longitude,
 *   radius_km: 20,
 *   types: 'flood,heavy_rain',
 *   active_only: true
 * })
 * ```
 */
export function useHazards(options: UseHazardsOptions = {}): UseHazardsReturn {
  const {
    enabled = true,
    refreshInterval,
    lat,
    lng,
    radius_km = 50,
    types,
    severity,
    active_only = true,
    sort = 'distance',
  } = options

  const [hazards, setHazards] = useState<HazardEvent[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0)

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!enabled) return

    const fetchHazards = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Build query params
        const params = new URLSearchParams()

        if (lat !== undefined && lng !== undefined) {
          params.append('lat', lat.toString())
          params.append('lng', lng.toString())
          params.append('radius_km', radius_km.toString())
        }

        if (types) params.append('types', types)
        if (severity) params.append('severity', severity)
        params.append('active_only', active_only.toString())
        if (sort) params.append('sort', sort)
        params.append('limit', '100') // Fetch up to 100 hazards

        // Get API URL from env
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const url = `${apiUrl}/hazards?${params.toString()}`

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch hazards: ${response.statusText}`)
        }

        const data = await response.json()

        setHazards(data.data || [])
        setTotal(data.pagination?.total || 0)
      } catch (err) {
        console.error('Error fetching hazards:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setHazards([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchHazards()

    // Set up auto-refresh if specified
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval && refreshInterval > 0) {
      intervalId = setInterval(fetchHazards, refreshInterval)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [
    enabled,
    lat,
    lng,
    radius_km,
    types,
    severity,
    active_only,
    sort,
    refreshInterval,
    refetchTrigger,
  ])

  return {
    hazards,
    isLoading,
    error,
    total,
    refetch,
  }
}
