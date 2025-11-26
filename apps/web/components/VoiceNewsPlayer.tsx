'use client'

import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useState } from 'react'
import { Radio, Play, Pause, X, ChevronUp, ChevronDown } from 'lucide-react'

interface VoiceNewsPlayerProps {
  isOpen: boolean
  onClose: () => void
}

export function VoiceNewsPlayer({ isOpen, onClose }: VoiceNewsPlayerProps) {
  const {
    bulletin,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    play,
    pause,
  } = useAudioPlayer()

  const [showDetails, setShowDetails] = useState(false)

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!isOpen) return null

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
        return 'BÌN​H THƯỜNG'
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expanded Details Panel */}
      {showDetails && bulletin && (
        <div className="bg-white border-t border-gray-200 shadow-2xl max-h-96 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Title & Priority */}
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-gray-900 flex-1">
                {bulletin.title}
              </h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getPriorityColor(
                  bulletin.priority_level
                )}`}
              >
                {getPriorityText(bulletin.priority_level)}
              </span>
            </div>

            {/* Summary Text */}
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {bulletin.summary_text}
              </p>
            </div>

            {/* Regions Affected */}
            {bulletin.regions_affected && bulletin.regions_affected.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  🗺️ Khu vực ảnh hưởng:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {bulletin.regions_affected.map((region, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-medium"
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key Points */}
            {bulletin.key_points && bulletin.key_points.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  📌 Điểm chính:
                </h4>
                <ul className="space-y-1">
                  {bulletin.key_points.map((point, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Actions */}
            {bulletin.recommended_actions && bulletin.recommended_actions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  ⚠️ Khuyến nghị:
                </h4>
                <ul className="space-y-1">
                  {bulletin.recommended_actions.map((action, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-orange-600 mt-0.5">→</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mini Player - Green Button */}
      <div className="bg-gradient-to-r from-green-600/95 to-emerald-600/95 backdrop-blur-lg shadow-2xl border-t border-white/20">
        {/* Progress Bar */}
        <div className="h-1 bg-white/20">
          <div
            className="h-full bg-white/90 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Main Controls */}
        <div className="flex items-center h-16 px-4 gap-3">
          {/* Radio Icon + "Nghe bản tin" Button */}
          <button
            onClick={isPlaying ? pause : play}
            disabled={isLoading || !bulletin}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-full group"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Radio className="w-5 h-5 text-white animate-pulse" />
            )}
            <span className="text-white font-semibold text-sm">
              {isPlaying ? 'Đang phát' : 'Nghe bản tin'}
            </span>
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm truncate">
              {isLoading ? (
                'Đang tải bản tin...'
              ) : error ? (
                'Lỗi tải bản tin'
              ) : bulletin ? (
                bulletin.title
              ) : (
                'Không có bản tin'
              )}
            </div>
            <div className="text-white/70 text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Priority Badge */}
          {bulletin && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getPriorityColor(
                bulletin.priority_level
              )}`}
            >
              {getPriorityText(bulletin.priority_level)}
            </span>
          )}

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-all flex items-center justify-center"
            aria-label={showDetails ? 'Thu gọn' : 'Mở rộng'}
          >
            {showDetails ? (
              <ChevronDown className="w-5 h-5 text-white" />
            ) : (
              <ChevronUp className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 hover:bg-red-500/50 active:bg-red-500/70 transition-all flex items-center justify-center"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
