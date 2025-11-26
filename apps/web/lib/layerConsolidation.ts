/**
 * Layer Consolidation Utilities
 *
 * Phase 5: Advanced Map Optimization
 * Helps reduce MapLibre layer count for GPU optimization:
 * - Merge similar layers into single layers with expressions
 * - Use data-driven styling instead of multiple layers
 * - Consolidate sources where possible
 *
 * Target: Reduce from ~40 layers to ≤15 layers
 */

import type { FeatureCollection, Feature, Point, Polygon } from 'geojson'

// ============================================
// TYPES
// ============================================

export interface ConsolidatedFeatureProperties {
  id: string
  domain: string // 'help-request' | 'help-offer' | 'distress' | 'traffic' | 'hazard' | 'ai-forecast'
  subtype?: string // Type within domain
  priority: number // 0 = highest, 5 = lowest
  status?: string
  urgency?: string
  severity?: string
  color?: string
  symbol?: string
  size?: number
  [key: string]: unknown
}

// ============================================
// DOMAIN CONFIGURATION
// ============================================

/**
 * Domain priority ordering (lower = renders on top)
 */
export const DOMAIN_PRIORITY: Record<string, number> = {
  distress: 0, // Critical - always on top
  'help-request': 1,
  traffic: 2,
  hazard: 3,
  'ai-forecast': 4,
  'help-offer': 5,
}

/**
 * Domain color mapping
 */
export const DOMAIN_COLORS: Record<string, string> = {
  distress: '#DC2626',
  'help-request': '#EF4444',
  'help-offer': '#22C55E',
  traffic: '#F59E0B',
  hazard: '#7C3AED',
  'ai-forecast': '#8B5CF6',
}

/**
 * Urgency/severity color mapping
 */
export const URGENCY_COLORS: Record<string, string> = {
  critical: '#991B1B',
  high: '#DC2626',
  medium: '#F59E0B',
  low: '#22C55E',
  info: '#3B82F6',
}

/**
 * Domain symbols (emoji fallbacks)
 */
export const DOMAIN_SYMBOLS: Record<string, string> = {
  distress: '🚨',
  'help-request': '🆘',
  'help-offer': '🤝',
  traffic: '🚧',
  hazard: '⚠️',
  'ai-forecast': '🤖',
}

// ============================================
// FEATURE CONSOLIDATION
// ============================================

/**
 * Normalize feature properties for consolidated rendering
 */
export function normalizeFeatureProperties(
  feature: Feature,
  domain: string
): ConsolidatedFeatureProperties {
  const props = feature.properties || {}

  return {
    id: props.id || `${domain}-${Math.random().toString(36).slice(2)}`,
    domain,
    subtype: props.type || props.subtype,
    priority: calculatePriority(domain, props),
    status: props.status,
    urgency: props.urgency,
    severity: props.severity,
    color: getFeatureColor(domain, props),
    symbol: DOMAIN_SYMBOLS[domain] || '●',
    size: calculateSize(domain, props),
    // Preserve original properties
    ...props,
  }
}

/**
 * Calculate priority for feature ordering
 */
function calculatePriority(domain: string, props: Record<string, unknown>): number {
  const basePriority = DOMAIN_PRIORITY[domain] ?? 3

  // Adjust based on urgency/severity
  let urgencyBoost = 0
  const urgency = props.urgency || props.severity
  if (urgency === 'critical') urgencyBoost = -2
  else if (urgency === 'high') urgencyBoost = -1

  return Math.max(0, basePriority + urgencyBoost)
}

/**
 * Get color for feature based on domain and properties
 */
function getFeatureColor(domain: string, props: Record<string, unknown>): string {
  // Check urgency/severity first
  const urgency = props.urgency || props.severity
  if (urgency && URGENCY_COLORS[urgency as string]) {
    return URGENCY_COLORS[urgency as string]
  }

  // Fall back to domain color
  return DOMAIN_COLORS[domain] || '#6B7280'
}

/**
 * Calculate marker size based on domain and properties
 */
function calculateSize(domain: string, props: Record<string, unknown>): number {
  const baseSize = 1

  // Adjust for urgency
  const urgency = props.urgency || props.severity
  if (urgency === 'critical') return baseSize * 1.3
  if (urgency === 'high') return baseSize * 1.15

  return baseSize
}

// ============================================
// GEOJSON CONSOLIDATION
// ============================================

/**
 * Merge multiple domain GeoJSON into single consolidated source
 */
export function consolidateGeoJSON(
  sources: Array<{
    domain: string
    data: FeatureCollection
  }>
): FeatureCollection {
  const features: Feature[] = []

  sources.forEach(({ domain, data }) => {
    if (!data || !data.features) return

    data.features.forEach((feature) => {
      const normalizedProps = normalizeFeatureProperties(feature, domain)
      features.push({
        ...feature,
        properties: normalizedProps,
      })
    })
  })

  // Sort by priority (higher priority = rendered later = on top)
  features.sort((a, b) => {
    const aPriority = (a.properties as ConsolidatedFeatureProperties)?.priority ?? 5
    const bPriority = (b.properties as ConsolidatedFeatureProperties)?.priority ?? 5
    return bPriority - aPriority // Higher priority (lower number) rendered last
  })

  return {
    type: 'FeatureCollection',
    features,
  }
}

/**
 * Separate point and polygon features for different layer types
 */
export function separateByGeometryType(data: FeatureCollection): {
  points: FeatureCollection<Point>
  polygons: FeatureCollection<Polygon>
} {
  const points: Feature<Point>[] = []
  const polygons: Feature<Polygon>[] = []

  data.features.forEach((feature) => {
    if (feature.geometry.type === 'Point') {
      points.push(feature as Feature<Point>)
    } else if (feature.geometry.type === 'Polygon') {
      polygons.push(feature as Feature<Polygon>)
    }
  })

  return {
    points: { type: 'FeatureCollection', features: points },
    polygons: { type: 'FeatureCollection', features: polygons },
  }
}

// ============================================
// MAPLIBRE EXPRESSIONS
// ============================================

/**
 * Create color expression for consolidated layer
 */
export function createConsolidatedColorExpression() {
  return [
    'case',
    // Check urgency/severity first
    ['==', ['get', 'urgency'], 'critical'],
    URGENCY_COLORS.critical,
    ['==', ['get', 'severity'], 'critical'],
    URGENCY_COLORS.critical,
    ['==', ['get', 'urgency'], 'high'],
    URGENCY_COLORS.high,
    ['==', ['get', 'severity'], 'high'],
    URGENCY_COLORS.high,
    // Fall back to domain color
    ['match', ['get', 'domain'],
      'distress', DOMAIN_COLORS.distress,
      'help-request', DOMAIN_COLORS['help-request'],
      'help-offer', DOMAIN_COLORS['help-offer'],
      'traffic', DOMAIN_COLORS.traffic,
      'hazard', DOMAIN_COLORS.hazard,
      'ai-forecast', DOMAIN_COLORS['ai-forecast'],
      '#6B7280', // default gray
    ],
  ]
}

/**
 * Create size expression for consolidated layer
 */
export function createConsolidatedSizeExpression(baseRadius: number = 8) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    [
      '*',
      baseRadius * 0.5,
      ['case',
        ['==', ['get', 'urgency'], 'critical'], 1.3,
        ['==', ['get', 'severity'], 'critical'], 1.3,
        ['==', ['get', 'urgency'], 'high'], 1.15,
        ['==', ['get', 'severity'], 'high'], 1.15,
        1,
      ],
    ],
    14,
    [
      '*',
      baseRadius,
      ['case',
        ['==', ['get', 'urgency'], 'critical'], 1.3,
        ['==', ['get', 'severity'], 'critical'], 1.3,
        ['==', ['get', 'urgency'], 'high'], 1.15,
        ['==', ['get', 'severity'], 'high'], 1.15,
        1,
      ],
    ],
  ]
}

/**
 * Create symbol expression for consolidated layer
 */
export function createConsolidatedSymbolExpression() {
  return [
    'match',
    ['get', 'domain'],
    'distress', DOMAIN_SYMBOLS.distress,
    'help-request', DOMAIN_SYMBOLS['help-request'],
    'help-offer', DOMAIN_SYMBOLS['help-offer'],
    'traffic', DOMAIN_SYMBOLS.traffic,
    'hazard', DOMAIN_SYMBOLS.hazard,
    'ai-forecast', DOMAIN_SYMBOLS['ai-forecast'],
    '●', // default
  ]
}

/**
 * Create sort key expression (higher priority = rendered on top)
 */
export function createSortKeyExpression() {
  return ['get', 'priority']
}

// ============================================
// LAYER TEMPLATES
// ============================================

/**
 * Get consolidated circle layer config
 */
export function getConsolidatedCircleLayerConfig(layerId: string, sourceId: string) {
  return {
    id: layerId,
    type: 'circle' as const,
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': createConsolidatedSizeExpression(10),
      'circle-color': createConsolidatedColorExpression(),
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.9,
    },
    layout: {
      'circle-sort-key': createSortKeyExpression(),
    },
  }
}

/**
 * Get consolidated symbol layer config
 */
export function getConsolidatedSymbolLayerConfig(layerId: string, sourceId: string) {
  return {
    id: layerId,
    type: 'symbol' as const,
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': createConsolidatedSymbolExpression(),
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8, 10,
        14, 16,
      ],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'symbol-sort-key': createSortKeyExpression(),
    },
  }
}

/**
 * Get consolidated fill layer config for polygons
 */
export function getConsolidatedFillLayerConfig(layerId: string, sourceId: string) {
  return {
    id: layerId,
    type: 'fill' as const,
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': createConsolidatedColorExpression(),
      'fill-opacity': 0.2,
    },
  }
}

/**
 * Get consolidated line layer config for polygon borders
 */
export function getConsolidatedLineLayerConfig(layerId: string, sourceId: string) {
  return {
    id: layerId,
    type: 'line' as const,
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'line-color': createConsolidatedColorExpression(),
      'line-width': 2,
      'line-opacity': 0.8,
    },
  }
}

// ============================================
// LAYER COUNT HELPERS
// ============================================

/**
 * Estimate layer count reduction
 */
export function estimateLayerReduction(
  currentLayers: number,
  domainsToConsolidate: number
): { before: number; after: number; reduction: string } {
  // Each domain typically has 3-5 layers (circle, symbol, fill, line, pulse)
  // Consolidation reduces to 4 layers total (circle, symbol, fill, line)
  const estimatedAfter = currentLayers - domainsToConsolidate * 3 + 4

  return {
    before: currentLayers,
    after: Math.max(estimatedAfter, 4),
    reduction: `${Math.round(((currentLayers - estimatedAfter) / currentLayers) * 100)}%`,
  }
}
