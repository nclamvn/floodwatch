/**
 * Map Animation Utilities
 *
 * Phase 5: Advanced Map Optimization
 * Optimized animation configurations:
 * - Duration tuning (fast/normal/slow)
 * - Easing presets
 * - Reduce motion support
 * - FPS-aware animation
 */

// ============================================
// EASING FUNCTIONS
// ============================================

/**
 * Easing presets for map animations
 * Values are [x1, y1, x2, y2] for cubic-bezier
 */
export const EASINGS = {
  // Fast, snappy
  easeOutQuad: [0.25, 0.46, 0.45, 0.94],
  // Smooth deceleration
  easeOutCubic: [0.215, 0.61, 0.355, 1],
  // Very smooth
  easeOutQuart: [0.165, 0.84, 0.44, 1],
  // Bouncy feel
  easeOutBack: [0.175, 0.885, 0.32, 1.275],
  // Natural feel
  easeInOutQuad: [0.455, 0.03, 0.515, 0.955],
  // Linear (for performance)
  linear: [0, 0, 1, 1],
} as const

export type EasingName = keyof typeof EASINGS

// ============================================
// DURATION PRESETS
// ============================================

/**
 * Duration presets in milliseconds
 */
export const DURATIONS = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  verySlow: 800,
} as const

export type DurationName = keyof typeof DURATIONS

// ============================================
// ANIMATION CONFIGS
// ============================================

export interface MapAnimationConfig {
  duration: number
  easing: number[]
  essential?: boolean
}

/**
 * Predefined animation configurations for common map operations
 */
export const MAP_ANIMATIONS = {
  // User-initiated navigation (click to location)
  flyTo: {
    duration: DURATIONS.normal,
    easing: EASINGS.easeOutCubic,
    essential: true,
  },

  // Programmatic pan (e.g., following location)
  panTo: {
    duration: DURATIONS.fast,
    easing: EASINGS.easeOutQuad,
    essential: false,
  },

  // Zoom changes
  zoomIn: {
    duration: DURATIONS.fast,
    easing: EASINGS.easeOutQuad,
    essential: false,
  },
  zoomOut: {
    duration: DURATIONS.fast,
    easing: EASINGS.easeOutQuad,
    essential: false,
  },

  // Fit bounds (e.g., show all markers)
  fitBounds: {
    duration: DURATIONS.normal,
    easing: EASINGS.easeOutCubic,
    essential: true,
  },

  // Snap to location (instant for performance)
  snapTo: {
    duration: DURATIONS.instant,
    easing: EASINGS.linear,
    essential: false,
  },

  // Layer transitions
  layerFadeIn: {
    duration: DURATIONS.fast,
    easing: EASINGS.easeOutQuad,
    essential: false,
  },
  layerFadeOut: {
    duration: DURATIONS.fast,
    easing: EASINGS.easeOutQuad,
    essential: false,
  },
} as const

export type MapAnimationName = keyof typeof MAP_ANIMATIONS

// ============================================
// REDUCE MOTION SUPPORT
// ============================================

let prefersReducedMotion: boolean | null = null

/**
 * Check if user prefers reduced motion
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return false

  if (prefersReducedMotion === null) {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  return prefersReducedMotion
}

/**
 * Get animation config with reduced motion support
 */
export function getAnimationConfig(
  name: MapAnimationName,
  options?: { forceAnimate?: boolean }
): MapAnimationConfig {
  const config = MAP_ANIMATIONS[name]

  // Respect reduced motion unless animation is essential or forced
  if (shouldReduceMotion() && !config.essential && !options?.forceAnimate) {
    return {
      ...config,
      duration: DURATIONS.instant,
      easing: [...EASINGS.linear],
    }
  }

  return {
    ...config,
    easing: [...config.easing],
  }
}

// ============================================
// PERFORMANCE-AWARE ANIMATIONS
// ============================================

let lastFrameTime = 0
let fps = 60

/**
 * Update FPS measurement
 */
export function measureFps(): number {
  const now = performance.now()
  if (lastFrameTime > 0) {
    const delta = now - lastFrameTime
    fps = Math.round(1000 / delta)
  }
  lastFrameTime = now
  return fps
}

/**
 * Get current estimated FPS
 */
export function getCurrentFps(): number {
  return fps
}

/**
 * Check if device is low-end based on FPS
 */
export function isLowPerformance(): boolean {
  return fps < 30
}

/**
 * Get animation duration adjusted for device performance
 */
export function getPerformanceAdjustedDuration(baseDuration: number): number {
  if (isLowPerformance()) {
    // Reduce duration by 50% on low-end devices
    return Math.max(baseDuration * 0.5, DURATIONS.instant)
  }
  return baseDuration
}

// ============================================
// MAPLIBRE ANIMATION HELPERS
// ============================================

/**
 * Create flyTo options for MapLibre
 */
export function createFlyToOptions(
  center: [number, number],
  zoom?: number,
  options?: {
    animation?: MapAnimationName
    padding?: number | { top: number; bottom: number; left: number; right: number }
    maxDuration?: number
  }
) {
  const animation = options?.animation || 'flyTo'
  const config = getAnimationConfig(animation)

  const result: {
    center: [number, number]
    zoom?: number
    duration: number
    easing: (t: number) => number
    padding?: number | { top: number; bottom: number; left: number; right: number }
    maxDuration?: number
  } = {
    center,
    duration: getPerformanceAdjustedDuration(config.duration),
    easing: createEasingFunction(config.easing),
  }

  if (zoom !== undefined) {
    result.zoom = zoom
  }

  if (options?.padding !== undefined) {
    result.padding = options.padding
  }

  if (options?.maxDuration !== undefined) {
    result.maxDuration = options.maxDuration
  }

  return result
}

/**
 * Create easeTo options for MapLibre
 */
export function createEaseToOptions(
  center: [number, number],
  zoom?: number,
  options?: {
    animation?: MapAnimationName
  }
) {
  const animation = options?.animation || 'panTo'
  const config = getAnimationConfig(animation)

  const result: {
    center: [number, number]
    zoom?: number
    duration: number
    easing: (t: number) => number
  } = {
    center,
    duration: getPerformanceAdjustedDuration(config.duration),
    easing: createEasingFunction(config.easing),
  }

  if (zoom !== undefined) {
    result.zoom = zoom
  }

  return result
}

/**
 * Create fitBounds options for MapLibre
 */
export function createFitBoundsOptions(
  padding?: number | { top: number; bottom: number; left: number; right: number },
  options?: {
    animation?: MapAnimationName
    maxZoom?: number
  }
) {
  const animation = options?.animation || 'fitBounds'
  const config = getAnimationConfig(animation)

  return {
    padding: padding || 50,
    duration: getPerformanceAdjustedDuration(config.duration),
    easing: createEasingFunction(config.easing),
    maxZoom: options?.maxZoom || 16,
  }
}

// ============================================
// EASING FUNCTION GENERATOR
// ============================================

/**
 * Create easing function from cubic-bezier values
 */
export function createEasingFunction(bezier: readonly number[]): (t: number) => number {
  const [x1, y1, x2, y2] = bezier

  // Simple cubic bezier approximation
  return (t: number): number => {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx

    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by

    const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t
    const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t
    const sampleCurveDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

    // Newton-Raphson iteration
    let x = t
    for (let i = 0; i < 4; i++) {
      const currentX = sampleCurveX(x) - t
      if (Math.abs(currentX) < 0.0001) break
      const derivative = sampleCurveDerivativeX(x)
      if (Math.abs(derivative) < 0.0001) break
      x = x - currentX / derivative
    }

    return sampleCurveY(x)
  }
}

// ============================================
// LAYER TRANSITION HELPERS
// ============================================

/**
 * Get paint transition config for smooth layer visibility changes
 */
export function getLayerTransition(type: 'fadeIn' | 'fadeOut' = 'fadeIn') {
  const config = getAnimationConfig(type === 'fadeIn' ? 'layerFadeIn' : 'layerFadeOut')

  return {
    'fill-opacity-transition': { duration: config.duration },
    'line-opacity-transition': { duration: config.duration },
    'circle-opacity-transition': { duration: config.duration },
    'text-opacity-transition': { duration: config.duration },
    'icon-opacity-transition': { duration: config.duration },
  }
}

/**
 * Get CSS transition string for React components
 */
export function getCssTransition(
  properties: string[] = ['opacity', 'transform'],
  duration: DurationName = 'fast'
): string {
  const ms = DURATIONS[duration]
  return properties.map((prop) => `${prop} ${ms}ms ease-out`).join(', ')
}
