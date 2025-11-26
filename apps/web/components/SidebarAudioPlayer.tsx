'use client'

import { useGlobalAudioPlayer } from '@/contexts/AudioPlayerContext'
import { Play, Pause, Loader2 } from 'lucide-react'
import { HeaderVoicePlayer } from './HeaderVoicePlayer'

interface SidebarAudioPlayerProps {
  collapsed: boolean
}

/**
 * SidebarAudioPlayer - UI component for audio controls
 *
 * This component ONLY renders UI. All audio state is managed by
 * AudioPlayerContext, so toggling sidebar collapsed/expanded
 * does NOT interrupt audio playback.
 */
export default function SidebarAudioPlayer({ collapsed }: SidebarAudioPlayerProps) {
  const { isPlaying, isLoading, play, pause, currentTime, duration } = useGlobalAudioPlayer()

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent parent onClick when collapsed
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  // Calculate progress (0 to 1)
  const progress = duration > 0 ? currentTime / duration : 0

  if (collapsed) {
    // Collapsed mode: Circular button with progress ring
    const radius = 14
    const circumference = 2 * Math.PI * radius // ≈ 87.96
    const progressOffset = (1 - progress) * circumference

    return (
      <div className="relative w-8 h-8">
        {/* SVG Progress Rings */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 32 32">
          {/* Background ring - Light: gray outline, Dark: white outline */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-neutral-400 dark:text-white/60"
          />
          {/* Progress ring - Light: black, Dark: white */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            className="text-black dark:text-white transition-all duration-300 ease-linear"
          />
        </svg>

        {/* Play/Pause button center - Light: transparent outline, Dark: transparent outline */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className="absolute inset-0 flex items-center justify-center
                     rounded-full bg-transparent dark:bg-transparent
                     hover:bg-black/5 dark:hover:bg-white/10
                     transition-colors backdrop-blur-sm
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 text-black dark:text-white animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3 text-black dark:text-white fill-current" />
          ) : (
            <Play className="w-3 h-3 text-black dark:text-white fill-current" />
          )}
        </button>
      </div>
    )
  }

  // Expanded mode: Use full HeaderVoicePlayer with pill design, glass blur, and water fill animation
  return <HeaderVoicePlayer showLabel={true} />
}
