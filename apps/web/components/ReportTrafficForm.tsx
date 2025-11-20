'use client'

import { useState, useEffect } from 'react'
import { useLocation } from '@/contexts/LocationContext'

interface ReportTrafficFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ReportTrafficForm({ isOpen, onClose, onSuccess }: ReportTrafficFormProps) {
  const { userLocation } = useLocation()

  const [formData, setFormData] = useState({
    lat: userLocation?.latitude || 0,
    lon: userLocation?.longitude || 0,
    type: 'flooded_road' as 'flooded_road' | 'landslide' | 'bridge_collapsed' | 'bridge_flooded' | 'traffic_jam' | 'road_damaged' | 'blocked',
    severity: 'dangerous' as 'impassable' | 'dangerous' | 'slow' | 'warning',
    road_name: '',
    location_description: '',
    description: '',
    estimated_clearance: '',
    alternative_route: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Update location when user location changes
  useEffect(() => {
    if (userLocation) {
      setFormData((prev) => ({
        ...prev,
        lat: userLocation.latitude,
        lon: userLocation.longitude,
      }))
    }
  }, [userLocation])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/traffic/disruptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Không thể gửi báo cáo')
      }

      const result = await response.json()
      setSuccess('Cảm ơn bạn đã báo cáo! Thông tin sẽ giúp người khác tránh nguy hiểm.')

      if (onSuccess) {
        onSuccess()
      }

      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          lat: userLocation?.latitude || 0,
          lon: userLocation?.longitude || 0,
          type: 'flooded_road',
          severity: 'dangerous',
          road_name: '',
          location_description: '',
          description: '',
          estimated_clearance: '',
          alternative_route: '',
        })
        setSuccess(null)
        onClose()
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'impassable': return 'bg-red-500/20 text-red-400 border-red-500'
      case 'dangerous': return 'bg-orange-500/20 text-orange-400 border-orange-500'
      case 'slow': return 'bg-amber-500/20 text-amber-400 border-amber-500'
      case 'warning': return 'bg-blue-500/20 text-blue-400 border-blue-500'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flooded_road': return '🌊'
      case 'landslide': return '⛰️'
      case 'bridge_collapsed': return '🌉💥'
      case 'bridge_flooded': return '🌉🌊'
      case 'traffic_jam': return '🚗'
      case 'road_damaged': return '🚧'
      case 'blocked': return '⛔'
      default: return '🚧'
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-[#171717] border border-neutral-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-neutral-700 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🚧</span>
                <h2 className="text-xl font-bold text-white">
                  Báo cáo tình trạng giao thông
                </h2>
              </div>
              <p className="text-sm text-neutral-400">
                Giúp cộng đồng biết về đường bị ngập, sạt lở, ùn tắc
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="ml-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-400 hover:text-white"
              aria-label="Đóng"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 overflow-y-auto max-h-[calc(85vh-180px)] custom-scrollbar">
            {/* Success message */}
            {success && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span className="font-semibold">{success}</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
                <div className="flex items-center gap-2">
                  <span>⚠</span>
                  <span className="font-semibold">{error}</span>
                </div>
              </div>
            )}

            {/* Disruption type */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                Loại sự cố *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'flooded_road', label: 'Đường ngập' },
                  { value: 'landslide', label: 'Sạt lở' },
                  { value: 'bridge_collapsed', label: 'Cầu sập' },
                  { value: 'bridge_flooded', label: 'Cầu ngập' },
                  { value: 'road_damaged', label: 'Đường hư hỏng' },
                  { value: 'blocked', label: 'Đường bị chặn' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: option.value })}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all flex items-center gap-2 ${
                      formData.type === option.value
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <span>{getTypeIcon(option.value)}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Severity level */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                Mức độ nghiêm trọng *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'impassable', label: 'Không thể đi qua' },
                  { value: 'dangerous', label: 'Nguy hiểm' },
                  { value: 'slow', label: 'Chậm chạp' },
                  { value: 'warning', label: 'Cảnh báo' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, severity: option.value })}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      formData.severity === option.value
                        ? getSeverityColor(option.value)
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Road name */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Tên đường
              </label>
              <input
                type="text"
                value={formData.road_name}
                onChange={(e) => setFormData({ ...formData, road_name: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ví dụ: QL1A, DT652, Đường Lê Lợi..."
              />
            </div>

            {/* Location description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Mô tả vị trí *
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={formData.location_description}
                onChange={(e) => setFormData({ ...formData, location_description: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ví dụ: Gần ngã tư Bưu điện, đoạn Km15..."
              />
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Chi tiết
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Thông tin thêm về tình trạng đường..."
              />
            </div>

            {/* Estimated clearance */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Dự kiến thông tuyến
              </label>
              <input
                type="text"
                value={formData.estimated_clearance}
                onChange={(e) => setFormData({ ...formData, estimated_clearance: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ví dụ: 2-3 ngày, 1 tuần, chưa rõ..."
              />
            </div>

            {/* Alternative route */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Đường thay thế
              </label>
              <textarea
                value={formData.alternative_route}
                onChange={(e) => setFormData({ ...formData, alternative_route: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
                placeholder="Ví dụ: Có thể đi qua QL20 hoặc qua xã X..."
              />
            </div>

            {/* Location info */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Vị trí hiện tại
              </label>
              <div className="px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white font-mono text-sm">
                {formData.lat.toFixed(6)}, {formData.lon.toFixed(6)}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Vị trí được lấy tự động từ thiết bị của bạn
              </p>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-neutral-700 flex items-center justify-end gap-3 bg-neutral-900/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.location_description || formData.location_description.length < 5}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <span>🚧</span>
                  <span>Gửi báo cáo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
