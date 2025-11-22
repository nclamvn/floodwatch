'use client'

import { Phone, Mail, MapPin, Users, Clock, AlertTriangle } from 'lucide-react'

interface HelpRequest {
  id: string
  needs_type: string
  urgency: string
  description: string
  people_count: number | null
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  status: string
  created_at: string
  distance_km?: number
}

interface HelpRequestCardProps {
  request: HelpRequest
}

const needsTypeLabels: Record<string, string> = {
  food: 'Thực phẩm',
  water: 'Nước uống',
  shelter: 'Chỗ ở',
  medical: 'Y tế',
  clothing: 'Quần áo',
  transport: 'Di chuyển',
  other: 'Khác'
}

const urgencyConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  critical: {
    label: 'Khẩn cấp',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
  },
  high: {
    label: 'Cao',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
  },
  medium: {
    label: 'Trung bình',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
  },
  low: {
    label: 'Thấp',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
  }
}

export default function HelpRequestCard({ request }: HelpRequestCardProps) {
  const urgency = urgencyConfig[request.urgency] || urgencyConfig.medium
  const needsLabel = needsTypeLabels[request.needs_type] || request.needs_type

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

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-md border-2 ${urgency.bgColor} p-4 hover:shadow-lg transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${urgency.color} bg-white dark:bg-neutral-900 border`}>
              <AlertTriangle className="w-3 h-3" />
              {urgency.label}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
              {needsLabel}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Cần {needsLabel.toLowerCase()}
          </h3>
        </div>
        {request.distance_km !== undefined && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              <MapPin className="w-4 h-4" />
              {request.distance_km < 1
                ? `${Math.round(request.distance_km * 1000)}m`
                : `${request.distance_km.toFixed(1)}km`}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-neutral-700 dark:text-neutral-300 text-sm mb-4">
        {request.description}
      </p>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        {request.people_count && (
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <Users className="w-4 h-4" />
            <span>{request.people_count} người</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
          <Clock className="w-4 h-4" />
          <span>{formatDate(request.created_at)}</span>
        </div>
      </div>

      {/* Contact Info */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {request.contact_name}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`tel:${request.contact_phone}`}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Phone className="w-4 h-4" />
            Gọi ngay
          </a>
          {request.contact_email && (
            <a
              href={`mailto:${request.contact_email}`}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-md transition-colors"
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
