'use client'

import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useEffect, useState } from 'react'

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      {/* Mini Player (Always visible when open) */}
      <div
        className="relative bg-gradient-to-r from-blue-600/95 to-indigo-600/95 backdrop-blur-lg shadow-2xl border-t border-white/20"
        style={{ height: '60px' }}
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-white/90 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Main Controls */}
        <div className="flex items-center h-full px-4 gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={isPlaying ? pause : play}
            disabled={isLoading || !bulletin}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center group"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              // Pause icon
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              // Play icon
              <svg
                className="w-5 h-5 text-white ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Title and Time */}
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
          {bulletin && bulletin.priority_level !== 'low' && (
            <div
              className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-bold ${
                bulletin.priority_level === 'critical'
                  ? 'bg-red-500/90 text-white'
                  : bulletin.priority_level === 'high'
                  ? 'bg-orange-500/90 text-white'
                  : 'bg-yellow-500/90 text-black'
              }`}
            >
              {bulletin.priority_level === 'critical'
                ? 'KHẨN CẤP'
                : bulletin.priority_level === 'high'
                ? 'QUAN TRỌNG'
                : 'CẢNH BÁO'}
            </div>
          )}

          {/* Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-all flex items-center justify-center"
            aria-label="Toggle details"
          >
            <svg
              className={`w-4 h-4 text-white transition-transform ${
                showDetails ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-all flex items-center justify-center"
            aria-label="Close player"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable Details Panel */}
      {showDetails && bulletin && (
        <div className="bg-white/95 backdrop-blur-lg shadow-xl border-t border-gray-200 max-h-[300px] overflow-y-auto">
          <div className="p-4 space-y-3">
            {/* Summary Text */}
            {bulletin.summary_text && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">
                  Nội dung
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {bulletin.summary_text}
                </p>
              </div>
            )}

            {/* Key Points */}
            {bulletin.key_points && bulletin.key_points.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">
                  Điểm chính
                </div>
                <ul className="space-y-1">
                  {bulletin.key_points.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span className="text-sm text-gray-700">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Actions */}
            {bulletin.recommended_actions &&
              bulletin.recommended_actions.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">
                    Khuyến nghị
                  </div>
                  <ul className="space-y-1">
                    {bulletin.recommended_actions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span className="text-sm text-gray-700">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Regions Affected */}
            {bulletin.regions_affected && bulletin.regions_affected.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">
                  Khu vực
                </div>
                <div className="flex flex-wrap gap-1">
                  {bulletin.regions_affected.map((region, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Generated At */}
            <div className="text-xs text-gray-400 pt-2 border-t">
              Cập nhật: {new Date(bulletin.generated_at).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
