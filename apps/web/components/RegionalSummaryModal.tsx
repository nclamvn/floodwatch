'use client'

import { X, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// Type definitions matching backend response
interface RegionalSummaryData {
  province: string
  summary_text: string
  severity_level: 'low' | 'moderate' | 'high' | 'critical' | 'unknown'
  key_points: string[]
  recommendations: string[]
  time_range: string
  statistics: {
    total_reports: number
    by_type: Record<string, number>
    avg_trust_score: number
  }
  top_reports: Array<{
    id: string
    type: string
    title: string
    description?: string
    trust_score: number
    created_at: string
    source: string
  }>
  generated_at: string
}

interface RegionalSummaryModalProps {
  data: RegionalSummaryData | null
  isOpen: boolean
  onClose: () => void
  onReportClick: (reportId: string) => void
}

export default function RegionalSummaryModal({
  data,
  isOpen,
  onClose,
  onReportClick
}: RegionalSummaryModalProps) {
  if (!isOpen || !data) return null

  // Severity styling
  const getSeverityConfig = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-red-500/20',
          text: 'text-red-700 dark:text-red-200',
          icon: XCircle,
          label: 'Nguy cơ rất cao'
        }
      case 'high':
        return {
          bg: 'bg-orange-500/20',
          text: 'text-orange-700 dark:text-orange-200',
          icon: AlertTriangle,
          label: 'Nguy cơ cao'
        }
      case 'moderate':
        return {
          bg: 'bg-yellow-500/20',
          text: 'text-yellow-700 dark:text-yellow-200',
          icon: Info,
          label: 'Nguy cơ trung bình'
        }
      case 'low':
      default:
        return {
          bg: 'bg-green-500/20',
          text: 'text-green-700 dark:text-green-200',
          icon: CheckCircle,
          label: 'Nguy cơ thấp'
        }
    }
  }

  const severityConfig = getSeverityConfig(data.severity_level)
  const SeverityIcon = severityConfig.icon

  // Format date
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return isoString
    }
  }

  // Type badge colors
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'ALERT':
        return 'bg-red-500/30 text-red-700 dark:text-red-200'
      case 'SOS':
        return 'bg-orange-500/30 text-orange-700 dark:text-orange-200'
      case 'RAIN':
        return 'bg-neutral-500/30 text-neutral-700 dark:text-neutral-200'
      case 'ROAD':
        return 'bg-yellow-500/30 text-yellow-700 dark:text-yellow-200'
      case 'NEEDS':
        return 'bg-neutral-500/30 text-neutral-700 dark:text-neutral-200'
      default:
        return 'bg-gray-500/30 text-gray-700 dark:text-gray-200'
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-300 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        className="
          relative w-full mx-4 flex flex-col
          max-h-[92vh] sm:max-h-[85vh]
          rounded-t-2xl sm:rounded-3xl
          sm:max-w-[920px]
          bg-white/90 dark:bg-gray-900/90
          backdrop-blur-xl
          border border-neutral-200/50 dark:border-white/10
          shadow-[0_24px_60px_rgba(0,0,0,0.3)]
          animate-in zoom-in-95 duration-300
          p-4 sm:p-7
        "
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
              Tình hình thiên tai tại {data.province}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-50/70">
              Dữ liệu từ KTTV, PCTT, báo chí chính thống · {data.time_range} · Cập nhật: {formatDate(data.generated_at)}
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="
              ml-4 p-2 rounded-full
              bg-neutral-200 dark:bg-white/10
              hover:bg-neutral-300 dark:hover:bg-white/20
              transition-colors
              text-neutral-700 dark:text-neutral-50
            "
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-white/20 scrollbar-track-transparent">
          {/* Severity Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${severityConfig.bg} ${severityConfig.text} mb-6`}>
            <SeverityIcon className="w-5 h-5" />
            <span className="font-semibold">{severityConfig.label}</span>
          </div>

          {/* AI-Generated Summary */}
          <div className="prose dark:prose-invert max-w-none mb-6">
            <div className="text-neutral-800 dark:text-neutral-50/90 leading-relaxed">
              <ReactMarkdown>{data.summary_text}</ReactMarkdown>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-neutral-100 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-neutral-200 dark:border-white/10">
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">{data.statistics.total_reports}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-50/70 mt-1">Báo cáo</div>
            </div>
            <div className="bg-neutral-100 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-neutral-200 dark:border-white/10">
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">{Object.keys(data.statistics.by_type).length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-50/70 mt-1">Loại sự kiện</div>
            </div>
            <div className="bg-neutral-100 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-neutral-200 dark:border-white/10">
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">{(data.statistics.avg_trust_score * 100).toFixed(0)}%</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-50/70 mt-1">Độ tin cậy TB</div>
            </div>
          </div>

          {/* Key Points (if provided) */}
          {data.key_points && data.key_points.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-3">Điểm chính:</h3>
              <ul className="space-y-2">
                {data.key_points.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-neutral-700 dark:text-neutral-50/80">
                    <span className="text-neutral-600 dark:text-neutral-300 mt-1">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations (if provided) */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 rounded-xl">
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-200 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Khuyến nghị:
              </h3>
              <ul className="space-y-2">
                {data.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-neutral-800 dark:text-neutral-50/90">
                    <span className="text-yellow-600 dark:text-yellow-300 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top Reports List */}
          {data.top_reports && data.top_reports.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">Chi tiết các báo cáo chính:</h3>
              <div className="space-y-3">
                {data.top_reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => onReportClick(report.id)}
                    className="
                      w-full text-left p-4
                      bg-neutral-100 dark:bg-white/10 backdrop-blur-sm
                      hover:bg-neutral-200 dark:hover:bg-white/20
                      border border-neutral-200 dark:border-white/10
                      rounded-xl
                      transition-all duration-200
                      hover:scale-[1.02]
                    "
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
                          {report.title}
                        </div>
                        {report.description && (
                          <div className="text-sm text-neutral-600 dark:text-neutral-50/70 mb-2 line-clamp-2">
                            {report.description}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-50/60">
                          <span>{formatDate(report.created_at)}</span>
                          <span>•</span>
                          <span>{(report.trust_score * 100).toFixed(0)}% tin cậy</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${getTypeBadgeClass(report.type)}`}>
                        {report.type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {(!data.top_reports || data.top_reports.length === 0) && data.statistics.total_reports === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
              <p className="text-neutral-600 dark:text-neutral-50/70">Không có báo cáo trong thời gian này</p>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-white/10 text-center text-sm text-neutral-500 dark:text-neutral-50/50">
            <p>
              Bản tóm tắt được tạo tự động bởi AI dựa trên dữ liệu từ các nguồn chính thống.
              <br />
              Vui lòng kiểm tra thông tin trên các kênh chính thức của địa phương.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
