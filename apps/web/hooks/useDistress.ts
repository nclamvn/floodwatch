'use client'

import { useState, useEffect } from 'react'
import { getCachedResponse, setCachedResponse } from '@/lib/apiCache'

const CACHE_TTL_MS = 30 * 1000 // 30 seconds (distress reports need fresher data)

export interface DistressReport {
  id: string
  created_at: string
  updated_at: string
  status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'false_alarm'
  urgency: 'critical' | 'high' | 'medium' | 'low'
  lat: number
  lon: number
  description: string
  num_people: number
  has_injuries: boolean
  has_children: boolean
  has_elderly: boolean
  contact_name?: string
  contact_phone?: string
  media_urls?: string[]
  source: string
  verified: boolean
  verified_by?: string
  verified_at?: string
  admin_notes?: string
  assigned_to?: string
  resolved_at?: string
  distance_km?: number
}

interface UseDistressOptions {
  enabled?: boolean
  refreshInterval?: number
  lat?: number
  lon?: number
  radius_km?: number
  status?: string
  urgency?: string
  verified_only?: boolean
}

interface UseDistressReturn {
  reports: DistressReport[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  stats: {
    critical_count: number
    high_count: number
    pending_count: number
    total_active: number
  }
}

export function useDistress(options: UseDistressOptions = {}): UseDistressReturn {
  const {
    enabled = true,
    refreshInterval,
    lat,
    lon,
    radius_km = 10,
    status = 'pending,acknowledged,in_progress',
    urgency,
    verified_only = false,
  } = options

  const [reports, setReports] = useState<DistressReport[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    critical_count: 0,
    high_count: 0,
    pending_count: 0,
    total_active: 0,
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

    const fetchReports = async (forceRefresh = false) => {
      // Build query params
      const params = new URLSearchParams()

      if (lat !== undefined && lon !== undefined) {
        params.append('lat', lat.toString())
        params.append('lon', lon.toString())
        params.append('radius_km', radius_km.toString())
      }

      if (status) params.append('status', status)
      if (urgency) params.append('urgency', urgency)
      if (verified_only) params.append('verified_only', 'true')
      params.append('limit', '100')

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'
      const url = `${apiUrl}/distress?${params.toString()}`

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getCachedResponse<{ data: DistressReport[]; meta?: typeof stats }>(url)
        if (cached) {
          if (isMounted) {
            setReports(cached.data || [])
            setStats(cached.meta || {
              critical_count: 0,
              high_count: 0,
              pending_count: 0,
              total_active: 0,
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
          throw new Error(`Failed to fetch distress reports: ${response.statusText}`)
        }

        const data = await response.json()

        // Cache the response
        setCachedResponse(url, data, CACHE_TTL_MS)

        if (isMounted) {
          setReports(data.data || [])
          setStats(data.meta || {
            critical_count: 0,
            high_count: 0,
            pending_count: 0,
            total_active: 0,
          })
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('Error fetching distress reports:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setReports([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchReports()

    // Set up auto-refresh if specified
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval && refreshInterval > 0) {
      intervalId = setInterval(fetchReports, refreshInterval)
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
    status,
    urgency,
    verified_only,
    refreshInterval,
    refetchTrigger,
  ])

  return {
    reports,
    isLoading,
    error,
    refetch,
    stats,
  }
}
