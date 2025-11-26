'use client'

import { useGlobalAudioPlayer } from '@/contexts/AudioPlayerContext'
import { Play, Pause } from 'lucide-react'

interface HeaderVoicePlayerProps {
  className?: string
  showLabel?: boolean
}

/**
 * HeaderVoicePlayer - Pill-shaped audio player UI
 *
 * This component ONLY renders UI. All audio state is managed by
 * AudioPlayerContext for seamless playback across UI state changes.
 */
export function HeaderVoicePlayer({ className = '', showLabel = false }: HeaderVoicePlayerProps = {}) {
  const {
    isPlaying,
    isLoading,
    currentTime,
    duration,
    play,
    pause,
    bulletin,
  } = useGlobalAudioPlayer()

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
      {/* Main pill-shaped container - Auto width to fit content */}
      <button
        onClick={handleToggle}
        disabled={isLoading || !bulletin}
        className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full overflow-hidden
                    backdrop-blur-md
                    bg-neutral-200/70 dark:bg-neutral-300/40
                    border border-neutral-400/50 dark:border-neutral-400/30
                    hover:bg-neutral-200/80 dark:hover:bg-neutral-300/50
                    active:bg-neutral-300/70 dark:active:bg-neutral-300/60
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-300 w-auto group ${className}`}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {/* Water filling animation - behind everything */}
        <div
          className="absolute inset-0
                     bg-gradient-to-r from-white/40 via-neutral-200/50 to-white/40
                     dark:from-neutral-400/50 dark:via-neutral-300/60 dark:to-neutral-400/50
                     transition-all duration-500 ease-linear"
          style={{
            width: `${progress}%`,
            opacity: isPlaying ? 0.8 : 0.4,
          }}
        />

        {/* Play/Pause Icon Circle - Smaller for slim design */}
        <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full
                        bg-white/90 dark:bg-neutral-700/90
                        backdrop-blur-sm flex items-center justify-center shadow-sm
                        group-hover:bg-white dark:group-hover:bg-neutral-700
                        transition-colors">
          {isLoading ? (
            <div className="w-3 h-3 border-2
                            border-neutral-900/30 dark:border-white/30
                            border-t-neutral-900 dark:border-t-white
                            rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3 text-neutral-900 dark:text-white" fill="currentColor" />
          ) : (
            <Play className="w-3 h-3 text-neutral-900 dark:text-white ml-0.5" fill="currentColor" />
          )}
        </div>

        {/* Text Label - Smaller font for slim design */}
        <span className="relative z-10 text-xs font-semibold
                         text-neutral-900 dark:text-white
                         whitespace-nowrap select-none">
          {isLoading ? 'Đang tải...' : 'Nghe tin mới nhất'}
        </span>

        {/* Subtle glow effect when playing */}
        {isPlaying && (
          <div className="absolute inset-0 rounded-full
                          bg-gradient-to-r from-transparent
                          via-white/20 dark:via-neutral-500/20
                          to-transparent animate-pulse" />
        )}
      </button>

      {/* Mobile: Hide text, show only icon (unless showLabel is true) */}
      {!showLabel && (
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
      )}
    </div>
  )
}
