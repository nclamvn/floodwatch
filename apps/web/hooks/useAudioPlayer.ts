'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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

interface UseAudioPlayerOptions {
  enabled?: boolean
  refreshInterval?: number // Auto-refresh bulletin every X ms (default: 10 minutes)
}

interface UseAudioPlayerReturn {
  bulletin: AINewsBulletin | null
  isPlaying: boolean
  isLoading: boolean
  error: string | null
  currentTime: number
  duration: number
  play: () => void
  pause: () => void
  seek: (time: number) => void
  refetch: () => void
}

/**
 * Hook to fetch and play AI-generated news bulletins
 *
 * Features:
 * - Fetches latest 1-minute bulletin from API
 * - Manages HTML5 Audio playback state
 * - Auto-refreshes bulletin every 10 minutes
 * - Provides playback controls (play, pause, seek)
 *
 * @example
 * ```tsx
 * const { bulletin, isPlaying, play, pause } = useAudioPlayer()
 * ```
 */
export function useAudioPlayer(
  options: UseAudioPlayerOptions = {}
): UseAudioPlayerReturn {
  const { enabled = true, refreshInterval = 600000 } = options // Default: 10 minutes

  const [bulletin, setBulletin] = useState<AINewsBulletin | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1)
  }, [])

  // Fetch latest bulletin from API
  useEffect(() => {
    if (!enabled) return

    const fetchBulletin = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'
        const url = `${apiUrl}/ai-news/latest`

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch bulletin: ${response.statusText}`)
        }

        const responseData = await response.json()
        const bulletinData = responseData.data

        setBulletin(bulletinData)

        // Initialize audio element if audio_url exists
        if (bulletinData.audio_url) {
          // Create or update audio element
          if (!audioRef.current) {
            audioRef.current = new Audio()

            // Set up event listeners
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

          // Update source if changed
          if (audioRef.current.src !== bulletinData.audio_url) {
            audioRef.current.src = bulletinData.audio_url
            audioRef.current.load()
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

    // Set up auto-refresh (default: every 10 minutes)
    let intervalId: NodeJS.Timeout | null = null
    if (refreshInterval && refreshInterval > 0) {
      intervalId = setInterval(fetchBulletin, refreshInterval)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [enabled, refreshInterval, refetchTrigger])

  // Cleanup audio on unmount
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
      audioRef.current.play().catch((err) => {
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

  return {
    bulletin,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    play,
    pause,
    seek,
    refetch,
  }
}
