'use client'

import { useState, KeyboardEvent, useEffect } from 'react'
import { Search, Maximize2, Send, ChevronLeft } from 'lucide-react'

interface RegionalSummaryInputProps {
  onSearch: (province: string) => void
  isLoading: boolean
}

export default function RegionalSummaryInput({ onSearch, isLoading }: RegionalSummaryInputProps) {
  const [isExpanded, setIsExpanded] = useState(true) // Default expanded as per spec
  const [inputValue, setInputValue] = useState('')
  const [showGlow, setShowGlow] = useState(false) // Track when loading just completed

  // Track when loading completes to show glow effect
  useEffect(() => {
    if (!isLoading && inputValue.trim()) {
      setShowGlow(true)
      const timer = setTimeout(() => setShowGlow(false), 3000) // Glow for 3 seconds
      return () => clearTimeout(timer)
    } else {
      setShowGlow(false)
    }
  }, [isLoading, inputValue])

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

  // Collapsed state - circular button
  if (!isExpanded) {
    return (
      <div className="fixed bottom-40 right-4 z-40">
        <button
          onClick={() => setIsExpanded(true)}
          className="
            w-12 h-12 rounded-full shadow-lg
            bg-gray-700 hover:bg-gray-600
            border-2 border-gray-600
            text-white
            transition-all duration-200
            hover:scale-105 active:scale-95
            flex items-center justify-center
          "
          title="Xem tình hình chung theo khu vực"
          aria-label="Expand regional summary search"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // Expanded state - pill-shaped input
  return (
    <div className="fixed bottom-40 right-4 z-40">
      <div className="
        flex items-center gap-2
        h-12 px-4 rounded-full
        bg-gray-700/90 backdrop-blur-md
        border border-gray-600/50
        shadow-lg
        min-w-[320px] sm:min-w-[420px]
        transition-all duration-300
      ">
        {/* Search Icon */}
        <Search className="w-5 h-5 text-gray-300 flex-shrink-0" />

        {/* Input Field with Spotlight Effect */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Xem tình hình chung hôm nay... Bạn ở đâu?"
            disabled={isLoading}
            className={`
              w-full bg-transparent
              outline-none border-none
              text-white placeholder-gray-400
              text-sm
              disabled:opacity-50
              transition-all duration-300
              ${showGlow ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''}
            `}
            aria-label="Enter province name"
          />
          {/* Spotlight effect during loading */}
          {isLoading && inputValue && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-spotlight" />
            </div>
          )}
        </div>

        {/* Loading Text */}
        {isLoading && (
          <span className="text-xs text-white/80 font-medium flex-shrink-0 animate-pulse">
            Đang tổng hợp tin...
          </span>
        )}

        {/* Submit Button (shows when there's input and not loading) */}
        {!isLoading && inputValue.trim() && (
          <button
            onClick={handleSearch}
            className="
              p-1 rounded-full
              hover:bg-white/30
              text-white font-bold
              transition-colors
              flex-shrink-0
            "
            title="Xem tình hình"
            aria-label="Search"
          >
            <Send className="w-4 h-4 stroke-[1.5]" />
          </button>
        )}

        {/* Collapse Button */}
        <button
          onClick={() => setIsExpanded(false)}
          className="
            p-1 rounded-full
            hover:bg-gray-600
            text-gray-100
            transition-colors
            flex-shrink-0
          "
          title="Thu gọn"
          aria-label="Collapse"
        >
          <ChevronLeft className="w-5 h-5 stroke-[1.5]" />
        </button>
      </div>
    </div>
  )
}
