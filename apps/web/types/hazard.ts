/**
 * Hazard Event Types
 * Matches the backend models and API spec
 */

export type HazardType =
  | 'heavy_rain'
  | 'flood'
  | 'dam_release'
  | 'landslide'
  | 'storm'
  | 'tide_surge'

export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

/**
 * Hazard Event as returned by the API
 */
export interface HazardEvent {
  id: string
  created_at: string
  updated_at: string

  // Event classification
  type: HazardType
  severity: SeverityLevel

  // Location (always present)
  lat: number
  lon: number
  radius_km?: number

  // Optional affected area polygon
  affected_area?: GeoJSONPolygon

  // Time range
  starts_at: string // ISO 8601 timestamp
  ends_at?: string | null

  // Data source
  source: string
  external_id?: string | null
  raw_payload?: Record<string, any> | null

  // Metadata
  created_by?: string | null

  // Computed fields (from API)
  distance_km?: number // Only present when querying with lat/lng
  status?: 'upcoming' | 'active' | 'ended'
  time_remaining_hours?: number
}

/**
 * Request body for creating a new hazard event
 */
export interface CreateHazardEventRequest {
  type: HazardType
  severity: SeverityLevel
  location: GeoJSONPoint
  affected_area?: GeoJSONPolygon
  radius_km?: number
  starts_at: string // ISO 8601 timestamp
  ends_at?: string | null
  source: string
  external_id?: string
  raw_payload?: Record<string, any>
}

/**
 * Request body for updating a hazard event
 */
export interface UpdateHazardEventRequest {
  severity?: SeverityLevel
  affected_area?: GeoJSONPolygon
  radius_km?: number
  starts_at?: string
  ends_at?: string | null
  raw_payload?: Record<string, any>
}

/**
 * Query parameters for GET /api/hazards
 */
export interface GetHazardsParams {
  // Spatial filters
  lat?: number
  lng?: number
  radius_km?: number

  // Type filters
  types?: string // Comma-separated: 'flood,heavy_rain'
  severity?: string // Comma-separated: 'high,critical'

  // Time filters
  active_only?: boolean
  from?: string // ISO 8601
  to?: string

  // Pagination
  page?: number
  limit?: number

  // Sorting
  sort?: 'distance' | 'severity' | 'starts_at'
}

/**
 * API response for GET /api/hazards
 */
export interface GetHazardsResponse {
  data: HazardEvent[]
  pagination?: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next?: boolean
    has_prev?: boolean
  }
  meta?: {
    query_time_ms: number
    filters_applied?: Record<string, any>
  }
}

/**
 * API response for single hazard operations
 */
export interface HazardEventResponse {
  data: HazardEvent
  meta?: {
    matched_subscriptions?: number
    notifications_queued?: boolean
  }
}

/**
 * Hazard type display names (Vietnamese)
 */
export const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  heavy_rain: 'Mưa lớn',
  flood: 'Ngập lụt',
  dam_release: 'Xả lũ hồ chứa',
  landslide: 'Sạt lở đất',
  storm: 'Bão',
  tide_surge: 'Triều cường',
}

/**
 * Severity level display names (Vietnamese)
 */
export const SEVERITY_LEVEL_LABELS: Record<SeverityLevel, string> = {
  info: 'Thông tin',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Khẩn cấp',
}

/**
 * Severity level colors (Tailwind classes)
 */
export const SEVERITY_LEVEL_COLORS: Record<SeverityLevel, string> = {
  info: 'blue',
  low: 'green',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
}

/**
 * Hazard type icons (emoji or icon class)
 */
export const HAZARD_TYPE_ICONS: Record<HazardType, string> = {
  heavy_rain: '🌧️',
  flood: '🌊',
  dam_release: '🚧',
  landslide: '⚠️',
  storm: '🌀',
  tide_surge: '🌊',
}
