'use client'

import { useState, useEffect } from 'react'
import { getCachedResponse, setCachedResponse } from '@/lib/apiCache'

const CACHE_TTL_MS = 60 * 1000 // 60 seconds

export interface TrafficDisruption {
  id: string
  created_at: string
  updated_at: string
  type: 'flooded_road' | 'landslide' | 'bridge_collapsed' | 'bridge_flooded' | 'traffic_jam' | 'road_damaged' | 'blocked'
  severity: 'impassable' | 'dangerous' | 'slow' | 'warning'
  lat: number
  lon: number
  road_name?: string
  location_description: string
  description?: string
  estimated_clearance?: string
  alternative_route?: string
  starts_at: string
  ends_at?: string
  source: string
  verified: boolean
  is_active: boolean
  hazard_event_id?: string
  media_urls?: string[]
  admin_notes?: string
  distance_km?: number
}

interface UseTrafficOptions {
  enabled?: boolean
  refreshInterval?: number
  lat?: number
  lon?: number
  radius_km?: number
  type?: string
  severity?: string
  road_name?: string
  is_active?: boolean
}

interface UseTrafficReturn {
  disruptions: TrafficDisruption[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  stats: {
    impassable_count: number
    dangerous_count: number
    total_active: number
    major_roads_affected: string[]
  }
}

export function useTraffic(options: UseTrafficOptions = {}): UseTrafficReturn {
  const {
    enabled = true,
    refreshInterval,
    lat,
    lon,
    radius_km = 30,
    type,
    severity,
    road_name,
    is_active = true,
  } = options

  const [disruptions, setDisruptions] = useState<TrafficDisruption[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    impassable_count: 0,
    dangerous_count: 0,
    total_active: 0,
    major_roads_affected: [] as string[],
  })
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0)

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!enabled) return

    // AbortController to cancel fetch on unmount
    const abortController = new AbortController()
    let isMounted = true

    const fetchDisruptions = async (forceRefresh = false) => {
      // Build query params
      const params = new URLSearchParams()

      if (lat !== undefined && lon !== undefined) {
        params.append('lat', lat.toString())
        params.append('lon', lon.toString())
        params.append('radius_km', radius_km.toString())
      }

      if (type) params.append('type', type)
      if (severity) params.append('severity', severity)
      if (road_name) params.append('road_name', road_name)
      params.append('is_active', is_active.toString())
      params.append('limit', '100')

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const url = `${apiUrl}/traffic/disruptions?${params.toString()}`

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getCachedResponse<{ data: TrafficDisruption[]; meta?: typeof stats }>(url)
        if (cached) {
          // Filter to only show disaster-related traffic disruptions
          const disasterTypes = ['flooded_road', 'landslide', 'bridge_collapsed', 'bridge_flooded', 'road_damaged', 'blocked']
          const disasterDisruptions = (cached.data || []).filter((disruption: TrafficDisruption) =>
            disasterTypes.includes(disruption.type) || disruption.hazard_event_id
          )
          if (isMounted) {
            setDisruptions(disasterDisruptions)
            setStats(cached.meta || {
              impassable_count: 0,
              dangerous_count: 0,
              total_active: 0,
              major_roads_affected: [],
            })
          }
          return
        }
      }

      try {
        if (isMounted) {
          setIsLoading(true)
          setError(null)
        }

        const response = await fetch(url, { signal: abortController.signal })

        if (!response.ok) {
          throw new Error(`Failed to fetch traffic disruptions: ${response.statusText}`)
        }

        const data = await response.json()

        // Cache the response
        setCachedResponse(url, data, CACHE_TTL_MS)

        // Filter to only show disaster-related traffic disruptions
        const disasterTypes = ['flooded_road', 'landslide', 'bridge_collapsed', 'bridge_flooded', 'road_damaged', 'blocked']
        const disasterDisruptions = (data.data || []).filter((disruption: TrafficDisruption) =>
          disasterTypes.includes(disruption.type) || disruption.hazard_event_id
        )

        if (isMounted) {
          setDisruptions(disasterDisruptions)
          setStats(data.meta || {
            impassable_count: 0,
            dangerous_count: 0,
            total_active: 0,
            major_roads_affected: [],
          })
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('Error fetching traffic disruptions:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setDisruptions([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchDisruptions()

    // Set up auto-refresh if specified
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval && refreshInterval > 0) {
      intervalId = setInterval(fetchDisruptions, refreshInterval)
    }

    return () => {
      isMounted = false
      abortController.abort()
      if (intervalId) clearInterval(intervalId)
    }
  }, [
    enabled,
    lat,
    lon,
    radius_km,
    type,
    severity,
    road_name,
    is_active,
    refreshInterval,
    refetchTrigger,
  ])

  return {
    disruptions,
    isLoading,
    error,
    refetch,
    stats,
  }
}
