'use client'

import { useState, useEffect } from 'react'

export interface HelpRequest {
  id: string
  created_at: string
  updated_at: string
  needs_type: 'food' | 'water' | 'shelter' | 'medical' | 'evacuation' | 'clothing' | 'other'
  urgency: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'in_progress' | 'fulfilled' | 'expired' | 'cancelled'
  lat: number
  lon: number
  address?: string
  description: string
  people_count: number
  has_children?: boolean
  has_elderly?: boolean
  has_disabilities?: boolean
  contact_name: string
  contact_phone: string
  contact_method?: string
  images?: string[]
  is_verified: boolean
  verified_by?: string
  verified_at?: string
  fulfilled_at?: string
  expires_at?: string
  notes?: string
  distance_km?: number
}

interface UseHelpRequestsOptions {
  enabled?: boolean
  refreshInterval?: number
  lat?: number
  lon?: number
  radius_km?: number
  status?: string
  needs_type?: string
  urgency?: string
  verified_only?: boolean
}

interface UseHelpRequestsReturn {
  requests: HelpRequest[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  stats: {
    critical_count: number
    high_count: number
    active_count: number
    total: number
  }
}

export function useHelpRequests(options: UseHelpRequestsOptions = {}): UseHelpRequestsReturn {
  const {
    enabled = true,
    refreshInterval,
    lat,
    lon,
    radius_km = 50,
    status = 'active,in_progress',
    needs_type,
    urgency,
    verified_only = false,
  } = options

  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    critical_count: 0,
    high_count: 0,
    active_count: 0,
    total: 0,
  })
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0)

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!enabled) return

    const fetchRequests = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Build query params
        const params = new URLSearchParams()

        if (lat !== undefined && lon !== undefined) {
          params.append('lat', lat.toString())
          params.append('lon', lon.toString())
          params.append('radius_km', radius_km.toString())
        }

        if (status) params.append('status', status)
        if (needs_type) params.append('needs_type', needs_type)
        if (urgency) params.append('urgency', urgency)
        if (verified_only) params.append('verified_only', 'true')
        params.append('limit', '200')

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'
        const url = `${apiUrl}/help/requests?${params.toString()}`

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch help requests: ${response.statusText}`)
        }

        const data = await response.json()

        setRequests(data.data || [])

        // Calculate stats from the data
        const requestsData = data.data || []
        const criticalCount = requestsData.filter((r: HelpRequest) => r.urgency === 'critical').length
        const highCount = requestsData.filter((r: HelpRequest) => r.urgency === 'high').length
        const activeCount = requestsData.filter((r: HelpRequest) => r.status === 'active').length

        setStats({
          critical_count: criticalCount,
          high_count: highCount,
          active_count: activeCount,
          total: requestsData.length,
        })
      } catch (err) {
        console.error('Error fetching help requests:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setRequests([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()

    // Set up auto-refresh if specified
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval && refreshInterval > 0) {
      intervalId = setInterval(fetchRequests, refreshInterval)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [
    enabled,
    lat,
    lon,
    radius_km,
    status,
    needs_type,
    urgency,
    verified_only,
    refreshInterval,
    refetchTrigger,
  ])

  return {
    requests,
    isLoading,
    error,
    refetch,
    stats,
  }
}
