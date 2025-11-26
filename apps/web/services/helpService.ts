/**
 * Help Requests & Offers API Service
 */
import { API_URL, apiFetch, buildParams } from './api'

// ==================== Types ====================

export interface HelpRequest {
  id: string
  needs_type: string
  urgency: string
  description: string
  people_count: number | null
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  has_children: boolean | null
  has_elderly: boolean | null
  has_disabilities: boolean | null
  water_level_cm: number | null
  building_floor: number | null
  status: string
  created_at: string
  distance_km?: number
}

export interface HelpOffer {
  id: string
  service_type: string
  description: string
  capacity: number | null
  coverage_radius_km: number | null
  availability: string
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  organization: string | null
  vehicle_type: string | null
  available_capacity: number | null
  status: string
  created_at: string
  distance_km?: number
}

export interface FetchHelpOptions {
  lat?: number
  lon?: number
  radiusKm?: number
  sortBy?: 'distance' | 'created_at'
  limit?: number
  offset?: number
}

export interface HelpListResponse<T> {
  data: T[]
  total: number
}

// ==================== Help Requests ====================

export async function fetchHelpRequests(
  options: FetchHelpOptions = {}
): Promise<HelpListResponse<HelpRequest>> {
  const params = buildParams({
    lat: options.lat,
    lon: options.lon,
    radius_km: options.radiusKm,
    sort_by: options.sortBy || (options.lat ? 'distance' : 'created_at'),
    limit: options.limit || 200,
    offset: options.offset || 0,
  })

  return apiFetch(`/help/requests?${params.toString()}`)
}

export async function createHelpRequest(data: Partial<HelpRequest>): Promise<{ id: string }> {
  return apiFetch('/help/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteHelpRequest(id: string): Promise<void> {
  await apiFetch(`/help/requests/${id}`, { method: 'DELETE' })
}

// ==================== Help Offers ====================

export async function fetchHelpOffers(
  options: FetchHelpOptions = {}
): Promise<HelpListResponse<HelpOffer>> {
  const params = buildParams({
    lat: options.lat,
    lon: options.lon,
    radius_km: options.radiusKm,
    sort_by: options.sortBy || (options.lat ? 'distance' : 'created_at'),
    limit: options.limit || 200,
    offset: options.offset || 0,
  })

  return apiFetch(`/help/offers?${params.toString()}`)
}

export async function createHelpOffer(data: Partial<HelpOffer>): Promise<{ id: string }> {
  return apiFetch('/help/offers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteHelpOffer(id: string): Promise<void> {
  await apiFetch(`/help/offers/${id}`, { method: 'DELETE' })
}

// ==================== Matching ====================

export async function findMatchingOffers(
  requestId: string,
  options?: { maxDistance?: number; limit?: number }
): Promise<{ matches: HelpOffer[] }> {
  const params = buildParams({
    max_distance_km: options?.maxDistance,
    limit: options?.limit,
  })

  return apiFetch(`/help/requests/${requestId}/matches?${params.toString()}`)
}
