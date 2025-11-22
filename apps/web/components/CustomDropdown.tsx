'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface CustomDropdownProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  className = ''
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button - Frosted Glass Design with Dark Text */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-full text-sm font-semibold text-gray-900 dark:text-neutral-100 shadow-sm hover:bg-white/95 dark:hover:bg-neutral-900/90 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`w-3 h-3 text-gray-900 dark:text-neutral-100 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu - Frosted Glass Design */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-lg shadow-sm overflow-hidden">
            <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-all ${
                    option.value === value
                      ? 'bg-primary-500/20 text-primary-700 dark:text-primary-400 font-semibold'
                      : 'text-gray-900 dark:text-neutral-300 hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
