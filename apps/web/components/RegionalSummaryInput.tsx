'use client'

import { useState, KeyboardEvent, useEffect, useRef } from 'react'
import { Search, Send } from 'lucide-react'

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

  // Collapsed state - Circular glass button with animated border
  if (!isExpanded) {
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-32 z-30">
        <button
          onClick={handleExpand}
          className="relative group"
          aria-label="Hỏi AI về tình hình địa phương"
        >
          {/* Animated glowing border */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-75 blur-sm animate-spin-slow" />
          <div className="absolute inset-[2px] rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-spin-slow" />

          {/* Glass button */}
          <div className="relative w-16 h-16 rounded-full backdrop-blur-xl bg-white/30 dark:bg-white/10 border border-white/50 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              Hỏi
            </span>
          </div>
        </button>
      </div>
    )
  }

  // Expanded state - Horizontal glass input
  return (
    <div ref={containerRef} className="fixed left-1/2 -translate-x-1/2 bottom-32 z-30 w-[90%] max-w-md">
      <div className="relative">
        {/* Glass container */}
        <div className="relative backdrop-blur-xl bg-white/30 dark:bg-white/10 rounded-full border border-white/50 shadow-2xl overflow-hidden">
          {/* Loading shimmer effect */}
          {isLoading && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </div>
          )}

          <div className="flex items-center gap-2 px-6 py-4">
            {/* Search icon */}
            <Search className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" />

            {/* Input field */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="VD: Tình hình Đà Nẵng"
              disabled={isLoading}
              autoFocus
              className="flex-1 bg-transparent outline-none border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base disabled:opacity-50"
            />

            {/* Loading text or Send button */}
            {isLoading ? (
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex-shrink-0 animate-pulse">
                Đang nghĩ...
              </span>
            ) : inputValue.trim() ? (
              <button
                onClick={handleSearch}
                className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 transition-colors flex-shrink-0"
                aria-label="Tìm kiếm"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }

        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
