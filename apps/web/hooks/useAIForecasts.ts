'use client'

import { useState, useEffect } from 'react'
import { AIForecast, GetAIForecastsParams } from '@/types/aiForecast'

interface UseAIForecastsOptions extends Omit<GetAIForecastsParams, 'page' | 'offset'> {
  enabled?: boolean
  refreshInterval?: number // Auto-refresh every X ms (default: 5 minutes for forecasts)
}

interface UseAIForecastsReturn {
  forecasts: AIForecast[]
  isLoading: boolean
  error: string | null
  total: number
  refetch: () => void
}

/**
 * Hook to fetch AI forecast events from the API
 *
 * @param options - Query parameters and options
 * @returns AI forecasts, loading state, and refetch function
 *
 * @example
 * ```tsx
 * const { forecasts, isLoading } = useAIForecasts({
 *   lat: userLocation.latitude,
 *   lng: userLocation.longitude,
 *   radius_km: 50,
 *   min_confidence: 0.7,
 *   types: 'flood,heavy_rain',
 *   active_only: true
 * })
 * ```
 */
export function useAIForecasts(options: UseAIForecastsOptions = {}): UseAIForecastsReturn {
  const {
    enabled = true,
    refreshInterval = 300000, // Default 5 minutes (forecasts change slower)
    lat,
    lng,
    radius_km = 50,
    types,
    severity,
    min_confidence = 0.6,
    active_only = true,
    sort = 'forecast_time',
    limit = 50,
  } = options

  const [forecasts, setForecasts] = useState<AIForecast[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0)

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!enabled) return

    const fetchForecasts = async () => {
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
        params.append('min_confidence', min_confidence.toString())
        params.append('active_only', active_only.toString())
        if (sort) params.append('sort', sort)
        params.append('limit', limit.toString())

        // Get API URL from env
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const url = `${apiUrl}/ai-forecasts?${params.toString()}`

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch AI forecasts: ${response.statusText}`)
        }

        const data = await response.json()

        setForecasts(data.data || [])
        setTotal(data.pagination?.total || 0)
      } catch (err) {
        console.error('Error fetching AI forecasts:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setForecasts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchForecasts()

    // Set up auto-refresh if specified
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval && refreshInterval > 0) {
      intervalId = setInterval(fetchForecasts, refreshInterval)
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
    min_confidence,
    active_only,
    sort,
    limit,
    refreshInterval,
    refetchTrigger,
  ])

  return {
    forecasts,
    isLoading,
    error,
    total,
    refetch,
  }
}
