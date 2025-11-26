/**
 * Vector Tiles Structure (Future-Ready)
 *
 * Phase 5: Advanced Map Optimization
 * Preparation for massive data mode (>10,000 markers):
 * - Vietnam region tiles
 * - Tile-based data loading
 * - On-demand tile fetching
 *
 * NOTE: This is a preparation file. Actual vector tile
 * implementation requires backend changes to serve tiles.
 */

// ============================================
// VIETNAM REGION TILES
// ============================================

/**
 * Vietnam divided into 12 logical regions
 * Each region covers ~50-100km radius
 */
export const VIETNAM_REGIONS = {
  // Northern regions
  NORTH_WEST: {
    id: 'nw',
    name: 'Tây Bắc',
    center: [103.5, 21.5],
    bbox: [102.0, 20.5, 105.0, 22.5],
    provinces: ['Điện Biên', 'Lai Châu', 'Sơn La', 'Lào Cai', 'Yên Bái'],
  },
  NORTH_EAST: {
    id: 'ne',
    name: 'Đông Bắc',
    center: [106.5, 22.0],
    bbox: [105.0, 21.0, 108.0, 23.5],
    provinces: ['Hà Giang', 'Cao Bằng', 'Bắc Kạn', 'Tuyên Quang', 'Thái Nguyên', 'Lạng Sơn'],
  },
  RED_RIVER_DELTA: {
    id: 'rrd',
    name: 'Đồng bằng sông Hồng',
    center: [106.0, 21.0],
    bbox: [105.0, 20.0, 107.0, 21.5],
    provinces: ['Hà Nội', 'Hải Phòng', 'Hải Dương', 'Hưng Yên', 'Bắc Ninh', 'Phú Thọ'],
  },

  // Central regions
  NORTH_CENTRAL: {
    id: 'nc',
    name: 'Bắc Trung Bộ',
    center: [106.0, 18.5],
    bbox: [104.5, 17.5, 107.5, 20.0],
    provinces: ['Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình'],
  },
  CENTRAL_COAST: {
    id: 'cc',
    name: 'Duyên hải miền Trung',
    center: [108.0, 16.0],
    bbox: [107.0, 14.5, 109.5, 17.5],
    provinces: ['Quảng Trị', 'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi'],
  },
  SOUTH_CENTRAL_COAST: {
    id: 'scc',
    name: 'Nam Trung Bộ',
    center: [109.0, 13.0],
    bbox: [108.0, 11.5, 110.0, 14.5],
    provinces: ['Bình Định', 'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận'],
  },

  // Highland regions
  CENTRAL_HIGHLANDS: {
    id: 'ch',
    name: 'Tây Nguyên',
    center: [108.0, 13.5],
    bbox: [107.0, 11.5, 109.5, 15.5],
    provinces: ['Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng'],
  },

  // Southern regions
  SOUTH_EAST: {
    id: 'se',
    name: 'Đông Nam Bộ',
    center: [107.0, 11.0],
    bbox: [106.0, 10.0, 108.0, 12.5],
    provinces: ['TP. Hồ Chí Minh', 'Bình Dương', 'Đồng Nai', 'Bà Rịa - Vũng Tàu', 'Tây Ninh'],
  },
  MEKONG_DELTA_NORTH: {
    id: 'mdn',
    name: 'ĐBSCL - Bắc',
    center: [105.8, 10.2],
    bbox: [105.0, 9.5, 106.5, 11.0],
    provinces: ['Long An', 'Tiền Giang', 'Bến Tre', 'Vĩnh Long', 'Đồng Tháp'],
  },
  MEKONG_DELTA_SOUTH: {
    id: 'mds',
    name: 'ĐBSCL - Nam',
    center: [105.5, 9.5],
    bbox: [104.5, 8.5, 106.5, 10.0],
    provinces: ['An Giang', 'Cần Thơ', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau', 'Kiên Giang'],
  },

  // Islands
  ISLANDS: {
    id: 'isl',
    name: 'Hải đảo',
    center: [112.0, 10.0],
    bbox: [109.0, 7.0, 117.0, 12.0],
    provinces: ['Hoàng Sa', 'Trường Sa', 'Phú Quốc', 'Côn Đảo'],
  },
} as const

export type RegionId = keyof typeof VIETNAM_REGIONS

// ============================================
// TILE HELPERS
// ============================================

/**
 * Get region ID from coordinates
 */
export function getRegionFromCoordinates(lon: number, lat: number): RegionId | null {
  for (const [regionId, region] of Object.entries(VIETNAM_REGIONS)) {
    const [minLon, minLat, maxLon, maxLat] = region.bbox
    if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
      return regionId as RegionId
    }
  }
  return null
}

/**
 * Get regions that intersect with a bounding box
 */
export function getRegionsInBbox(bbox: [number, number, number, number]): RegionId[] {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const intersecting: RegionId[] = []

  for (const [regionId, region] of Object.entries(VIETNAM_REGIONS)) {
    const [rMinLon, rMinLat, rMaxLon, rMaxLat] = region.bbox

    // Check if bboxes intersect
    if (!(maxLon < rMinLon || minLon > rMaxLon || maxLat < rMinLat || minLat > rMaxLat)) {
      intersecting.push(regionId as RegionId)
    }
  }

  return intersecting
}

/**
 * Get neighboring regions
 */
export function getNeighboringRegions(regionId: RegionId): RegionId[] {
  const region = VIETNAM_REGIONS[regionId]
  const [minLon, minLat, maxLon, maxLat] = region.bbox

  // Expand bbox slightly to find neighbors
  const expandedBbox: [number, number, number, number] = [
    minLon - 0.5,
    minLat - 0.5,
    maxLon + 0.5,
    maxLat + 0.5,
  ]

  return getRegionsInBbox(expandedBbox).filter((id) => id !== regionId)
}

// ============================================
// TILE URL BUILDERS
// ============================================

/**
 * Build tile URL for a region and data type
 *
 * NOTE: This requires backend support for serving tiles
 */
export function buildTileUrl(
  regionId: RegionId,
  dataType: 'requests' | 'offers' | 'hazards' | 'traffic'
): string {
  const baseUrl = process.env.NEXT_PUBLIC_TILE_URL || process.env.NEXT_PUBLIC_API_URL
  return `${baseUrl}/tiles/${dataType}/${regionId}.geojson`
}

/**
 * Build vector tile URL (MVT format)
 *
 * NOTE: This requires backend support for serving MVT tiles
 */
export function buildMvtUrl(
  dataType: 'requests' | 'offers' | 'hazards' | 'traffic'
): string {
  const baseUrl = process.env.NEXT_PUBLIC_TILE_URL || process.env.NEXT_PUBLIC_API_URL
  return `${baseUrl}/tiles/${dataType}/{z}/{x}/{y}.mvt`
}

// ============================================
// TILE LOADING STRATEGY
// ============================================

export interface TileLoadStrategy {
  /** Regions to load immediately */
  immediate: RegionId[]
  /** Regions to pre-fetch */
  prefetch: RegionId[]
  /** All visible regions */
  visible: RegionId[]
}

/**
 * Determine which tiles to load based on viewport
 *
 * @param viewportBbox - Current viewport bounding box
 * @param zoom - Current zoom level
 */
export function getTileLoadStrategy(
  viewportBbox: [number, number, number, number],
  zoom: number
): TileLoadStrategy {
  const visibleRegions = getRegionsInBbox(viewportBbox)

  // At low zoom (zoomed out), load all visible regions
  if (zoom < 8) {
    return {
      immediate: visibleRegions,
      prefetch: [],
      visible: visibleRegions,
    }
  }

  // At high zoom (zoomed in), prioritize center region
  const centerLon = (viewportBbox[0] + viewportBbox[2]) / 2
  const centerLat = (viewportBbox[1] + viewportBbox[3]) / 2
  const centerRegion = getRegionFromCoordinates(centerLon, centerLat)

  if (!centerRegion) {
    return {
      immediate: visibleRegions,
      prefetch: [],
      visible: visibleRegions,
    }
  }

  const neighbors = getNeighboringRegions(centerRegion)

  return {
    immediate: [centerRegion],
    prefetch: neighbors.filter((n) => visibleRegions.includes(n)),
    visible: visibleRegions,
  }
}

// ============================================
// TILE CACHE
// ============================================

interface TileCache {
  data: unknown
  timestamp: number
  regionId: RegionId
}

const tileCache = new Map<string, TileCache>()
const TILE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached tile data
 */
export function getCachedTile(
  regionId: RegionId,
  dataType: string
): unknown | null {
  const key = `${dataType}:${regionId}`
  const cached = tileCache.get(key)

  if (!cached) return null
  if (Date.now() - cached.timestamp > TILE_TTL_MS) {
    tileCache.delete(key)
    return null
  }

  return cached.data
}

/**
 * Cache tile data
 */
export function cacheTile(
  regionId: RegionId,
  dataType: string,
  data: unknown
): void {
  const key = `${dataType}:${regionId}`
  tileCache.set(key, {
    data,
    timestamp: Date.now(),
    regionId,
  })
}

/**
 * Clear tile cache
 */
export function clearTileCache(): void {
  tileCache.clear()
}
