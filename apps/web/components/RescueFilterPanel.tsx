'use client'

import { useState, useEffect } from 'react'
import { X, RotateCcw, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { RescueFilters } from '@/hooks/useRescueFilters'

interface RescueFilterPanelProps {
  filters: RescueFilters
  onUpdateFilter: <K extends keyof RescueFilters>(key: K, value: RescueFilters[K]) => void
  onToggleArrayValue: <K extends keyof RescueFilters>(key: K, value: string) => void
  onSetArrayValues: <K extends keyof RescueFilters>(key: K, values: string[]) => void
  onReset: () => void
  onClose: () => void
  requestsCount: number
  offersCount: number
}

// Values only - labels will come from translations
const urgencyValues = ['critical', 'high', 'medium', 'low']
const urgencyColors: Record<string, string> = {
  critical: 'text-red-700 dark:text-red-400',
  high: 'text-orange-700 dark:text-orange-400',
  medium: 'text-yellow-700 dark:text-yellow-400',
  low: 'text-neutral-700 dark:text-neutral-400',
}
const needsTypeValues = ['food', 'water', 'shelter', 'medical', 'clothing', 'transport', 'other']
const requestStatusValues = ['active', 'in_progress', 'fulfilled', 'expired', 'cancelled']
const serviceTypeValues = ['rescue', 'transportation', 'medical', 'shelter', 'food_water', 'supplies', 'volunteer', 'donation', 'other']
const offerStatusValues = ['active', 'in_progress', 'fulfilled', 'cancelled']

/**
 * RescueFilterPanel Component
 *
 * Comprehensive filter panel for rescue map with:
 * - Search functionality
 * - Radius slider
 * - Multi-select dropdowns for urgency, needs, service types
 * - Toggle switches
 * - Mobile responsive (bottom sheet)
 */
export default function RescueFilterPanel({
  filters,
  onUpdateFilter,
  onToggleArrayValue,
  onSetArrayValues,
  onReset,
  onClose,
  requestsCount,
  offersCount,
}: RescueFilterPanelProps) {
  const t = useTranslations('rescueFilter')
  const [searchInput, setSearchInput] = useState(filters.searchQuery)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    requests: true,
    offers: true,
  })

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdateFilter('searchQuery', searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, onUpdateFilter])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const allUrgencySelected = urgencyValues.every(val => filters.requestUrgency.includes(val))
  const allNeedsTypeSelected = needsTypeValues.every(val => filters.requestNeedsType.includes(val))
  const allServiceTypeSelected = serviceTypeValues.every(val => filters.offerServiceType.includes(val))

  const toggleAllUrgency = () => {
    onSetArrayValues('requestUrgency', allUrgencySelected ? [] : urgencyValues)
  }

  const toggleAllNeedsType = () => {
    onSetArrayValues('requestNeedsType', allNeedsTypeSelected ? [] : needsTypeValues)
  }

  const toggleAllServiceType = () => {
    onSetArrayValues('offerServiceType', allServiceTypeSelected ? [] : serviceTypeValues)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Filter Panel */}
      <div className="fixed top-24 left-4 w-[360px] max-h-[calc(100vh-120px)] z-50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden lg:flex lg:flex-col max-lg:inset-x-0 max-lg:top-auto max-lg:bottom-0 max-lg:left-0 max-lg:w-full max-lg:max-h-[85vh] max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-blue-50 to-neutral-50 dark:from-blue-950 dark:to-neutral-950">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              {t('title')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex items-center gap-1"
              title={t('resetFilters')}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reset')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title={t('close')}
            >
              <X className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Search Box */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('search')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Radius Slider */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('radius')}: <span className="text-blue-600 dark:text-blue-400 font-bold">{filters.radiusKm}km</span>
            </label>
            <input
              type="range"
              min="5"
              max="200"
              step="5"
              value={filters.radiusKm}
              onChange={(e) => onUpdateFilter('radiusKm', parseInt(e.target.value))}
              className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              <span>5km</span>
              <span>200km</span>
            </div>
          </div>

          {/* Verified Only Checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.verifiedOnly}
                onChange={(e) => onUpdateFilter('verifiedOnly', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-neutral-100 border-neutral-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-neutral-800 focus:ring-2 dark:bg-neutral-700 dark:border-neutral-600"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {t('verifiedOnly')}
              </span>
            </label>
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-200 dark:border-neutral-700" />

          {/* Requests Section */}
          <div>
            <button
              onClick={() => toggleSection('requests')}
              className="w-full flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                  {t('requestsSection')}
                </span>
              </div>
              {expandedSections.requests ? (
                <ChevronUp className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              )}
            </button>

            {expandedSections.requests && (
              <div className="mt-3 space-y-3 pl-2">
                {/* Show Requests Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showRequests}
                    onChange={(e) => onUpdateFilter('showRequests', e.target.checked)}
                    className="w-4 h-4 text-red-600 bg-neutral-100 border-neutral-300 rounded focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('showRequests')}
                  </span>
                </label>

                {/* Urgency Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('urgencyLevel')}
                    </label>
                    <button
                      onClick={toggleAllUrgency}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {allUrgencySelected ? t('deselectAll') : t('selectAll')}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {urgencyValues.map(value => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.requestUrgency.includes(value)}
                          onChange={() => onToggleArrayValue('requestUrgency', value)}
                          className="w-4 h-4 text-red-600 bg-neutral-100 border-neutral-300 rounded focus:ring-red-500"
                        />
                        <span className={`text-sm ${urgencyColors[value]}`}>
                          {t(`urgency.${value}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Needs Type Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('needsType')}
                    </label>
                    <button
                      onClick={toggleAllNeedsType}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {allNeedsTypeSelected ? t('deselectAll') : t('selectAll')}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {needsTypeValues.map(value => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.requestNeedsType.includes(value)}
                          onChange={() => onToggleArrayValue('requestNeedsType', value)}
                          className="w-4 h-4 text-red-600 bg-neutral-100 border-neutral-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {t(`needs.${value}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Request Status */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('status')}
                  </label>
                  <div className="space-y-1">
                    {requestStatusValues.map(value => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.requestStatus.includes(value)}
                          onChange={() => onToggleArrayValue('requestStatus', value)}
                          className="w-4 h-4 text-red-600 bg-neutral-100 border-neutral-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {t(`requestStatus.${value}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-200 dark:border-neutral-700" />

          {/* Offers Section */}
          <div>
            <button
              onClick={() => toggleSection('offers')}
              className="w-full flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                  {t('offersSection')}
                </span>
              </div>
              {expandedSections.offers ? (
                <ChevronUp className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              )}
            </button>

            {expandedSections.offers && (
              <div className="mt-3 space-y-3 pl-2">
                {/* Show Offers Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showOffers}
                    onChange={(e) => onUpdateFilter('showOffers', e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-neutral-100 border-neutral-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('showOffers')}
                  </span>
                </label>

                {/* Service Type Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('serviceType')}
                    </label>
                    <button
                      onClick={toggleAllServiceType}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {allServiceTypeSelected ? t('deselectAll') : t('selectAll')}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {serviceTypeValues.map(value => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.offerServiceType.includes(value)}
                          onChange={() => onToggleArrayValue('offerServiceType', value)}
                          className="w-4 h-4 text-green-600 bg-neutral-100 border-neutral-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {t(`services.${value}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Offer Status */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('status')}
                  </label>
                  <div className="space-y-1">
                    {offerStatusValues.map(value => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.offerStatus.includes(value)}
                          onChange={() => onToggleArrayValue('offerStatus', value)}
                          className="w-4 h-4 text-green-600 bg-neutral-100 border-neutral-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {t(`offerStatus.${value}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Min Capacity */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('minCapacity')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.minCapacity ?? ''}
                    onChange={(e) => onUpdateFilter('minCapacity', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder={t('capacityPlaceholder')}
                    className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Results Count */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400 font-medium">
              {t('results')}:
            </span>
            <div className="flex items-center gap-3">
              <span className="font-bold text-red-600 dark:text-red-400">
                {requestsCount} {t('requestsSection').toLowerCase()}
              </span>
              <span className="text-neutral-400">•</span>
              <span className="font-bold text-green-600 dark:text-green-400">
                {offersCount} {t('offersSection').toLowerCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile slide-up animation */}
        <style jsx>{`
          @keyframes slide-up {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
          .animate-slide-up {
            animation: slide-up 0.3s ease-out;
          }
        `}</style>
      </div>
    </>
  )
}
