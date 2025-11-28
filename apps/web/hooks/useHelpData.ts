'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Shared hook for fetching and filtering help requests/offers data
 * Consolidates common logic from HelpRequestsList and HelpOffersList
 */

export interface UseHelpDataOptions {
  endpoint: 'requests' | 'offers'
  searchFields: string[]
}

export interface UserLocation {
  lat: number
  lon: number
}

export interface UseHelpDataReturn<T> {
  items: T[]
  filteredItems: T[]
  isLoading: boolean
  isGettingLocation: boolean
  error: string | null
  userLocation: UserLocation | null
  searchQuery: string
  setSearchQuery: (query: string) => void
  radiusKm: number | null
  setRadiusKm: (radius: number | null) => void
  showRadiusPopup: boolean
  setShowRadiusPopup: (show: boolean) => void
  refresh: () => void
}

export function useHelpData<T extends { distance_km?: number }>(
  options: UseHelpDataOptions
): UseHelpDataReturn<T> {
  const { endpoint, searchFields } = options

  // Data state
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Location state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [radiusKm, setRadiusKm] = useState<number | null>(50)
  const [showRadiusPopup, setShowRadiusPopup] = useState(false)

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setIsGettingLocation(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          })
          setIsGettingLocation(false)
        },
        (error) => {
          console.warn('Could not get user location:', error)
          setIsGettingLocation(false)
          // Continue without location - will show all items without distance
        },
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }
  }, [])

  // Fetch data function
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Build query params
      const params = new URLSearchParams()

      if (userLocation) {
        params.append('lat', userLocation.lat.toString())
        params.append('lon', userLocation.lon.toString())
        if (radiusKm !== null) {
          params.append('radius_km', radiusKm.toString())
        }
        params.append('sort_by', 'distance')
      } else {
        params.append('sort_by', 'created_at')
      }

      // Fetch maximum allowed by API (200 items)
      params.append('limit', '200')

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'
      const response = await fetch(`${apiUrl}/help/${endpoint}?${params.toString()}`)

      if (!response.ok) {
        throw new Error(
          endpoint === 'requests'
            ? 'Không thể tải danh sách yêu cầu'
            : 'Không thể tải danh sách đề nghị'
        )
      }

      const data = await response.json()
      setItems(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
    } finally {
      setIsLoading(false)
    }
  }, [userLocation, radiusKm, endpoint])

  // Fetch data when location is ready or radiusKm changes
  useEffect(() => {
    // Only fetch after we've checked for location (or failed to get it)
    if (!isGettingLocation) {
      fetchData()
    }
  }, [fetchData, isGettingLocation])

  // Filter items based on radius and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // First, filter by distance if we have user location
      // Only show items within selected radius (skip if "All" is selected)
      if (userLocation && radiusKm !== null && item.distance_km !== undefined) {
        if (item.distance_km > radiusKm) {
          return false
        }
      }

      // Then filter by search query
      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase()

      // Check each search field
      return searchFields.some(field => {
        const value = (item as Record<string, unknown>)[field]
        return typeof value === 'string' && value.toLowerCase().includes(query)
      })
    })
  }, [items, userLocation, radiusKm, searchQuery, searchFields])

  // Refresh function
  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  return {
    items,
    filteredItems,
    isLoading,
    isGettingLocation,
    error,
    userLocation,
    searchQuery,
    setSearchQuery,
    radiusKm,
    setRadiusKm,
    showRadiusPopup,
    setShowRadiusPopup,
    refresh
  }
}

export default useHelpData
