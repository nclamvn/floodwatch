/**
 * Hazard Events API Service
 * Handles natural disaster events and forecasts
 */
import { API_URL, apiFetch, buildParams } from './api'

// ==================== Types ====================

export type HazardType = 'heavy_rain' | 'flood' | 'dam_release' | 'landslide' | 'storm' | 'tide_surge'
export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface HazardEvent {
  id: string
  type: HazardType
  severity: SeverityLevel
  lat: number
  lon: number
  radius_km: number | null
  starts_at: string
  ends_at: string | null
  source: string
  external_id: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
  distance_km?: number
}

export interface FetchHazardsOptions {
  types?: HazardType[]
  severity?: SeverityLevel[]
  activeOnly?: boolean
  lat?: number
  lon?: number
  radiusKm?: number
  limit?: number
  offset?: number
  sort?: 'distance' | 'severity' | 'starts_at'
}

export interface HazardListResponse {
  data: HazardEvent[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

// ==================== Hazard Events ====================

export async function fetchHazards(
  options: FetchHazardsOptions = {}
): Promise<HazardListResponse> {
  const params = buildParams({
    types: options.types?.join(','),
    severity: options.severity?.join(','),
    active_only: options.activeOnly !== false, // default true
    lat: options.lat,
    lng: options.lon,
    radius_km: options.radiusKm || 10,
    limit: options.limit || 20,
    offset: options.offset || 0,
    sort: options.sort || 'starts_at',
  })

  return apiFetch(`/hazards?${params.toString()}`)
}

export async function fetchHazardById(id: string): Promise<HazardEvent> {
  return apiFetch(`/hazards/${id}`)
}

export async function createHazard(data: Partial<HazardEvent>): Promise<HazardEvent> {
  return apiFetch('/hazards', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateHazard(
  id: string,
  data: Partial<HazardEvent>
): Promise<HazardEvent> {
  return apiFetch(`/hazards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteHazard(id: string): Promise<void> {
  await apiFetch(`/hazards/${id}`, { method: 'DELETE' })
}

// ==================== AI Forecasts ====================

export interface AIForecast {
  id: string
  type: HazardType
  severity: SeverityLevel
  confidence: number
  lat: number
  lon: number
  radius_km: number | null
  forecast_time: string
  valid_until: string
  model_name: string
  model_version: string
  summary: string | null
  predicted_intensity: number | null
  predicted_duration_hours: number | null
  risk_factors: string[] | null
  is_active: boolean
  created_at: string
  distance_km?: number
}

export interface FetchForecastsOptions {
  types?: HazardType[]
  activeOnly?: boolean
  lat?: number
  lon?: number
  radiusKm?: number
  limit?: number
  offset?: number
}

export interface ForecastListResponse {
  data: AIForecast[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

export async function fetchAIForecasts(
  options: FetchForecastsOptions = {}
): Promise<ForecastListResponse> {
  const params = buildParams({
    types: options.types?.join(','),
    active_only: options.activeOnly !== false,
    lat: options.lat,
    lng: options.lon,
    radius_km: options.radiusKm,
    limit: options.limit || 20,
    offset: options.offset || 0,
  })

  return apiFetch(`/ai-forecasts?${params.toString()}`)
}
