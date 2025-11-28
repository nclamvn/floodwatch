'use client'

import { useState, useEffect } from 'react'

export interface HelpOffer {
  id: string
  created_at: string
  updated_at: string
  service_type: 'rescue' | 'transportation' | 'medical' | 'shelter' | 'food_distribution' | 'supplies' | 'volunteer' | 'other'
  status: 'active' | 'in_progress' | 'fulfilled' | 'expired' | 'cancelled'
  lat: number
  lon: number
  address?: string
  description: string
  capacity: number
  coverage_radius_km: number
  availability?: string
  contact_name: string
  contact_phone: string
  contact_method?: string
  organization?: string
  vehicle_type?: string
  is_verified: boolean
  verified_by?: string
  verified_at?: string
  expires_at?: string
  notes?: string
  distance_km?: number
}

interface UseHelpOffersOptions {
  enabled?: boolean
  refreshInterval?: number
  lat?: number
  lon?: number
  radius_km?: number
  status?: string
  service_type?: string
  min_capacity?: number
  verified_only?: boolean
}

interface UseHelpOffersReturn {
  offers: HelpOffer[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  stats: {
    available_count: number
    total_capacity: number
    rescue_count: number
    total: number
  }
}

export function useHelpOffers(options: UseHelpOffersOptions = {}): UseHelpOffersReturn {
  const {
    enabled = true,
    refreshInterval,
    lat,
    lon,
    radius_km = 50,
    status = 'active',
    service_type,
    min_capacity,
    verified_only = false,
  } = options

  const [offers, setOffers] = useState<HelpOffer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    available_count: 0,
    total_capacity: 0,
    rescue_count: 0,
    total: 0,
  })
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0)

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!enabled) return

    const fetchOffers = async () => {
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
        if (service_type) params.append('service_type', service_type)
        if (min_capacity !== undefined) params.append('min_capacity', min_capacity.toString())
        if (verified_only) params.append('verified_only', 'true')
        params.append('limit', '200')

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'
        const url = `${apiUrl}/help/offers?${params.toString()}`

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch help offers: ${response.statusText}`)
        }

        const data = await response.json()

        setOffers(data.data || [])

        // Calculate stats from the data
        const offersData = data.data || []
        const activeCount = offersData.filter((o: HelpOffer) => o.status === 'active').length
        const totalCapacity = offersData.reduce((sum: number, o: HelpOffer) => sum + o.capacity, 0)
        const rescueCount = offersData.filter((o: HelpOffer) => o.service_type === 'rescue').length

        setStats({
          available_count: activeCount,
          total_capacity: totalCapacity,
          rescue_count: rescueCount,
          total: offersData.length,
        })
      } catch (err) {
        console.error('Error fetching help offers:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setOffers([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchOffers()

    // Set up auto-refresh if specified
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval && refreshInterval > 0) {
      intervalId = setInterval(fetchOffers, refreshInterval)
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
    service_type,
    min_capacity,
    verified_only,
    refreshInterval,
    refetchTrigger,
  ])

  return {
    offers,
    isLoading,
    error,
    refetch,
    stats,
  }
}
