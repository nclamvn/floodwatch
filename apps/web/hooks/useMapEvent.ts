/**
 * useMapEvent Hook
 *
 * Phase 5: Advanced Map Optimization
 * Safe event listener management for MapLibre:
 * - Auto cleanup on unmount
 * - Prevent memory leaks
 * - Type-safe event handling
 */

import { useEffect, useRef, useCallback } from 'react'
import type { Map as MapLibreMap, MapLayerMouseEvent, MapLayerTouchEvent } from 'maplibre-gl'

type MapEventType =
  | 'click'
  | 'dblclick'
  | 'mousedown'
  | 'mouseup'
  | 'mousemove'
  | 'mouseenter'
  | 'mouseleave'
  | 'mouseover'
  | 'mouseout'
  | 'contextmenu'
  | 'touchstart'
  | 'touchend'
  | 'touchcancel'
  | 'wheel'
  | 'movestart'
  | 'move'
  | 'moveend'
  | 'dragstart'
  | 'drag'
  | 'dragend'
  | 'zoomstart'
  | 'zoom'
  | 'zoomend'
  | 'rotatestart'
  | 'rotate'
  | 'rotateend'
  | 'pitchstart'
  | 'pitch'
  | 'pitchend'
  | 'load'
  | 'idle'
  | 'error'
  | 'data'
  | 'styledata'
  | 'sourcedata'
  | 'dataloading'
  | 'styledataloading'
  | 'sourcedataloading'
  | 'resize'
  | 'render'

type MapEventHandler = (event: MapLayerMouseEvent | MapLayerTouchEvent | Event) => void

/**
 * Hook to safely manage map event listeners
 *
 * @param map - MapLibre map instance (can be null during initialization)
 * @param eventType - Event type to listen for
 * @param handler - Event handler function
 * @param layerId - Optional layer ID for layer-specific events
 *
 * @example
 * ```tsx
 * useMapEvent(map, 'click', (e) => {
 *   console.log('Map clicked at', e.lngLat)
 * })
 *
 * useMapEvent(map, 'click', (e) => {
 *   console.log('Layer clicked', e.features)
 * }, 'my-layer-id')
 * ```
 */
export function useMapEvent(
  map: MapLibreMap | null | undefined,
  eventType: MapEventType,
  handler: MapEventHandler,
  layerId?: string
): void {
  // Store handler in ref to avoid re-adding listener on handler change
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!map) return

    // Wrapper to use current handler
    const eventHandler = (event: MapLayerMouseEvent | MapLayerTouchEvent | Event) => {
      handlerRef.current(event)
    }

    // Add event listener
    if (layerId) {
      map.on(eventType as 'click', layerId, eventHandler as (e: MapLayerMouseEvent) => void)
    } else {
      map.on(eventType, eventHandler as () => void)
    }

    // Cleanup on unmount
    return () => {
      if (layerId) {
        map.off(eventType as 'click', layerId, eventHandler as (e: MapLayerMouseEvent) => void)
      } else {
        map.off(eventType, eventHandler as () => void)
      }
    }
  }, [map, eventType, layerId])
}

/**
 * Hook for handling clicks on a specific map layer
 *
 * @param map - MapLibre map instance
 * @param layerId - Layer ID to listen for clicks
 * @param onClick - Click handler receiving features
 */
export function useLayerClick<T = unknown>(
  map: MapLibreMap | null | undefined,
  layerId: string,
  onClick: (features: T[], event: MapLayerMouseEvent) => void
): void {
  const handleClick = useCallback(
    (event: MapLayerMouseEvent | MapLayerTouchEvent | Event) => {
      const e = event as MapLayerMouseEvent
      if (e.features && e.features.length > 0) {
        onClick(e.features.map((f) => f.properties as T), e)
      }
    },
    [onClick]
  )

  useMapEvent(map, 'click', handleClick, layerId)
}

/**
 * Hook to change cursor on layer hover
 *
 * @param map - MapLibre map instance
 * @param layerId - Layer ID to track hover
 * @param cursor - Cursor style when hovering (default: 'pointer')
 */
export function useLayerHoverCursor(
  map: MapLibreMap | null | undefined,
  layerId: string,
  cursor: string = 'pointer'
): void {
  useMapEvent(
    map,
    'mouseenter',
    () => {
      if (map) {
        map.getCanvas().style.cursor = cursor
      }
    },
    layerId
  )

  useMapEvent(
    map,
    'mouseleave',
    () => {
      if (map) {
        map.getCanvas().style.cursor = ''
      }
    },
    layerId
  )
}

/**
 * Hook for viewport change debouncing
 *
 * @param map - MapLibre map instance
 * @param onViewportChange - Callback with new bounds
 * @param debounceMs - Debounce delay in ms (default: 300)
 */
export function useViewportChange(
  map: MapLibreMap | null | undefined,
  onViewportChange: (bounds: [number, number, number, number], zoom: number) => void,
  debounceMs: number = 300
): void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(onViewportChange)
  callbackRef.current = onViewportChange

  useMapEvent(map, 'moveend', () => {
    if (!map) return

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce the callback
    timeoutRef.current = setTimeout(() => {
      const bounds = map.getBounds()
      const zoom = map.getZoom()

      callbackRef.current(
        [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ],
        zoom
      )
    }, debounceMs)
  })

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
}

/**
 * Hook to track if map is idle (not rendering)
 *
 * @param map - MapLibre map instance
 * @param onIdle - Callback when map becomes idle
 */
export function useMapIdle(
  map: MapLibreMap | null | undefined,
  onIdle: () => void
): void {
  useMapEvent(map, 'idle', onIdle)
}
