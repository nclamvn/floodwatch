'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Radio, Play, Pause, Loader2 } from 'lucide-react'
import { useGlobalAudioPlayer } from '@/contexts/AudioPlayerContext'

interface MobileNewsPopupProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * MobileNewsPopup - Full-screen news popup for mobile
 *
 * Features:
 * - Full-screen overlay (100vw x 100vh)
 * - Arrow-down close button (no circle background)
 * - Audio player with bulletin content
 * - Animated entrance/exit
 */
export default function MobileNewsPopup({ isOpen, onClose }: MobileNewsPopupProps) {
  const {
    bulletin,
    isPlaying,
    isLoading,
    play,
    pause,
    currentTime,
    duration,
  } = useGlobalAudioPlayer()

  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    } else {
      setIsAnimating(false)
      const timeout = setTimeout(() => {
        setIsVisible(false)
      }, 300) // Match animation duration
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const getPriorityColor = (level?: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-600'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      default:
        return 'bg-green-500'
    }
  }

  const getPriorityText = (level?: string) => {
    switch (level) {
      case 'critical':
        return 'KHẨN CẤP'
      case 'high':
        return 'QUAN TRỌNG'
      case 'medium':
        return 'CẢNH BÁO'
      default:
        return 'BÌNH THƯỜNG'
    }
  }

  // State for portal mounting
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isVisible || !mounted) return null

  // Use Portal to render at document.body level, escaping parent z-index stacking context
  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Full-screen backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-800 to-neutral-900"
        onClick={onClose}
      />

      {/* Content container */}
      <div
        className={`relative h-full w-full flex flex-col transition-transform duration-300 ${
          isAnimating ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Radio className="w-5 h-5 text-green-400" />
            Bản tin thoại AI
          </h2>

          {/* Close button - Arrow down without circle */}
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Đóng"
          >
            <ChevronDown className="w-8 h-8" strokeWidth={2.5} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Main content - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
              <p className="text-white/70">Đang tải bản tin...</p>
            </div>
          ) : bulletin ? (
            <div className="space-y-6">
              {/* Title & Priority */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getPriorityColor(
                      bulletin.priority_level
                    )}`}
                  >
                    {getPriorityText(bulletin.priority_level)}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white leading-tight">
                  {bulletin.title}
                </h3>
              </div>

              {/* Summary Text */}
              <div className="bg-white/5 rounded-2xl p-4">
                <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                  {bulletin.summary_text}
                </p>
              </div>

              {/* Regions Affected */}
              {bulletin.regions_affected && bulletin.regions_affected.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
                    Khu vực ảnh hưởng
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {bulletin.regions_affected.map((region, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-white/10 text-white rounded-full text-sm"
                      >
                        {region}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Points */}
              {bulletin.key_points && bulletin.key_points.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
                    Điểm chính
                  </h4>
                  <ul className="space-y-2">
                    {bulletin.key_points.map((point, idx) => (
                      <li key={idx} className="text-white/90 flex items-start gap-3">
                        <span className="text-green-400 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Actions */}
              {bulletin.recommended_actions && bulletin.recommended_actions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
                    Khuyến nghị
                  </h4>
                  <ul className="space-y-2">
                    {bulletin.recommended_actions.map((action, idx) => (
                      <li key={idx} className="text-white/90 flex items-start gap-3">
                        <span className="text-orange-400 mt-1">→</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Radio className="w-12 h-12 text-white/30" />
              <p className="text-white/50">Không có bản tin</p>
            </div>
          )}
        </div>

        {/* Bottom audio controls */}
        <div className="border-t border-white/10 bg-black/30 backdrop-blur-lg">
          {/* Time display */}
          <div className="flex items-center justify-between px-4 py-2 text-xs text-white/60 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Play/Pause button */}
          <div className="flex items-center justify-center pb-8 pt-2">
            <button
              onClick={isPlaying ? pause : play}
              disabled={isLoading || !bulletin}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
