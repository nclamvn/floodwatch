'use client'

import { useState, useMemo, useCallback } from 'react'

export interface RescueFilters {
  // Common filters
  showRequests: boolean
  showOffers: boolean
  radiusKm: number
  searchQuery: string
  verifiedOnly: boolean

  // Request-specific filters
  requestUrgency: string[] // ['critical', 'high', 'medium', 'low'] or empty for all
  requestStatus: string[] // ['active', 'in_progress'] or empty for all
  requestNeedsType: string[] // ['food', 'water', 'medical', etc] or empty for all

  // Offer-specific filters
  offerStatus: string[] // ['active'] or empty for all
  offerServiceType: string[] // ['rescue', 'transportation', etc] or empty for all
  minCapacity: number | null
}

export const DEFAULT_FILTERS: RescueFilters = {
  showRequests: true,
  showOffers: true,
  radiusKm: 100,
  searchQuery: '',
  verifiedOnly: false,
  requestUrgency: [],
  requestStatus: [],
  requestNeedsType: [],
  offerStatus: [],
  offerServiceType: [],
  minCapacity: null,
}

export function useRescueFilters() {
  const [filters, setFilters] = useState<RescueFilters>(DEFAULT_FILTERS)

  // Reset all filters to default
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  // Update individual filter
  const updateFilter = useCallback(<K extends keyof RescueFilters>(
    key: K,
    value: RescueFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // Toggle array value (for multi-select)
  const toggleArrayValue = useCallback(<K extends keyof RescueFilters>(
    key: K,
    value: string
  ) => {
    setFilters(prev => {
      const currentArray = prev[key] as string[]
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value]
      return { ...prev, [key]: newArray }
    })
  }, [])

  // Set all values in array (select/deselect all)
  const setArrayValues = useCallback(<K extends keyof RescueFilters>(
    key: K,
    values: string[]
  ) => {
    setFilters(prev => ({ ...prev, [key]: values }))
  }, [])

  // Count active filters (excluding defaults)
  const activeFiltersCount = useMemo(() => {
    let count = 0

    // Search query
    if (filters.searchQuery) count++

    // Radius changed from default (100km)
    if (filters.radiusKm !== DEFAULT_FILTERS.radiusKm) count++

    // Verified only
    if (filters.verifiedOnly) count++

    // Show/hide toggles changed
    if (!filters.showRequests) count++
    if (!filters.showOffers) count++

    // Request filters
    if (filters.requestUrgency.length > 0) count++
    if (filters.requestStatus.length > 0) count++
    if (filters.requestNeedsType.length > 0) count++

    // Offer filters
    if (filters.offerStatus.length > 0) count++
    if (filters.offerServiceType.length > 0) count++
    if (filters.minCapacity !== null) count++

    return count
  }, [filters])

  // Convert array filters to comma-separated strings for API
  const getApiFilters = useMemo(() => ({
    // Request filters
    requestStatus: filters.requestStatus.length > 0
      ? filters.requestStatus.join(',')
      : undefined,
    requestUrgency: filters.requestUrgency.length > 0
      ? filters.requestUrgency.join(',')
      : undefined,
    requestNeedsType: filters.requestNeedsType.length > 0
      ? filters.requestNeedsType.join(',')
      : undefined,

    // Offer filters
    offerStatus: filters.offerStatus.length > 0
      ? filters.offerStatus.join(',')
      : undefined,
    offerServiceType: filters.offerServiceType.length > 0
      ? filters.offerServiceType.join(',')
      : undefined,
  }), [filters])

  return {
    filters,
    setFilters,
    updateFilter,
    toggleArrayValue,
    setArrayValues,
    resetFilters,
    activeFiltersCount,
    getApiFilters,
  }
}
