'use client'

import { MapPin, MapPinned, Wind, Loader2, Layers } from 'lucide-react'
import { MapStyleSwitcher } from './MapStyleSwitcher'
import { LocationInfoPopup } from './LocationInfoPopup'
import { type BaseMapStyleId } from '@/lib/mapProvider'
import { useLocation } from '@/contexts/LocationContext'

interface MapControlsGroupProps {
  baseMapStyle: BaseMapStyleId
  onStyleChange: (style: BaseMapStyleId) => void
  onWindyClick: () => void
  onLayerControlClick: () => void
  layerControlActive?: boolean
  onAIForecastClick: () => void
  aiForecastActive?: boolean
}

export function MapControlsGroup({ baseMapStyle, onStyleChange, onWindyClick, onLayerControlClick, layerControlActive, onAIForecastClick, aiForecastActive }: MapControlsGroupProps) {
  const { userLocation, isLocating, requestLocation } = useLocation()

  return (
    <>
      {/* Desktop: Single row with all buttons */}
      <div className="hidden sm:flex absolute top-4 left-4 z-40 flex-row gap-2 relative">
        {/* Map Style Switcher - 4 buttons */}
        <MapStyleSwitcher value={baseMapStyle} onChange={onStyleChange} />

        {/* My Location Button */}
        <button
          onClick={requestLocation}
          disabled={isLocating}
          className={`
            w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border
            flex items-center justify-center
            transition-all duration-200
            ${
              userLocation
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                : 'bg-white/90 hover:bg-white text-gray-700 border-gray-200/50 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-700/50'
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

        {/* Layer Control Button */}
        <button
          onClick={onLayerControlClick}
          className={`
            w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border
            flex items-center justify-center
            transition-all duration-200 hover:scale-105 active:scale-95
            ${
              layerControlActive
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
                : 'bg-white/90 hover:bg-white text-gray-700 border-gray-200/50 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-700/50'
            }
          `}
          title="Lớp hiển thị"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Windy Button */}
        <button
          onClick={onWindyClick}
          className="w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          title="Xem dự báo thời tiết Windy"
        >
          <Wind className="w-4 h-4" />
        </button>

        {/* AI Forecast Button */}
        <button
          onClick={onAIForecastClick}
          className={`
            w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border
            flex items-center justify-center
            transition-all duration-200 hover:scale-105 active:scale-95
            ${
              aiForecastActive
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
                : 'bg-white/90 hover:bg-white text-gray-700 border-gray-200/50 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-700/50'
            }
          `}
          title="Dự báo AI"
        >
          <span className="text-xs font-bold">AI</span>
        </button>

        {/* Location Info Popup */}
        <LocationInfoPopup />
      </div>

      {/* Mobile: Two rows - better organization */}
      <div className="sm:hidden absolute top-3 left-3 right-3 z-40 flex flex-col gap-2">
        {/* Row 1: Map Styles (4 buttons) */}
        <div className="flex flex-row gap-2 justify-start">
          <MapStyleSwitcher value={baseMapStyle} onChange={onStyleChange} />
        </div>

        {/* Row 2: Action buttons (4 buttons evenly spaced) */}
        <div className="flex flex-row gap-2 justify-start">
          {/* My Location */}
          <button
            onClick={requestLocation}
            disabled={isLocating}
            className={`
              w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border
              flex items-center justify-center
              transition-all duration-200
              ${
                userLocation
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                  : 'bg-white/90 hover:bg-white text-gray-700 border-gray-200/50'
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

          {/* Layer Control */}
          <button
            onClick={onLayerControlClick}
            className={`
              w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border
              flex items-center justify-center
              transition-all duration-200 active:scale-95
              ${
                layerControlActive
                  ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
                  : 'bg-white/90 hover:bg-white text-gray-700 border-gray-200/50'
              }
            `}
            title="Lớp"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Windy */}
          <button
            onClick={onWindyClick}
            className="w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 flex items-center justify-center transition-all duration-200 active:scale-95"
            title="Windy"
          >
            <Wind className="w-4 h-4" />
          </button>

          {/* AI Forecast */}
          <button
            onClick={onAIForecastClick}
            className={`
              w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border
              flex items-center justify-center
              transition-all duration-200 active:scale-95
              ${
                aiForecastActive
                  ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
                  : 'bg-white/90 hover:bg-white text-gray-700 border-gray-200/50'
              }
            `}
            title="AI"
          >
            <span className="text-xs font-bold">AI</span>
          </button>
        </div>

        {/* Location Info Popup - below buttons on mobile */}
        <div className="flex justify-start">
          <LocationInfoPopup />
        </div>
      </div>
    </>
  )
}
