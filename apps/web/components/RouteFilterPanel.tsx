'use client'

import { useState } from 'react'
import { Filter, ChevronDown, X, MapPin, Clock, ArrowUpDown, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { RouteStatus } from './RouteCard'

export interface RouteFilters {
  province: string
  status: RouteStatus[]
  hazardType: string
  timeRange: string
  sortBy: 'risk_score' | 'created_at' | 'status'
}

interface RouteFilterPanelProps {
  filters: RouteFilters
  onChange: (filters: RouteFilters) => void
  provinces?: string[]
  isCollapsible?: boolean
  defaultExpanded?: boolean
}

// Vietnamese provinces (Central region focus + major cities)
// First item is 'all' (key for translation), rest are province names
const DEFAULT_PROVINCES = [
  'all',
  'Quảng Bình',
  'Quảng Trị',
  'Thừa Thiên Huế',
  'Đà Nẵng',
  'Quảng Nam',
  'Quảng Ngãi',
  'Bình Định',
  'Phú Yên',
  'Khánh Hòa',
  'Ninh Thuận',
  'Bình Thuận',
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Hải Phòng',
  'Cần Thơ'
]

// Status options for multi-select (keys for translations)
const STATUS_OPTIONS: { value: RouteStatus; key: string; color: string }[] = [
  { value: 'OPEN', key: 'open', color: 'bg-emerald-500' },
  { value: 'LIMITED', key: 'limited', color: 'bg-amber-500' },
  { value: 'DANGEROUS', key: 'dangerous', color: 'bg-orange-500' },
  { value: 'CLOSED', key: 'closed', color: 'bg-red-500' }
]

// Hazard type options (keys for translations)
const HAZARD_OPTIONS = ['', 'flood', 'storm', 'landslide', 'other']

// Time range options (keys for translations)
const TIME_OPTIONS = ['', '6h', '12h', '24h', '48h', '7d']

// Sort options (keys for translations)
const SORT_OPTIONS: RouteFilters['sortBy'][] = ['risk_score', 'created_at', 'status']

export default function RouteFilterPanel({
  filters,
  onChange,
  provinces = DEFAULT_PROVINCES,
  isCollapsible = true,
  defaultExpanded = true
}: RouteFilterPanelProps) {
  const t = useTranslations('routeFilter')
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Count active filters
  const activeFilterCount = [
    filters.province !== 'all' && filters.province !== '',
    filters.status.length > 0 && filters.status.length < 4,
    filters.hazardType !== '',
    filters.timeRange !== ''
  ].filter(Boolean).length

  // Update a single filter
  const updateFilter = <K extends keyof RouteFilters>(key: K, value: RouteFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  // Toggle status in multi-select
  const toggleStatus = (status: RouteStatus) => {
    const currentStatuses = filters.status
    if (currentStatuses.includes(status)) {
      updateFilter('status', currentStatuses.filter(s => s !== status))
    } else {
      updateFilter('status', [...currentStatuses, status])
    }
  }

  // Clear all filters
  const clearFilters = () => {
    onChange({
      province: 'all',
      status: [],
      hazardType: '',
      timeRange: '',
      sortBy: 'risk_score'
    })
  }

  // Helper to get province display name
  const getProvinceLabel = (p: string) => p === 'all' ? t('all') : p

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
      {/* Header - Always visible */}
      <button
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 ${
          isCollapsible ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50' : ''
        } transition-colors`}
        disabled={!isCollapsible}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
            {t('title')}
          </span>

          {/* Active filter badge */}
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Clear all button */}
          {activeFilterCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearFilters()
              }}
              className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              {t('clear')}
            </button>
          )}

          {/* Expand/Collapse icon */}
          {isCollapsible && (
            <ChevronDown
              className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </button>

      {/* Filter Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Province Filter */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                <MapPin className="w-3.5 h-3.5" />
                {t('province')}
              </label>
              <select
                value={filters.province}
                onChange={(e) => updateFilter('province', e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {provinces.map(p => (
                  <option key={p} value={p}>{getProvinceLabel(p)}</option>
                ))}
              </select>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                <Clock className="w-3.5 h-3.5" />
                {t('timeRange')}
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => updateFilter('timeRange', e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {TIME_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt === '' ? t('all') : t(`timeOptions.${opt}`)}</option>
                ))}
              </select>
            </div>

            {/* Hazard Type Filter */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                <Zap className="w-3.5 h-3.5" />
                {t('hazardType')}
              </label>
              <select
                value={filters.hazardType}
                onChange={(e) => updateFilter('hazardType', e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {HAZARD_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt === '' ? t('all') : t(`hazardOptions.${opt}`)}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                <ArrowUpDown className="w-3.5 h-3.5" />
                {t('sortBy')}
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value as RouteFilters['sortBy'])}
                className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{t(`sortOptions.${opt}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Multi-Select (below the grid) */}
          <div className="mt-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
              {t('status')}
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => {
                const isSelected = filters.status.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleStatus(opt.value)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all
                      ${isSelected
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }
                    `}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                    {t(`statusOptions.${opt.key}`)}
                    {isSelected && <X className="w-3.5 h-3.5" />}
                  </button>
                )
              })}

              {/* Select/Deselect all */}
              {filters.status.length > 0 && filters.status.length < 4 && (
                <button
                  onClick={() => updateFilter('status', [])}
                  className="px-3 py-2 rounded-xl text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
