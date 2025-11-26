'use client'

import { Phone, MapPin, Users, Clock, AlertTriangle, Heart } from 'lucide-react'
import { HelpRequest } from '@/hooks/useHelpRequests'
import { HelpOffer } from '@/hooks/useHelpOffers'

interface PinPopoverProps {
  data: HelpRequest | HelpOffer
  type: 'request' | 'offer'
  position: { x: number; y: number }
  onClose: () => void
  onViewDetails: () => void
}

const urgencyLabels: Record<string, string> = {
  critical: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp'
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

/**
 * PinPopover Component (Phase 3.1)
 *
 * Quick preview popover that appears when clicking/hovering a pin.
 * Shows essential info (3-4 lines) with action buttons.
 */
export default function PinPopover({ data, type, position, onClose, onViewDetails }: PinPopoverProps) {
  const isRequest = type === 'request'
  const request = isRequest ? (data as HelpRequest) : null
  const offer = !isRequest ? (data as HelpOffer) : null

  // Clean JCI ID and [STATION] prefix from description
  const cleanDescription = data.description
    .replace(/^\[STATION\]\s*/i, '')
    .replace(/\n*\[JCI ID: \d+\]\s*$/i, '')
    .trim()

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
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
    } else {
      return `${diffDays} ngày trước`
    }
  }

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Popover */}
      <div
        className="fixed z-50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-4 w-80"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -100%) translateY(-16px)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {isRequest && request ? (
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  request.urgency === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  request.urgency === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                  request.urgency === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                  'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400'
                }`}>
                  <AlertTriangle className="w-3 h-3" />
                  {urgencyLabels[request.urgency]}
                </span>
              </div>
            ) : offer ? (
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  <Heart className="w-3 h-3" />
                  Sẵn sàng giúp
                </span>
              </div>
            ) : null}
            <h3 className="text-base font-bold text-slate-900 dark:text-neutral-50">
              {isRequest && request
                ? `Cần ${needsTypeLabels[request.needs_type]?.toLowerCase() || request.needs_type}`
                : offer
                ? serviceTypeLabels[offer.service_type] || offer.service_type
                : ''
              }
            </h3>
          </div>
        </div>

        {/* Quick Info */}
        <div className="space-y-2 mb-3 text-sm">
          {/* Description preview */}
          <p className="text-slate-700 dark:text-neutral-200 line-clamp-2">
            {cleanDescription.length > 80 ? `${cleanDescription.substring(0, 80)}...` : cleanDescription}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-slate-600 dark:text-neutral-300">
            {isRequest && request?.people_count && (
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{request.people_count} người</span>
              </div>
            )}
            {!isRequest && offer?.capacity && (
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{offer.capacity} người</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimeAgo(data.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onViewDetails}
            className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-medium rounded-lg transition-colors"
          >
            Chi tiết
          </button>
          <a
            href={`tel:${data.contact_phone}`}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
              isRequest
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-3.5 h-3.5" />
            Gọi ngay
          </a>
        </div>

        {/* Pointer arrow - more prominent */}
        <div
          className="absolute left-1/2 bottom-0 w-4 h-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl border-r border-b border-neutral-200 dark:border-neutral-700"
          style={{
            transform: 'translate(-50%, 50%) rotate(45deg)',
          }}
        />
      </div>
    </>
  )
}
