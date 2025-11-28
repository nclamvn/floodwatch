'use client'

import { useState, memo } from 'react'
import { Phone, Mail, MapPin, Users, Clock, Building2, Heart, Copy, Trash2, CheckCircle } from 'lucide-react'

interface HelpOffer {
  id: string
  service_type: string
  description: string
  capacity: number | null
  coverage_radius_km: number | null
  availability: string
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  organization: string | null
  status: string
  created_at: string
  distance_km?: number
}

interface HelpOfferCardProps {
  offer: HelpOffer
  onDelete?: (id: string) => void
  showDeleteButton?: boolean // Default false for public users
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  active: {
    label: 'Sẵn sàng',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
    icon: '✓'
  },
  in_progress: {
    label: 'Đang hỗ trợ',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
    icon: '🔄'
  },
  fulfilled: {
    label: 'Đã xong',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
    icon: '✓'
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'text-neutral-500 dark:text-neutral-400',
    bgColor: 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600',
    icon: '✕'
  }
}

const serviceTypeLabels: Record<string, string> = {
  rescue: 'Cứu hộ',
  transportation: 'Vận chuyển',
  medical: 'Y tế',
  shelter: 'Chỗ ở',
  food_water: 'Thực phẩm/Nước',
  supplies: 'Vật tư',
  volunteer: 'Tình nguyện',
  donation: 'Quyên góp',
  other: 'Khác'
}

// Memoized to prevent re-renders when parent list updates but this card's props haven't changed
function HelpOfferCardBase({ offer, onDelete, showDeleteButton = false }: HelpOfferCardProps) {
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const serviceLabel = serviceTypeLabels[offer.service_type] || offer.service_type
  const status = statusConfig[offer.status?.toLowerCase()] || statusConfig.active

  // Remove JCI ID and [STATION] prefix from description
  const cleanDescription = offer.description
    .replace(/^\[STATION\]\s*/i, '')
    .replace(/\n*\[JCI ID: \d+\]\s*$/i, '')
    .trim()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) {
      return `${diffMins} phút trước`
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`
    } else if (diffDays < 7) {
      return `${diffDays} ngày trước`
    } else {
      return date.toLocaleDateString('vi-VN')
    }
  }

  const handleCopy = async () => {
    const textToCopy = `ĐỀ NGHỊ HỖ TRỢ
Loại dịch vụ: ${serviceLabel}
Mô tả: ${cleanDescription}
${offer.capacity ? `Sức chứa: ${offer.capacity}\n` : ''}
${offer.coverage_radius_km ? `Bán kính: ${offer.coverage_radius_km}km\n` : ''}
Thời gian: ${offer.availability}
${offer.organization ? `Tổ chức: ${offer.organization}\n` : ''}
Liên hệ: ${offer.contact_name}
Điện thoại: ${offer.contact_phone}
${offer.contact_email ? `Email: ${offer.contact_email}\n` : ''}
Vị trí: ${offer.lat}, ${offer.lon}
${offer.distance_km !== undefined ? `Khoảng cách: ${offer.distance_km < 1 ? `${Math.round(offer.distance_km * 1000)}m` : `${offer.distance_km.toFixed(1)}km`}\n` : ''}
Đăng lúc: ${formatDate(offer.created_at)}`

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }

    setIsDeleting(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'
      const response = await fetch(`${apiUrl}/help/offers/${offer.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        if (onDelete) {
          onDelete(offer.id)
        }
      } else {
        alert('Không thể xóa đề nghị này')
      }
    } catch (err) {
      console.error('Failed to delete:', err)
      alert('Đã xảy ra lỗi khi xóa')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border-2 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 p-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${status.color} bg-white dark:bg-neutral-950 border`}>
              <Heart className="w-3 h-3" />
              {status.label}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300">
              {serviceLabel}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50">
            {serviceLabel}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          {offer.distance_km !== undefined && (
            <div className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-neutral-200">
              <MapPin className="w-4 h-4" />
              {offer.distance_km < 1
                ? `${Math.round(offer.distance_km * 1000)}m`
                : `${offer.distance_km.toFixed(1)}km`}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 transition-colors"
              title="Sao chép thông tin"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
{showDeleteButton && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`p-1.5 rounded-md ${
                  showDeleteConfirm
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400'
                } transition-colors disabled:opacity-50`}
                title={showDeleteConfirm ? 'Nhấn lần nữa để xác nhận xóa' : 'Xóa đề nghị'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-700 dark:text-neutral-200 text-sm mb-4">
        {cleanDescription}
      </p>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        {offer.capacity && (
          <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
            <Users className="w-4 h-4" />
            <span>Sức chứa: {offer.capacity}</span>
          </div>
        )}
        {offer.coverage_radius_km && (
          <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
            <MapPin className="w-4 h-4" />
            <span>Bán kính: {offer.coverage_radius_km}km</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
          <Clock className="w-4 h-4" />
          <span>{offer.availability}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
          <Clock className="w-4 h-4" />
          <span>{formatDate(offer.created_at)}</span>
        </div>
      </div>

      {/* Organization */}
      {offer.organization && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">{offer.organization}</span>
          </div>
        </div>
      )}

      {/* Contact Info */}
      <div className="border-t border-slate-200 dark:border-neutral-700 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">
            {offer.contact_name}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`tel:${offer.contact_phone}`}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Phone className="w-4 h-4" />
            Gọi ngay
          </a>
          {offer.contact_email && (
            <a
              href={`mailto:${offer.contact_email}`}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-600 text-slate-700 dark:text-neutral-200 text-sm font-medium rounded-md transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// Custom comparison for memo - only re-render if offer data changes
const HelpOfferCard = memo(HelpOfferCardBase, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  return (
    prevProps.offer.id === nextProps.offer.id &&
    prevProps.offer.status === nextProps.offer.status &&
    prevProps.offer.capacity === nextProps.offer.capacity &&
    prevProps.showDeleteButton === nextProps.showDeleteButton
  )
})

export default HelpOfferCard
