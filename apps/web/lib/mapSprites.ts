/**
 * Map Sprites Configuration
 *
 * Phase 5: Advanced Map Optimization
 * Defines sprite/icon configuration for Symbol Layers:
 * - Icon mappings for different marker types
 * - Color coding by priority/status
 * - Fallback to text symbols when sprites unavailable
 */

// ============================================
// ICON DEFINITIONS
// ============================================

/**
 * Icon names used in symbol layers
 * These should match sprite sheet entries or use built-in MapLibre icons
 */
export const MAP_ICONS = {
  // Help markers
  HELP_REQUEST: 'help-request',
  HELP_OFFER: 'help-offer',
  HELP_REQUEST_CRITICAL: 'help-request-critical',
  HELP_REQUEST_HIGH: 'help-request-high',

  // Distress markers
  DISTRESS: 'distress',
  DISTRESS_CRITICAL: 'distress-critical',
  DISTRESS_HIGH: 'distress-high',

  // Traffic markers
  TRAFFIC_BLOCKED: 'traffic-blocked',
  TRAFFIC_WARNING: 'traffic-warning',
  TRAFFIC_INFO: 'traffic-info',

  // Hazard markers
  HAZARD_FLOOD: 'hazard-flood',
  HAZARD_STORM: 'hazard-storm',
  HAZARD_LANDSLIDE: 'hazard-landslide',
  HAZARD_WARNING: 'hazard-warning',

  // AI Forecast markers
  AI_FORECAST: 'ai-forecast',

  // Rescue markers
  RESCUE_PENDING: 'rescue-pending',
  RESCUE_ACTIVE: 'rescue-active',
  RESCUE_COMPLETED: 'rescue-completed',

  // User location
  USER_LOCATION: 'user-location',

  // Clusters
  CLUSTER_SMALL: 'cluster-small',
  CLUSTER_MEDIUM: 'cluster-medium',
  CLUSTER_LARGE: 'cluster-large',
} as const

export type MapIconName = (typeof MAP_ICONS)[keyof typeof MAP_ICONS]

// ============================================
// TEXT SYMBOL FALLBACKS
// ============================================

/**
 * Unicode symbols for fallback when sprites unavailable
 * Used with 'text-field' in symbol layers
 */
export const TEXT_SYMBOLS = {
  // Help
  HELP_REQUEST: '🆘',
  HELP_OFFER: '🤝',

  // Distress
  DISTRESS: '⚠️',
  DISTRESS_CRITICAL: '🚨',

  // Traffic
  TRAFFIC_BLOCKED: '🚧',
  TRAFFIC_WARNING: '⚡',
  TRAFFIC_INFO: 'ℹ️',

  // Hazard
  HAZARD_FLOOD: '🌊',
  HAZARD_STORM: '🌀',
  HAZARD_LANDSLIDE: '⛰️',
  HAZARD_WARNING: '⚠️',

  // AI
  AI_FORECAST: '🤖',

  // Rescue
  RESCUE: '🚑',

  // User
  USER: '📍',

  // Cluster count placeholder
  CLUSTER: '{point_count_abbreviated}',
} as const

// ============================================
// COLOR PALETTES
// ============================================

/**
 * Priority-based colors matching tailwind config
 */
export const PRIORITY_COLORS = {
  critical: '#991b1b', // red-800
  high: '#f97316', // orange-500
  medium: '#eab308', // yellow-500
  low: '#22c55e', // green-500
  default: '#6b7280', // gray-500
} as const

/**
 * Status-based colors
 */
export const STATUS_COLORS = {
  active: '#22c55e', // green-500
  pending: '#eab308', // yellow-500
  in_progress: '#3b82f6', // blue-500
  completed: '#6b7280', // gray-500
  cancelled: '#ef4444', // red-500
} as const

/**
 * Domain-specific colors
 */
export const DOMAIN_COLORS = {
  help_request: '#ef4444', // red-500
  help_offer: '#22c55e', // green-500
  distress: '#dc2626', // red-600
  traffic: '#f59e0b', // amber-500
  hazard: '#7c3aed', // violet-600
  ai_forecast: '#06b6d4', // cyan-500
  rescue: '#ec4899', // pink-500
} as const

// ============================================
// SYMBOL LAYER CONFIGURATIONS
// ============================================

/**
 * Base symbol layout configuration
 */
export const BASE_SYMBOL_LAYOUT = {
  'icon-allow-overlap': true,
  'icon-ignore-placement': false,
  'text-allow-overlap': false,
  'text-optional': true,
  'symbol-sort-key': ['get', 'priority'],
} as const

/**
 * Symbol paint configuration for different marker types
 */
export const SYMBOL_PAINT_CONFIG = {
  helpRequests: {
    'icon-color': [
      'match',
      ['get', 'urgency'],
      'critical',
      PRIORITY_COLORS.critical,
      'high',
      PRIORITY_COLORS.high,
      'medium',
      PRIORITY_COLORS.medium,
      PRIORITY_COLORS.default,
    ],
    'icon-halo-color': '#ffffff',
    'icon-halo-width': 2,
  },

  helpOffers: {
    'icon-color': DOMAIN_COLORS.help_offer,
    'icon-halo-color': '#ffffff',
    'icon-halo-width': 2,
  },

  distress: {
    'icon-color': [
      'match',
      ['get', 'priority'],
      'critical',
      PRIORITY_COLORS.critical,
      'high',
      PRIORITY_COLORS.high,
      PRIORITY_COLORS.medium,
    ],
    'icon-halo-color': '#ffffff',
    'icon-halo-width': 2,
  },

  traffic: {
    'icon-color': [
      'match',
      ['get', 'severity'],
      'impassable',
      PRIORITY_COLORS.critical,
      'major',
      PRIORITY_COLORS.high,
      'minor',
      PRIORITY_COLORS.medium,
      PRIORITY_COLORS.default,
    ],
    'icon-halo-color': '#ffffff',
    'icon-halo-width': 2,
  },

  hazards: {
    'icon-color': DOMAIN_COLORS.hazard,
    'icon-halo-color': '#ffffff',
    'icon-halo-width': 2,
  },

  aiForecast: {
    'icon-color': DOMAIN_COLORS.ai_forecast,
    'icon-halo-color': '#ffffff',
    'icon-halo-width': 2,
  },
} as const

// ============================================
// CLUSTER STYLING
// ============================================

/**
 * Cluster circle colors based on point count
 */
export const CLUSTER_COLORS = {
  small: '#51bbd6', // < 10 points
  medium: '#f1f075', // 10-99 points
  large: '#f28cb1', // 100+ points
} as const

/**
 * Get cluster color expression for circle-color
 */
export function getClusterColorExpression() {
  return [
    'step',
    ['get', 'point_count'],
    CLUSTER_COLORS.small,
    10,
    CLUSTER_COLORS.medium,
    100,
    CLUSTER_COLORS.large,
  ]
}

/**
 * Get cluster radius expression for circle-radius
 */
export function getClusterRadiusExpression(base: number = 15) {
  return ['step', ['get', 'point_count'], base, 10, base + 5, 100, base + 10]
}

// ============================================
// DYNAMIC ICON SELECTION
// ============================================

/**
 * Get icon name based on feature properties
 */
export function getIconForFeature(
  domain: 'help-request' | 'help-offer' | 'distress' | 'traffic' | 'hazard' | 'ai-forecast',
  properties: Record<string, unknown>
): MapIconName {
  switch (domain) {
    case 'help-request': {
      const urgency = properties.urgency as string
      if (urgency === 'critical') return MAP_ICONS.HELP_REQUEST_CRITICAL
      if (urgency === 'high') return MAP_ICONS.HELP_REQUEST_HIGH
      return MAP_ICONS.HELP_REQUEST
    }

    case 'help-offer':
      return MAP_ICONS.HELP_OFFER

    case 'distress': {
      const priority = properties.priority as string
      if (priority === 'critical') return MAP_ICONS.DISTRESS_CRITICAL
      if (priority === 'high') return MAP_ICONS.DISTRESS_HIGH
      return MAP_ICONS.DISTRESS
    }

    case 'traffic': {
      const severity = properties.severity as string
      if (severity === 'impassable') return MAP_ICONS.TRAFFIC_BLOCKED
      if (severity === 'major') return MAP_ICONS.TRAFFIC_WARNING
      return MAP_ICONS.TRAFFIC_INFO
    }

    case 'hazard': {
      const type = properties.type as string
      if (type === 'flood') return MAP_ICONS.HAZARD_FLOOD
      if (type === 'storm') return MAP_ICONS.HAZARD_STORM
      if (type === 'landslide') return MAP_ICONS.HAZARD_LANDSLIDE
      return MAP_ICONS.HAZARD_WARNING
    }

    case 'ai-forecast':
      return MAP_ICONS.AI_FORECAST

    default:
      return MAP_ICONS.HELP_REQUEST
  }
}

/**
 * Get text symbol for fallback rendering
 */
export function getTextSymbolForDomain(
  domain: 'help-request' | 'help-offer' | 'distress' | 'traffic' | 'hazard' | 'ai-forecast'
): string {
  switch (domain) {
    case 'help-request':
      return TEXT_SYMBOLS.HELP_REQUEST
    case 'help-offer':
      return TEXT_SYMBOLS.HELP_OFFER
    case 'distress':
      return TEXT_SYMBOLS.DISTRESS
    case 'traffic':
      return TEXT_SYMBOLS.TRAFFIC_WARNING
    case 'hazard':
      return TEXT_SYMBOLS.HAZARD_WARNING
    case 'ai-forecast':
      return TEXT_SYMBOLS.AI_FORECAST
    default:
      return '●'
  }
}

// ============================================
// MAPLIBRE EXPRESSIONS
// ============================================

/**
 * Create icon-image expression for symbol layer
 * Falls back based on priority/type
 */
export function createIconImageExpression(domain: string) {
  switch (domain) {
    case 'help-requests':
      return [
        'match',
        ['get', 'urgency'],
        'critical',
        MAP_ICONS.HELP_REQUEST_CRITICAL,
        'high',
        MAP_ICONS.HELP_REQUEST_HIGH,
        MAP_ICONS.HELP_REQUEST,
      ]

    case 'distress':
      return [
        'match',
        ['get', 'priority'],
        'critical',
        MAP_ICONS.DISTRESS_CRITICAL,
        'high',
        MAP_ICONS.DISTRESS_HIGH,
        MAP_ICONS.DISTRESS,
      ]

    case 'traffic':
      return [
        'match',
        ['get', 'severity'],
        'impassable',
        MAP_ICONS.TRAFFIC_BLOCKED,
        'major',
        MAP_ICONS.TRAFFIC_WARNING,
        MAP_ICONS.TRAFFIC_INFO,
      ]

    default:
      return domain
  }
}

/**
 * Create size expression based on zoom and importance
 */
export function createSizeExpression(baseSize: number = 1) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    baseSize * 0.5,
    12,
    baseSize,
    16,
    baseSize * 1.5,
  ]
}
