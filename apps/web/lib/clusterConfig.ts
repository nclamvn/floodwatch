/**
 * Cluster Configuration
 *
 * Phase 5: Advanced Map Optimization
 * Centralized Supercluster configuration with:
 * - Performance mode (mobile/low-end devices)
 * - Detail mode (desktop/high-end devices)
 * - Domain-specific tuning
 */

export interface ClusterConfig {
  radius: number
  maxZoom: number
  minZoom?: number
  minPoints?: number
  extent?: number
  nodeSize?: number
}

// ============================================
// PERFORMANCE PROFILES
// ============================================

/**
 * Performance mode - for mobile/low-end devices
 * - Larger cluster radius (more aggressive clustering)
 * - Lower maxZoom (clusters break apart later)
 * - Higher minPoints (need more points to form cluster)
 */
export const PERFORMANCE_MODE: ClusterConfig = {
  radius: 80,      // Larger radius = more clustering
  maxZoom: 14,     // Break clusters at zoom 14
  minZoom: 0,
  minPoints: 3,    // Need 3+ points to cluster
  extent: 256,     // Tile extent
  nodeSize: 64,    // R-tree node size
}

/**
 * Detail mode - for desktop/high-end devices
 * - Smaller cluster radius (less aggressive)
 * - Higher maxZoom (clusters break apart sooner)
 * - Lower minPoints (cluster even with 2 points)
 */
export const DETAIL_MODE: ClusterConfig = {
  radius: 50,      // Smaller radius = less clustering
  maxZoom: 17,     // Break clusters at zoom 17
  minZoom: 0,
  minPoints: 2,    // Cluster with just 2 points
  extent: 512,     // Higher resolution
  nodeSize: 64,
}

// ============================================
// DOMAIN-SPECIFIC CONFIGS
// ============================================

type ClusterDomain = 'reports' | 'traffic' | 'distress' | 'help-requests' | 'help-offers'

const DOMAIN_CONFIGS: Record<ClusterDomain, Partial<ClusterConfig>> = {
  reports: {
    radius: 60,
    maxZoom: 16,
  },
  traffic: {
    radius: 50,      // Traffic disruptions should cluster less
    maxZoom: 14,
    minPoints: 3,
  },
  distress: {
    radius: 40,      // Distress reports need to be visible individually sooner
    maxZoom: 15,
    minPoints: 2,
  },
  'help-requests': {
    radius: 60,
    maxZoom: 16,
    minPoints: 2,
  },
  'help-offers': {
    radius: 60,
    maxZoom: 16,
    minPoints: 2,
  },
}

// ============================================
// HELPERS
// ============================================

/**
 * Detect if device is low-end (should use performance mode)
 */
export function shouldUsePerformanceMode(): boolean {
  if (typeof window === 'undefined') return false

  // Check for mobile
  const isMobile = window.innerWidth < 768

  // Check for low memory (if available)
  const nav = navigator as Navigator & { deviceMemory?: number }
  const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory < 4

  // Check for slow connection
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
  const slowConnection = conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g'

  return isMobile || lowMemory || slowConnection
}

/**
 * Get cluster config for a domain with auto-detected mode
 */
export function getClusterConfig(domain: ClusterDomain): ClusterConfig {
  const baseConfig = shouldUsePerformanceMode() ? PERFORMANCE_MODE : DETAIL_MODE
  const domainOverrides = DOMAIN_CONFIGS[domain] || {}

  return {
    ...baseConfig,
    ...domainOverrides,
  }
}

/**
 * Get cluster config with explicit mode
 */
export function getClusterConfigWithMode(
  domain: ClusterDomain,
  mode: 'performance' | 'detail'
): ClusterConfig {
  const baseConfig = mode === 'performance' ? PERFORMANCE_MODE : DETAIL_MODE
  const domainOverrides = DOMAIN_CONFIGS[domain] || {}

  return {
    ...baseConfig,
    ...domainOverrides,
  }
}

// ============================================
// CLUSTER STYLE HELPERS
// ============================================

export interface ClusterStyle {
  size: number
  backgroundColor: string
  borderColor: string
  textColor: string
  boxShadow: string
}

/**
 * Get cluster marker style based on point count and urgency level
 */
export function getClusterStyle(
  pointCount: number,
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low' = 'low'
): ClusterStyle {
  // Size based on point count
  const baseSize = 30
  let size = baseSize
  if (pointCount >= 100) size = baseSize + 30
  else if (pointCount >= 50) size = baseSize + 25
  else if (pointCount >= 20) size = baseSize + 20
  else if (pointCount >= 10) size = baseSize + 15
  else if (pointCount >= 5) size = baseSize + 10
  else size = baseSize + 5

  // Colors based on urgency
  const styles = {
    critical: {
      backgroundColor: '#DC2626',
      borderColor: '#991B1B',
      textColor: '#ffffff',
      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
    },
    high: {
      backgroundColor: '#EA580C',
      borderColor: '#C2410C',
      textColor: '#ffffff',
      boxShadow: '0 3px 10px rgba(234, 88, 12, 0.3)',
    },
    medium: {
      backgroundColor: '#FBBF24',
      borderColor: '#F59E0B',
      textColor: '#1F2937',
      boxShadow: '0 2px 8px rgba(251, 191, 36, 0.25)',
    },
    low: {
      backgroundColor: '#9CA3AF',
      borderColor: '#6B7280',
      textColor: '#ffffff',
      boxShadow: '0 2px 6px rgba(156, 163, 175, 0.2)',
    },
  }

  return {
    size,
    ...styles[urgencyLevel],
  }
}

/**
 * Determine urgency level from cluster contents
 */
export function determineClusterUrgency(
  reports: Array<{ type?: string; urgency?: string; trust_score?: number }>
): 'critical' | 'high' | 'medium' | 'low' {
  if (reports.length === 0) return 'low'

  const criticalCount = reports.filter(
    r => r.urgency === 'critical' || (r.type === 'SOS' && (r.trust_score || 0) >= 0.7)
  ).length

  const highCount = reports.filter(
    r => r.urgency === 'high' || r.type === 'ALERT' || r.type === 'SOS'
  ).length

  if (criticalCount >= 3 || (criticalCount >= 1 && reports.length >= 5)) {
    return 'critical'
  }
  if (highCount >= 3 || criticalCount >= 1) {
    return 'high'
  }
  if (highCount >= 1 || reports.length >= 10) {
    return 'medium'
  }
  return 'low'
}
