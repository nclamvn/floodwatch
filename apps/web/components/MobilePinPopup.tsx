'use client'

import { X } from 'lucide-react'

interface Report {
  id: string
  type: string
  source: string
  title: string
  description?: string
  province?: string
  lat?: number
  lon?: number
  trust_score: number
  status: string
  created_at: string
  media?: string[]
}

interface MobilePinPopupProps {
  report: Report | null
  onClose: () => void
  onExpand?: (report: Report) => void
}

// Helper function to truncate description
function truncateDescription(text: string, maxLength: number = 120): string {
  if (!text || text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return text.substring(0, lastSpace > 0 ? lastSpace : maxLength).trim() + '...'
}

/**
 * MobilePinPopup - Fixed position popup for mobile
 *
 * Position: Center X, 2/3 height from top (Y)
 * Only shown on mobile when a pin is touched
 */
export default function MobilePinPopup({ report, onClose, onExpand }: MobilePinPopupProps) {
  if (!report) return null

  return (
    <>
      {/* Backdrop - transparent to allow map interaction but catches close */}
      <div
        className="fixed inset-0 z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Popup Card - Fixed at center X, 2/3 Y */}
      <div
        className="fixed z-50 sm:hidden left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm"
        style={{ top: '66.67%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-elevation-2 border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header with close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                report.type === 'ALERT' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                report.type === 'SOS' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                report.type === 'ROAD' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              }`}>
                {report.type}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {(report.trust_score * 100).toFixed(0)}% tin cậy
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 -mr-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-3">
            {/* Title */}
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-2 leading-snug line-clamp-2">
              {report.title}
            </h3>

            {/* Description - Truncated */}
            {report.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-3 leading-relaxed line-clamp-3">
                {truncateDescription(report.description, 120)}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
              {report.province && (
                <span className="flex items-center gap-1">
                  <span>📍</span>
                  {report.province}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span>🕒</span>
                {new Date(report.created_at).toLocaleString('vi-VN', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })}
              </span>
            </div>
          </div>

          {/* Footer - Expand button */}
          <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
            <button
              onClick={() => onExpand?.(report)}
              className="w-full py-2.5 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Xem chi tiết
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
