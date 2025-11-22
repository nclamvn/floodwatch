'use client'

import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { Play, Pause } from 'lucide-react'

export function HeaderVoicePlayer() {
  const {
    isPlaying,
    isLoading,
    currentTime,
    duration,
    play,
    pause,
    bulletin,
  } = useAudioPlayer()

  // Calculate progress percentage for water filling animation
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleToggle = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  return (
    <div className="relative">
      {/* Main pill-shaped container - Slim 32px height, 290px width */}
      <button
        onClick={handleToggle}
        disabled={isLoading || !bulletin}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-full overflow-hidden backdrop-blur-md bg-gray-200/30 border border-white/20 hover:bg-gray-200/40 active:bg-gray-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 w-[290px] group"
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {/* Water filling animation - behind everything */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-gray-100/60 via-white/40 to-gray-100/60 transition-all duration-500 ease-linear"
          style={{
            width: `${progress}%`,
            opacity: isPlaying ? 0.8 : 0.4,
          }}
        />

        {/* Play/Pause Icon Circle - Smaller for slim design */}
        <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm group-hover:bg-white/90 transition-colors">
          {isLoading ? (
            <div className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3 text-gray-700" fill="currentColor" />
          ) : (
            <Play className="w-3 h-3 text-gray-700 ml-0.5" fill="currentColor" />
          )}
        </div>

        {/* Text Label - Smaller font for slim design */}
        <span className="relative z-10 text-xs font-semibold text-gray-800 whitespace-nowrap select-none">
          {isLoading ? 'Đang tải...' : 'Nghe tin cập nhật mới nhất'}
        </span>

        {/* Subtle glow effect when playing */}
        {isPlaying && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        )}
      </button>

      {/* Mobile: Hide text, show only icon */}
      <style jsx>{`
        @media (max-width: 640px) {
          button span {
            display: none;
          }
          button {
            width: 40px;
            padding: 0.375rem;
          }
        }
      `}</style>
    </div>
  )
}
