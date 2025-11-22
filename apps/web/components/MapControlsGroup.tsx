'use client'

import { MapPin, MapPinned, Wind, Loader2, Info } from 'lucide-react'
import { MapStyleSwitcher } from './MapStyleSwitcher'
import { LocationInfoPopup } from './LocationInfoPopup'
import { HeaderVoicePlayer } from './HeaderVoicePlayer'
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
}

export function MapControlsGroup({ baseMapStyle, onStyleChange, onWindyClick, onAIForecastClick, aiForecastActive, onLegendClick, legendActive }: MapControlsGroupProps) {
  const { userLocation, isLocating, requestLocation } = useLocation()

  return (
    <>
      {/* Desktop: Single row with all buttons */}
      <div className="hidden sm:flex absolute top-4 left-4 z-40 flex-row gap-2 relative">
        {/* Legend Button - Frosted Glass (MOVED TO FAR LEFT) */}
        <button
          onClick={onLegendClick}
          className={`
            w-9 h-9 rounded-full shadow-sm backdrop-blur-md border
            flex items-center justify-center
            transition-all duration-200 hover:scale-105 active:scale-95
            ${
              legendActive
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                : 'bg-white/80 hover:bg-white/95 text-gray-900 border-white/30 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700/90 dark:border-white/10'
            }
          `}
          title="Chú giải bản đồ"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* Map Style Switcher - 4 buttons */}
        <MapStyleSwitcher value={baseMapStyle} onChange={onStyleChange} />

        {/* My Location Button - Frosted Glass */}
        <button
          onClick={requestLocation}
          disabled={isLocating}
          className={`
            w-9 h-9 rounded-full shadow-sm backdrop-blur-md border
            flex items-center justify-center
            transition-all duration-200
            ${
              userLocation
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                : 'bg-white/80 hover:bg-white/95 text-gray-900 border-white/30 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700/90 dark:border-white/10'
            }
            ${isLocating ? 'cursor-wait opacity-70' : 'hover:scale-105 active:scale-95'}
          `}
          title={userLocation ? 'Vị trí hiện tại' : 'Lấy vị trí của tôi'}
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : userLocation ? (
            <MapPinned className="w-4 h-4" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
        </button>

        {/* Windy Button - Frosted Glass */}
        <button
          onClick={onWindyClick}
          className="w-9 h-9 rounded-full shadow-sm backdrop-blur-md border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          title="Xem dự báo thời tiết Windy"
        >
          <Wind className="w-4 h-4" />
        </button>

        {/* AI Forecast Button - Frosted Glass */}
        <button
          onClick={onAIForecastClick}
          className={`
            w-9 h-9 rounded-full shadow-sm backdrop-blur-md border
            flex items-center justify-center
            transition-all duration-200 hover:scale-105 active:scale-95
            ${
              aiForecastActive
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
                : 'bg-white/80 hover:bg-white/95 text-gray-900 border-white/30 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700/90 dark:border-white/10'
            }
          `}
          title="Dự báo AI"
        >
          <span className="text-xs font-bold">AI</span>
        </button>

        {/* Audio News Player */}
        <HeaderVoicePlayer key="map-controls-audio" />

        {/* Location Info Popup */}
        <LocationInfoPopup />
      </div>

      {/* Mobile: Three rows - better organization */}
      <div className="sm:hidden absolute top-3 left-3 right-20 z-40 flex flex-col gap-2">
        {/* Row 1: Map Styles (4 buttons) */}
        <div className="flex flex-row gap-2 justify-start">
          <MapStyleSwitcher value={baseMapStyle} onChange={onStyleChange} />
        </div>

        {/* Row 2: Action buttons (4 buttons) */}
        <div className="flex flex-row gap-2 justify-start">
          {/* Legend - Frosted Glass (MOVED TO FAR LEFT) */}
          <button
            onClick={onLegendClick}
            className={`
              w-9 h-9 rounded-full shadow-sm backdrop-blur-md border
              flex items-center justify-center
              transition-all duration-200 active:scale-95
              ${
                legendActive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                  : 'bg-white/80 hover:bg-white/95 text-gray-900 border-white/30'
              }
            `}
            title="Chú giải"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* My Location - Frosted Glass */}
          <button
            onClick={requestLocation}
            disabled={isLocating}
            className={`
              w-9 h-9 rounded-full shadow-sm backdrop-blur-md border
              flex items-center justify-center
              transition-all duration-200
              ${
                userLocation
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                  : 'bg-white/80 hover:bg-white/95 text-gray-900 border-white/30'
              }
              ${isLocating ? 'cursor-wait opacity-70' : 'active:scale-95'}
            `}
            title="Vị trí"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : userLocation ? (
              <MapPinned className="w-4 h-4" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
          </button>

          {/* Windy - Frosted Glass */}
          <button
            onClick={onWindyClick}
            className="w-9 h-9 rounded-full shadow-sm backdrop-blur-md border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 flex items-center justify-center transition-all duration-200 active:scale-95"
            title="Windy"
          >
            <Wind className="w-4 h-4" />
          </button>

          {/* AI Forecast - Frosted Glass */}
          <button
            onClick={onAIForecastClick}
            className={`
              w-9 h-9 rounded-full shadow-sm backdrop-blur-md border
              flex items-center justify-center
              transition-all duration-200 active:scale-95
              ${
                aiForecastActive
                  ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
                  : 'bg-white/80 hover:bg-white/95 text-gray-900 border-white/30'
              }
            `}
            title="AI"
          >
            <span className="text-xs font-bold">AI</span>
          </button>
        </div>

        {/* Row 3: Audio News Player - Pill shape, full width */}
        <div className="flex justify-start w-[168px]">
          <HeaderVoicePlayer key="map-controls-audio-mobile" className="!w-full !rounded-full !px-3 !py-1.5" showLabel={true} />
        </div>

        {/* Location Info Popup - below audio player on mobile */}
        <div className="flex justify-start">
          <LocationInfoPopup />
        </div>
      </div>
    </>
  )
}
