'use client'

import { useState } from 'react'
import { X, MapPin, Clock, Navigation, ExternalLink, AlertTriangle, ShieldCheck, ShieldAlert, ShieldX, Copy, Check, CheckCircle2 } from 'lucide-react'
import { RouteSegment, RouteStatus } from './RouteCard'
import DirectionsModal from './DirectionsModal'

interface RouteDetailModalProps {
  route: RouteSegment
  onClose: () => void
}

// Status configuration
const STATUS_CONFIG: Record<RouteStatus, {
  label: string
  bgColor: string
  textColor: string
  icon: React.ReactNode
}> = {
  OPEN: {
    label: 'Thông thoáng',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    icon: <ShieldCheck className="w-6 h-6" />
  },
  LIMITED: {
    label: 'Hạn chế',
    bgColor: 'bg-amber-100 dark:bg-amber-900/50',
    textColor: 'text-amber-700 dark:text-amber-300',
    icon: <AlertTriangle className="w-6 h-6" />
  },
  DANGEROUS: {
    label: 'Nguy hiểm',
    bgColor: 'bg-orange-100 dark:bg-orange-900/50',
    textColor: 'text-orange-700 dark:text-orange-300',
    icon: <ShieldAlert className="w-6 h-6" />
  },
  CLOSED: {
    label: 'Đóng',
    bgColor: 'bg-red-100 dark:bg-red-900/50',
    textColor: 'text-red-700 dark:text-red-300',
    icon: <ShieldX className="w-6 h-6" />
  }
}

// Format relative time
function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Không rõ'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} ngày trước`

  return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Format full date
function formatFullDate(dateString?: string): string {
  if (!dateString) return 'Không rõ'
  const date = new Date(dateString)
  return date.toLocaleString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Calculate days until archive for RESOLVED alerts
function getDaysUntilArchive(resolvedAt?: string): number {
  if (!resolvedAt) return 3
  const resolved = new Date(resolvedAt)
  const archiveDate = new Date(resolved.getTime() + 3 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const diffDays = Math.ceil((archiveDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(0, diffDays)
}

export default function RouteDetailModal({ route, onClose }: RouteDetailModalProps) {
  const [showDirections, setShowDirections] = useState(false)
  const [copied, setCopied] = useState(false)

  const config = STATUS_CONFIG[route.status]
  const hasCoordinates = route.lat !== undefined && route.lon !== undefined
  const isResolved = route.lifecycle_status === 'RESOLVED'
  const daysUntilArchive = isResolved ? getDaysUntilArchive(route.resolved_at) : 0

  const handleCopyLocation = () => {
    if (hasCoordinates) {
      navigator.clipboard.writeText(`${route.lat}, ${route.lon}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenGoogleMaps = () => {
    if (hasCoordinates) {
      window.open(`https://www.google.com/maps?q=${route.lat},${route.lon}`, '_blank')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto animate-scale-in">
          {/* Resolved Banner */}
          {isResolved && (
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-100 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  Đã khắc phục
                </span>
              </div>
              <span className="text-sm text-emerald-600 dark:text-emerald-400">
                Hiển thị thêm {daysUntilArchive} ngày
              </span>
            </div>
          )}

          {/* Header with Status */}
          <div className={`flex items-center justify-between p-4 ${isResolved ? 'bg-neutral-50 dark:bg-neutral-800/50' : config.bgColor}`}>
            <div className="flex items-center gap-3">
              <div className={isResolved ? 'text-neutral-400 dark:text-neutral-500' : config.textColor}>
                {config.icon}
              </div>
              <div>
                <span className={`font-bold text-lg ${isResolved ? 'text-neutral-500 dark:text-neutral-400 line-through' : config.textColor}`}>
                  {config.label}
                </span>
                {route.risk_score !== undefined && route.risk_score > 0 && (
                  <p className={`text-sm ${isResolved ? 'text-neutral-400 dark:text-neutral-500' : config.textColor} opacity-80`}>
                    Mức độ rủi ro: {Math.round(route.risk_score * 100)}%
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Road Name */}
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {route.segment_name}
              </h2>
              {route.road_name && route.road_name !== route.segment_name && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {route.road_name}
                </p>
              )}
            </div>

            {/* Location */}
            <div className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
              <MapPin className="w-5 h-5 text-neutral-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {[route.district, route.province].filter(Boolean).join(', ') || 'Chưa xác định vị trí'}
                </p>
                {hasCoordinates && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-neutral-500 font-mono">
                      {route.lat?.toFixed(6)}, {route.lon?.toFixed(6)}
                    </span>
                    <button
                      onClick={handleCopyLocation}
                      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                      title="Sao chép tọa độ"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Status Reason / Description */}
            {route.status_reason && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                  Mô tả tình trạng
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {route.status_reason}
                </p>
              </div>
            )}

            {/* Hazard Info */}
            {route.hazard_name && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Liên quan đến thiên tai
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    {route.hazard_name}
                  </p>
                </div>
              </div>
            )}

            {/* Time Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <Clock className="w-4 h-4" />
                <span>Cập nhật: {formatRelativeTime(route.verified_at || route.updated_at)}</span>
              </div>
              {route.verified_at && (
                <p className="text-xs text-neutral-500 dark:text-neutral-500 ml-6">
                  {formatFullDate(route.verified_at)}
                </p>
              )}
            </div>

            {/* Source */}
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
              {route.source_url ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500 dark:text-neutral-500">Nguồn:</span>
                  <a
                    href={route.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    {route.source_domain || 'Xem bài viết gốc'}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Chưa có nguồn kiểm chứng
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Thông tin từ {route.source === 'PRESS' ? 'báo chí' :
                         route.source === 'COMMUNITY' ? 'cộng đồng' :
                         route.source === 'GOVERNMENT' ? 'chính phủ' :
                         'hệ thống'} nhưng chưa có link bài viết gốc.
                        Vui lòng gọi <strong>113/114</strong> để xác nhận.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
            <div className="flex gap-3">
              {/* Directions Button */}
              {hasCoordinates && (
                <button
                  onClick={() => setShowDirections(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                >
                  <Navigation className="w-5 h-5" />
                  Chỉ đường
                </button>
              )}

              {/* Open in Maps */}
              {hasCoordinates && (
                <button
                  onClick={handleOpenGoogleMaps}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Mở Maps
                </button>
              )}

              {/* Close */}
              <button
                onClick={onClose}
                className={`${hasCoordinates ? '' : 'flex-1'} px-4 py-3 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors`}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>

      {/* Directions Modal */}
      {showDirections && hasCoordinates && (
        <DirectionsModal
          lat={route.lat!}
          lon={route.lon!}
          destinationName={route.segment_name}
          address={[route.district, route.province].filter(Boolean).join(', ')}
          onClose={() => setShowDirections(false)}
        />
      )}
    </>
  )
}
