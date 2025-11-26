/**
 * useScheduledMapData Hook
 *
 * Phase 5: Advanced Map Optimization
 * Applies render scheduling to map data updates:
 * - High priority: User location, selected items
 * - Normal priority: Visible markers within viewport
 * - Low priority: Prefetched data, off-screen markers
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  scheduleWhenIdle,
  scheduleFrame,
  createBatchScheduler,
} from '@/lib/renderScheduler'

type Priority = 'high' | 'normal' | 'low'

interface ScheduledDataOptions<T> {
  /** Initial data */
  initialData?: T[]
  /** Priority level for updates */
  priority?: Priority
  /** Batch multiple updates */
  batchUpdates?: boolean
  /** Batch delay in ms */
  batchDelayMs?: number
}

interface ScheduledDataResult<T> {
  /** Current data state */
  data: T[]
  /** Update data with scheduling */
  setData: (newData: T[], priority?: Priority) => void
  /** Force immediate update */
  setDataImmediate: (newData: T[]) => void
  /** Whether an update is pending */
  isPending: boolean
}

/**
 * Hook for scheduled map data updates
 *
 * @example
 * ```tsx
 * const { data: markers, setData } = useScheduledMapData<Marker>({
 *   priority: 'normal',
 *   batchUpdates: true,
 * })
 *
 * // Update with scheduling
 * setData(newMarkers, 'high') // High priority - immediate
 * setData(newMarkers, 'low')  // Low priority - when idle
 * ```
 */
export function useScheduledMapData<T>(
  options: ScheduledDataOptions<T> = {}
): ScheduledDataResult<T> {
  const {
    initialData = [],
    priority: defaultPriority = 'normal',
    batchUpdates = false,
    batchDelayMs = 100,
  } = options

  const [data, setDataState] = useState<T[]>(initialData)
  const [isPending, setIsPending] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const batchSchedulerRef = useRef<ReturnType<typeof createBatchScheduler<T[]>> | null>(null)

  // Initialize batch scheduler if needed
  useEffect(() => {
    if (batchUpdates && !batchSchedulerRef.current) {
      batchSchedulerRef.current = createBatchScheduler<T[]>(
        (updates) => {
          // Use the latest update
          const latest = updates[updates.length - 1]
          if (latest) {
            setDataState(latest.data)
            setIsPending(false)
          }
        },
        batchDelayMs,
        10
      )
    }

    return () => {
      batchSchedulerRef.current?.clear()
    }
  }, [batchUpdates, batchDelayMs])

  const setData = useCallback(
    (newData: T[], priority: Priority = defaultPriority) => {
      // Cancel any pending update
      if (cancelRef.current) {
        cancelRef.current()
        cancelRef.current = null
      }

      setIsPending(true)

      // Use batch scheduler if enabled
      if (batchUpdates && batchSchedulerRef.current) {
        batchSchedulerRef.current.add(Date.now().toString(), newData)
        return
      }

      // Schedule based on priority
      switch (priority) {
        case 'high':
          // Immediate update on next frame
          cancelRef.current = scheduleFrame(() => {
            setDataState(newData)
            setIsPending(false)
          })
          break

        case 'normal':
          // Update on animation frame
          cancelRef.current = scheduleFrame(() => {
            setDataState(newData)
            setIsPending(false)
          })
          break

        case 'low':
          // Update when browser is idle
          cancelRef.current = scheduleWhenIdle(() => {
            setDataState(newData)
            setIsPending(false)
          }, 2000) // Max 2s delay
          break
      }
    },
    [defaultPriority, batchUpdates]
  )

  const setDataImmediate = useCallback((newData: T[]) => {
    // Cancel any pending update
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
    }
    setDataState(newData)
    setIsPending(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current()
      }
      batchSchedulerRef.current?.clear()
    }
  }, [])

  return {
    data,
    setData,
    setDataImmediate,
    isPending,
  }
}

/**
 * Hook for managing map layer visibility with smooth transitions
 */
export function useLayerVisibilityScheduler(initialVisibility: Record<string, boolean>) {
  const [visibility, setVisibility] = useState(initialVisibility)
  const pendingRef = useRef<Map<string, boolean>>(new Map())
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setLayerVisibility = useCallback(
    (layerId: string, visible: boolean, immediate = false) => {
      if (immediate) {
        setVisibility((prev) => ({ ...prev, [layerId]: visible }))
        return
      }

      // Queue the change
      pendingRef.current.set(layerId, visible)

      // Debounce batch updates
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        setVisibility((prev) => {
          const updates: Record<string, boolean> = {}
          pendingRef.current.forEach((value, key) => {
            updates[key] = value
          })
          pendingRef.current.clear()
          return { ...prev, ...updates }
        })
      }, 50)
    },
    []
  )

  const toggleLayer = useCallback((layerId: string) => {
    setVisibility((prev) => ({ ...prev, [layerId]: !prev[layerId] }))
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    visibility,
    setLayerVisibility,
    toggleLayer,
    setAllVisibility: setVisibility,
  }
}

/**
 * Hook for viewport-aware data prioritization
 */
export function useViewportPrioritization<T extends { lat: number; lon: number }>(
  items: T[],
  viewport: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null
) {
  const [prioritized, setPrioritized] = useState<{
    inViewport: T[]
    nearViewport: T[]
    outOfViewport: T[]
  }>({ inViewport: [], nearViewport: [], outOfViewport: [] })

  useEffect(() => {
    if (!viewport || items.length === 0) {
      setPrioritized({ inViewport: items, nearViewport: [], outOfViewport: [] })
      return
    }

    // Expand viewport for "near" classification
    const expandedViewport = {
      minLon: viewport.minLon - (viewport.maxLon - viewport.minLon) * 0.5,
      minLat: viewport.minLat - (viewport.maxLat - viewport.minLat) * 0.5,
      maxLon: viewport.maxLon + (viewport.maxLon - viewport.minLon) * 0.5,
      maxLat: viewport.maxLat + (viewport.maxLat - viewport.minLat) * 0.5,
    }

    const inViewport: T[] = []
    const nearViewport: T[] = []
    const outOfViewport: T[] = []

    items.forEach((item) => {
      const inMain =
        item.lon >= viewport.minLon &&
        item.lon <= viewport.maxLon &&
        item.lat >= viewport.minLat &&
        item.lat <= viewport.maxLat

      if (inMain) {
        inViewport.push(item)
      } else {
        const inExpanded =
          item.lon >= expandedViewport.minLon &&
          item.lon <= expandedViewport.maxLon &&
          item.lat >= expandedViewport.minLat &&
          item.lat <= expandedViewport.maxLat

        if (inExpanded) {
          nearViewport.push(item)
        } else {
          outOfViewport.push(item)
        }
      }
    })

    setPrioritized({ inViewport, nearViewport, outOfViewport })
  }, [items, viewport])

  return prioritized
}
