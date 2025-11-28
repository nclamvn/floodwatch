/**
 * Generic API Response Cache
 *
 * Caches API fetch responses with configurable TTL (default: 60 seconds)
 * Used by data hooks (useHazards, useTraffic, useDistress)
 *
 * Key features:
 * - URL-based cache key
 * - Configurable TTL per cache entry
 * - Automatic cleanup of expired entries
 * - Memory-efficient with max entries limit
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // TTL in ms for this specific entry
}

const DEFAULT_TTL_MS = 60 * 1000 // 60 seconds default
const MAX_CACHE_ENTRIES = 100

// Main cache store
const apiCache = new Map<string, CacheEntry<unknown>>()

/**
 * Check if cache entry is still valid
 */
function isValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false
  return Date.now() - entry.timestamp < entry.ttl
}

/**
 * Clean up expired entries and enforce max limit
 */
function cleanupCache(): void {
  if (apiCache.size > MAX_CACHE_ENTRIES) {
    const now = Date.now()
    const entries = Array.from(apiCache.entries())

    // Remove expired entries
    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        apiCache.delete(key)
      }
    })

    // If still over limit, remove oldest entries
    if (apiCache.size > MAX_CACHE_ENTRIES) {
      const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toRemove = sortedEntries.slice(0, apiCache.size - MAX_CACHE_ENTRIES)
      toRemove.forEach(([key]) => apiCache.delete(key))
    }
  }
}

/**
 * Get cached API response
 */
export function getCachedResponse<T>(url: string): T | null {
  const entry = apiCache.get(url) as CacheEntry<T> | undefined

  if (!isValid(entry)) {
    if (entry) apiCache.delete(url)
    return null
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[APICache] HIT:', url.substring(0, 80))
  }
  return entry.data
}

/**
 * Cache API response
 */
export function setCachedResponse<T>(url: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  apiCache.set(url, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  })

  if (process.env.NODE_ENV === 'development') {
    console.log('[APICache] SET:', url.substring(0, 80), `(TTL: ${ttlMs / 1000}s)`)
  }
  cleanupCache()
}

/**
 * Invalidate specific cache entry
 */
export function invalidateCache(url: string): void {
  apiCache.delete(url)
}

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCachePattern(pattern: string): void {
  const keysToDelete: string[] = []
  apiCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach((key) => apiCache.delete(key))
}

/**
 * Clear all API cache
 */
export function clearApiCache(): void {
  apiCache.clear()
  if (process.env.NODE_ENV === 'development') {
    console.log('[APICache] All cache cleared')
  }
}

/**
 * Get cache statistics
 */
export function getApiCacheStats(): {
  size: number
  maxSize: number
  defaultTtlSeconds: number
} {
  return {
    size: apiCache.size,
    maxSize: MAX_CACHE_ENTRIES,
    defaultTtlSeconds: DEFAULT_TTL_MS / 1000,
  }
}

/**
 * Cached fetch wrapper - use this in hooks
 */
export async function cachedFetch<T>(
  url: string,
  options?: {
    ttlMs?: number
    forceRefresh?: boolean
  }
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, forceRefresh = false } = options || {}

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedResponse<T>(url)
    if (cached !== null) {
      return cached
    }
  }

  // Fetch from API
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Cache the response
  setCachedResponse(url, data, ttlMs)

  return data
}
