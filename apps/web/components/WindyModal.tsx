'use client'

import { Wind, X, Info } from 'lucide-react'

interface WindyModalProps {
  isOpen: boolean
  onClose: () => void
  initialLat?: number
  initialLon?: number
  initialZoom?: number
}

export function WindyModal({
  isOpen,
  onClose,
  initialLat = 16.5,
  initialLon = 107.5,
  initialZoom = 7
}: WindyModalProps) {
  if (!isOpen) return null

  // Windy embed URL with parameters
  const windyUrl = `https://embed.windy.com/embed2.html?lat=${initialLat}&lon=${initialLon}&detailLat=${initialLat}&detailLon=${initialLon}&width=650&height=450&zoom=${initialZoom}&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl mx-4 h-[80vh] bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/30 dark:border-neutral-700/30 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200/50 dark:border-gray-700 bg-gradient-to-r from-emerald-100/80 to-blue-100/80 dark:from-emerald-950 dark:to-blue-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
              <Wind className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Dự báo thời tiết Windy
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bản đồ thời tiết tương tác - Miền Trung Việt Nam
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/80 hover:bg-white/95 dark:bg-gray-800/80 dark:hover:bg-gray-700 border border-white/30 dark:border-white/10 text-gray-900 dark:text-gray-300 hover:text-black dark:hover:text-white transition-all flex items-center justify-center shadow-sm backdrop-blur-md hover:scale-105 active:scale-95"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Windy Iframe */}
        <div className="relative w-full h-[calc(100%-80px)]">
          <iframe
            src={windyUrl}
            className="w-full h-full border-none"
            title="Windy Weather Map"
            loading="lazy"
          />

          {/* Info Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-white text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>
                Dữ liệu từ <strong>Windy.com</strong> - Click vào bản đồ để xem chi tiết, chọn layer từ menu bên phải
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
