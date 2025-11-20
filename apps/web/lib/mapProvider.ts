/**
 * Map Provider Abstraction Layer
 *
 * Supports multiple map providers (Mapbox, Goong Maps) with easy switching
 * via environment variables.
 *
 * Usage:
 * - Set NEXT_PUBLIC_MAP_PROVIDER to 'mapbox' or 'goong'
 * - Set appropriate API keys in .env
 */

export type MapProvider = 'mapbox' | 'goong'
export type BaseMapStyleId = 'streets' | 'satellite' | 'hybrid' | 'outdoors'

export interface MapConfig {
  provider: MapProvider
  styleUrl: string
  accessToken: string
  cssUrl: string
  attribution: string
}

// MapTiler styles - work natively with MapLibre (includes satellite imagery!)
// Get free API key at: https://www.maptiler.com/cloud/
const MAPTILER_STYLES: Record<BaseMapStyleId, string> = {
  streets: 'streets-v2',
  outdoors: 'outdoor-v2',
  satellite: 'satellite',
  hybrid: 'hybrid',
}

// OSM fallback when no API keys available
const OSM_FALLBACK = 'https://demotiles.maplibre.org/style.json'

// Keep Mapbox config for reference but won't work with MapLibre
const MAPBOX_BASE_URL = 'https://api.mapbox.com/styles/v1'
const MAPBOX_STYLES: Record<BaseMapStyleId, string> = {
  streets: 'mapbox/streets-v11',
  outdoors: 'mapbox/outdoors-v11',
  satellite: 'mapbox/satellite-v9',
  hybrid: 'mapbox/satellite-streets-v11',
}

/**
 * Get current map provider from environment
 */
export function getCurrentProvider(): MapProvider {
  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER || 'mapbox'
  return provider as MapProvider
}

/**
 * Get MapLibre-compatible style URL for a specific style ID
 * Now uses MapTiler (supports satellite!) instead of Mapbox proprietary tiles
 */
export function getMapboxStyleUrl(styleId: BaseMapStyleId = 'streets'): string {
  // Try MapTiler first (has satellite imagery)
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY

  if (maptilerKey) {
    const styleMap = MAPTILER_STYLES[styleId] ?? MAPTILER_STYLES.streets
    const url = `https://api.maptiler.com/maps/${styleMap}/style.json?key=${maptilerKey}`
    console.log(`🗺️ MapTiler style: ${styleId} → ${styleMap}`)
    return url
  }

  // Fallback to Mapbox (won't work with MapLibre but kept for reference)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (mapboxToken) {
    console.warn('⚠️  Mapbox token found but NOT compatible with MapLibre!')
    console.warn('💡 Get free MapTiler key at: https://www.maptiler.com/cloud/')
    console.warn('🔧 Add NEXT_PUBLIC_MAPTILER_KEY to .env for satellite maps')
  }

  // Ultimate fallback to OSM demo tiles
  console.warn(`⚠️  No MapTiler key. Using OSM fallback (no satellite/hybrid available)`)
  return OSM_FALLBACK
}

/**
 * Get Mapbox configuration
 */
function getMapboxConfig(styleId: BaseMapStyleId = 'streets'): MapConfig {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  return {
    provider: 'mapbox',
    styleUrl: getMapboxStyleUrl(styleId),
    accessToken: process.env.NEXT_PUBLIC_MAPTILER_KEY || token,
    cssUrl: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
    attribution: '© MapTiler © OpenStreetMap contributors'
  }
}

/**
 * Get Goong Maps configuration
 */
function getGoongConfig(): MapConfig {
  const token = process.env.NEXT_PUBLIC_GOONG_API_KEY

  if (!token) {
    console.warn('⚠️  NEXT_PUBLIC_GOONG_API_KEY not found. Fallback to Mapbox.')
    return getMapboxConfig() // Fallback to Mapbox if Goong key not available
  }

  return {
    provider: 'goong',
    // Goong style URLs - update these based on Goong documentation
    styleUrl: `https://tiles.goong.io/assets/goong_map_web.json?api_key=${token}`,
    accessToken: token,
    cssUrl: 'https://cdn.goong.io/goong-js/1.0.9/goong-js.css',
    attribution: '© Goong © OpenStreetMap contributors'
  }
}

/**
 * Get map configuration for current provider
 */
export function getMapConfig(styleId?: BaseMapStyleId): MapConfig {
  const provider = getCurrentProvider()

  switch (provider) {
    case 'goong':
      return getGoongConfig()
    case 'mapbox':
    default:
      return getMapboxConfig(styleId)
  }
}

/**
 * Get CSS URL for map library
 *
 * This can be used in <link> tags or dynamic imports
 */
export function getMapCssUrl(): string {
  return getMapConfig().cssUrl
}

/**
 * Get style URL with access token for MapLibre
 *
 * MapLibre requires some style URLs to include access tokens as query params
 */
export function getStyleUrlWithToken(styleId?: BaseMapStyleId): string {
  const config = getMapConfig(styleId)
  return config.styleUrl
}

/**
 * Check if current provider is available (has API key)
 */
export function isProviderAvailable(provider: MapProvider): boolean {
  switch (provider) {
    case 'mapbox':
      return !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    case 'goong':
      return !!process.env.NEXT_PUBLIC_GOONG_API_KEY
    default:
      return false
  }
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): MapProvider[] {
  const providers: MapProvider[] = []

  if (isProviderAvailable('mapbox')) providers.push('mapbox')
  if (isProviderAvailable('goong')) providers.push('goong')

  return providers
}

/**
 * Utility to log current provider configuration (for debugging)
 */
export function logProviderInfo() {
  const config = getMapConfig()
  const available = getAvailableProviders()

  console.log('🗺️  Map Provider Configuration:')
  console.log(`   Current: ${config.provider}`)
  console.log(`   Available: ${available.join(', ') || 'none'}`)
  console.log(`   Style URL: ${config.styleUrl}`)
  console.log(`   Has Token: ${!!config.accessToken}`)
}
