/**
 * AI Search Cache
 *
 * Caches AI-generated search results (Regional Summary, Storm Summary, etc.)
 * TTL: 30 minutes to balance freshness with API cost savings
 *
 * This cache is shared across all users on the same client (browser session)
 * and persists in memory until page refresh.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// Regional Summary Cache
const regionalSummaryCache = new Map<string, CacheEntry<any>>()

// Storm Summary Cache
const stormSummaryCache = new Map<string, CacheEntry<any>>()

/**
 * Normalize cache key for consistent lookup
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().trim()
}

/**
 * Check if cache entry is still valid
 */
function isValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false
  return Date.now() - entry.timestamp < CACHE_TTL_MS
}

/**
 * Clean up expired entries from a cache
 */
function cleanupCache<T>(cache: Map<string, CacheEntry<T>>): void {
  if (cache.size > 50) {
    const now = Date.now()
    const entries = Array.from(cache.entries())
    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key)
      }
    })
  }
}

// ============================================
// REGIONAL SUMMARY CACHE
// ============================================

/**
 * Get cached regional summary for a province
 */
export function getCachedRegionalSummary(province: string): any | null {
  const key = normalizeKey(province)
  const entry = regionalSummaryCache.get(key)

  if (!isValid(entry)) {
    if (entry) regionalSummaryCache.delete(key)
    return null
  }

  console.log('[AICache] Regional summary cache HIT for:', province)
  return entry.data
}

/**
 * Cache regional summary result
 */
export function setCachedRegionalSummary(province: string, data: any): void {
  const key = normalizeKey(province)
  regionalSummaryCache.set(key, {
    data,
    timestamp: Date.now()
  })
  console.log('[AICache] Regional summary cached for:', province)
  cleanupCache(regionalSummaryCache)
}

/**
 * Get cache age for regional summary (for displaying "cached X minutes ago")
 */
export function getRegionalSummaryCacheAge(province: string): number | null {
  const key = normalizeKey(province)
  const entry = regionalSummaryCache.get(key)

  if (!isValid(entry)) return null

  return Math.floor((Date.now() - entry.timestamp) / 1000 / 60) // minutes
}

// ============================================
// STORM SUMMARY CACHE
// ============================================

/**
 * Get cached storm summary
 */
export function getCachedStormSummary(hours: number = 72): any | null {
  const key = `storm_${hours}`
  const entry = stormSummaryCache.get(key)

  if (!isValid(entry)) {
    if (entry) stormSummaryCache.delete(key)
    return null
  }

  console.log('[AICache] Storm summary cache HIT for hours:', hours)
  return entry.data
}

/**
 * Cache storm summary result
 */
export function setCachedStormSummary(hours: number, data: any): void {
  const key = `storm_${hours}`
  stormSummaryCache.set(key, {
    data,
    timestamp: Date.now()
  })
  console.log('[AICache] Storm summary cached for hours:', hours)
  cleanupCache(stormSummaryCache)
}

/**
 * Get cache age for storm summary
 */
export function getStormSummaryCacheAge(hours: number = 72): number | null {
  const key = `storm_${hours}`
  const entry = stormSummaryCache.get(key)

  if (!isValid(entry)) return null

  return Math.floor((Date.now() - entry.timestamp) / 1000 / 60) // minutes
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear all AI caches
 */
export function clearAllAICaches(): void {
  regionalSummaryCache.clear()
  stormSummaryCache.clear()
  console.log('[AICache] All caches cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  regionalSummary: number
  stormSummary: number
  ttlMinutes: number
} {
  return {
    regionalSummary: regionalSummaryCache.size,
    stormSummary: stormSummaryCache.size,
    ttlMinutes: CACHE_TTL_MS / 1000 / 60
  }
}
