'use client'

import { useLocation } from '@/contexts/LocationContext'

export function LocationInfoPopup() {
  const { userLocation, error } = useLocation()

  if (!userLocation || error) return null

  return (
    <div
      className="absolute top-4 left-[calc(100%+12px)] z-40 bg-white/10 dark:bg-black/10 px-4 py-2 rounded-lg shadow-lg text-xs max-w-xs backdrop-blur-lg border border-white/30"
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-white font-bold text-sm">Vị trí của bạn</span>
      </div>

      {/* Coordinates */}
      <div className="text-white font-mono text-xs">
        {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
      </div>

      {/* Accuracy */}
      {userLocation.accuracy && (
        <div className="text-white/80 text-xs mt-1">
          Độ chính xác: ±{Math.round(userLocation.accuracy)}m
        </div>
      )}
    </div>
  )
}
