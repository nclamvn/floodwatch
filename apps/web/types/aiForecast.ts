/**
 * AI Forecast Types
 * ML-based predictions for future hazard events
 * Matches the backend models and API spec
 */

import { HazardType, SeverityLevel, GeoJSONPoint, GeoJSONPolygon } from './hazard'

/**
 * AI Forecast as returned by the API
 */
export interface AIForecast {
  id: string
  created_at: string
  updated_at: string

  // Forecast classification
  type: HazardType
  severity: SeverityLevel
  confidence: number // 0.0-1.0

  // Location (always present)
  lat: number
  lon: number
  radius_km?: number

  // Optional affected area polygon
  affected_area?: GeoJSONPolygon

  // Timing - when the forecast is for
  forecast_time: string // ISO 8601 - when the hazard is predicted to occur
  valid_until: string // ISO 8601 - when this forecast expires

  // AI Model metadata
  model_name: string
  model_version: string
  training_data_date?: string | null

  // Prediction details
  summary?: string | null // AI-generated summary text
  predicted_intensity?: number | null
  predicted_duration_hours?: number | null
  risk_factors?: string[] | null
  data_sources?: string[] | null
  raw_output?: Record<string, any> | null

  // Status
  is_active: boolean
  verified_at?: string | null
  actual_event_id?: string | null

  // Source
  source: string
  created_by?: string | null

  // Computed fields (from API)
  distance_km?: number // Only present when querying with lat/lng
  time_to_forecast_hours?: number
  time_remaining_hours?: number
}

/**
 * Request body for creating a new AI forecast
 */
export interface CreateAIForecastRequest {
  type: HazardType
  severity: SeverityLevel
  confidence: number
  location: GeoJSONPoint
  affected_area?: GeoJSONPolygon
  radius_km?: number
  forecast_time: string // ISO 8601
  valid_until: string // ISO 8601
  model_name: string
  model_version: string
  training_data_date?: string
  summary?: string
  predicted_intensity?: number
  predicted_duration_hours?: number
  risk_factors?: string[]
  data_sources?: string[]
  raw_output?: Record<string, any>
  source?: string
}

/**
 * Request body for updating an AI forecast
 */
export interface UpdateAIForecastRequest {
  severity?: SeverityLevel
  confidence?: number
  radius_km?: number
  valid_until?: string
  summary?: string
  predicted_intensity?: number
  predicted_duration_hours?: number
  risk_factors?: string[]
  is_active?: boolean
  raw_output?: Record<string, any>
}

/**
 * Query parameters for GET /api/ai-forecasts
 */
export interface GetAIForecastsParams {
  // Spatial filters
  lat?: number
  lng?: number
  radius_km?: number

  // Type filters
  types?: string // Comma-separated: 'flood,heavy_rain'
  severity?: string // Comma-separated: 'high,critical'

  // Confidence filter
  min_confidence?: number // 0.0-1.0

  // Status filters
  active_only?: boolean

  // Time filters
  from_time?: string // ISO 8601
  to_time?: string

  // Pagination
  page?: number
  limit?: number
  offset?: number

  // Sorting
  sort?: 'forecast_time' | 'confidence' | 'severity' | 'distance'
}

/**
 * API response for GET /api/ai-forecasts
 */
export interface GetAIForecastsResponse {
  data: AIForecast[]
  pagination?: {
    total: number
    limit: number
    offset: number
    total_pages: number
  }
  meta?: {
    min_confidence?: number
    active_only?: boolean
    forecast_horizon_hours?: number
  }
}

/**
 * API response for single AI forecast operations
 */
export interface AIForecastResponse {
  data: AIForecast
  meta?: {
    message?: string
    verified?: boolean
  }
}

/**
 * AI Forecast accuracy statistics
 */
export interface AIForecastAccuracyStats {
  total_verified: number
  true_positives: number
  false_positives: number
  avg_confidence: number
  accuracy_rate: number
  false_positive_rate: number
}

/**
 * Confidence level labels (Vietnamese)
 */
export const CONFIDENCE_LEVEL_LABELS: Record<string, string> = {
  very_high: 'Rất cao', // 0.9-1.0
  high: 'Cao', // 0.75-0.89
  medium: 'Trung bình', // 0.6-0.74
  low: 'Thấp', // 0.0-0.59
}

/**
 * Get confidence level label from confidence score
 */
export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return CONFIDENCE_LEVEL_LABELS.very_high
  if (confidence >= 0.75) return CONFIDENCE_LEVEL_LABELS.high
  if (confidence >= 0.6) return CONFIDENCE_LEVEL_LABELS.medium
  return CONFIDENCE_LEVEL_LABELS.low
}

/**
 * Get confidence level color (Tailwind class)
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'green'
  if (confidence >= 0.75) return 'blue'
  if (confidence >= 0.6) return 'yellow'
  return 'gray'
}

/**
 * AI Forecast purple color scheme (distinct from real events)
 */
export const AI_FORECAST_COLORS = {
  primary: '#8B5CF6', // purple-600
  light: '#A78BFA', // purple-400
  dark: '#7C3AED', // purple-700
  bg: '#F5F3FF', // purple-50
  border: '#DDD6FE', // purple-200
}
