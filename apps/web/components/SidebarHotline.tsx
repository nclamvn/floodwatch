'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Sidebar Emergency Hotline Component
 * Comprehensive list of emergency and disaster relief numbers for Vietnam
 * Positioned in sidebar with expandable sections
 */

export function SidebarHotline() {
  const [isExpanded, setIsExpanded] = useState(false)

  // Primary emergency numbers - always visible
  const primaryNumbers = [
    { number: '112', label: 'Cứu Nạn', icon: '🆘', color: 'bg-red-600' },
    { number: '113', label: 'Cảnh Sát', icon: '👮', color: 'bg-blue-600' },
    { number: '114', label: 'Cứu Hỏa', icon: '🔥', color: 'bg-orange-600' },
    { number: '115', label: 'Cấp Cứu', icon: '🚑', color: 'bg-green-600' },
  ]

  // Secondary/relief numbers - shown when expanded
  const secondaryNumbers = [
    { number: '1022', label: 'Dịch vụ công - PCTT', description: 'Báo ngập lụt' },
    { number: '1900 1260', label: 'Dự báo thời tiết', description: 'Cảnh báo bão lũ 24/7' },
    { number: '080.43162', label: 'BAN CHỈNH ĐẠO QUỐC GIA PCTT', description: 'Trung ương' },
    { number: '024.37333664', label: 'Cục Cứu hộ - Cứu nạn', description: 'Bộ Quốc phòng' },
  ]

  // Relief/donation numbers
  const reliefNumbers = [
    { number: '0984 242 025', label: 'Ban Cứu trợ MTTQ VN', description: 'Tiếp nhận ủng hộ' },
    { number: '0933 026 868', label: 'Ban Cứu trợ MTTQ VN' },
    { number: '0786 675 133', label: 'Ban Cứu trợ MTTQ VN' },
    { number: '024.3826.4368', label: 'Văn phòng Ban Cứu trợ', description: 'MTTQ Trung ương' },
  ]

  const handleCall = (number: string) => {
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
      window.location.href = `tel:${number.replace(/[.\s]/g, '')}`
    }
  }

  return (
    <div className="mx-4 mt-4 mb-3 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-2 border-yellow-500/40 dark:border-yellow-500/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg animate-pulse">🚨</span>
          <span className="text-xs font-bold text-white uppercase tracking-wide">
            SỐ KHẨN CẤP
          </span>
        </div>
      </div>

      {/* Primary Emergency Numbers - Always Visible */}
      <div className="p-3 space-y-1.5">
        {primaryNumbers.map((item) => (
          <button
            key={item.number}
            onClick={() => handleCall(item.number)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 ${item.color} hover:opacity-90 active:scale-98 rounded-md transition-all group`}
            aria-label={`Gọi ${item.label}: ${item.number}`}
          >
            <span className="text-base">{item.icon}</span>
            <div className="flex-1 text-left">
              <div className="text-white font-bold text-sm">{item.number}</div>
              <div className="text-white/90 text-[10px]">{item.label}</div>
            </div>
            <svg className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        ))}
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-yellow-100/50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors flex items-center justify-center gap-2 text-xs font-medium text-yellow-800 dark:text-yellow-200"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Thu gọn</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Xem thêm số hỗ trợ & cứu trợ</span>
          </>
        )}
      </button>

      {/* Secondary Numbers - Expandable */}
      {isExpanded && (
        <div className="border-t border-yellow-200 dark:border-yellow-800/30">
          {/* Support Numbers */}
          <div className="px-3 pt-3 pb-2">
            <div className="text-[10px] font-bold text-yellow-800 dark:text-yellow-200 uppercase tracking-wide mb-2">
              📞 Hỗ trợ & Dự báo
            </div>
            <div className="space-y-1">
              {secondaryNumbers.map((item) => (
                <button
                  key={item.number}
                  onClick={() => handleCall(item.number)}
                  className="w-full text-left px-2 py-1.5 bg-white/50 dark:bg-neutral-800/30 hover:bg-white dark:hover:bg-neutral-800/50 rounded border border-yellow-200/50 dark:border-yellow-800/20 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-yellow-900 dark:text-yellow-100">{item.number}</div>
                      <div className="text-[10px] text-yellow-700 dark:text-yellow-300">{item.label}</div>
                      {item.description && (
                        <div className="text-[9px] text-yellow-600 dark:text-yellow-400 italic">{item.description}</div>
                      )}
                    </div>
                    <svg className="w-3 h-3 text-yellow-600 dark:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Relief/Donation Numbers */}
          <div className="px-3 pb-3">
            <div className="text-[10px] font-bold text-yellow-800 dark:text-yellow-200 uppercase tracking-wide mb-2">
              💰 Ủng hộ & Cứu trợ
            </div>
            <div className="space-y-1">
              {reliefNumbers.map((item) => (
                <button
                  key={item.number}
                  onClick={() => handleCall(item.number)}
                  className="w-full text-left px-2 py-1.5 bg-white/50 dark:bg-neutral-800/30 hover:bg-white dark:hover:bg-neutral-800/50 rounded border border-yellow-200/50 dark:border-yellow-800/20 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-yellow-900 dark:text-yellow-100">{item.number}</div>
                      <div className="text-[10px] text-yellow-700 dark:text-yellow-300">{item.label}</div>
                      {item.description && (
                        <div className="text-[9px] text-yellow-600 dark:text-yellow-400 italic">{item.description}</div>
                      )}
                    </div>
                    <svg className="w-3 h-3 text-yellow-600 dark:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
