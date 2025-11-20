'use client'

import { useState, useEffect, useRef } from 'react'
import { Info } from 'lucide-react'

interface DisasterLegendProps {
  lastUpdated?: Date
}

export default function DisasterLegend({ lastUpdated }: DisasterLegendProps) {
  const [collapsed, setCollapsed] = useState(true) // Hidden by default
  const legendRef = useRef<HTMLDivElement>(null)

  // Close legend when clicking outside
  useEffect(() => {
    if (collapsed) return

    const handleClickOutside = (event: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(event.target as Node)) {
        setCollapsed(true)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [collapsed])

  const severityLevels = [
    { label: 'Nghiêm trọng', color: 'bg-red-600', textColor: 'text-red-600' },
    { label: 'Cao', color: 'bg-orange-600', textColor: 'text-orange-600' },
    { label: 'Trung bình', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
    { label: 'Thấp', color: 'bg-gray-400', textColor: 'text-gray-500' },
  ]

  const disasterTypes = [
    { icon: '🌧️', label: 'Mưa lớn', color: 'text-blue-500' },
    { icon: '🌊', label: 'Lũ lụt', color: 'text-red-600' },
    { icon: '💧', label: 'Ngập úng', color: 'text-blue-600' },
    { icon: '⛰️', label: 'Sạt lở', color: 'text-orange-600' },
    { icon: '🏗️', label: 'Xả đập', color: 'text-purple-600' },
    { icon: '🌀', label: 'Bão', color: 'text-gray-700' },
    { icon: '🌊', label: 'Triều cường', color: 'text-cyan-600' },
    { icon: '🚧', label: 'Giao thông', color: 'text-amber-600' },
    { icon: '🆘', label: 'Cứu hộ', color: 'text-red-700' },
  ]

  const dataSources = [
    { icon: '🏛️', label: 'Chính phủ', description: 'KTTV, PCTT' },
    { icon: '📰', label: 'Báo chí', description: 'VnExpress, Tuổi Trẻ' },
    { icon: '👥', label: 'Cộng đồng', description: 'Báo cáo từ dân' },
  ]

  if (collapsed) {
    return (
      <div className="absolute bottom-40 right-4 z-40">
        <button
          onClick={() => setCollapsed(false)}
          className="w-12 h-12 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-full shadow-lg border border-white/20 dark:border-neutral-700/30 flex items-center justify-center hover:bg-white dark:hover:bg-neutral-800 transition-colors"
          title="Mở chú giải"
        >
          <Info className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
        </button>
      </div>
    )
  }

  return (
    <div ref={legendRef} className="absolute bottom-40 right-4 z-40 w-72 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-lg shadow-lg border border-white/20 dark:border-neutral-700/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-neutral-700 to-neutral-800 dark:from-neutral-800 dark:to-neutral-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          <h3 className="font-bold text-sm">Chú giải</h3>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          title="Thu gọn"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
        {/* Severity Levels */}
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
            Mức độ nghiêm trọng
          </h4>
          <div className="space-y-1.5">
            {severityLevels.map(level => (
              <div key={level.label} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${level.color}`} />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{level.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Disaster Types */}
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
            Loại thiên tai
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {disasterTypes.map(type => (
              <div key={type.label} className="flex items-center gap-1.5">
                <span className="text-base">{type.icon}</span>
                <span className="text-xs text-neutral-700 dark:text-neutral-300">{type.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Sources */}
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
            Nguồn dữ liệu
          </h4>
          <div className="space-y-2">
            {dataSources.map(source => (
              <div key={source.label} className="flex items-start gap-2">
                <span className="text-base">{source.icon}</span>
                <div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{source.label}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{source.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="pt-2 border-t border-neutral-200/50 dark:border-neutral-700/50">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Cập nhật: {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200/50 dark:border-neutral-700/50">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-start gap-1">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>Click vào marker để xem chi tiết</span>
        </p>
      </div>
    </div>
  )
}
