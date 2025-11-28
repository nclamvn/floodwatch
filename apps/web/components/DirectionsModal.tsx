'use client'

import { X, ExternalLink, Navigation, AlertCircle } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'

interface DirectionsModalProps {
  lat: number
  lon: number
  address?: string
  destinationName: string
  onClose: () => void
}

/**
 * DirectionsModal Component (Phase 6.1)
 *
 * Modal displaying Google Maps directions using Embed API.
 * - Desktop: 96% width, 80vh height modal
 * - Mobile: Fullscreen with options to open in Google Maps app
 * - Loading states and fallback to direct Google Maps link
 * - iframe sandbox for security
 */
export default function DirectionsModal({
  lat,
  lon,
  address,
  destinationName,
  onClose
}: DirectionsModalProps) {
  const t = useTranslations('directions')
  const tCommon = useTranslations('common')
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile on mount (avoid SSR mismatch)
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  // Memoize URLs to avoid re-computation on re-render
  const embedUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? `https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&origin=current+location&destination=${lat},${lon}&mode=driving`
      : null
  }, [lat, lon])

  const fallbackUrl = useMemo(() => {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
  }, [lat, lon])

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 pointer-events-none">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] md:max-h-[80vh] overflow-hidden flex flex-col pointer-events-auto animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Navigation className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-50 truncate">
                  {t('title')} - {destinationName}
                </h2>
                {address && (
                  <p className="text-sm text-slate-600 dark:text-neutral-400 truncate">
                    {address}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
              aria-label={tCommon('close')}
            >
              <X className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 relative bg-neutral-100 dark:bg-neutral-950">
            {/* Google Maps Embed - Only if API key is configured */}
            {embedUrl ? (
              <>
                {/* Loading State */}
                {isLoading && !hasError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-950">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-lg font-medium text-slate-700 dark:text-neutral-200">
                        Đang tải bản đồ...
                      </p>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {hasError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 p-6">
                    <div className="text-center max-w-md">
                      <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-slate-900 dark:text-neutral-50 mb-2">
                        Không thể tải bản đồ
                      </h3>
                      <p className="text-slate-600 dark:text-neutral-400 mb-6">
                        Đã xảy ra lỗi khi tải Google Maps. Vui lòng sử dụng nút bên dưới để mở trong Google Maps.
                      </p>
                      <a
                        href={fallbackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-5 h-5" />
                        {t('googleMaps')}
                      </a>
                    </div>
                  </div>
                )}

                {/* iframe - Google Maps Embed */}
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  title="Google Maps Directions"
                />
              </>
            ) : (
              /* No API Key - Show fallback */
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 p-6">
                <div className="text-center max-w-md">
                  <AlertCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 dark:text-neutral-50 mb-2">
                    Google Maps Embed chưa được cấu hình
                  </h3>
                  <p className="text-slate-600 dark:text-neutral-400 mb-6">
                    Để hiển thị bản đồ nhúng, vui lòng thêm <code className="bg-neutral-200 dark:bg-neutral-800 px-2 py-1 rounded text-sm">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> vào file .env
                  </p>
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                    {t('googleMaps')}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Quick Actions */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Mobile: Open in Google Maps App */}
              {isMobile && (
                <a
                  href={`https://maps.google.com/?q=${lat},${lon}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Navigation className="w-5 h-5" />
                  {t('googleMaps')}
                </a>
              )}

              {/* Open in new tab */}
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                {t('googleMaps')}
              </a>

              {/* Close button */}
              <button
                onClick={onClose}
                className="px-4 py-3 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-medium rounded-lg transition-colors"
              >
                {t('close')}
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
    </>
  )
}
