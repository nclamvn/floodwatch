'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, MapPin, Search, Check } from 'lucide-react'
import HelpRequestCard from './HelpRequestCard'

interface HelpRequest {
  id: string
  needs_type: string
  urgency: string
  description: string
  people_count: number | null
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  has_children: boolean | null
  has_elderly: boolean | null
  has_disabilities: boolean | null
  water_level_cm: number | null
  building_floor: number | null
  status: string
  created_at: string
  distance_km?: number
}

export default function HelpRequestsList() {
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
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
          // Continue without location - will show all requests without distance
        },
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }
  }, [])

  // Fetch help requests
  useEffect(() => {
    const fetchRequests = async () => {
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

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
        const response = await fetch(`${apiUrl}/help/requests?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Không thể tải danh sách yêu cầu')
        }

        const data = await response.json()
        setRequests(data.data || [])

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
      } finally {
        setIsLoading(false)
      }
    }

    // Only fetch after we've checked for location (or failed to get it)
    if (!isGettingLocation) {
      fetchRequests()
    }
  }, [userLocation, isGettingLocation, radiusKm])

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-neutral-600 dark:text-neutral-400">
            {isGettingLocation ? 'Đang lấy vị trí...' : 'Đang tải yêu cầu cứu trợ...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6">
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

  if (requests.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400 text-lg font-medium">
            Chưa có yêu cầu cứu trợ nào
          </p>
          <p className="text-neutral-500 dark:text-neutral-500 text-sm mt-2">
            {userLocation
              ? 'Không có yêu cầu nào trong bán kính 50km từ vị trí của bạn'
              : 'Hiện chưa có yêu cầu cứu trợ nào được gửi lên'}
          </p>
        </div>
      </div>
    )
  }

  // Filter requests based on location (radiusKm) and search query
  const filteredRequests = requests.filter((request) => {
    // First, filter by distance if we have user location
    // Only show items within selected radius (skip if "All" is selected)
    if (userLocation && radiusKm !== null && request.distance_km !== undefined) {
      if (request.distance_km > radiusKm) {
        return false
      }
    }

    // Then filter by search query
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    return (
      request.needs_type?.toLowerCase().includes(query) ||
      request.description?.toLowerCase().includes(query) ||
      request.contact_name?.toLowerCase().includes(query) ||
      request.status?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg flex flex-col h-full overflow-hidden">
      {/* Header with Search */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Yêu cầu cứu trợ ({filteredRequests.length})
          </h3>
          {userLocation && (
            <button
              onClick={() => setShowRadiusPopup(true)}
              className="text-xs text-neutral-500 dark:text-neutral-500 flex items-center gap-1 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Thay đổi bán kính tìm kiếm"
            >
              <MapPin className="w-3 h-3" />
              {radiusKm === null ? 'Tất cả' : `${radiusKm}km`}
            </button>
          )}
        </div>

        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo loại, mô tả, tên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Request Cards - Scrollable area inside the box */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredRequests.length === 0 && searchQuery ? (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400 text-lg font-medium">
              Không tìm thấy kết quả
            </p>
            <p className="text-neutral-500 dark:text-neutral-500 text-sm mt-2">
              Thử tìm kiếm với từ khóa khác
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <HelpRequestCard key={request.id} request={request} />
          ))
        )}
      </div>

      {/* Radius Filter Popup */}
      {showRadiusPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRadiusPopup(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              Bán kính tìm kiếm
            </h3>

            <div className="space-y-2 mb-6">
              {[10, 25, 50, 100, 200].map((radius) => (
                <button
                  key={radius}
                  onClick={() => {
                    setRadiusKm(radius)
                    setShowRadiusPopup(false)
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-all ${
                    radiusKm === radius
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{radius} km</span>
                    {radiusKm === radius && <Check className="w-5 h-5" />}
                  </div>
                </button>
              ))}

              {/* All option */}
              <button
                onClick={() => {
                  setRadiusKm(null)
                  setShowRadiusPopup(false)
                }}
                className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-all ${
                  radiusKm === null
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Tất cả</span>
                  {radiusKm === null && <Check className="w-5 h-5" />}
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowRadiusPopup(false)}
              className="w-full px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
