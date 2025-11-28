'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook that persists state to localStorage
 * Works safely with SSR (server-side rendering)
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: {
    serialize?: (value: T) => string
    deserialize?: (value: string) => T
  }
) {
  const serialize = options?.serialize || JSON.stringify
  const deserialize = options?.deserialize || JSON.parse

  // Initialize with default value (SSR-safe)
  const [state, setState] = useState<T>(defaultValue)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(key)
      if (storedValue !== null) {
        const parsed = deserialize(storedValue)
        setState(parsed)
      }
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error)
    }
    setIsHydrated(true)
  }, [key, deserialize])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isHydrated) return // Don't save during initial hydration

    try {
      localStorage.setItem(key, serialize(state))
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error)
    }
  }, [key, state, serialize, isHydrated])

  // Clear stored value
  const clearPersistedState = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setState(defaultValue)
    } catch (error) {
      console.warn(`Failed to clear ${key} from localStorage:`, error)
    }
  }, [key, defaultValue])

  return [state, setState, { isHydrated, clearPersistedState }] as const
}

// Storage keys for different filter types
export const STORAGE_KEYS = {
  RESCUE_FILTERS: 'floodwatch_rescue_filters',
  ROUTE_FILTERS: 'floodwatch_route_filters',
  MAP_FILTERS: 'floodwatch_map_filters',
  MAP_VIEW_STATE: 'floodwatch_map_view',
  HELP_FILTERS: 'floodwatch_help_filters',
} as const
