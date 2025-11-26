'use client'

import { useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import ImageUpload from '@/components/ImageUpload'

interface FormData {
  type: 'SOS' | 'ROAD' | 'NEEDS'
  text: string
  lat: number | null
  lon: number | null
  province: string
  district: string
  ward: string
  media: string[]
}

export default function ReportPage() {
  const [formData, setFormData] = useState<FormData>({
    type: 'SOS',
    text: '',
    lat: null,
    lon: null,
    province: '',
    district: '',
    ward: '',
    media: []
  })

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Cloudinary config (use unsigned upload for simplicity)
  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo'
  const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset'

  const provinces = [
    'Quảng Bình',
    'Quảng Trị',
    'Thừa Thiên Huế',
    'Đà Nẵng',
    'Quảng Nam',
    'Quảng Ngãi',
    'Bình Định',
    'Phú Yên',
    'Khánh Hòa'
  ]

  const getLocation = () => {
    setGettingLocation(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị')
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
        setError('Không thể lấy vị trí: ' + err.message)
        setGettingLocation(false)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    // Validation
    if (!formData.text.trim()) {
      setError('Vui lòng nhập mô tả')
      setLoading(false)
      return
    }

    if (!formData.province) {
      setError('Vui lòng chọn tỉnh')
      setLoading(false)
      return
    }

    if (formData.lat === null || formData.lon === null) {
      setError('Vui lòng cung cấp vị trí (bấm nút "Lấy vị trí hiện tại")')
      setLoading(false)
      return
    }

    try {
      const payload = {
        type: formData.type,
        text: formData.text,
        lat: formData.lat,
        lon: formData.lon,
        province: formData.province || undefined,
        district: formData.district || undefined,
        ward: formData.ward || undefined,
        media: formData.media
      }

      const response = await axios.post(`${API_URL}/ingest/community`, payload)

      if (response.data.status === 'success') {
        setSuccess(true)
        // Reset form
        setFormData({
          type: 'SOS',
          text: '',
          lat: null,
          lon: null,
          province: '',
          district: '',
          ward: '',
          media: []
        })

        // Redirect to map after 2 seconds
        setTimeout(() => {
          window.location.href = '/map'
        }, 2000)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Có lỗi xảy ra khi gửi báo cáo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      {/* Header - Modern pill style */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-slate-200 dark:border-neutral-800 shadow-soft">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-600 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-neutral-50">
              Báo cáo Cộng đồng
            </h1>
          </div>
          <Link
            href="/map"
            className="px-4 py-2 bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-neutral-100 rounded-full text-sm font-medium transition-colors"
          >
            ← Bản đồ
          </Link>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-neutral-950 rounded-prominent shadow-soft-lg p-6 md:p-8 border border-slate-200 dark:border-neutral-800">
          {success && (
            <div className="mb-6 p-4 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded-card border border-success-200 dark:border-success-700/30">
              ✅ Đã gửi báo cáo thành công! Đang chuyển đến bản đồ...
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-card border border-error-200 dark:border-error-700/30">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Loại báo cáo *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-card text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-shadow"
                required
              >
                <option value="SOS">🆘 SOS - Cần cứu trợ khẩn cấp</option>
                <option value="ROAD">🚧 Đường bộ - Sạt lở, ngập, chia cắt</option>
                <option value="NEEDS">📦 Nhu yếu phẩm - Thiếu thức ăn, nước, thuốc</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Mô tả chi tiết *
              </label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-card text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-shadow resize-none"
                rows={4}
                placeholder="Ví dụ: Gia đình 5 người bị cô lập tại xóm 3, cần thực phẩm và nước uống..."
                required
              />
              <p className="text-xs text-slate-600 dark:text-neutral-400 mt-1">
                Càng chi tiết càng giúp đội cứu hộ hỗ trợ nhanh hơn
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                Vị trí *
              </label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={getLocation}
                  disabled={gettingLocation}
                  className="w-full px-4 py-2.5 bg-neutral-600 hover:bg-neutral-700 active:bg-neutral-800 text-white rounded-card font-medium shadow-sm hover:shadow-md transition-all disabled:bg-neutral-400 disabled:cursor-not-allowed"
                >
                  {gettingLocation ? 'Đang lấy vị trí...' : '📍 Lấy vị trí hiện tại (GPS)'}
                </button>

                {formData.lat !== null && formData.lon !== null && (
                  <div className="p-3 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded-card text-sm border border-success-200 dark:border-success-700/30">
                    ✓ Đã có vị trí: {formData.lat.toFixed(4)}, {formData.lon.toFixed(4)}
                  </div>
                )}
              </div>
            </div>

            {/* Province, District, Ward */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tỉnh *</label>
                <select
                  value={formData.province}
                  onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Chọn tỉnh</option>
                  {provinces.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Huyện</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: Phú Vang"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Xã/Phường</label>
                <input
                  type="text"
                  value={formData.ward}
                  onChange={(e) => setFormData(prev => ({ ...prev, ward: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: Phú Thuận"
                />
              </div>
            </div>

            {/* Media Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Ảnh minh chứng (tùy chọn)
              </label>
              <ImageUpload
                onUploadComplete={(urls) => setFormData(prev => ({ ...prev, media: urls }))}
                maxImages={3}
                cloudName={CLOUDINARY_CLOUD_NAME}
                uploadPreset={CLOUDINARY_UPLOAD_PRESET}
              />
              <p className="text-xs text-gray-500 mt-1">
                Ảnh giúp xác minh tình hình nhanh hơn. Tối đa 3 ảnh, 5MB/ảnh.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full px-6 py-3.5 bg-warning-600 hover:bg-warning-700 active:bg-warning-800 text-white text-lg font-bold rounded-card shadow-md hover:shadow-lg transition-all disabled:bg-neutral-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang gửi...' : success ? 'Đã gửi thành công!' : '📤 Gửi báo cáo'}
            </button>
          </form>

          {/* Help text */}
          <div className="mt-8 p-5 border-t border-slate-200 dark:border-neutral-800 bg-info-50/50 dark:bg-info-900/10 rounded-card">
            <p className="text-sm font-bold text-slate-900 dark:text-neutral-100 mb-3">
              ⚠️ Lưu ý quan trọng:
            </p>
            <ul className="text-sm text-slate-700 dark:text-neutral-300 list-disc list-inside space-y-2">
              <li>Chỉ báo cáo tình huống thực tế, khẩn cấp</li>
              <li>Cung cấp thông tin chính xác để đội cứu hộ hỗ trợ nhanh</li>
              <li>Nếu tình huống nguy hiểm, gọi <strong>113/114</strong> trước khi báo cáo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
