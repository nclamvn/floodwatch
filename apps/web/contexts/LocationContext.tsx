'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

interface UserLocation {
  latitude: number
  longitude: number
  accuracy?: number // meters
  timestamp: number
}

interface LocationContextType {
  userLocation: UserLocation | null
  isLocating: boolean
  error: string | null
  requestLocation: () => void
  clearLocation: () => void
  alertRadius: number // km
  setAlertRadius: (radius: number) => void
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertRadius, setAlertRadius] = useState(3) // default 3km

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ GPS')
      return
    }

    setIsLocating(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        })
        setIsLocating(false)
        setError(null)
      },
      (err) => {
        setIsLocating(false)

        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Bạn đã từ chối quyền truy cập vị trí')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Không thể xác định vị trí')
            break
          case err.TIMEOUT:
            setError('Hết thời gian chờ lấy vị trí')
            break
          default:
            setError('Lỗi không xác định khi lấy vị trí')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000, // Cache location for 30 seconds
      }
    )
  }, [])

  const clearLocation = useCallback(() => {
    setUserLocation(null)
    setError(null)
  }, [])

  return (
    <LocationContext.Provider
      value={{
        userLocation,
        isLocating,
        error,
        requestLocation,
        clearLocation,
        alertRadius,
        setAlertRadius,
      }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  const context = useContext(LocationContext)
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider')
  }
  return context
}
