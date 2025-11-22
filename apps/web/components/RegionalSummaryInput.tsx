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

  // Collapsed state - Enhanced Siri-style button with vibrant dynamic waves
  if (!isExpanded) {
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[26px] z-30">
        <button
          onClick={handleExpand}
          className="relative group animate-button-breathe"
          aria-label="Hỏi AI về tình hình địa phương"
        >
          {/* Outer glow effect - ENHANCED: Brighter, larger, more visible */}
          <div className="absolute inset-[-12px] rounded-full bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-pink-500/50 blur-2xl animate-pulse-glow-enhanced opacity-90" />

          {/* Main button container */}
          <div className="relative w-[46px] h-[46px] rounded-full overflow-hidden backdrop-blur-xl bg-black/50 border border-white/30 shadow-2xl">
            {/* Siri-style animated gradient waves - Layer 1 - BRIGHTER & FASTER */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600 opacity-85 animate-siri-wave-1-fast" />

            {/* Siri-style animated gradient waves - Layer 2 - BRIGHTER & FASTER */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-blue-600 to-purple-700 opacity-75 animate-siri-wave-2-fast" />

            {/* Siri-style animated gradient waves - Layer 3 - BRIGHTER & FASTER */}
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 via-red-600 to-orange-600 opacity-65 animate-siri-wave-3-fast" />

            {/* Subtle radial gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-radial from-white/30 via-transparent to-black/40" />
          </div>
        </button>
      </div>
    )
  }

  // Expanded state - Horizontal glass input (120% larger, no icons, white text)
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
        @keyframes siri-wave-1-fast {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 0.85;
          }
          33% {
            transform: translate(-30%, -40%) scale(1.4) rotate(120deg);
            opacity: 0.7;
          }
          66% {
            transform: translate(-70%, -60%) scale(0.9) rotate(240deg);
            opacity: 0.95;
          }
        }

        @keyframes siri-wave-2-fast {
          0%, 100% {
            transform: translate(0%, 0%) scale(1.2) rotate(0deg);
            opacity: 0.75;
          }
          33% {
            transform: translate(20%, 30%) scale(0.8) rotate(-90deg);
            opacity: 0.85;
          }
          66% {
            transform: translate(-20%, 20%) scale(1.1) rotate(-180deg);
            opacity: 0.6;
          }
        }

        @keyframes siri-wave-3-fast {
          0%, 100% {
            transform: translate(50%, 50%) scale(0.9) rotate(180deg);
            opacity: 0.65;
          }
          33% {
            transform: translate(60%, 40%) scale(1.3) rotate(60deg);
            opacity: 0.75;
          }
          66% {
            transform: translate(30%, 60%) scale(1) rotate(-60deg);
            opacity: 0.5;
          }
        }

        @keyframes pulse-glow-enhanced {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes button-breathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes shimmer-fast {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-siri-wave-1-fast {
          animation: siri-wave-1-fast 2s ease-in-out infinite;
        }

        .animate-siri-wave-2-fast {
          animation: siri-wave-2-fast 2.5s ease-in-out infinite;
        }

        .animate-siri-wave-3-fast {
          animation: siri-wave-3-fast 3s ease-in-out infinite;
        }

        .animate-pulse-glow-enhanced {
          animation: pulse-glow-enhanced 2s ease-in-out infinite;
        }

        .animate-button-breathe {
          animation: button-breathe 3s ease-in-out infinite;
        }

        .animate-shimmer-fast {
          animation: shimmer-fast 1.5s ease-in-out infinite;
        }

        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  )
}
