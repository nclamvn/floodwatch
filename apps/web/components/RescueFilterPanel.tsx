'use client'

import { useState, useEffect } from 'react'
import { X, RotateCcw, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
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

const urgencyOptions = [
  { value: 'critical', label: 'Khẩn cấp', color: 'text-red-700 dark:text-red-400' },
  { value: 'high', label: 'Cao', color: 'text-orange-700 dark:text-orange-400' },
  { value: 'medium', label: 'Trung bình', color: 'text-yellow-700 dark:text-yellow-400' },
  { value: 'low', label: 'Thấp', color: 'text-neutral-700 dark:text-neutral-400' },
]

const needsTypeOptions = [
  { value: 'food', label: 'Thực phẩm' },
  { value: 'water', label: 'Nước uống' },
  { value: 'shelter', label: 'Chỗ ở' },
  { value: 'medical', label: 'Y tế' },
  { value: 'clothing', label: 'Quần áo' },
  { value: 'transport', label: 'Di chuyển' },
  { value: 'other', label: 'Khác' },
]

const requestStatusOptions = [
  { value: 'active', label: 'Đang chờ' },
  { value: 'in_progress', label: 'Đang xử lý' },
]

const serviceTypeOptions = [
  { value: 'rescue', label: 'Cứu hộ' },
  { value: 'transportation', label: 'Vận chuyển' },
  { value: 'medical', label: 'Y tế' },
  { value: 'shelter', label: 'Chỗ ở' },
  { value: 'food_water', label: 'Thực phẩm/Nước' },
  { value: 'supplies', label: 'Vật tư' },
  { value: 'volunteer', label: 'Tình nguyện' },
  { value: 'donation', label: 'Quyên góp' },
  { value: 'other', label: 'Khác' },
]

const offerStatusOptions = [
  { value: 'active', label: 'Sẵn sàng' },
]

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

  const allUrgencySelected = urgencyOptions.every(opt => filters.requestUrgency.includes(opt.value))
  const allNeedsTypeSelected = needsTypeOptions.every(opt => filters.requestNeedsType.includes(opt.value))
  const allServiceTypeSelected = serviceTypeOptions.every(opt => filters.offerServiceType.includes(opt.value))

  const toggleAllUrgency = () => {
    onSetArrayValues('requestUrgency', allUrgencySelected ? [] : urgencyOptions.map(o => o.value))
  }

  const toggleAllNeedsType = () => {
    onSetArrayValues('requestNeedsType', allNeedsTypeSelected ? [] : needsTypeOptions.map(o => o.value))
  }

  const toggleAllServiceType = () => {
    onSetArrayValues('offerServiceType', allServiceTypeSelected ? [] : serviceTypeOptions.map(o => o.value))
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
              Bộ lọc
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex items-center gap-1"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Đặt lại</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title="Đóng"
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
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tên, địa điểm, SĐT..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Radius Slider */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Bán kính: <span className="text-blue-600 dark:text-blue-400 font-bold">{filters.radiusKm}km</span>
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
                Chỉ hiển thị đã xác minh
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
                  Yêu cầu cứu trợ
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
                    Hiển thị yêu cầu
                  </span>
                </label>

                {/* Urgency Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Mức độ khẩn cấp
                    </label>
                    <button
                      onClick={toggleAllUrgency}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {allUrgencySelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {urgencyOptions.map(option => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.requestUrgency.includes(option.value)}
                          onChange={() => onToggleArrayValue('requestUrgency', option.value)}
                          className="w-4 h-4 text-red-600 bg-neutral-100 border-neutral-300 rounded focus:ring-red-500"
                        />
                        <span className={`text-sm ${option.color}`}>
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Needs Type Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Loại nhu cầu
                    </label>
                    <button
                      onClick={toggleAllNeedsType}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {allNeedsTypeSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {needsTypeOptions.map(option => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.requestNeedsType.includes(option.value)}
                          onChange={() => onToggleArrayValue('requestNeedsType', option.value)}
                          className="w-4 h-4 text-red-600 bg-neutral-100 border-neutral-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Request Status */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Trạng thái
                  </label>
                  <div className="space-y-1">
                    {requestStatusOptions.map(option => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.requestStatus.includes(option.value)}
                          onChange={() => onToggleArrayValue('requestStatus', option.value)}
                          className="w-4 h-4 text-red-600 bg-neutral-100 border-neutral-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {option.label}
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
                  Đề nghị hỗ trợ
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
                    Hiển thị đề nghị
                  </span>
                </label>

                {/* Service Type Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Loại dịch vụ
                    </label>
                    <button
                      onClick={toggleAllServiceType}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {allServiceTypeSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {serviceTypeOptions.map(option => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.offerServiceType.includes(option.value)}
                          onChange={() => onToggleArrayValue('offerServiceType', option.value)}
                          className="w-4 h-4 text-green-600 bg-neutral-100 border-neutral-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Offer Status */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Trạng thái
                  </label>
                  <div className="space-y-1">
                    {offerStatusOptions.map(option => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={filters.offerStatus.includes(option.value)}
                          onChange={() => onToggleArrayValue('offerStatus', option.value)}
                          className="w-4 h-4 text-green-600 bg-neutral-100 border-neutral-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Min Capacity */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Sức chứa tối thiểu
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.minCapacity ?? ''}
                    onChange={(e) => onUpdateFilter('minCapacity', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Số người"
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
              Kết quả:
            </span>
            <div className="flex items-center gap-3">
              <span className="font-bold text-red-600 dark:text-red-400">
                {requestsCount} yêu cầu
              </span>
              <span className="text-neutral-400">•</span>
              <span className="font-bold text-green-600 dark:text-green-400">
                {offersCount} đề nghị
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
