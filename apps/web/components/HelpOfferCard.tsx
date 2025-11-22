'use client'

import { Phone, Mail, MapPin, Users, Clock, Building2, Heart } from 'lucide-react'

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

export default function HelpOfferCard({ offer }: HelpOfferCardProps) {
  const serviceLabel = serviceTypeLabels[offer.service_type] || offer.service_type

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
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md border-2 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 p-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-green-700 dark:text-green-400 bg-white dark:bg-neutral-900 border border-green-300 dark:border-green-700">
              <Heart className="w-3 h-3" />
              Sẵn sàng giúp
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
              {serviceLabel}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {serviceLabel}
          </h3>
        </div>
        {offer.distance_km !== undefined && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              <MapPin className="w-4 h-4" />
              {offer.distance_km < 1
                ? `${Math.round(offer.distance_km * 1000)}m`
                : `${offer.distance_km.toFixed(1)}km`}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-neutral-700 dark:text-neutral-300 text-sm mb-4">
        {offer.description}
      </p>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        {offer.capacity && (
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <Users className="w-4 h-4" />
            <span>Sức chứa: {offer.capacity}</span>
          </div>
        )}
        {offer.coverage_radius_km && (
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <MapPin className="w-4 h-4" />
            <span>Bán kính: {offer.coverage_radius_km}km</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
          <Clock className="w-4 h-4" />
          <span>{offer.availability}</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
          <Clock className="w-4 h-4" />
          <span>{formatDate(offer.created_at)}</span>
        </div>
      </div>

      {/* Organization */}
      {offer.organization && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">{offer.organization}</span>
          </div>
        </div>
      )}

      {/* Contact Info */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
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
