'use client'

import { useState, KeyboardEvent, useEffect, useRef } from 'react'
import { Newspaper } from 'lucide-react'

interface RegionalSummaryInputProps {
  onSearch: (province: string) => void
  isLoading: boolean
}

export default function RegionalSummaryInput({ onSearch, isLoading }: RegionalSummaryInputProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-collapse when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isExpanded && !isLoading) {
          setIsExpanded(false)
        }
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside as any)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside as any)
    }
  }, [isExpanded, isLoading])

  const handleSearch = () => {
    if (inputValue.trim() && !isLoading) {
      onSearch(inputValue.trim())
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleExpand = () => {
    setIsExpanded(true)
  }

  // Collapsed state - 3D Frosted Glass Sphere with Newspaper Icon - Apple Premium Design
  if (!isExpanded) {
    return (
      <div data-testid="regional-summary-button" className="fixed left-1/2 -translate-x-1/2 z-40" style={{ bottom: '207px' }}>
        <button
          onClick={handleExpand}
          className="relative group"
          aria-label="Hỏi AI về tình hình địa phương"
        >
          {/* 3D Frosted Glass Sphere - Premium Apple Style with Enhanced Lighting */}
          <div className="relative w-[46px] h-[46px] rounded-full overflow-hidden backdrop-blur-2xl
                          bg-gradient-to-br from-white/50 via-neutral-100/40 to-neutral-200/50
                          dark:from-neutral-700/50 dark:via-neutral-800/40 dark:to-neutral-900/50
                          border border-white/70 dark:border-neutral-600/70
                          shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]
                          dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]">

            {/* Animated lighting beam - sweeping shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent
                              translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
            </div>

            {/* Top highlight for 3D effect - stronger */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/60 dark:from-white/30 via-transparent to-transparent" />

            {/* Bottom shadow for 3D depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-500/25 dark:from-black/40 via-transparent to-transparent" />

            {/* Newspaper Icon - Theme-aware: White in light, Black in dark */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Newspaper
                className="w-5 h-5 text-white dark:text-black
                           drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]
                           dark:drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]"
                strokeWidth={2.5}
              />
            </div>

            {/* Subtle inner glow for depth */}
            <div className="absolute inset-[1px] rounded-full shadow-inner" />

            {/* Pulsing glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 dark:from-neutral-600/20 to-transparent animate-pulse" />
          </div>
        </button>
      </div>
    )
  }

  // Expanded state - Horizontal glass input (no icons, white text)
  return (
    <div ref={containerRef} data-testid="regional-summary-expanded" className="fixed left-1/2 -translate-x-1/2 w-[65%] max-w-[324px] z-40" style={{ bottom: '207px' }}>
      <div className="relative">
        {/* Glass container */}
        <div className="relative backdrop-blur-2xl bg-white/60 dark:bg-neutral-800/60 rounded-full border border-neutral-300/50 dark:border-neutral-700/50 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
          <div className="flex items-center px-4 py-2.5">
            {/* Input field - No icons, white text */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="VD: Đà Nẵng"
                disabled={isLoading}
                autoFocus
                className="w-full bg-transparent outline-none border-none text-gray-900 dark:text-white placeholder-gray-800 dark:placeholder-white text-sm disabled:opacity-50"
              />
              {/* Apple-style loading shimmer effect - elegant light sweep */}
              {isLoading && inputValue && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer-elegant bg-gradient-to-r from-transparent via-white/80 to-transparent blur-sm" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Apple-style Custom Animations */}
      <style jsx>{`
        @keyframes shimmer-elegant {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateX(200%);
            opacity: 0;
          }
        }

        .animate-shimmer-elegant {
          animation: shimmer-elegant 2s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  )
}
