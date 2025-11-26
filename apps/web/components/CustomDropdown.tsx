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
      {/* Dropdown Button - Design System 2025 with subtle shadow */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 glass border border-slate-800/30 dark:border-neutral-700/30 rounded-pill text-body-2 font-semibold text-slate-900 dark:text-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.1)] hover:bg-white/95 dark:hover:bg-neutral-900/90 focus:outline-none focus:ring-2 focus:ring-neutral-500/50 transition-all duration-ui ease-smooth cursor-pointer flex items-center justify-center gap-2"
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`w-3 h-3 text-slate-900 dark:text-neutral-100 transition-transform duration-ui ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu - Design System 2025 with subtle shadow */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-ui">
          <div className="glass border border-slate-800/30 dark:border-neutral-700/30 rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.1)] overflow-hidden">
            <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left text-body-2 transition-all duration-ui ease-smooth ${
                    option.value === value
                      ? 'bg-neutral-500/20 text-neutral-700 dark:text-neutral-400 font-semibold'
                      : 'text-slate-900 dark:text-neutral-300 hover:bg-white/60 dark:hover:bg-white/10'
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
