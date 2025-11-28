'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

interface DistressSubmitSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  trackingCode: string
  reportId: string
}

export default function DistressSubmitSuccessModal({
  isOpen,
  onClose,
  trackingCode,
  reportId
}: DistressSubmitSuccessModalProps) {
  const t = useTranslations('report')
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  // Auto-close after 10 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        router.push('/map')
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, router])

  const copyTrackingCode = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = trackingCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const viewStatus = () => {
    router.push(`/distress/track/${trackingCode}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-success-500 to-success-600 p-6 text-center">
          <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">
            {t('success') || 'Báo cáo đã được ghi nhận!'}
          </h2>
          <p className="text-white/80 text-sm mt-2">
            Lực lượng cứu hộ sẽ liên hệ sớm nhất có thể
          </p>
        </div>

        {/* Tracking Code Section */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-neutral-400 mb-2">
              Mã theo dõi của bạn
            </p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-2xl font-mono font-bold text-slate-900 dark:text-neutral-100 bg-slate-100 dark:bg-neutral-800 px-4 py-2 rounded-lg">
                {trackingCode}
              </code>
              <button
                onClick={copyTrackingCode}
                className="p-2 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                title="Sao chép mã"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700/30 rounded-lg p-4">
            <p className="text-sm text-info-700 dark:text-info-400">
              <span className="font-semibold">💡 Lưu ý:</span> Hãy lưu lại mã này để theo dõi tình trạng xử lý báo cáo của bạn.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={viewStatus}
              className="w-full px-4 py-3 bg-neutral-600 hover:bg-neutral-700 text-white font-semibold rounded-lg transition-colors"
            >
              📋 Xem trạng thái báo cáo
            </button>
            <button
              onClick={() => router.push('/map')}
              className="w-full px-4 py-3 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-neutral-100 font-medium rounded-lg transition-colors"
            >
              ← Quay về bản đồ
            </button>
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-neutral-500">
            Tự động chuyển về bản đồ sau 10 giây...
          </p>
        </div>
      </div>
    </div>
  )
}
