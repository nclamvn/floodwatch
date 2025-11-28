'use client'

import { RefreshCw, Route, ShieldCheck, AlertTriangle, ShieldAlert, ShieldX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { RouteStatus } from './RouteCard'

export interface RouteSummary {
  total: number
  by_status: Record<RouteStatus, number>
  last_updated?: string
}

interface RouteSummaryBarProps {
  summary: RouteSummary | null
  isLoading?: boolean
  onStatusClick?: (status: RouteStatus | null) => void
  activeStatus?: RouteStatus | null
  onRefresh?: () => void
}

// Status configuration for summary cards (styling only - labels come from translations)
const STATUS_CARDS: {
  status: RouteStatus
  key: string
  bgColor: string
  bgColorActive: string
  textColor: string
  borderColor: string
  icon: React.ReactNode
}[] = [
  {
    status: 'OPEN',
    key: 'open',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
    bgColorActive: 'bg-emerald-200 dark:bg-emerald-800/50 ring-2 ring-emerald-500',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: <ShieldCheck className="w-5 h-5" />
  },
  {
    status: 'LIMITED',
    key: 'limited',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40',
    bgColorActive: 'bg-amber-200 dark:bg-amber-800/50 ring-2 ring-amber-500',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: <AlertTriangle className="w-5 h-5" />
  },
  {
    status: 'DANGEROUS',
    key: 'dangerous',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/40',
    bgColorActive: 'bg-orange-200 dark:bg-orange-800/50 ring-2 ring-orange-500',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: <ShieldAlert className="w-5 h-5" />
  },
  {
    status: 'CLOSED',
    key: 'closed',
    bgColor: 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40',
    bgColorActive: 'bg-red-200 dark:bg-red-800/50 ring-2 ring-red-500',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: <ShieldX className="w-5 h-5" />
  }
]

export default function RouteSummaryBar({
  summary,
  isLoading,
  onStatusClick,
  activeStatus,
  onRefresh
}: RouteSummaryBarProps) {
  const t = useTranslations('routeSummary')

  const handleStatusClick = (status: RouteStatus) => {
    if (!onStatusClick) return

    // Toggle: if clicking active status, clear filter
    if (activeStatus === status) {
      onStatusClick(null)
    } else {
      onStatusClick(status)
    }
  }

  // Format relative time with translations
  const formatLastUpdate = (dateString?: string): string => {
    if (!dateString) return t('updating')

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 1) return t('justNow')
    if (diffMinutes < 60) return t('minutesAgo', { count: diffMinutes })

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return t('hoursAgo', { count: diffHours })

    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
            {t('title')}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Last Updated */}
          <span className="text-xs text-neutral-500 dark:text-neutral-500">
            {t('updated')}: {formatLastUpdate(summary?.last_updated)}
          </span>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              title={t('refresh')}
            >
              <RefreshCw className={`w-4 h-4 text-neutral-500 dark:text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Status Cards Grid */}
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STATUS_CARDS.map(card => {
            const count = summary?.by_status?.[card.status] ?? 0
            const isActive = activeStatus === card.status
            const isClickable = !!onStatusClick

            return (
              <button
                key={card.status}
                onClick={() => handleStatusClick(card.status)}
                disabled={!isClickable || isLoading}
                className={`
                  relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200
                  ${isActive ? card.bgColorActive : card.bgColor}
                  ${card.borderColor}
                  ${isClickable && !isLoading ? 'cursor-pointer' : 'cursor-default'}
                  ${isLoading ? 'opacity-60' : ''}
                `}
              >
                {/* Icon */}
                <div className={`mb-1 ${card.textColor}`}>
                  {card.icon}
                </div>

                {/* Count */}
                <span className={`text-2xl font-bold ${card.textColor}`}>
                  {isLoading ? '-' : count}
                </span>

                {/* Label */}
                <span className={`text-xs font-medium ${card.textColor} opacity-80`}>
                  <span className="hidden sm:inline">{t(`status.${card.key}`)}</span>
                  <span className="sm:hidden">{t(`status.${card.key}Short`)}</span>
                </span>

                {/* Active indicator */}
                {isActive && (
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                    card.status === 'OPEN' ? 'bg-emerald-500' :
                    card.status === 'LIMITED' ? 'bg-amber-500' :
                    card.status === 'DANGEROUS' ? 'bg-orange-500' :
                    'bg-red-500'
                  } ring-2 ring-white dark:ring-neutral-900`} />
                )}
              </button>
            )
          })}
        </div>

        {/* Total Count */}
        <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('total')}:
          </span>
          <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {isLoading ? '...' : (summary?.total ?? 0)}
          </span>
          <span className="text-sm text-neutral-500 dark:text-neutral-500">
            {t('routes')}
          </span>

          {/* Clear filter button */}
          {activeStatus && onStatusClick && (
            <button
              onClick={() => onStatusClick(null)}
              className="ml-3 px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 rounded-lg transition-colors"
            >
              {t('clearFilter')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
