/**
 * Layer Ordering System
 *
 * Phase 5: Advanced Map Optimization
 * Defines render order for map layers to ensure:
 * - Important layers on top
 * - Proper z-ordering
 * - Consistent rendering across components
 */

// ============================================
// LAYER ORDER DEFINITION
// ============================================

/**
 * Layer order from bottom (0) to top (higher number)
 * Lower number = rendered first (below)
 * Higher number = rendered last (on top)
 */
export const LAYER_ORDER = {
  // Base layers (rendered first, at bottom)
  BASE_FILL: 0,
  BASE_LINE: 1,

  // Coverage/radius layers
  USER_RADIUS: 10,
  OFFER_COVERAGE: 11,
  HAZARD_FILL: 12,
  HAZARD_BORDER: 13,
  AI_FORECAST_FILL: 14,
  AI_FORECAST_BORDER: 15,

  // Heatmap
  RAINFALL_HEATMAP: 20,

  // Filter/selection layers
  RADIUS_FILTER: 25,

  // Point layers - from less important to most important
  TRAFFIC_OUTER: 30,
  TRAFFIC_INNER: 31,
  TRAFFIC_ICON: 32,
  TRAFFIC_LABEL: 33,

  OFFERS_CLUSTER: 40,
  OFFERS_OUTER: 41,
  OFFERS_MAIN: 42,
  OFFERS_SYMBOL: 43,

  REQUESTS_CLUSTER: 50,
  REQUESTS_PULSE: 51,
  REQUESTS_OUTER: 52,
  REQUESTS_MAIN: 53,
  REQUESTS_SYMBOL: 54,
  REQUESTS_BADGE: 55,

  DISTRESS_PULSE: 60,
  DISTRESS_OUTER: 61,
  DISTRESS_MAIN: 62,
  DISTRESS_SYMBOL: 63,
  DISTRESS_BADGE: 64,

  AI_FORECAST_MARKER: 70,

  HAZARD_MARKER: 75,

  // Reports/news clusters
  REPORTS_CLUSTER: 80,
  REPORTS_PIN: 81,

  // Selected/highlighted items (always on top)
  SELECTED_MARKER: 90,

  // User location (highest priority)
  USER_LOCATION: 100,
} as const

export type LayerOrderKey = keyof typeof LAYER_ORDER

// ============================================
// LAYER ID MAPPING
// ============================================

/**
 * Map layer IDs to their order
 * Add new layers here when created
 */
export const LAYER_ID_ORDER: Record<string, number> = {
  // User location
  'user-alert-radius-fill': LAYER_ORDER.USER_RADIUS,
  'user-alert-radius-border': LAYER_ORDER.USER_RADIUS + 1,

  // Hazards
  'hazard-circles-fill': LAYER_ORDER.HAZARD_FILL,
  'hazard-circles-border': LAYER_ORDER.HAZARD_BORDER,

  // AI Forecasts
  'ai-forecast-circles-fill': LAYER_ORDER.AI_FORECAST_FILL,
  'ai-forecast-circles-border': LAYER_ORDER.AI_FORECAST_BORDER,

  // Rainfall heatmap
  'rainfall-heat': LAYER_ORDER.RAINFALL_HEATMAP,

  // Radius filter
  'radius-circle-fill': LAYER_ORDER.RADIUS_FILTER,

  // Traffic
  'traffic-points-pulse-impassable': LAYER_ORDER.TRAFFIC_OUTER,
  'traffic-points-outer': LAYER_ORDER.TRAFFIC_OUTER + 1,
  'traffic-points-inner': LAYER_ORDER.TRAFFIC_INNER,
  'traffic-points-icon': LAYER_ORDER.TRAFFIC_ICON,
  'traffic-points-label': LAYER_ORDER.TRAFFIC_LABEL,
  'traffic-points-alt-route': LAYER_ORDER.TRAFFIC_LABEL + 1,
  'traffic-points-severity': LAYER_ORDER.TRAFFIC_LABEL + 2,

  // Help offers
  'help-offers-coverage-fill': LAYER_ORDER.OFFER_COVERAGE,
  'help-offers-coverage-outline': LAYER_ORDER.OFFER_COVERAGE + 1,
  'help-offers-clusters': LAYER_ORDER.OFFERS_CLUSTER,
  'help-offers-cluster-count': LAYER_ORDER.OFFERS_CLUSTER + 1,
  'help-offers-outer': LAYER_ORDER.OFFERS_OUTER,
  'help-offers-main': LAYER_ORDER.OFFERS_MAIN,
  'help-offers-symbol': LAYER_ORDER.OFFERS_SYMBOL,
  'help-offers-capacity': LAYER_ORDER.OFFERS_SYMBOL + 1,
  'help-offers-verified': LAYER_ORDER.OFFERS_SYMBOL + 2,

  // Help requests
  'help-requests-clusters': LAYER_ORDER.REQUESTS_CLUSTER,
  'help-requests-cluster-count': LAYER_ORDER.REQUESTS_CLUSTER + 1,
  'help-requests-pulse-critical': LAYER_ORDER.REQUESTS_PULSE,
  'help-requests-pulse-high': LAYER_ORDER.REQUESTS_PULSE + 1,
  'help-requests-outer': LAYER_ORDER.REQUESTS_OUTER,
  'help-requests-main': LAYER_ORDER.REQUESTS_MAIN,
  'help-requests-symbol': LAYER_ORDER.REQUESTS_SYMBOL,
  'help-requests-count': LAYER_ORDER.REQUESTS_BADGE,
  'help-requests-special': LAYER_ORDER.REQUESTS_BADGE + 1,

  // Distress
  'distress-points-pulse-critical': LAYER_ORDER.DISTRESS_PULSE,
  'distress-points-pulse-high': LAYER_ORDER.DISTRESS_PULSE + 1,
  'distress-points-outer': LAYER_ORDER.DISTRESS_OUTER,
  'distress-points-main': LAYER_ORDER.DISTRESS_MAIN,
  'distress-points-symbol': LAYER_ORDER.DISTRESS_SYMBOL,
  'distress-points-count': LAYER_ORDER.DISTRESS_BADGE,
  'distress-points-priority': LAYER_ORDER.DISTRESS_BADGE + 1,
}

// ============================================
// HELPERS
// ============================================

/**
 * Get the order value for a layer ID
 */
export function getLayerOrder(layerId: string): number {
  return LAYER_ID_ORDER[layerId] ?? 50 // Default to middle
}

/**
 * Sort layer IDs by their render order
 */
export function sortLayersByOrder(layerIds: string[]): string[] {
  return [...layerIds].sort((a, b) => getLayerOrder(a) - getLayerOrder(b))
}

/**
 * Get the layer ID that should be rendered before the given layer
 * (for use with map.moveLayer(layerId, beforeId))
 */
export function getBeforeLayerId(
  layerId: string,
  existingLayerIds: string[]
): string | undefined {
  const order = getLayerOrder(layerId)

  // Find first layer with higher order
  const sortedExisting = sortLayersByOrder(existingLayerIds)
  for (const existingId of sortedExisting) {
    if (getLayerOrder(existingId) > order) {
      return existingId
    }
  }

  return undefined // No layer with higher order, add at top
}

/**
 * Check if layers are in correct order
 */
export function validateLayerOrder(layerIds: string[]): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  for (let i = 0; i < layerIds.length - 1; i++) {
    const currentOrder = getLayerOrder(layerIds[i])
    const nextOrder = getLayerOrder(layerIds[i + 1])

    if (currentOrder > nextOrder) {
      issues.push(
        `Layer "${layerIds[i]}" (order: ${currentOrder}) should be below "${layerIds[i + 1]}" (order: ${nextOrder})`
      )
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
