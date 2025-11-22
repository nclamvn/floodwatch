'use client'

import { useState, useEffect } from 'react'
import { useLocation } from '@/contexts/LocationContext'
import { Siren, Check, AlertTriangle, Ambulance, Baby, User } from 'lucide-react'

interface ReportDistressFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (trackingCode: string) => void
}

export default function ReportDistressForm({ isOpen, onClose, onSuccess }: ReportDistressFormProps) {
  const { userLocation } = useLocation()

  const [formData, setFormData] = useState({
    lat: userLocation?.latitude || 0,
    lon: userLocation?.longitude || 0,
    urgency: 'high' as 'critical' | 'high' | 'medium' | 'low',
    description: '',
    num_people: 1,
    has_injuries: false,
    has_children: false,
    has_elderly: false,
    contact_name: '',
    contact_phone: '',
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
      const response = await fetch(`${apiUrl}/distress`, {
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
      setSuccess(`Báo cáo đã được tiếp nhận! Mã theo dõi: ${result.meta.tracking_code}`)

      if (onSuccess) {
        onSuccess(result.meta.tracking_code)
      }

      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          lat: userLocation?.latitude || 0,
          lon: userLocation?.longitude || 0,
          urgency: 'high',
          description: '',
          num_people: 1,
          has_injuries: false,
          has_children: false,
          has_elderly: false,
          contact_name: '',
          contact_phone: '',
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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500'
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500'
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500'
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
          className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-white/30 dark:border-neutral-700/30 rounded-2xl shadow-lg max-w-2xl w-full max-h-[85vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-neutral-200/50 dark:border-neutral-700 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                  <Siren className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Báo cáo tình huống khẩn cấp
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Điền thông tin để yêu cầu hỗ trợ khẩn cấp
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="ml-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-neutral-800 active:bg-gray-300 dark:active:bg-neutral-700 transition-colors text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white"
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
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">{success}</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">{error}</span>
                </div>
              </div>
            )}

            {/* Urgency level */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-3">
                Mức độ khẩn cấp *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['critical', 'high', 'medium', 'low'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, urgency: level })}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                      formData.urgency === level
                        ? getUrgencyColor(level)
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-400 border-gray-300 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-600'
                    }`}
                  >
                    {level === 'critical' && 'Nguy hiểm nghiêm trọng'}
                    {level === 'high' && 'Khẩn cấp'}
                    {level === 'medium' && 'Cần hỗ trợ'}
                    {level === 'low' && 'Không khẩn cấp'}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                Mô tả tình huống *
              </label>
              <textarea
                required
                minLength={10}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="Ví dụ: Nhà bị ngập sâu 1.5m, không thể di chuyển, cần cứu hộ khẩn cấp..."
              />
            </div>

            {/* Number of people */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                Số người cần hỗ trợ
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.num_people}
                onChange={(e) => setFormData({ ...formData, num_people: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Priority checkboxes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-3">
                Thông tin ưu tiên
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.has_injuries}
                    onChange={(e) => setFormData({ ...formData, has_injuries: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-0"
                  />
                  <Ambulance className="w-5 h-5 text-red-500" />
                  <span className="text-gray-900 dark:text-white group-hover:text-red-500 transition-colors">
                    Có người bị thương
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.has_children}
                    onChange={(e) => setFormData({ ...formData, has_children: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <Baby className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                    Có trẻ em
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.has_elderly}
                    onChange={(e) => setFormData({ ...formData, has_elderly: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0"
                  />
                  <User className="w-5 h-5 text-purple-500" />
                  <span className="text-gray-900 dark:text-white group-hover:text-purple-500 transition-colors">
                    Có người già
                  </span>
                </label>
              </div>
            </div>

            {/* Contact info */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                  Tên liên hệ
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tùy chọn"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  pattern="0\d{9}"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ví dụ: 0901234567"
                />
              </div>
            </div>

            {/* Location info */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                Vị trí hiện tại
              </label>
              <div className="px-4 py-3 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white font-mono text-sm">
                {formData.lat.toFixed(6)}, {formData.lon.toFixed(6)}
              </div>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
                Vị trí được lấy tự động từ thiết bị của bạn
              </p>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-neutral-200/50 dark:border-neutral-700 flex items-center justify-between bg-gray-50/50 dark:bg-neutral-900/50">
            <p className="text-sm text-gray-600 dark:text-neutral-400">
              Số khẩn cấp: <span className="font-semibold text-gray-900 dark:text-white">113, 114, 115</span>
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.description || formData.description.length < 10}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    <Siren className="w-5 h-5" />
                    <span>Gửi yêu cầu khẩn cấp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
