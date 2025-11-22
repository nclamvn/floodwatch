'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Info,
  CloudRain,
  Waves,
  Droplets,
  Mountain,
  Dam,
  Wind,
  Sparkles,
  Construction,
  Siren,
  Building2,
  Newspaper,
  Users
} from 'lucide-react'

interface DisasterLegendProps {
  lastUpdated?: Date
  isOpen?: boolean
  onClose?: () => void
}

export default function DisasterLegend({ lastUpdated, isOpen, onClose }: DisasterLegendProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true) // Hidden by default
  const collapsed = isOpen !== undefined ? !isOpen : internalCollapsed
  const legendRef = useRef<HTMLDivElement>(null)

  // Close legend when clicking outside
  useEffect(() => {
    if (collapsed) return

    const handleClickOutside = (event: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(event.target as Node)) {
        if (onClose) {
          onClose()
        } else {
          setInternalCollapsed(true)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [collapsed, onClose])

  const severityLevels = [
    { label: 'Nghiêm trọng', color: 'bg-red-600', textColor: 'text-red-600' },
    { label: 'Cao', color: 'bg-orange-600', textColor: 'text-orange-600' },
    { label: 'Trung bình', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
    { label: 'Thấp', color: 'bg-gray-400', textColor: 'text-gray-500' },
  ]

  const disasterTypes = [
    { Icon: CloudRain, label: 'Mưa lớn', color: 'text-blue-500' },
    { Icon: Waves, label: 'Lũ lụt', color: 'text-red-600' },
    { Icon: Droplets, label: 'Ngập úng', color: 'text-blue-600' },
    { Icon: Mountain, label: 'Sạt lở', color: 'text-orange-600' },
    { Icon: Dam, label: 'Xả đập', color: 'text-purple-600' },
    { Icon: Wind, label: 'Bão', color: 'text-gray-700' },
    { Icon: Waves, label: 'Triều cường', color: 'text-cyan-600' },
    { Icon: Sparkles, label: 'Dự báo AI', color: 'text-purple-600' },
    { Icon: Construction, label: 'Giao thông', color: 'text-amber-600' },
    { Icon: Siren, label: 'Cứu hộ', color: 'text-red-700' },
  ]

  const dataSources = [
    { Icon: Building2, label: 'Chính phủ', description: 'KTTV, PCTT' },
    { Icon: Newspaper, label: 'Báo chí', description: 'VnExpress, Tuổi Trẻ' },
    { Icon: Users, label: 'Cộng đồng', description: 'Báo cáo từ dân' },
  ]

  // Don't show anything if controlled externally and closed
  if (collapsed && isOpen !== undefined) {
    return null
  }

  return (
    <div className="absolute top-24 left-3 sm:top-14 sm:left-4 z-40">
      {/* Expanded Panel */}
      {!collapsed && (
        <div ref={legendRef} className="absolute top-full left-0 mt-2 w-[calc(100vw-24px)] sm:w-72 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md rounded-lg shadow-sm border border-white/30 dark:border-neutral-700/30 overflow-hidden">
      {/* Header */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-neutral-700 to-neutral-800 dark:from-neutral-800 dark:to-neutral-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          <h3 className="font-bold text-sm">Chú giải</h3>
        </div>
        <button
          onClick={() => {
            if (onClose) {
              onClose()
            } else {
              setInternalCollapsed(true)
            }
          }}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          title="Đóng"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-2.5 sm:p-3 space-y-3 sm:space-y-4 max-h-[calc(100vh-250px)] sm:max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
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
            {disasterTypes.map(type => {
              const IconComponent = type.Icon
              return (
                <div key={type.label} className="flex items-center gap-1.5">
                  <IconComponent className={`w-4 h-4 ${type.color}`} />
                  <span className="text-xs text-gray-900 dark:text-neutral-300">{type.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Data Sources */}
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
            Nguồn dữ liệu
          </h4>
          <div className="space-y-2">
            {dataSources.map(source => {
              const IconComponent = source.Icon
              return (
                <div key={source.label} className="flex items-start gap-2">
                  <IconComponent className="w-4 h-4 mt-0.5 text-gray-900 dark:text-neutral-300" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-neutral-300">{source.label}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{source.description}</div>
                  </div>
                </div>
              )
            })}
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
      <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200/50 dark:border-neutral-700/50">
        <p className="text-xs text-neutral-300 dark:text-neutral-600 text-left">
          <span>© Thông tin mưa lũ - Lâm Nguyễn</span>
        </p>
      </div>
        </div>
      )}
    </div>
  )
}
