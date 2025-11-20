'use client'

import { useEffect } from 'react'
import ImageGallery from './ImageGallery'
import { getReportTypeLabel } from '@/types/report'
import { decodeHTML } from '@/lib/htmlDecode'

interface Report {
  id: string
  created_at: string
  type: string
  source: string
  title: string
  description?: string
  province?: string
  lat?: number
  lon?: number
  trust_score: number
  status: string
  media?: string[]
}

interface ReportDetailModalProps {
  report: Report | null
  isOpen: boolean
  onClose: () => void
}

export default function ReportDetailModal({ report, isOpen, onClose }: ReportDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !report) return null

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SOS': return 'bg-red-600/20 text-red-500 border-red-600/30'
      case 'ALERT': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'ROAD': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'RAIN': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'NEEDS': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ALERT': return '⚠️'
      case 'SOS': return '🆘'
      case 'ROAD': return '🚧'
      case 'NEEDS': return '📦'
      default: return 'ℹ️'
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-[#171717] border border-neutral-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-neutral-700 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold ${getTypeColor(report.type)}`}>
                  <span>{getTypeIcon(report.type)}</span>
                  {getReportTypeLabel(report.type)}
                </span>
                <span className="text-sm text-neutral-400">
                  {(report.trust_score * 100).toFixed(0)}% tin cậy
                </span>
              </div>
              <h2 className="text-xl font-bold text-white leading-tight">
                {decodeHTML(report.title)}
              </h2>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="ml-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-800 active:bg-neutral-700 transition-colors text-neutral-400 hover:text-white"
              aria-label="Đóng"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 overflow-y-auto max-h-[calc(85vh-180px)] custom-scrollbar">
            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Tóm tắt
              </h3>
              <p className="text-white leading-relaxed whitespace-pre-wrap">
                {report.description ? decodeHTML(report.description) : 'Nhấn "Nguồn tin" bên dưới để xem chi tiết đầy đủ.'}
              </p>
            </div>

            {/* Image Gallery */}
            {report.media && report.media.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                  Hình ảnh
                </h3>
                <ImageGallery images={report.media} alt={report.title} />
              </div>
            )}

            {/* Meta info grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                  Địa phương
                </h3>
                <p className="text-white flex items-center gap-1">
                  <span>📍</span>
                  {report.province ? decodeHTML(report.province) : 'Không rõ'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                  Thời gian
                </h3>
                <p className="text-white">
                  {new Date(report.created_at).toLocaleString('vi-VN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {report.lat && report.lon && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                    Tọa độ
                  </h3>
                  <p className="text-white text-sm font-mono">
                    {report.lat.toFixed(4)}, {report.lon.toFixed(4)}
                  </p>
                </div>
              )}
            </div>

            {/* Trust score visual */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Độ tin cậy
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      report.trust_score >= 0.8 ? 'bg-green-500' :
                      report.trust_score >= 0.5 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${report.trust_score * 100}%` }}
                  />
                </div>
                <span className="text-white font-semibold tabular-nums">
                  {(report.trust_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Status */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Trạng thái
              </h3>
              <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-medium ${
                report.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                report.status === 'resolved' ? 'bg-blue-500/20 text-blue-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {report.status === 'verified' ? '✓ Đã xác minh' :
                 report.status === 'resolved' ? '✓ Đã giải quyết' :
                 '● Mới'}
              </span>
            </div>
          </div>

          {/* Footer with action button */}
          <div className="px-6 py-4 border-t border-neutral-700 flex items-center justify-between bg-neutral-900/50">
            <p className="text-sm text-neutral-400">
              ID: <span className="font-mono text-xs">{report.id.slice(0, 8)}</span>
            </p>

            {/* Source link button */}
            {report.source && (report.source.startsWith('http') || report.source.includes('www')) && (
              <a
                href={report.source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-semibold transition-colors text-sm"
              >
                <span>Nguồn tin</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
