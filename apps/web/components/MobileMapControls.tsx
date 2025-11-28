'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronUp, MapPin, MapPinned, Info, Map, Satellite, Globe, Mountain, Loader2, Play, Pause, Newspaper } from 'lucide-react'
import DarkModeToggle from './DarkModeToggle'
import { type BaseMapStyleId } from '@/lib/mapProvider'
import { useLocation } from '@/contexts/LocationContext'
import { useGlobalAudioPlayer } from '@/contexts/AudioPlayerContext'
import MobileNewsPopup from './MobileNewsPopup'

interface MobileMapControlsProps {
  baseMapStyle: BaseMapStyleId
  onStyleChange: (style: BaseMapStyleId) => void
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
  onLegendClick,
  legendActive,
  onLocationClick
}: MobileMapControlsProps) {
  const { userLocation, isLocating, requestLocation } = useLocation()
  const { isPlaying, isLoading, play, pause, currentTime, duration } = useGlobalAudioPlayer()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isNewsPopupOpen, setIsNewsPopupOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Audio progress for spinning ring
  const progress = duration > 0 ? currentTime / duration : 0

  // Handle My Location button click
  const handleLocationClick = () => {
    if (userLocation) {
      onLocationClick?.(userLocation.latitude, userLocation.longitude)
    } else {
      requestLocation()
    }
  }

  // Handle Audio play/pause
  const handleAudioClick = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
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

      {/* Audio Player Button with Spinning Ring */}
      <div className="relative w-11 h-11">
        {/* Spinning ring when playing */}
        {isPlaying && (
          <svg
            className="absolute inset-0 w-full h-full animate-spin-slow"
            viewBox="0 0 44 44"
            style={{ animationDuration: '3s' }}
          >
            {/* Outer spinning ring */}
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="url(#audioGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="40 85"
            />
            <defs>
              <linearGradient id="audioGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
        )}

        {/* Audio button */}
        <button
          onClick={handleAudioClick}
          disabled={isLoading}
          className={`${buttonBaseStyle} ${isPlaying ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent' : buttonInactiveStyle} hover:scale-105 active:scale-95 disabled:opacity-50`}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát tin tức'}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>
      </div>

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

          {/* News Button */}
          <button
            onClick={() => {
              setIsNewsPopupOpen(true)
              setIsExpanded(false)
            }}
            className={`${buttonBaseStyle} ${buttonInactiveStyle} hover:scale-105 active:scale-95`}
            title="Tin tức"
          >
            <Newspaper className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Full-screen News Popup */}
      <MobileNewsPopup
        isOpen={isNewsPopupOpen}
        onClose={() => setIsNewsPopupOpen(false)}
      />
    </div>
  )
}
