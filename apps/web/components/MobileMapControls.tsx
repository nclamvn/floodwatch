'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronUp, MapPin, MapPinned, Info, Map, Satellite, Globe, Mountain, Loader2 } from 'lucide-react'
import DarkModeToggle from './DarkModeToggle'
import { type BaseMapStyleId } from '@/lib/mapProvider'
import { useLocation } from '@/contexts/LocationContext'

interface MobileMapControlsProps {
  baseMapStyle: BaseMapStyleId
  onStyleChange: (style: BaseMapStyleId) => void
  onAIForecastClick: () => void
  aiForecastActive?: boolean
  onLegendClick: () => void
  legendActive?: boolean
  onLocationClick?: (lat: number, lon: number) => void
}

// Map style icon mapping
const MAP_STYLE_ICONS: Record<BaseMapStyleId, React.ComponentType<{ className?: string }>> = {
  streets: Map,
  hybrid: Satellite,
  satellite: Globe,
  outdoors: Mountain,
}

const MAP_STYLE_LABELS: Record<BaseMapStyleId, string> = {
  streets: 'Đường',
  hybrid: 'Lai',
  satellite: 'Vệ tinh',
  outdoors: 'Địa hình',
}

export function MobileMapControls({
  baseMapStyle,
  onStyleChange,
  onAIForecastClick,
  aiForecastActive,
  onLegendClick,
  legendActive,
  onLocationClick
}: MobileMapControlsProps) {
  const { userLocation, isLocating, requestLocation } = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle My Location button click
  const handleLocationClick = () => {
    if (userLocation) {
      onLocationClick?.(userLocation.latitude, userLocation.longitude)
    } else {
      requestLocation()
    }
  }

  // When location is acquired, automatically pan to it
  useEffect(() => {
    if (userLocation && onLocationClick) {
      onLocationClick(userLocation.latitude, userLocation.longitude)
    }
  }, [userLocation?.timestamp, onLocationClick])

  // Close menu when clicking outside
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside as any, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside as any)
    }
  }, [isExpanded])

  // Common button styles
  const buttonBaseStyle = "w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-xl border shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] transition-all duration-200"
  const buttonInactiveStyle = "bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-700/80 dark:border-neutral-700/50"
  const buttonActiveStyle = "bg-neutral-600 hover:bg-neutral-700 text-white border-neutral-500"

  return (
    <div ref={containerRef} className="sm:hidden fixed top-4 left-4 z-50 flex flex-col gap-2">
      {/* Back Button */}
      <Link
        href="/"
        className={`${buttonBaseStyle} ${buttonInactiveStyle} hover:scale-105 active:scale-95`}
        aria-label="Quay về trang chủ"
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>

      {/* Theme Toggle */}
      <DarkModeToggle />

      {/* Hamburger / Expand Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`${buttonBaseStyle} ${isExpanded ? buttonActiveStyle : buttonInactiveStyle} hover:scale-105 active:scale-95`}
        aria-label={isExpanded ? "Thu gọn menu" : "Mở menu bản đồ"}
      >
        {isExpanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {/* Expanded Menu - Vertical list of controls */}
      {isExpanded && (
        <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
          {/* Map Style Buttons */}
          {Object.entries(MAP_STYLE_ICONS).map(([styleId, IconComponent]) => (
            <button
              key={styleId}
              onClick={() => onStyleChange(styleId as BaseMapStyleId)}
              className={`${buttonBaseStyle} ${baseMapStyle === styleId ? buttonActiveStyle : buttonInactiveStyle} hover:scale-105 active:scale-95`}
              title={MAP_STYLE_LABELS[styleId as BaseMapStyleId]}
            >
              <IconComponent className="w-5 h-5" />
            </button>
          ))}

          {/* My Location Button */}
          <button
            onClick={handleLocationClick}
            disabled={isLocating}
            className={`${buttonBaseStyle} ${userLocation ? buttonActiveStyle : buttonInactiveStyle} ${isLocating ? 'cursor-wait opacity-70' : 'hover:scale-105 active:scale-95'}`}
            title="Vị trí của tôi"
          >
            {isLocating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : userLocation ? (
              <MapPinned className="w-5 h-5" />
            ) : (
              <MapPin className="w-5 h-5" />
            )}
          </button>

          {/* AI Forecast Button */}
          <button
            onClick={() => {
              onAIForecastClick()
              setIsExpanded(false)
            }}
            className={`${buttonBaseStyle} ${aiForecastActive ? buttonActiveStyle : buttonInactiveStyle} hover:scale-105 active:scale-95`}
            title="Dự báo AI"
          >
            <span className="text-sm font-bold">AI</span>
          </button>

          {/* Legend Button */}
          <button
            onClick={() => {
              onLegendClick()
              setIsExpanded(false)
            }}
            className={`${buttonBaseStyle} ${legendActive ? buttonActiveStyle : buttonInactiveStyle} hover:scale-105 active:scale-95`}
            title="Chú giải"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
