'use client'

import { useState } from 'react'
import { MapPin, Clock, Navigation, ChevronRight, AlertTriangle, ShieldCheck, ShieldAlert, ShieldX, AlertOctagon, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import DirectionsModal from './DirectionsModal'

// 4-Status System (Apple Maps style)
export type RouteStatus = 'OPEN' | 'LIMITED' | 'DANGEROUS' | 'CLOSED'

// Lifecycle status for alerts
export type LifecycleStatus = 'ACTIVE' | 'RESOLVED' | 'ARCHIVED'

export interface RouteSegment {
  id: string
  segment_name: string
  road_name?: string
  status: RouteStatus
  status_reason?: string
  province?: string
  district?: string
  lat?: number
  lon?: number
  risk_score?: number
  hazard_name?: string
  source?: string
  source_url?: string
  source_domain?: string
  verified_at?: string
  created_at?: string
  updated_at?: string
  // Lifecycle fields
  lifecycle_status?: LifecycleStatus
  last_verified_at?: string
  resolved_at?: string
  archived_at?: string
}

interface RouteCardProps {
  route: RouteSegment
  onDetailClick?: (route: RouteSegment) => void
}

// Status configuration (styling only - labels come from translations)
const STATUS_STYLES: Record<RouteStatus, {
  bgColor: string
  textColor: string
  borderColor: string
  iconBg: string
  icon: React.ReactNode
}> = {
  OPEN: {
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    icon: <ShieldCheck className="w-4 h-4" />
  },
  LIMITED: {
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    icon: <AlertTriangle className="w-4 h-4" />
  },
  DANGEROUS: {
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    icon: <ShieldAlert className="w-4 h-4" />
  },
  CLOSED: {
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-800',
    iconBg: 'bg-red-100 dark:bg-red-900/50',
    icon: <ShieldX className="w-4 h-4" />
  }
}

// Convert old 3-status to new 4-status
export function normalizeStatus(status: string): RouteStatus {
  const upperStatus = status?.toUpperCase()
  if (upperStatus === 'RESTRICTED') return 'LIMITED'
  if (upperStatus === 'OPEN' || upperStatus === 'LIMITED' || upperStatus === 'DANGEROUS' || upperStatus === 'CLOSED') {
    return upperStatus as RouteStatus
  }
  return 'OPEN'
}

// Format relative time - returns raw time data for translation
function getRelativeTimeData(dateString?: string): { type: 'justNow' | 'minutes' | 'hours' | 'days' | 'date', count?: number, date?: Date } {
  if (!dateString) return { type: 'justNow' }

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return { type: 'justNow' }
  if (diffMinutes < 60) return { type: 'minutes', count: diffMinutes }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return { type: 'hours', count: diffHours }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return { type: 'days', count: diffDays }

  return { type: 'date', date }
}

// Format risk score as percentage
function formatRiskScore(score?: number): string {
  if (score === undefined || score === null) return ''
  return `${Math.round(score * 100)}%`
}

// Calculate days until archive for RESOLVED alerts (3 days from resolved_at)
function getDaysUntilArchive(resolvedAt?: string): number {
  if (!resolvedAt) return 3
  const resolved = new Date(resolvedAt)
  const archiveDate = new Date(resolved.getTime() + 3 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const diffDays = Math.ceil((archiveDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(0, diffDays)
}

export default function RouteCard({ route, onDetailClick }: RouteCardProps) {
  const t = useTranslations('routeCard')
  const [showDirections, setShowDirections] = useState(false)

  const status = normalizeStatus(route.status)
  const styles = STATUS_STYLES[status]
  const hasCoordinates = route.lat !== undefined && route.lon !== undefined
  const isResolved = route.lifecycle_status === 'RESOLVED'
  const daysUntilArchive = isResolved ? getDaysUntilArchive(route.resolved_at) : 0

  // Get translated status label
  const statusLabel = t(`status.${status.toLowerCase()}`)

  // Format time with translations
  const formatTime = (dateString?: string) => {
    const timeData = getRelativeTimeData(dateString)
    if (timeData.type === 'justNow') return t('timeAgo.justNow')
    if (timeData.type === 'minutes' && timeData.count !== undefined) return t('timeAgo.minutes', { count: timeData.count })
    if (timeData.type === 'hours' && timeData.count !== undefined) return t('timeAgo.hours', { count: timeData.count })
    if (timeData.type === 'days' && timeData.count !== undefined) return t('timeAgo.days', { count: timeData.count })
    return timeData.date?.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) || ''
  }

  return (
    <>
      <div
        className={`group relative bg-white dark:bg-neutral-900 rounded-2xl border-2 ${
          isResolved
            ? 'border-emerald-300 dark:border-emerald-700'
            : styles.borderColor
        } overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01]`}
      >
        {/* RESOLVED Banner */}
        {isResolved && (
          <div className="flex items-center justify-between px-4 py-2 bg-emerald-100 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                {t('resolved')}
              </span>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              {t('showMore', { days: daysUntilArchive })}
            </span>
          </div>
        )}

        {/* Status Header Bar */}
        <div className={`flex items-center justify-between px-4 py-2.5 ${
          isResolved
            ? 'bg-neutral-50 dark:bg-neutral-800/50'
            : styles.bgColor
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${
              isResolved
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                : `${styles.iconBg} ${styles.textColor}`
            }`}>
              {styles.icon}
            </div>
            <span className={`font-bold text-sm uppercase tracking-wide ${
              isResolved
                ? 'text-neutral-500 dark:text-neutral-400 line-through'
                : styles.textColor
            }`}>
              {statusLabel}
            </span>
          </div>

          {/* Time Badge */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(route.verified_at || route.updated_at || route.created_at)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Road Name */}
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2 line-clamp-2 leading-tight">
            {route.segment_name}
          </h3>

          {/* Description/Reason */}
          {route.status_reason && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 line-clamp-3 leading-relaxed">
              {route.status_reason}
            </p>
          )}

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-500 mb-4">
            {/* Province */}
            {route.province && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{route.province}</span>
                {route.district && <span className="text-neutral-400">• {route.district}</span>}
              </div>
            )}

            {/* Linked Hazard */}
            {route.hazard_name && (
              <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>{route.hazard_name}</span>
              </div>
            )}

            {/* Risk Score */}
            {route.risk_score !== undefined && route.risk_score > 0 && (
              <div className={`flex items-center gap-1 font-medium ${
                route.risk_score >= 0.7 ? 'text-red-600 dark:text-red-400' :
                route.risk_score >= 0.4 ? 'text-orange-600 dark:text-orange-400' :
                'text-amber-600 dark:text-amber-400'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t('risk')}: {formatRiskScore(route.risk_score)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Directions Button */}
            {hasCoordinates && (
              <button
                onClick={() => setShowDirections(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Navigation className="w-4 h-4" />
                <span>{t('directions')}</span>
              </button>
            )}

            {/* Detail Button */}
            {onDetailClick && (
              <button
                onClick={() => onDetailClick(route)}
                className={`${hasCoordinates ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-xl transition-colors`}
              >
                <span>{t('viewDetail')}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Fallback if no detail handler */}
            {!onDetailClick && !hasCoordinates && (
              <div className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-500 text-sm text-center rounded-xl">
                {t('noGps')}
              </div>
            )}
          </div>
        </div>

        {/* Source Footer */}
        <div className={`px-4 py-2 border-t ${route.source_url ? 'border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50' : 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20'}`}>
          {route.source_url ? (
            <a
              href={route.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{t('source')}: {route.source_domain || route.source}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              <span>{t('noSourceWarning')}</span>
            </p>
          )}
        </div>
      </div>

      {/* Directions Modal */}
      {showDirections && hasCoordinates && (
        <DirectionsModal
          lat={route.lat!}
          lon={route.lon!}
          destinationName={route.segment_name}
          address={[route.district, route.province].filter(Boolean).join(', ')}
          onClose={() => setShowDirections(false)}
        />
      )}
    </>
  )
}
