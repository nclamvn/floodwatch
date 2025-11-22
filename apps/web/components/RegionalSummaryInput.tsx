'use client'

import { useState, KeyboardEvent, useEffect, useRef } from 'react'

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

  // Collapsed state - 3D Frosted Glass Sphere with "?" - Apple Premium Design
  if (!isExpanded) {
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[26px] z-30">
        <button
          onClick={handleExpand}
          className="relative group"
          aria-label="Hỏi AI về tình hình địa phương"
        >
          {/* 3D Frosted Glass Sphere - Premium Apple Style */}
          <div className="relative w-[46px] h-[46px] rounded-full overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-white/40 via-gray-100/30 to-gray-200/40 border border-white/60 shadow-2xl">
            {/* Top highlight for 3D effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-transparent" />

            {/* Bottom shadow for 3D depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-400/20 via-transparent to-transparent" />

            {/* Question Mark - Bold Black */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-black text-gray-900 select-none">?</span>
            </div>

            {/* Subtle inner shadow */}
            <div className="absolute inset-[1px] rounded-full shadow-inner" />
          </div>
        </button>
      </div>
    )
  }

  // Expanded state - Horizontal glass input (no icons, white text)
  return (
    <div ref={containerRef} className="fixed left-1/2 -translate-x-1/2 bottom-[26px] z-30 w-[65%] max-w-[324px]">
      <div className="relative">
        {/* Glass container */}
        <div className="relative backdrop-blur-xl bg-white/30 dark:bg-white/10 rounded-full border border-white/50 shadow-2xl overflow-hidden">
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
                className="w-full bg-transparent outline-none border-none text-white placeholder-white text-sm disabled:opacity-50"
              />
              {/* Loading shimmer effect on input text */}
              {isLoading && inputValue && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer-fast bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes shimmer-fast {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-shimmer-fast {
          animation: shimmer-fast 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
