'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown,
  AlertOctagon,
  Shield,
  Flame,
  Ambulance,
  Phone,
  CloudSun,
  Building2,
  HardHat,
  Banknote,
  HandHeart,
  PhoneIncoming,
  Smartphone,
  PhoneForwarded,
  Building
} from 'lucide-react'

/**
 * Sidebar Scrolling Hotline Ticker
 * Similar to NewsTicker at bottom, but for emergency hotlines in sidebar
 * Scrolls continuously with comprehensive disaster relief numbers
 * Click to show dropdown with all numbers
 */

export function SidebarHotlineTicker() {
  const [isPaused, setIsPaused] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Comprehensive hotline list from user (shortened labels for better visibility)
  const hotlines = [
    { Icon: AlertOctagon, label: 'SOS', number: '112', description: 'Ưu tiên gọi đầu tiên' },
    { Icon: Shield, label: 'Cảnh sát', number: '113', description: 'Cảnh sát & cứu hộ' },
    { Icon: Flame, label: 'Cứu hỏa', number: '114', description: 'Cứu hỏa cứu nạn cứu hộ' },
    { Icon: Ambulance, label: 'Cấp cứu', number: '115', description: 'Cấp cứu y tế' },
    { Icon: Phone, label: 'PCTT', number: '1022', description: 'Báo ngập lụt, hỗ trợ địa phương' },
    { Icon: CloudSun, label: 'Thời tiết', number: '1900 1260', description: 'Cảnh báo bão lũ 24/7' },
    { Icon: Building2, label: 'BCĐ PCTT', number: '080.43162', description: 'Trung ương' },
    { Icon: HardHat, label: 'Cứu hộ QP', number: '024.37333664', description: 'Bộ Quốc phòng' },
    { Icon: Banknote, label: 'Cứu trợ 1', number: '0984 242 025', description: 'Tiếp nhận ủng hộ' },
    { Icon: HandHeart, label: 'Cứu trợ 2', number: '0933 026 868', description: 'MTTQ Việt Nam' },
    { Icon: PhoneIncoming, label: 'Cứu trợ 3', number: '0786 675 133', description: 'MTTQ Việt Nam' },
    { Icon: Smartphone, label: 'Cứu trợ 4', number: '0983 218 721', description: 'MTTQ Việt Nam' },
    { Icon: PhoneForwarded, label: 'Cứu trợ 5', number: '0819 889 888', description: 'MTTQ Việt Nam' },
    { Icon: Building, label: 'VP Cứu trợ', number: '024.3826.4368', description: 'MTTQ Trung ương' },
  ]

  const handleCall = (number: string) => {
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
      window.location.href = `tel:${number.replace(/[.\s]/g, '')}`
    }
  }

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isDropdownOpen])

  return (
    <div className="mx-4 mt-3 mb-2 relative" ref={dropdownRef}>
      {/* Scrolling Ticker */}
      <div
        className="h-10 bg-gray-100 border-2 border-red-400 rounded-full overflow-hidden relative shadow-md cursor-pointer hover:border-red-500 transition-colors"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        {/* Label Area - Fixed on left - Pill shape */}
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center bg-red-500 px-3 rounded-l-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-white ml-1.5 uppercase tracking-wide">
            HOTLINE
          </span>
          <ChevronDown className={`w-3 h-3 text-white ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Scrolling Content Container */}
        <div
          className="flex items-center h-full"
          style={{
            paddingLeft: '70px', // Space for label + icon (optimized for visibility)
            animation: isPaused ? 'none' : 'tickerSidebar 35s linear infinite',
          }}
        >
          {/* Duplicate content for seamless infinite loop */}
          {[...hotlines, ...hotlines].map((item, idx) => {
            const IconComponent = item.Icon
            return (
              <div
                key={`${item.number}-${idx}`}
                className="inline-flex items-center gap-1 px-2.5 flex-shrink-0"
              >
                <IconComponent className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-700 whitespace-nowrap">
                  {item.label}: <span className="font-bold">{item.number}</span>
                </span>
                {/* Separator */}
                <span className="text-red-300 mx-1 text-sm">•</span>
              </div>
            )
          })}
        </div>

        {/* CSS Animation - Fixed pixel value for proper infinite scroll */}
        <style jsx>{`
          @keyframes tickerSidebar {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-1400px);
            }
          }
        `}</style>
      </div>

      {/* Dropdown List - Appears on click */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-red-400 rounded-lg shadow-lg overflow-hidden z-20 max-h-96 overflow-y-auto">
          <div className="p-2 space-y-1">
            {hotlines.map((item, idx) => {
              const IconComponent = item.Icon
              return (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCall(item.number)
                    setIsDropdownOpen(false)
                  }}
                  className="w-full flex items-start gap-2 p-2 hover:bg-red-50 rounded-md transition-colors group text-left"
                >
                  <IconComponent className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-red-700">{item.label}</span>
                      <span className="text-sm font-bold text-red-900 tabular-nums">{item.number}</span>
                    </div>
                    <p className="text-[10px] text-red-600/70 mt-0.5">{item.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
