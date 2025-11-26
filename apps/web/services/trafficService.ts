/**
 * Traffic & Road Events API Service
 */
import { API_URL, apiFetch, buildParams } from './api'

// ==================== Types ====================

export type RoadStatus = 'OPEN' | 'CLOSED' | 'RESTRICTED'
export type DisruptionType = 'flooded_road' | 'landslide' | 'bridge_collapsed' | 'bridge_flooded' | 'traffic_jam' | 'road_damaged' | 'blocked'
export type DisruptionSeverity = 'impassable' | 'dangerous' | 'slow' | 'warning'

export interface RoadEvent {
  id: string
  segment_name: string
  status: RoadStatus
  reason: string | null
  province: string | null
  district: string | null
  lat: number | null
  lon: number | null
  last_verified: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface TrafficDisruption {
  id: string
  type: DisruptionType
  severity: DisruptionSeverity
  lat: number
  lon: number
  road_name: string | null
  location_description: string
  description: string | null
  estimated_clearance: string | null
  alternative_route: string | null
  starts_at: string
  ends_at: string | null
  source: string
  verified: boolean
  is_active: boolean
  media_urls: string[] | null
  created_at: string
  updated_at: string
  distance_km?: number
}

// ==================== Road Events ====================

export interface FetchRoadEventsOptions {
  province?: string
  status?: RoadStatus
}

export interface RoadEventListResponse {
  data: RoadEvent[]
  total: number
}

export async function fetchRoadEvents(
  options: FetchRoadEventsOptions = {}
): Promise<RoadEventListResponse> {
  const params = buildParams({
    province: options.province,
    status: options.status,
  })

  return apiFetch(`/road-events?${params.toString()}`)
}

export async function fetchPublicRoadEvents(
  options: FetchRoadEventsOptions = {}
): Promise<RoadEventListResponse> {
  const params = buildParams({
    province: options.province,
    status: options.status,
  })

  return apiFetch(`/api/v1/road-events?${params.toString()}`)
}

// ==================== Traffic Disruptions ====================

export interface FetchDisruptionsOptions {
  types?: DisruptionType[]
  severity?: DisruptionSeverity[]
  activeOnly?: boolean
  lat?: number
  lon?: number
  radiusKm?: number
  limit?: number
  offset?: number
}

export interface DisruptionListResponse {
  data: TrafficDisruption[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

export async function fetchTrafficDisruptions(
  options: FetchDisruptionsOptions = {}
): Promise<DisruptionListResponse> {
  const params = buildParams({
    types: options.types?.join(','),
    severity: options.severity?.join(','),
    active_only: options.activeOnly !== false,
    lat: options.lat,
    lng: options.lon,
    radius_km: options.radiusKm,
    limit: options.limit || 50,
    offset: options.offset || 0,
  })

  return apiFetch(`/traffic/disruptions?${params.toString()}`)
}

export interface CreateDisruptionData {
  type: DisruptionType
  severity: DisruptionSeverity
  lat: number
  lon: number
  location_description: string
  description?: string
  road_name?: string
  media_urls?: string[]
  source?: string
}

export async function createTrafficDisruption(
  data: CreateDisruptionData
): Promise<TrafficDisruption> {
  return apiFetch('/traffic/disruptions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
