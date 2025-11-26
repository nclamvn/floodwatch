'use client'

import { useState } from 'react'
import { MapPin, Send, AlertCircle, CheckCircle } from 'lucide-react'

interface HelpMeFormProps {
  onSubmitSuccess?: () => void
}

type NeedsType = 'food' | 'water' | 'shelter' | 'medical' | 'clothing' | 'transport' | 'other'
type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low'

interface FormData {
  lat: number | null
  lon: number | null
  needs_type: NeedsType
  urgency: UrgencyLevel
  description: string
  people_count: number | null
  contact_name: string
  contact_phone: string
  contact_email: string
  has_children: boolean
  has_elderly: boolean
  has_disabilities: boolean
  water_level_cm: number | null
  building_floor: number | null
}

export default function HelpMeForm({ onSubmitSuccess }: HelpMeFormProps) {
  const [formData, setFormData] = useState<FormData>({
    lat: null,
    lon: null,
    needs_type: 'food',
    urgency: 'medium',
    description: '',
    people_count: null,
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    has_children: false,
    has_elderly: false,
    has_disabilities: false,
    water_level_cm: null,
    building_floor: null
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const needsTypeOptions = [
    { value: 'food', label: 'Thực phẩm' },
    { value: 'water', label: 'Nước uống' },
    { value: 'shelter', label: 'Chỗ ở' },
    { value: 'medical', label: 'Y tế' },
    { value: 'clothing', label: 'Quần áo' },
    { value: 'transport', label: 'Di chuyển' },
    { value: 'other', label: 'Khác' }
  ]

  const urgencyOptions = [
    { value: 'critical', label: 'Khẩn cấp', color: 'text-red-600' },
    { value: 'high', label: 'Cao', color: 'text-orange-600' },
    { value: 'medium', label: 'Trung bình', color: 'text-yellow-600' },
    { value: 'low', label: 'Thấp', color: 'text-neutral-600' }
  ]

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị')
      return
    }

    setIsGettingLocation(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }))
        setIsGettingLocation(false)
      },
      (error) => {
        setError('Không thể lấy vị trí. Vui lòng cho phép truy cập vị trí.')
        setIsGettingLocation(false)
        console.error('Geolocation error:', error)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!formData.lat || !formData.lon) {
      setError('Vui lòng lấy vị trí của bạn')
      return
    }

    if (formData.description.length < 10) {
      setError('Mô tả phải có ít nhất 10 ký tự')
      return
    }

    if (!formData.contact_name.trim()) {
      setError('Vui lòng nhập tên liên hệ')
      return
    }

    if (!formData.contact_phone.trim()) {
      setError('Vui lòng nhập số điện thoại')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        lat: formData.lat,
        lon: formData.lon,
        needs_type: formData.needs_type,
        urgency: formData.urgency,
        description: formData.description.trim(),
        contact_name: formData.contact_name.trim(),
        contact_phone: formData.contact_phone.trim(),
        ...(formData.people_count && { people_count: formData.people_count }),
        ...(formData.contact_email.trim() && { contact_email: formData.contact_email.trim() }),
        has_children: formData.has_children,
        has_elderly: formData.has_elderly,
        has_disabilities: formData.has_disabilities,
        ...(formData.water_level_cm !== null && { water_level_cm: formData.water_level_cm }),
        ...(formData.building_floor !== null && { building_floor: formData.building_floor })
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
      const response = await fetch(`${apiUrl}/help/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Không thể gửi yêu cầu. Vui lòng thử lại.')
      }

      setSuccess(true)

      // Reset form
      setFormData({
        lat: null,
        lon: null,
        needs_type: 'food',
        urgency: 'medium',
        description: '',
        people_count: null,
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        has_children: false,
        has_elderly: false,
        has_disabilities: false,
        water_level_cm: null,
        building_floor: null
      })

      // Call success callback
      if (onSubmitSuccess) {
        onSubmitSuccess()
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-50 mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        Yêu cầu cứu trợ
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Vị trí <span className="text-red-600">*</span>
          </label>
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isGettingLocation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-600 hover:bg-neutral-700 disabled:bg-neutral-400 text-white rounded-md transition-colors"
          >
            <MapPin className="w-4 h-4" />
            {isGettingLocation ? 'Đang lấy vị trí...' :
             formData.lat && formData.lon ? `Đã lấy vị trí (${formData.lat.toFixed(6)}, ${formData.lon.toFixed(6)})` :
             'Lấy vị trí hiện tại'}
          </button>
        </div>

        {/* Needs Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Loại trợ giúp cần <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.needs_type}
            onChange={(e) => setFormData(prev => ({ ...prev, needs_type: e.target.value as NeedsType }))}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          >
            {needsTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Mức độ khẩn cấp <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.urgency}
            onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value as UrgencyLevel }))}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          >
            {urgencyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Mô tả chi tiết <span className="text-red-600">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Mô tả tình huống và những gì bạn cần (ít nhất 10 ký tự)"
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent resize-none"
          />
          <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1">
            {formData.description.length}/10 ký tự tối thiểu
          </p>
        </div>

        {/* People Count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Số người cần giúp
          </label>
          <div className="relative">
            <input
              type="number"
              min="1"
              value={formData.people_count || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, people_count: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="Ví dụ: 5"
              className="number-input-modern w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>
          <style jsx>{`
            .number-input-modern::-webkit-inner-spin-button,
            .number-input-modern::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }

            .number-input-modern[type=number] {
              -moz-appearance: textfield;
              appearance: textfield;
            }
          `}</style>
        </div>

        {/* Contact Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Tên liên hệ <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.contact_name}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
            placeholder="Họ và tên của bạn"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
        </div>

        {/* Contact Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Số điện thoại <span className="text-red-600">*</span>
          </label>
          <input
            type="tel"
            value={formData.contact_phone}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
            placeholder="Số điện thoại liên hệ"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
        </div>

        {/* Contact Email (Optional) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Email (tùy chọn)
          </label>
          <input
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
            placeholder="Email của bạn"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
        </div>

        {/* Special Conditions */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Điều kiện đặc biệt
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_children}
                onChange={(e) => setFormData(prev => ({ ...prev, has_children: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-600"
              />
              <span className="text-sm text-slate-900 dark:text-neutral-50">Có trẻ em</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_elderly}
                onChange={(e) => setFormData(prev => ({ ...prev, has_elderly: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-600"
              />
              <span className="text-sm text-slate-900 dark:text-neutral-50">Có người cao tuổi</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_disabilities}
                onChange={(e) => setFormData(prev => ({ ...prev, has_disabilities: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-600"
              />
              <span className="text-sm text-slate-900 dark:text-neutral-50">Có người khuyết tật</span>
            </label>
          </div>
        </div>

        {/* Water Level */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Mức nước hiện tại (cm)
          </label>
          <input
            type="number"
            min="0"
            value={formData.water_level_cm || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, water_level_cm: e.target.value ? parseInt(e.target.value) : null }))}
            placeholder="Ví dụ: 80"
            className="number-input-modern w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
          <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1">
            Độ cao mực nước tại vị trí (quan trọng cho ưu tiên cứu hộ)
          </p>
        </div>

        {/* Building Floor */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Tầng của tòa nhà
          </label>
          <input
            type="number"
            value={formData.building_floor || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, building_floor: e.target.value ? parseInt(e.target.value) : null }))}
            placeholder="Ví dụ: 1, 2, 3..."
            className="number-input-modern w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
          />
          <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1">
            Tầng hiện tại của bạn (phục vụ lập kế hoạch sơ tán)
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Yêu cầu của bạn đã được ghi nhận thành công!
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-md transition-colors"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu cứu trợ'}
        </button>
      </form>
    </div>
  )
}
