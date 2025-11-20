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
}

export function MapControlsGroup({ baseMapStyle, onStyleChange, onWindyClick, onLayerControlClick, layerControlActive }: MapControlsGroupProps) {
  const { userLocation, isLocating, requestLocation } = useLocation()

  return (
    <div className="absolute top-4 left-4 z-40 flex flex-row gap-2 relative">
      {/* Map Style Switcher - 4 buttons */}
      <MapStyleSwitcher value={baseMapStyle} onChange={onStyleChange} />

      {/* My Location Button - button thứ 5 */}
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

      {/* Layer Control Button - button thứ 6 */}
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

      {/* Windy Button - button thứ 7 */}
      <button
        onClick={onWindyClick}
        className="w-9 h-9 rounded-full shadow-lg backdrop-blur-sm border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        title="Xem dự báo thời tiết Windy"
      >
        <Wind className="w-4 h-4" />
      </button>

      {/* Location Info Popup - appears to the right */}
      <LocationInfoPopup />
    </div>
  )
}
