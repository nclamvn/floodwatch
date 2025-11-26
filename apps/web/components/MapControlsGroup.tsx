'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, MapPinned, Wind, Loader2, Info, Map, Satellite, Globe, Mountain, ChevronRight, ChevronLeft } from 'lucide-react'
import { MapStyleSwitcher } from './MapStyleSwitcher'
import { LocationInfoPopup } from './LocationInfoPopup'
import { type BaseMapStyleId } from '@/lib/mapProvider'
import { useLocation } from '@/contexts/LocationContext'

interface MapControlsGroupProps {
  baseMapStyle: BaseMapStyleId
  onStyleChange: (style: BaseMapStyleId) => void
  onWindyClick: () => void
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

export function MapControlsGroup({ baseMapStyle, onStyleChange, onWindyClick, onAIForecastClick, aiForecastActive, onLegendClick, legendActive, onLocationClick }: MapControlsGroupProps) {
  const { userLocation, isLocating, requestLocation } = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showLocationInfo, setShowLocationInfo] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get current map style icon
  const CurrentMapIcon = MAP_STYLE_ICONS[baseMapStyle] || Map

  // Component mount debug
  useEffect(() => {
    console.log('[MapControlsGroup] Component mounted', {
      hasLocationCallback: !!onLocationClick,
      userLocation: userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : null
    })
  }, [])

  // Handle My Location button click - pan map to location
  const handleLocationClick = () => {
    console.log('[MapControlsGroup] Location button clicked', { userLocation, hasCallback: !!onLocationClick })

    if (userLocation) {
      // If location exists, pan the map to it
      console.log('[MapControlsGroup] Panning to existing location:', userLocation.latitude, userLocation.longitude)
      onLocationClick?.(userLocation.latitude, userLocation.longitude)
      // Also show the popup
      setShowLocationInfo(true)
    } else {
      // If no location yet, request it
      console.log('[MapControlsGroup] Requesting new location...')
      requestLocation()
    }
  }

  // Track isExpanded state changes
  useEffect(() => {
    console.log('[MapControlsGroup] isExpanded changed to:', isExpanded)
  }, [isExpanded])

  // When location is acquired, automatically pan to it
  useEffect(() => {
    if (userLocation && onLocationClick) {
      console.log('[MapControlsGroup] Location acquired, auto-panning to:', userLocation.latitude, userLocation.longitude)
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

    // Use pointerdown for unified mouse/touch handling
    document.addEventListener('pointerdown', handleClickOutside as any, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside as any)
    }
  }, [isExpanded])

  return (
    <>
      {/* Hamburger Menu Container - responsive: left-4 on mobile, left-[360px] on desktop */}
      <div ref={containerRef} className="absolute top-4 left-4 sm:left-[360px] z-40">
        {!isExpanded ? (
          /* Collapsed State - Show current map style icon + arrow with 3D shadow effect */
          <button
            onClick={() => {
              console.log('[MapControlsGroup] Hamburger button clicked, expanding menu...')
              setIsExpanded(true)
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 h-11 sm:h-10 rounded-full backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-neutral-300/50 dark:border-neutral-700/50 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] transition-all duration-ui ease-smooth hover:scale-105 active:scale-95"
            title="Mở menu bản đồ"
          >
            <CurrentMapIcon className="w-5 h-5 text-gray-900 dark:text-gray-200" />
            <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-gray-900 dark:text-gray-200" />
          </button>
        ) : (
          /* Expanded State - Horizontal pill tray with all buttons - scrollable on mobile */
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-full backdrop-blur-2xl bg-white/70 dark:bg-gray-800/70 border border-neutral-300/50 dark:border-neutral-700/50 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-200 max-w-[calc(100vw-32px)] sm:max-w-none overflow-x-auto">
            {/* Collapse Button - ChevronLeft - 44px on mobile */}
            <button
              onClick={() => setIsExpanded(false)}
              className="w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 rounded-full backdrop-blur-xl border bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-700/70 dark:text-gray-200 dark:hover:bg-gray-600/80 dark:border-neutral-700/50 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
              title="Thu gọn menu"
            >
              <ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Legend Button - 40px mobile, 32px desktop */}
            <button
              onClick={() => {
                onLegendClick()
                setIsExpanded(false)
              }}
              className={`
                w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 rounded-full backdrop-blur-xl border
                flex items-center justify-center
                transition-all duration-200 hover:scale-105 active:scale-95
                ${
                  legendActive
                    ? 'bg-neutral-600 hover:bg-neutral-700 text-white border-neutral-500'
                    : 'bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-700/70 dark:text-gray-200 dark:hover:bg-gray-600/80 dark:border-neutral-700/50'
                }
              `}
              title="Chú giải"
            >
              <Info className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Map Style Buttons - 40px mobile, 32px desktop */}
            {Object.entries(MAP_STYLE_ICONS).map(([styleId, IconComponent]) => (
              <button
                key={styleId}
                onClick={() => {
                  onStyleChange(styleId as BaseMapStyleId)
                }}
                className={`
                  w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 rounded-full backdrop-blur-xl border
                  flex items-center justify-center
                  transition-all duration-200 hover:scale-105 active:scale-95
                  ${
                    baseMapStyle === styleId
                      ? 'bg-neutral-600 hover:bg-neutral-700 text-white border-neutral-500'
                      : 'bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-700/70 dark:text-gray-200 dark:hover:bg-gray-600/80 dark:border-neutral-700/50'
                  }
                `}
                title={styleId === 'streets' ? 'Đường phố' : styleId === 'hybrid' ? 'Vệ tinh + đường' : styleId === 'satellite' ? 'Vệ tinh' : 'Địa hình'}
              >
                <IconComponent className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            ))}

            {/* My Location Button - 40px mobile, 32px desktop */}
            <button
              onClick={(e) => {
                console.log('[MapControlsGroup] Location button onClick fired!', {
                  isLocating,
                  hasUserLocation: !!userLocation,
                  disabled: isLocating
                })
                handleLocationClick()
              }}
              disabled={isLocating}
              className={`
                w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 rounded-full backdrop-blur-xl border
                flex items-center justify-center
                transition-all duration-200
                ${
                  showLocationInfo && userLocation
                    ? 'bg-neutral-600 hover:bg-neutral-700 text-white border-neutral-500'
                    : 'bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-700/70 dark:text-gray-200 dark:hover:bg-gray-600/80 dark:border-neutral-700/50'
                }
                ${isLocating ? 'cursor-wait opacity-70' : 'hover:scale-105 active:scale-95'}
              `}
              title="Vị trí của tôi"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" />
              ) : userLocation ? (
                <MapPinned className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              ) : (
                <MapPin className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              )}
            </button>

            {/* AI Forecast Button - 40px mobile, 32px desktop */}
            <button
              onClick={() => {
                onAIForecastClick()
                setIsExpanded(false)
              }}
              className={`
                w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 rounded-full backdrop-blur-xl border
                flex items-center justify-center
                transition-all duration-200 hover:scale-105 active:scale-95
                ${
                  aiForecastActive
                    ? 'bg-neutral-600 hover:bg-neutral-700 text-white border-neutral-500'
                    : 'bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-700/70 dark:text-gray-200 dark:hover:bg-gray-600/80 dark:border-neutral-700/50'
                }
              `}
              title="Dự báo AI"
            >
              <span className="text-sm sm:text-[13px] font-bold">AI</span>
            </button>
          </div>
        )}

        {/* Location Info Popup - Toggleable */}
        <div className="mt-2">
          <LocationInfoPopup
            isVisible={showLocationInfo}
            onClose={() => setShowLocationInfo(false)}
          />
        </div>
      </div>
    </>
  )
}
