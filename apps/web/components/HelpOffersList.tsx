'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, MapPin } from 'lucide-react'
import HelpOfferCard from './HelpOfferCard'

interface HelpOffer {
  id: string
  service_type: string
  description: string
  capacity: number | null
  coverage_radius_km: number | null
  availability: string
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  organization: string | null
  status: string
  created_at: string
  distance_km?: number
}

export default function HelpOffersList() {
  const [offers, setOffers] = useState<HelpOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

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
          // Continue without location - will show all offers without distance
        },
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }
  }, [])

  // Fetch help offers
  useEffect(() => {
    const fetchOffers = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Build query params
        const params = new URLSearchParams()

        if (userLocation) {
          params.append('lat', userLocation.lat.toString())
          params.append('lon', userLocation.lon.toString())
          params.append('radius_km', '50') // 50km radius
          params.append('sort_by', 'distance')
        } else {
          params.append('sort_by', 'created_at')
        }

        params.append('limit', '50')

        const response = await fetch(`/api/help/offers?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Không thể tải danh sách đề nghị')
        }

        const data = await response.json()
        setOffers(data.data || [])

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
      } finally {
        setIsLoading(false)
      }
    }

    // Only fetch after we've checked for location (or failed to get it)
    if (!isGettingLocation) {
      fetchOffers()
    }
  }, [userLocation, isGettingLocation])

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          <p className="text-neutral-600 dark:text-neutral-400">
            {isGettingLocation ? 'Đang lấy vị trí...' : 'Đang tải đề nghị hỗ trợ...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6">
        <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Không thể tải danh sách</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400 text-lg font-medium">
            Chưa có đề nghị hỗ trợ nào
          </p>
          <p className="text-neutral-500 dark:text-neutral-500 text-sm mt-2">
            {userLocation
              ? 'Không có đề nghị nào trong bán kính 50km từ vị trí của bạn'
              : 'Hiện chưa có đề nghị hỗ trợ nào được gửi lên'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Đề nghị hỗ trợ ({offers.length})
          </h3>
          {userLocation && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Trong bán kính 50km
            </p>
          )}
        </div>
      </div>

      {/* Offer Cards */}
      <div className="space-y-3">
        {offers.map((offer) => (
          <HelpOfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  )
}
