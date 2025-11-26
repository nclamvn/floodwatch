/**
 * Reports API Service
 * Handles disaster reports, alerts, and news
 */
import { API_URL, apiFetch, buildParams } from './api'

// ==================== Types ====================

export interface Report {
  id: string
  type: 'ALERT' | 'RAIN' | 'ROAD' | 'SOS' | 'NEEDS'
  source: string
  title: string
  description: string | null
  province: string | null
  district: string | null
  ward: string | null
  lat: number | null
  lon: number | null
  trust_score: number
  media: string[]
  status: string
  created_at: string
  updated_at: string
}

export interface FetchReportsOptions {
  type?: string
  province?: string
  since?: string // e.g., '6h', '24h', '7d'
  limit?: number
  offset?: number
}

export interface ReportListResponse {
  data: Report[]
  total: number
  limit: number
  offset: number
}

// ==================== Reports ====================

export async function fetchReports(
  options: FetchReportsOptions = {}
): Promise<ReportListResponse> {
  const params = buildParams({
    type: options.type,
    province: options.province,
    since: options.since,
    limit: options.limit || 50,
    offset: options.offset || 0,
  })

  return apiFetch(`/reports?${params.toString()}`)
}

export async function fetchReportById(id: string): Promise<Report> {
  return apiFetch(`/reports/${id}`)
}

// ==================== Public API v1 ====================

export async function fetchPublicReports(
  options: FetchReportsOptions = {}
): Promise<ReportListResponse> {
  const params = buildParams({
    type: options.type,
    province: options.province,
    since: options.since,
    limit: options.limit || 50,
    offset: options.offset || 0,
  })

  return apiFetch(`/api/v1/reports?${params.toString()}`)
}

// ==================== Regional Summary ====================

export interface RegionalSummary {
  summary: string
  generated_at: string
  province?: string
  report_count: number
}

export async function fetchRegionalSummary(
  province?: string
): Promise<RegionalSummary> {
  const params = buildParams({ province })
  return apiFetch(`/api/v1/regional-summary?${params.toString()}`)
}

// ==================== Storm Summary ====================

export interface StormSummary {
  summary: string
  generated_at: string
  hazard_count: number
}

export async function fetchStormSummary(): Promise<StormSummary> {
  return apiFetch('/api/v1/storm-summary')
}
