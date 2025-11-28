'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('hotlines')
  const [isPaused, setIsPaused] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Comprehensive hotline list from user (shortened labels for better visibility)
  const hotlines = [
    { Icon: AlertOctagon, label: t('sos.label'), number: '112', description: t('sos.description') },
    { Icon: Shield, label: t('police.label'), number: '113', description: t('police.description') },
    { Icon: Flame, label: t('fire.label'), number: '114', description: t('fire.description') },
    { Icon: Ambulance, label: t('emergency.label'), number: '115', description: t('emergency.description') },
    { Icon: Phone, label: 'PCTT', number: '1022', description: t('rescue.description') },
    { Icon: CloudSun, label: t('power.label'), number: '1900 1260', description: t('power.description') },
    { Icon: Building2, label: 'BCĐ PCTT', number: '080.43162', description: t('rescue.description') },
    { Icon: HardHat, label: t('army.label'), number: '024.37333664', description: t('army.description') },
    { Icon: Banknote, label: t('redCross.label'), number: '0984 242 025', description: t('redCross.description') },
    { Icon: HandHeart, label: t('redCross.label'), number: '0933 026 868', description: 'MTTQ Việt Nam' },
    { Icon: PhoneIncoming, label: t('redCross.label'), number: '0786 675 133', description: 'MTTQ Việt Nam' },
    { Icon: Smartphone, label: t('redCross.label'), number: '0983 218 721', description: 'MTTQ Việt Nam' },
    { Icon: PhoneForwarded, label: t('redCross.label'), number: '0819 889 888', description: 'MTTQ Việt Nam' },
    { Icon: Building, label: t('redCross.label'), number: '024.3826.4368', description: 'MTTQ' },
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
      {/* Scrolling Ticker - Apple Premium Design */}
      <div
        className="h-10 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-xl border border-neutral-300/50 dark:border-neutral-700/50 rounded-full overflow-hidden relative shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] cursor-pointer hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition-all duration-200 hover:scale-[1.01]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        {/* Label Area - Fixed on left - Premium Pill */}
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center bg-red-500 dark:bg-red-600 px-3 rounded-l-full shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          <span className="text-[10px] font-bold text-white ml-1.5 uppercase tracking-wide drop-shadow-sm">
            HOTLINE
          </span>
          <ChevronDown className={`w-3 h-3 text-white ml-1 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Scrolling Content Container */}
        <div
          className="flex items-center h-full"
          style={{
            paddingLeft: '70px',
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
                <IconComponent className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {item.label}: <span className="font-bold text-red-600 dark:text-red-400">{item.number}</span>
                </span>
                {/* Separator */}
                <span className="text-neutral-300 dark:text-neutral-600 mx-1 text-sm">•</span>
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

      {/* Dropdown List - Premium Apple Card */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl border border-neutral-300/50 dark:border-neutral-700/50 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden z-20 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 space-y-1">
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
                  className="w-full flex items-start gap-2.5 p-2.5 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 rounded-xl transition-all duration-200 group text-left active:scale-[0.98]"
                >
                  <IconComponent className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{item.label}</span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">{item.number}</span>
                    </div>
                    <p className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-0.5">{item.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
