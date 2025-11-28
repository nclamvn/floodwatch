'use client'

import { useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import ImageUpload from '@/components/ImageUpload'
import DistressSubmitSuccessModal from '@/components/DistressSubmitSuccessModal'

interface FormData {
  urgency: 'critical' | 'high' | 'medium' | 'low'
  description: string
  lat: number | null
  lon: number | null
  num_people: number
  has_injuries: boolean
  has_children: boolean
  has_elderly: boolean
  contact_name: string
  contact_phone: string
  media_urls: string[]
}

interface SubmitResult {
  reportId: string
  trackingCode: string
}

export default function ReportPage() {
  const t = useTranslations('report')
  const [formData, setFormData] = useState<FormData>({
    urgency: 'high',
    description: '',
    lat: null,
    lon: null,
    num_people: 1,
    has_injuries: false,
    has_children: false,
    has_elderly: false,
    contact_name: '',
    contact_phone: '',
    media_urls: []
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'

  // Cloudinary config (use unsigned upload for simplicity)
  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo'
  const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset'

  const getLocation = () => {
    setGettingLocation(true)
    setError(null)

    if (!navigator.geolocation) {
      setError(t('browserNotSupported'))
      setGettingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }))
        setGettingLocation(false)
      },
      (err) => {
        setError(t('geoError') + ': ' + err.message)
        setGettingLocation(false)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (!formData.description.trim() || formData.description.length < 10) {
      setError(t('validation.descriptionRequired') || 'Mô tả phải có ít nhất 10 ký tự')
      setLoading(false)
      return
    }

    if (formData.lat === null || formData.lon === null) {
      setError(t('validation.locationRequired') || 'Vui lòng lấy vị trí của bạn')
      setLoading(false)
      return
    }

    try {
      const payload = {
        lat: formData.lat,
        lon: formData.lon,
        urgency: formData.urgency,
        description: formData.description,
        num_people: formData.num_people,
        has_injuries: formData.has_injuries,
        has_children: formData.has_children,
        has_elderly: formData.has_elderly,
        contact_name: formData.contact_name || undefined,
        contact_phone: formData.contact_phone || undefined,
        media_urls: formData.media_urls.length > 0 ? formData.media_urls : undefined
      }

      const response = await axios.post(`${API_URL}/distress`, payload)

      // Extract tracking code from response
      const reportId = response.data.data.id
      const trackingCode = response.data.meta.tracking_code

      setSubmitResult({ reportId, trackingCode })
      setShowSuccessModal(true)

      // Reset form
      setFormData({
        urgency: 'high',
        description: '',
        lat: null,
        lon: null,
        num_people: 1,
        has_injuries: false,
        has_children: false,
        has_elderly: false,
        contact_name: '',
        contact_phone: '',
        media_urls: []
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Có lỗi xảy ra khi gửi báo cáo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      {/* Success Modal */}
      {submitResult && (
        <DistressSubmitSuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          trackingCode={submitResult.trackingCode}
          reportId={submitResult.reportId}
        />
      )}

      {/* Header - Modern pill style */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-slate-200 dark:border-neutral-800 shadow-soft">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-error-500 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-neutral-50">
              {t('title') || 'Báo cáo cần cứu hộ'}
            </h1>
          </div>
          <Link
            href="/map"
            className="px-4 py-2 bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-neutral-100 rounded-full text-sm font-medium transition-colors"
          >
            ← {t('backToMap') || 'Về bản đồ'}
          </Link>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-soft-lg p-6 md:p-8 border border-slate-200 dark:border-neutral-800">
          {/* Emergency Banner */}
          <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-xl border border-error-200 dark:border-error-700/30">
            <p className="font-semibold">🆘 Đây là form báo cáo khẩn cấp cần cứu hộ</p>
            <p className="text-sm mt-1">Nếu bạn đang trong tình trạng nguy hiểm, hãy gọi <strong>113</strong> hoặc <strong>114</strong> ngay lập tức.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-xl border border-error-200 dark:border-error-700/30">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Urgency Level */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Mức độ khẩn cấp *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { value: 'critical', label: '🔴 Nguy kịch', color: 'bg-error-100 dark:bg-error-900/40 border-error-300 dark:border-error-700 text-error-700 dark:text-error-400' },
                  { value: 'high', label: '🟠 Cao', color: 'bg-warning-100 dark:bg-warning-900/40 border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-400' },
                  { value: 'medium', label: '🟡 Trung bình', color: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400' },
                  { value: 'low', label: '🟢 Thấp', color: 'bg-success-100 dark:bg-success-900/40 border-success-300 dark:border-success-700 text-success-700 dark:text-success-400' }
                ].map((urgency) => (
                  <button
                    key={urgency.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, urgency: urgency.value as FormData['urgency'] }))}
                    className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.urgency === urgency.value
                        ? `${urgency.color} ring-2 ring-offset-2 ring-neutral-400`
                        : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    {urgency.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Mô tả tình huống *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-shadow resize-none"
                rows={4}
                placeholder="Mô tả chi tiết tình huống của bạn: nước ngập đến đâu, địa chỉ cụ thể, tình trạng sức khỏe..."
                required
              />
              <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">
                Tối thiểu 10 ký tự. Càng chi tiết càng tốt để lực lượng cứu hộ hỗ trợ nhanh chóng.
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Vị trí của bạn *
              </label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={getLocation}
                  disabled={gettingLocation}
                  className="w-full px-4 py-3 bg-neutral-600 hover:bg-neutral-700 active:bg-neutral-800 text-white rounded-xl font-medium shadow-sm hover:shadow-md transition-all disabled:bg-neutral-400 disabled:cursor-not-allowed"
                >
                  {gettingLocation ? '⏳ Đang lấy vị trí...' : '📍 Lấy vị trí hiện tại'}
                </button>

                {formData.lat !== null && formData.lon !== null && (
                  <div className="p-3 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded-xl text-sm border border-success-200 dark:border-success-700/30">
                    ✓ Đã có vị trí: {formData.lat.toFixed(5)}, {formData.lon.toFixed(5)}
                  </div>
                )}
              </div>
            </div>

            {/* Number of People */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Số người cần cứu hộ *
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, num_people: Math.max(1, prev.num_people - 1) }))}
                  className="w-10 h-10 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-lg text-lg font-bold transition-colors"
                >
                  -
                </button>
                <span className="w-16 text-center text-xl font-bold text-slate-900 dark:text-neutral-100">
                  {formData.num_people}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, num_people: prev.num_people + 1 }))}
                  className="w-10 h-10 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-lg text-lg font-bold transition-colors"
                >
                  +
                </button>
                <span className="text-sm text-slate-500 dark:text-neutral-500">người</span>
              </div>
            </div>

            {/* Special Conditions */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-3">
                Tình trạng đặc biệt
              </label>
              <div className="space-y-3">
                {[
                  { key: 'has_injuries', label: '🏥 Có người bị thương', desc: 'Cần hỗ trợ y tế' },
                  { key: 'has_children', label: '👶 Có trẻ em', desc: 'Dưới 12 tuổi' },
                  { key: 'has_elderly', label: '👴 Có người già', desc: 'Trên 65 tuổi' }
                ].map((condition) => (
                  <label
                    key={condition.key}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      formData[condition.key as keyof FormData]
                        ? 'bg-warning-50 dark:bg-warning-900/30 border-warning-300 dark:border-warning-700'
                        : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData[condition.key as keyof FormData] as boolean}
                      onChange={(e) => setFormData(prev => ({ ...prev, [condition.key]: e.target.checked }))}
                      className="w-5 h-5 rounded border-slate-300 dark:border-neutral-600 text-warning-600 focus:ring-warning-500"
                    />
                    <div>
                      <span className="font-medium text-slate-900 dark:text-neutral-100">{condition.label}</span>
                      <span className="text-xs text-slate-500 dark:text-neutral-500 ml-2">{condition.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                  Tên liên hệ
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-shadow"
                  placeholder="Họ tên người cần cứu"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-shadow"
                  placeholder="0xxx xxx xxx"
                />
              </div>
            </div>

            {/* Media Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Hình ảnh / Video
              </label>
              <ImageUpload
                onUploadComplete={(urls) => setFormData(prev => ({ ...prev, media_urls: urls }))}
                maxImages={3}
                cloudName={CLOUDINARY_CLOUD_NAME}
                uploadPreset={CLOUDINARY_UPLOAD_PRESET}
              />
              <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">
                Tối đa 3 ảnh/video. Giúp lực lượng cứu hộ đánh giá tình hình.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-error-600 hover:bg-error-700 active:bg-error-800 text-white text-lg font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:bg-neutral-400 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Đang gửi...' : '🆘 GỬI YÊU CẦU CỨU HỘ'}
            </button>
          </form>

          {/* Help text */}
          <div className="mt-8 p-5 bg-info-50 dark:bg-info-900/20 rounded-xl border border-info-200 dark:border-info-700/30">
            <p className="text-sm font-bold text-info-900 dark:text-info-100 mb-3">
              📞 Liên hệ khẩn cấp:
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <a href="tel:113" className="p-2 bg-error-100 dark:bg-error-900/40 text-error-700 dark:text-error-400 rounded-lg font-bold">
                113<br /><span className="text-xs font-normal">Công an</span>
              </a>
              <a href="tel:114" className="p-2 bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-400 rounded-lg font-bold">
                114<br /><span className="text-xs font-normal">Cứu hỏa</span>
              </a>
              <a href="tel:115" className="p-2 bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-400 rounded-lg font-bold">
                115<br /><span className="text-xs font-normal">Cấp cứu</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
