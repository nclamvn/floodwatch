'use client'

import { useState } from 'react'
import { MapPin, Send, Heart, CheckCircle, AlertCircle } from 'lucide-react'

interface ICanHelpFormProps {
  onSubmitSuccess?: () => void
}

type ServiceType = 'rescue' | 'transportation' | 'medical' | 'shelter' | 'food_water' | 'supplies' | 'volunteer' | 'donation' | 'other'
type VehicleType = 'boat' | 'truck' | 'helicopter' | 'ambulance' | 'car' | 'motorcycle' | 'other' | ''

interface FormData {
  lat: number | null
  lon: number | null
  service_type: ServiceType
  description: string
  capacity: number | null
  coverage_radius_km: number | null
  availability: string
  contact_name: string
  contact_phone: string
  contact_email: string
  organization: string
  vehicle_type: VehicleType
  available_capacity: number | null
}

export default function ICanHelpForm({ onSubmitSuccess }: ICanHelpFormProps) {
  const [formData, setFormData] = useState<FormData>({
    lat: null,
    lon: null,
    service_type: 'volunteer',
    description: '',
    capacity: null,
    coverage_radius_km: 10,
    availability: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    organization: '',
    vehicle_type: '',
    available_capacity: null
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const serviceTypeOptions = [
    { value: 'rescue', label: 'Cứu hộ' },
    { value: 'transportation', label: 'Vận chuyển' },
    { value: 'medical', label: 'Y tế' },
    { value: 'shelter', label: 'Chỗ ở' },
    { value: 'food_water', label: 'Thực phẩm/Nước' },
    { value: 'supplies', label: 'Vật tư' },
    { value: 'volunteer', label: 'Tình nguyện' },
    { value: 'donation', label: 'Quyên góp' },
    { value: 'other', label: 'Khác' }
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

    if (!formData.availability.trim()) {
      setError('Vui lòng nhập thời gian có thể giúp')
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
        service_type: formData.service_type,
        description: formData.description.trim(),
        availability: formData.availability.trim(),
        contact_name: formData.contact_name.trim(),
        contact_phone: formData.contact_phone.trim(),
        ...(formData.capacity && { capacity: formData.capacity }),
        ...(formData.coverage_radius_km && { coverage_radius_km: formData.coverage_radius_km }),
        ...(formData.contact_email.trim() && { contact_email: formData.contact_email.trim() }),
        ...(formData.organization.trim() && { organization: formData.organization.trim() }),
        ...(formData.vehicle_type && { vehicle_type: formData.vehicle_type }),
        ...(formData.available_capacity && { available_capacity: formData.available_capacity })
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
      const response = await fetch(`${apiUrl}/help/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Không thể gửi đề nghị. Vui lòng thử lại.')
      }

      setSuccess(true)

      // Reset form
      setFormData({
        lat: null,
        lon: null,
        service_type: 'volunteer',
        description: '',
        capacity: null,
        coverage_radius_km: 10,
        availability: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        organization: '',
        vehicle_type: '',
        available_capacity: null
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
        <Heart className="w-5 h-5 text-green-600" />
        Đề nghị hỗ trợ
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Vị trí của bạn <span className="text-red-600">*</span>
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

        {/* Service Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Loại hỗ trợ <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.service_type}
            onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value as ServiceType }))}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          >
            {serviceTypeOptions.map(option => (
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
            placeholder="Mô tả những gì bạn có thể giúp (ít nhất 10 ký tự)"
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none"
          />
          <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1">
            {formData.description.length}/10 ký tự tối thiểu
          </p>
        </div>

        {/* Capacity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Số lượng người có thể giúp
          </label>
          <input
            type="number"
            min="1"
            value={formData.capacity || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value ? parseInt(e.target.value) : null }))}
            placeholder="Ví dụ: 10"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
        </div>

        {/* Coverage Radius */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Bán kính hỗ trợ (km)
          </label>
          <input
            type="number"
            min="1"
            value={formData.coverage_radius_km || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, coverage_radius_km: e.target.value ? parseFloat(e.target.value) : null }))}
            placeholder="Khoảng cách bạn có thể di chuyển để giúp"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
          <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1">
            Bạn có thể giúp đỡ trong bán kính bao xa từ vị trí của bạn?
          </p>
        </div>

        {/* Availability */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Thời gian có thể giúp <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.availability}
            onChange={(e) => setFormData(prev => ({ ...prev, availability: e.target.value }))}
            placeholder="Ví dụ: 8h-17h hàng ngày, Cuối tuần, 24/7"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
        </div>

        {/* Organization (Optional) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Tổ chức (nếu có)
          </label>
          <input
            type="text"
            value={formData.organization}
            onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
            placeholder="Tên tổ chức, nhóm tình nguyện"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
        </div>

        {/* Vehicle Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Loại phương tiện (nếu có)
          </label>
          <select
            value={formData.vehicle_type}
            onChange={(e) => setFormData(prev => ({ ...prev, vehicle_type: e.target.value as VehicleType }))}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          >
            <option value="">-- Chọn loại phương tiện --</option>
            <option value="boat">Thuyền/Xuồng</option>
            <option value="truck">Xe tải</option>
            <option value="helicopter">Trực thăng</option>
            <option value="ambulance">Xe cứu thương</option>
            <option value="car">Ô tô</option>
            <option value="motorcycle">Xe máy</option>
            <option value="other">Khác</option>
          </select>
          <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1">
            Phương tiện có sẵn để hỗ trợ cứu hộ/vận chuyển
          </p>
        </div>

        {/* Available Capacity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
            Sức chứa hiện có
          </label>
          <input
            type="number"
            min="1"
            value={formData.available_capacity || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, available_capacity: e.target.value ? parseInt(e.target.value) : null }))}
            placeholder="Số người có thể giúp ngay lúc này"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
          <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1">
            Số người bạn có thể giúp được ngay bây giờ (khác với tổng sức chứa)
          </p>
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
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-50 placeholder-neutral-400 focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
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
              Đề nghị hỗ trợ của bạn đã được ghi nhận thành công!
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-md transition-colors"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Đang gửi...' : 'Gửi đề nghị hỗ trợ'}
        </button>
      </form>
    </div>
  )
}
