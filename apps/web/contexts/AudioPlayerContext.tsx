'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'

export interface AINewsBulletin {
  title: string
  summary_text: string
  audio_url: string
  generated_at: string
  priority_level: 'low' | 'medium' | 'high' | 'critical'
  regions_affected: string[]
  key_points: string[]
  recommended_actions: string[]
}

interface AudioPlayerState {
  bulletin: AINewsBulletin | null
  isPlaying: boolean
  isLoading: boolean
  error: string | null
  currentTime: number
  duration: number
}

interface AudioPlayerContextValue extends AudioPlayerState {
  play: () => void
  pause: () => void
  seek: (time: number) => void
  refetch: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null)

interface AudioPlayerProviderProps {
  children: ReactNode
  enabled?: boolean
  refreshInterval?: number
}

/**
 * AudioPlayerProvider - Global audio player state manager
 *
 * This provider ensures audio playback continues seamlessly when:
 * - Sidebar is collapsed/expanded
 * - User navigates between different UI states on /map
 *
 * The actual <audio> element is mounted once at this level and
 * persists across all child component re-renders.
 */
export function AudioPlayerProvider({
  children,
  enabled = true,
  refreshInterval = 600000 // 10 minutes
}: AudioPlayerProviderProps) {
  const [bulletin, setBulletin] = useState<AINewsBulletin | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  // CRITICAL: audioRef persists across all re-renders
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1)
  }, [])

  // Fetch bulletin from API
  useEffect(() => {
    if (!enabled) return

    const fetchBulletin = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/ai-news/latest`)

        if (!response.ok) {
          throw new Error(`Failed to fetch bulletin: ${response.statusText}`)
        }

        const responseData = await response.json()
        const bulletinData = responseData.data

        setBulletin(bulletinData)

        // Initialize audio element ONCE (not on every fetch)
        if (bulletinData?.audio_url) {
          if (!audioRef.current) {
            audioRef.current = new Audio()

            // Event listeners - set up once
            audioRef.current.addEventListener('loadedmetadata', () => {
              setDuration(audioRef.current?.duration || 0)
            })

            audioRef.current.addEventListener('timeupdate', () => {
              setCurrentTime(audioRef.current?.currentTime || 0)
            })

            audioRef.current.addEventListener('ended', () => {
              setIsPlaying(false)
              setCurrentTime(0)
            })

            audioRef.current.addEventListener('play', () => {
              setIsPlaying(true)
            })

            audioRef.current.addEventListener('pause', () => {
              setIsPlaying(false)
            })

            audioRef.current.addEventListener('error', (e) => {
              console.error('Audio playback error:', e)
              setError('Lỗi phát âm thanh')
              setIsPlaying(false)
            })
          }

          // Only update source if it changed
          if (audioRef.current.src !== bulletinData.audio_url) {
            // Save current playback state
            const wasPlaying = !audioRef.current.paused
            const savedTime = audioRef.current.currentTime

            audioRef.current.src = bulletinData.audio_url
            audioRef.current.load()

            // If new audio, don't auto-resume (it's different content)
            // If same audio (shouldn't happen), could restore state
          }
        }
      } catch (err) {
        console.error('Error fetching bulletin:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setBulletin(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBulletin()

    // Auto-refresh
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchBulletin, refreshInterval)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [enabled, refreshInterval, refetchTrigger])

  // Cleanup on unmount (only when provider unmounts, not children)
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error('Play error:', err)
        setError('Không thể phát âm thanh')
      })
    }
  }, [])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const value: AudioPlayerContextValue = {
    bulletin,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    play,
    pause,
    seek,
    refetch
  }

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  )
}

/**
 * Hook to access global audio player state
 *
 * @throws Error if used outside of AudioPlayerProvider
 */
export function useGlobalAudioPlayer(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext)

  if (!context) {
    throw new Error('useGlobalAudioPlayer must be used within an AudioPlayerProvider')
  }

  return context
}

/**
 * Safe hook that returns null if outside provider (for optional usage)
 */
export function useGlobalAudioPlayerSafe(): AudioPlayerContextValue | null {
  return useContext(AudioPlayerContext)
}
