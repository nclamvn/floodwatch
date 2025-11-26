/**
 * Map GeoJSON Source Management
 *
 * Phase 5: Advanced Map Optimization
 * Centralized GeoJSON source creation with:
 * - Domain-based source IDs
 * - Memoization support
 * - Clustering configuration
 * - Type-safe feature properties
 */

import type { FeatureCollection, Feature, Point, Polygon } from 'geojson'

// ============================================
// TYPES
// ============================================

export type MapSourceDomain =
  | 'reports'
  | 'hazards'
  | 'ai-forecasts'
  | 'traffic'
  | 'distress'
  | 'help-requests'
  | 'help-offers'
  | 'user-location'

export interface SourceConfig {
  id: string
  cluster?: boolean
  clusterRadius?: number
  clusterMaxZoom?: number
  clusterMinPoints?: number
}

// Domain-specific source configurations
const SOURCE_CONFIGS: Record<MapSourceDomain, SourceConfig> = {
  reports: {
    id: 'reports-source',
    cluster: true,
    clusterRadius: 60,
    clusterMaxZoom: 16,
    clusterMinPoints: 2,
  },
  hazards: {
    id: 'hazards-source',
    cluster: false, // Hazards have area polygons, don't cluster
  },
  'ai-forecasts': {
    id: 'ai-forecasts-source',
    cluster: false, // Forecasts have area polygons
  },
  traffic: {
    id: 'traffic-source',
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 14,
    clusterMinPoints: 3,
  },
  distress: {
    id: 'distress-source',
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 15,
    clusterMinPoints: 2,
  },
  'help-requests': {
    id: 'help-requests-source',
    cluster: true,
    clusterRadius: 60,
    clusterMaxZoom: 16,
    clusterMinPoints: 2,
  },
  'help-offers': {
    id: 'help-offers-source',
    cluster: true,
    clusterRadius: 60,
    clusterMaxZoom: 16,
    clusterMinPoints: 2,
  },
  'user-location': {
    id: 'user-location-source',
    cluster: false,
  },
}

// ============================================
// SOURCE ID HELPERS
// ============================================

/**
 * Get source ID for a domain
 */
export function getSourceId(domain: MapSourceDomain): string {
  return SOURCE_CONFIGS[domain].id
}

/**
 * Get source config for a domain
 */
export function getSourceConfig(domain: MapSourceDomain): SourceConfig {
  return SOURCE_CONFIGS[domain]
}

// ============================================
// GEOJSON CREATORS
// ============================================

/**
 * Create a Point feature
 */
export function createPointFeature<P extends Record<string, unknown>>(
  lon: number,
  lat: number,
  properties: P
): Feature<Point, P> {
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
  }
}

/**
 * Create a circle polygon (for radius visualization)
 */
export function createCirclePolygon(
  lon: number,
  lat: number,
  radiusKm: number,
  points: number = 64
): Feature<Polygon> {
  const coords: number[][] = []
  const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const distanceY = radiusKm / 110.574

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    const x = distanceX * Math.cos(theta)
    const y = distanceY * Math.sin(theta)
    coords.push([lon + x, lat + y])
  }
  coords.push(coords[0]) // Close the polygon

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  }
}

/**
 * Create a FeatureCollection from an array of items
 */
export function createFeatureCollection<T, P extends Record<string, unknown>>(
  items: T[],
  mapFn: (item: T) => Feature<Point, P> | null
): FeatureCollection<Point, P> {
  const features = items
    .map(mapFn)
    .filter((f): f is Feature<Point, P> => f !== null)

  return {
    type: 'FeatureCollection',
    features,
  }
}

// ============================================
// MEMOIZATION HELPERS
// ============================================

// Simple hash function for cache keys
function hashData(data: unknown): string {
  return JSON.stringify(data).slice(0, 100) + String(JSON.stringify(data).length)
}

// Cache for GeoJSON data
const geoJSONCache = new Map<string, { hash: string; data: FeatureCollection }>()

/**
 * Create memoized GeoJSON - only recompute if data changed
 */
export function createMemoizedGeoJSON<T>(
  domain: MapSourceDomain,
  items: T[],
  createFn: (items: T[]) => FeatureCollection
): FeatureCollection {
  const cacheKey = domain
  const dataHash = hashData(items)

  const cached = geoJSONCache.get(cacheKey)
  if (cached && cached.hash === dataHash) {
    return cached.data
  }

  const newData = createFn(items)
  geoJSONCache.set(cacheKey, { hash: dataHash, data: newData })

  return newData
}

/**
 * Clear GeoJSON cache for a domain
 */
export function clearGeoJSONCache(domain?: MapSourceDomain): void {
  if (domain) {
    geoJSONCache.delete(domain)
  } else {
    geoJSONCache.clear()
  }
}

// ============================================
// URGENCY/STATUS HELPERS
// ============================================

export const URGENCY_COLORS = {
  critical: '#DC2626', // red-600
  high: '#F97316',     // orange-500
  medium: '#FBBF24',   // amber-400
  low: '#22C55E',      // green-500
  info: '#3B82F6',     // blue-500
} as const

export const STATUS_COLORS = {
  available: '#22C55E', // green-500
  busy: '#FBBF24',      // amber-400
  offline: '#9CA3AF',   // gray-400
  unavailable: '#EF4444', // red-500
} as const

/**
 * Get color for urgency level
 */
export function getUrgencyColor(urgency: string): string {
  return URGENCY_COLORS[urgency as keyof typeof URGENCY_COLORS] || URGENCY_COLORS.medium
}

/**
 * Get color for status
 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.available
}
