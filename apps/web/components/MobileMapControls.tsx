'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Menu, X, ArrowLeft, MapPin, MapPinned, Info, Map, Satellite, Globe, Mountain,
  Loader2, Play, Pause, Newspaper, Sun, Moon, Check, Heart, Route, Cloud, Wind
} from 'lucide-react'
import Link from 'next/link'
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
  // Action callbacks for mobile buttons (moved from page.tsx)
  onWeatherClick?: () => void
  onStormClick?: () => void
  isLoadingStorm?: boolean
}

// Map style icon mapping
const MAP_STYLE_ICONS: Record<BaseMapStyleId, React.ComponentType<{ className?: string }>> = {
  streets: Map,
  hybrid: Satellite,
  satellite: Globe,
  outdoors: Mountain,
}

const MAP_STYLE_LABELS: Record<BaseMapStyleId, string> = {
  streets: 'Bản đồ đường',
  hybrid: 'Vệ tinh + Đường',
  satellite: 'Vệ tinh',
  outdoors: 'Địa hình',
}

export function MobileMapControls({
  baseMapStyle,
  onStyleChange,
  onLegendClick,
  legendActive,
  onLocationClick,
  onWeatherClick,
  onStormClick,
  isLoadingStorm = false
}: MobileMapControlsProps) {
  const { userLocation, isLocating, requestLocation } = useLocation()
  const { isPlaying, isLoading, play, pause } = useGlobalAudioPlayer()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isNewsPopupOpen, setIsNewsPopupOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize dark mode state on mount
  useEffect(() => {
    setMounted(true)
    const htmlElement = document.documentElement
    setIsDark(htmlElement.classList.contains('dark'))
  }, [])

  // Toggle dark mode
  const toggleDarkMode = () => {
    const htmlElement = document.documentElement
    const newIsDark = !isDark
    if (newIsDark) {
      htmlElement.classList.add('dark')
      localStorage.theme = 'dark'
    } else {
      htmlElement.classList.remove('dark')
      localStorage.theme = 'light'
    }
    setIsDark(newIsDark)
    setIsExpanded(false)
  }

  // Handle My Location button click
  const handleLocationClick = () => {
    if (userLocation) {
      onLocationClick?.(userLocation.latitude, userLocation.longitude)
    } else {
      requestLocation()
    }
    setIsExpanded(false)
  }

  // Handle Audio play/pause
  const handleAudioClick = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
    setIsExpanded(false)
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

  // Menu item component
  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    isActive = false,
    rightElement
  }: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    onClick: () => void
    isActive?: boolean
    rightElement?: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3
        transition-colors duration-150
        ${isActive
          ? 'bg-blue-500/10 dark:bg-blue-400/10'
          : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-700/50 active:bg-neutral-200/80 dark:active:bg-neutral-600/50'
        }
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-300'}`} />
      <span className={`flex-1 text-left text-[15px] ${isActive ? 'text-blue-500 dark:text-blue-400 font-medium' : 'text-neutral-800 dark:text-neutral-100'}`}>
        {label}
      </span>
      {rightElement}
      {isActive && !rightElement && (
        <Check className="w-4 h-4 text-blue-500 dark:text-blue-400" />
      )}
    </button>
  )

  // Section divider
  const Divider = () => (
    <div className="h-px bg-neutral-200/60 dark:bg-neutral-700/60 mx-3" />
  )

  // Section header
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="px-4 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {title}
    </div>
  )

  const buttonBaseStyle = "w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-xl border shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] transition-all duration-200"
  const buttonInactiveStyle = "bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-700/80 dark:border-neutral-700/50"

  return (
    <div ref={containerRef} className="sm:hidden fixed top-4 left-4 z-50">
      {/* Single Hamburger Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`${buttonBaseStyle} ${buttonInactiveStyle} hover:scale-105 active:scale-95`}
        aria-label={isExpanded ? "Đóng menu" : "Mở menu"}
      >
        {isExpanded ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>

      {/* Apple-style Frosted Glass Dropdown */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
            onClick={() => setIsExpanded(false)}
          />

          {/* Menu Panel */}
          <div
            className="
              absolute top-14 left-0 z-50
              w-64
              bg-white/80 dark:bg-neutral-900/80
              backdrop-blur-2xl backdrop-saturate-150
              border border-neutral-200/50 dark:border-neutral-700/50
              rounded-2xl
              shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]
              dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3)]
              overflow-hidden
              animate-in fade-in slide-in-from-top-2 duration-200
            "
          >
            {/* Navigation */}
            <div className="py-1">
              <MenuItem
                icon={ArrowLeft}
                label="Trang chủ"
                onClick={() => {
                  setIsExpanded(false)
                  window.location.href = '/'
                }}
              />
            </div>

            <Divider />

            {/* Audio & News */}
            <div className="py-1">
              <MenuItem
                icon={isPlaying ? Pause : Play}
                label={isPlaying ? "Tạm dừng phát" : "Phát tin tức"}
                onClick={handleAudioClick}
                isActive={isPlaying}
                rightElement={
                  isLoading ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> : undefined
                }
              />
              <MenuItem
                icon={Newspaper}
                label="Xem tin tức"
                onClick={() => {
                  setIsNewsPopupOpen(true)
                  setIsExpanded(false)
                }}
              />
            </div>

            <Divider />

            {/* Map Styles */}
            <SectionHeader title="Kiểu bản đồ" />
            <div className="py-1">
              {Object.entries(MAP_STYLE_ICONS).map(([styleId, IconComponent]) => (
                <MenuItem
                  key={styleId}
                  icon={IconComponent}
                  label={MAP_STYLE_LABELS[styleId as BaseMapStyleId]}
                  onClick={() => {
                    onStyleChange(styleId as BaseMapStyleId)
                    setIsExpanded(false)
                  }}
                  isActive={baseMapStyle === styleId}
                />
              ))}
            </div>

            <Divider />

            {/* Tools */}
            <SectionHeader title="Công cụ" />
            <div className="py-1">
              <MenuItem
                icon={userLocation ? MapPinned : MapPin}
                label={userLocation ? "Vị trí của tôi" : "Xác định vị trí"}
                onClick={handleLocationClick}
                isActive={!!userLocation}
                rightElement={
                  isLocating ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> : undefined
                }
              />
              <MenuItem
                icon={Info}
                label="Chú giải bản đồ"
                onClick={() => {
                  onLegendClick()
                  setIsExpanded(false)
                }}
                isActive={legendActive}
              />
            </div>

            <Divider />

            {/* Actions - moved from right side buttons */}
            <SectionHeader title="Hành động" />
            <div className="py-1">
              <Link href="/help" onClick={() => setIsExpanded(false)}>
                <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-100/80 dark:hover:bg-neutral-700/50 active:bg-neutral-200/80 dark:active:bg-neutral-600/50 transition-colors duration-150">
                  <Heart className="w-5 h-5 flex-shrink-0 text-purple-500" />
                  <span className="flex-1 text-left text-[15px] text-neutral-800 dark:text-neutral-100">Cứu trợ</span>
                </div>
              </Link>
              <Link href="/routes" onClick={() => setIsExpanded(false)}>
                <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-100/80 dark:hover:bg-neutral-700/50 active:bg-neutral-200/80 dark:active:bg-neutral-600/50 transition-colors duration-150">
                  <Route className="w-5 h-5 flex-shrink-0 text-blue-500" />
                  <span className="flex-1 text-left text-[15px] text-neutral-800 dark:text-neutral-100">Tuyến đường</span>
                </div>
              </Link>
              {onWeatherClick && (
                <MenuItem
                  icon={Cloud}
                  label="Thời tiết"
                  onClick={() => {
                    onWeatherClick()
                    setIsExpanded(false)
                  }}
                />
              )}
              {onStormClick && (
                <MenuItem
                  icon={Wind}
                  label="Bão số 15"
                  onClick={() => {
                    onStormClick()
                    setIsExpanded(false)
                  }}
                  rightElement={
                    isLoadingStorm ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> : undefined
                  }
                />
              )}
            </div>

            <Divider />

            {/* Theme */}
            <div className="py-1 pb-2">
              {mounted && (
                <MenuItem
                  icon={isDark ? Moon : Sun}
                  label={isDark ? "Chế độ tối" : "Chế độ sáng"}
                  onClick={toggleDarkMode}
                  rightElement={
                    <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{isDark ? 'Bật' : 'Tắt'}</span>
                    </div>
                  }
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Full-screen News Popup */}
      <MobileNewsPopup
        isOpen={isNewsPopupOpen}
        onClose={() => setIsNewsPopupOpen(false)}
      />
    </div>
  )
}
