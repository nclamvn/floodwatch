'use client'

import { useState } from 'react'
import { Phone, Mail, MapPin, Users, Clock, AlertTriangle, Copy, Trash2, CheckCircle } from 'lucide-react'

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
  priority_score?: number | null
}

interface HelpRequestCardProps {
  request: HelpRequest
  onDelete?: (id: string) => void
  showDeleteButton?: boolean // Default false for public users
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
    color: 'text-neutral-700 dark:text-neutral-400',
    bgColor: 'bg-neutral-100 dark:bg-neutral-900/30 border-neutral-300 dark:border-neutral-700'
  }
}

export default function HelpRequestCard({ request, onDelete, showDeleteButton = false }: HelpRequestCardProps) {
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const urgency = urgencyConfig[request.urgency] || urgencyConfig.medium
  const needsLabel = needsTypeLabels[request.needs_type] || request.needs_type

  // Remove JCI ID from description
  const cleanDescription = request.description.replace(/\n*\[JCI ID: \d+\]\s*$/i, '').trim()

  // Priority badge configuration
  const getPriorityConfig = (score: number | null | undefined) => {
    if (!score) return null

    if (score >= 70) {
      return {
        label: `Ưu tiên ${score}`,
        color: 'text-red-700 dark:text-red-300',
        bgColor: 'bg-red-50 dark:bg-red-950/40',
        borderColor: 'border-red-300 dark:border-red-700'
      }
    } else if (score >= 40) {
      return {
        label: `Ưu tiên ${score}`,
        color: 'text-orange-700 dark:text-orange-300',
        bgColor: 'bg-orange-50 dark:bg-orange-950/40',
        borderColor: 'border-orange-300 dark:border-orange-700'
      }
    } else if (score >= 20) {
      return {
        label: `Ưu tiên ${score}`,
        color: 'text-yellow-700 dark:text-yellow-300',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/40',
        borderColor: 'border-yellow-300 dark:border-yellow-700'
      }
    }
    return null
  }

  const priorityConfig = getPriorityConfig(request.priority_score)

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
    const textToCopy = `YÊU CẦU CỨU TRỢ
Loại: ${needsLabel}
Mức độ: ${urgency.label}
${request.priority_score ? `Ưu tiên: ${request.priority_score}\n` : ''}
Mô tả: ${cleanDescription}
${request.people_count ? `Số người: ${request.people_count}\n` : ''}
Liên hệ: ${request.contact_name}
Điện thoại: ${request.contact_phone}
${request.contact_email ? `Email: ${request.contact_email}\n` : ''}
Vị trí: ${request.lat}, ${request.lon}
${request.distance_km !== undefined ? `Khoảng cách: ${request.distance_km < 1 ? `${Math.round(request.distance_km * 1000)}m` : `${request.distance_km.toFixed(1)}km`}\n` : ''}
Thời gian: ${formatDate(request.created_at)}`

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
      const response = await fetch(`${apiUrl}/help/requests/${request.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        if (onDelete) {
          onDelete(request.id)
        }
      } else {
        alert('Không thể xóa yêu cầu này')
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
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border-2 border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${urgency.color} bg-white dark:bg-neutral-950 border`}>
              <AlertTriangle className="w-3 h-3" />
              {urgency.label}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300">
              {needsLabel}
            </span>
            {priorityConfig && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${priorityConfig.color} ${priorityConfig.bgColor} border ${priorityConfig.borderColor}`}>
                {priorityConfig.label}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50">
            Cần {needsLabel.toLowerCase()}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          {request.distance_km !== undefined && (
            <div className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-neutral-200">
              <MapPin className="w-4 h-4" />
              {request.distance_km < 1
                ? `${Math.round(request.distance_km * 1000)}m`
                : `${request.distance_km.toFixed(1)}km`}
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
                title={showDeleteConfirm ? 'Nhấn lần nữa để xác nhận xóa' : 'Xóa yêu cầu'}
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

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        {request.people_count && (
          <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
            <Users className="w-4 h-4" />
            <span>{request.people_count} người</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
          <Clock className="w-4 h-4" />
          <span>{formatDate(request.created_at)}</span>
        </div>
      </div>

      {/* Contact Info */}
      <div className="border-t border-slate-200 dark:border-neutral-700 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">
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
