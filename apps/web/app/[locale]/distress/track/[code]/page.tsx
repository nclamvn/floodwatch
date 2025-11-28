'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'

interface DistressStatus {
  id: string
  tracking_code: string
  status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'false_alarm'
  urgency: 'critical' | 'high' | 'medium' | 'low'
  created_at: string
  updated_at: string
  description: string
  lat: number
  lon: number
  num_people: number
  has_injuries: boolean
  has_children: boolean
  has_elderly: boolean
  verified: boolean
  assigned_to?: string
  admin_notes?: string
  resolved_at?: string
}

const STATUS_CONFIG = {
  pending: {
    label: 'Chờ xử lý',
    color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
    icon: '⏳',
    description: 'Báo cáo đang chờ được xác nhận và phân công'
  },
  acknowledged: {
    label: 'Đã tiếp nhận',
    color: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400',
    icon: '✓',
    description: 'Báo cáo đã được xác nhận và đang được phân công'
  },
  in_progress: {
    label: 'Đang xử lý',
    color: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400',
    icon: '🚑',
    description: 'Lực lượng cứu hộ đang trên đường hoặc đang hỗ trợ'
  },
  resolved: {
    label: 'Đã hoàn thành',
    color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    icon: '✅',
    description: 'Đã hỗ trợ thành công'
  },
  false_alarm: {
    label: 'Không hợp lệ',
    color: 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400',
    icon: '❌',
    description: 'Báo cáo không chính xác hoặc đã được giải quyết trước đó'
  }
}

const URGENCY_CONFIG = {
  critical: { label: 'Khẩn cấp', color: 'text-error-600 dark:text-error-400' },
  high: { label: 'Cao', color: 'text-warning-600 dark:text-warning-400' },
  medium: { label: 'Trung bình', color: 'text-info-600 dark:text-info-400' },
  low: { label: 'Thấp', color: 'text-slate-600 dark:text-neutral-400' }
}

export default function DistressTrackPage() {
  const params = useParams()
  const code = params.code as string

  const [status, setStatus] = useState<DistressStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await axios.get(`${API_URL}/distress/track/${code}`)
        setStatus(response.data.data)
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Không tìm thấy báo cáo với mã này. Vui lòng kiểm tra lại.')
        } else {
          setError('Có lỗi xảy ra khi tải thông tin. Vui lòng thử lại.')
        }
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      fetchStatus()
    }
  }, [code, API_URL])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-neutral-950/90 backdrop-blur border-b border-slate-200 dark:border-neutral-800 shadow-soft">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-600" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-neutral-50">
              Theo dõi báo cáo
            </h1>
          </div>
          <Link
            href="/map"
            className="px-4 py-2 bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-neutral-100 rounded-full text-sm font-medium transition-colors"
          >
            ← Về bản đồ
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-soft-lg p-8 text-center border border-slate-200 dark:border-neutral-800">
            <div className="animate-spin w-12 h-12 border-4 border-neutral-200 dark:border-neutral-700 border-t-neutral-600 rounded-full mx-auto mb-4" />
            <p className="text-slate-600 dark:text-neutral-400">Đang tải thông tin...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-soft-lg p-8 text-center border border-slate-200 dark:border-neutral-800">
            <div className="w-16 h-16 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-100 mb-2">
              Không tìm thấy
            </h2>
            <p className="text-slate-600 dark:text-neutral-400 mb-6">{error}</p>
            <div className="space-y-3">
              <Link
                href="/report"
                className="block w-full px-4 py-3 bg-neutral-600 hover:bg-neutral-700 text-white font-semibold rounded-lg transition-colors"
              >
                Gửi báo cáo mới
              </Link>
              <Link
                href="/map"
                className="block w-full px-4 py-3 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-neutral-100 font-medium rounded-lg transition-colors"
              >
                Về bản đồ
              </Link>
            </div>
          </div>
        )}

        {/* Status Card */}
        {status && !loading && (
          <div className="space-y-6">
            {/* Tracking Code Header */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-soft-lg p-6 border border-slate-200 dark:border-neutral-800">
              <div className="text-center mb-6">
                <p className="text-sm text-slate-500 dark:text-neutral-500 mb-1">Mã theo dõi</p>
                <code className="text-2xl font-mono font-bold text-slate-900 dark:text-neutral-100">
                  {code}
                </code>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col items-center">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-semibold ${STATUS_CONFIG[status.status].color}`}>
                  <span>{STATUS_CONFIG[status.status].icon}</span>
                  <span>{STATUS_CONFIG[status.status].label}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-neutral-500 mt-2 text-center">
                  {STATUS_CONFIG[status.status].description}
                </p>
              </div>
            </div>

            {/* Timeline / Details */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-soft-lg p-6 border border-slate-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-4">
                Chi tiết báo cáo
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-neutral-800">
                  <span className="text-slate-500 dark:text-neutral-500">Mức độ khẩn cấp</span>
                  <span className={`font-semibold ${URGENCY_CONFIG[status.urgency].color}`}>
                    {URGENCY_CONFIG[status.urgency].label}
                  </span>
                </div>

                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-neutral-800">
                  <span className="text-slate-500 dark:text-neutral-500">Số người cần hỗ trợ</span>
                  <span className="font-semibold text-slate-900 dark:text-neutral-100">{status.num_people}</span>
                </div>

                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-neutral-800">
                  <span className="text-slate-500 dark:text-neutral-500">Thời gian gửi</span>
                  <span className="font-semibold text-slate-900 dark:text-neutral-100">
                    {formatDate(status.created_at)}
                  </span>
                </div>

                {status.updated_at !== status.created_at && (
                  <div className="flex justify-between py-3 border-b border-slate-100 dark:border-neutral-800">
                    <span className="text-slate-500 dark:text-neutral-500">Cập nhật lần cuối</span>
                    <span className="font-semibold text-slate-900 dark:text-neutral-100">
                      {formatDate(status.updated_at)}
                    </span>
                  </div>
                )}

                {status.verified && (
                  <div className="flex justify-between py-3 border-b border-slate-100 dark:border-neutral-800">
                    <span className="text-slate-500 dark:text-neutral-500">Xác minh</span>
                    <span className="text-success-600 dark:text-success-400 font-semibold">✓ Đã xác minh</span>
                  </div>
                )}

                {status.assigned_to && (
                  <div className="flex justify-between py-3 border-b border-slate-100 dark:border-neutral-800">
                    <span className="text-slate-500 dark:text-neutral-500">Phân công cho</span>
                    <span className="font-semibold text-slate-900 dark:text-neutral-100">{status.assigned_to}</span>
                  </div>
                )}

                {status.resolved_at && (
                  <div className="flex justify-between py-3 border-b border-slate-100 dark:border-neutral-800">
                    <span className="text-slate-500 dark:text-neutral-500">Hoàn thành lúc</span>
                    <span className="font-semibold text-success-600 dark:text-success-400">
                      {formatDate(status.resolved_at)}
                    </span>
                  </div>
                )}

                {/* Special flags */}
                {(status.has_injuries || status.has_children || status.has_elderly) && (
                  <div className="py-3">
                    <span className="text-slate-500 dark:text-neutral-500 block mb-2">Lưu ý đặc biệt</span>
                    <div className="flex flex-wrap gap-2">
                      {status.has_injuries && (
                        <span className="px-3 py-1 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 text-sm rounded-full">
                          🏥 Có người bị thương
                        </span>
                      )}
                      {status.has_children && (
                        <span className="px-3 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-sm rounded-full">
                          👶 Có trẻ em
                        </span>
                      )}
                      {status.has_elderly && (
                        <span className="px-3 py-1 bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-400 text-sm rounded-full">
                          👴 Có người già
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Notes (if any) */}
            {status.admin_notes && (
              <div className="bg-info-50 dark:bg-info-900/20 rounded-2xl p-6 border border-info-200 dark:border-info-700/30">
                <h3 className="text-lg font-bold text-info-900 dark:text-info-100 mb-2">
                  Ghi chú từ đội cứu hộ
                </h3>
                <p className="text-info-700 dark:text-info-300">{status.admin_notes}</p>
              </div>
            )}

            {/* Emergency Contact */}
            <div className="bg-warning-50 dark:bg-warning-900/20 rounded-2xl p-6 border border-warning-200 dark:border-warning-700/30">
              <h3 className="text-lg font-bold text-warning-900 dark:text-warning-100 mb-2">
                📞 Liên hệ khẩn cấp
              </h3>
              <p className="text-warning-700 dark:text-warning-300 mb-4">
                Nếu tình huống khẩn cấp, hãy gọi ngay:
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="tel:113"
                  className="px-4 py-2 bg-error-500 hover:bg-error-600 text-white font-bold rounded-lg transition-colors"
                >
                  113 - Công an
                </a>
                <a
                  href="tel:114"
                  className="px-4 py-2 bg-warning-500 hover:bg-warning-600 text-white font-bold rounded-lg transition-colors"
                >
                  114 - Cứu hỏa
                </a>
                <a
                  href="tel:115"
                  className="px-4 py-2 bg-success-500 hover:bg-success-600 text-white font-bold rounded-lg transition-colors"
                >
                  115 - Cấp cứu
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
