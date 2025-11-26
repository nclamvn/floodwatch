'use client'

import { useEffect, useRef } from 'react'
import { useLocation } from '@/contexts/LocationContext'
import { X } from 'lucide-react'

interface LocationInfoPopupProps {
  isVisible: boolean
  onClose: () => void
}

export function LocationInfoPopup({ isVisible, onClose }: LocationInfoPopupProps) {
  const { userLocation, error } = useLocation()
  const popupRef = useRef<HTMLDivElement>(null)

  // Close popup when clicking outside
  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside as any)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside as any)
    }
  }, [isVisible, onClose])

  if (!userLocation || error || !isVisible) return null

  return (
    <div
      ref={popupRef}
      className="absolute top-4 left-[calc(100%+12px)] z-40 bg-white/70 dark:bg-neutral-900/70 px-4 py-2 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)] text-xs max-w-xs backdrop-blur-2xl border border-neutral-300/50 dark:border-neutral-700/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" />
          <span className="text-gray-900 dark:text-white font-bold text-sm">Vị trí của bạn</span>
        </div>
        {/* Close button */}
        <button
          onClick={onClose}
          className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          aria-label="Đóng"
        >
          <X className="w-3 h-3 text-gray-700 dark:text-white" />
        </button>
      </div>

      {/* Coordinates */}
      <div className="text-gray-900 dark:text-white font-mono text-xs">
        {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
      </div>

      {/* Accuracy */}
      {userLocation.accuracy && (
        <div className="text-gray-700 dark:text-white/80 text-xs mt-1">
          Độ chính xác: ±{Math.round(userLocation.accuracy)}m
        </div>
      )}
    </div>
  )
}
