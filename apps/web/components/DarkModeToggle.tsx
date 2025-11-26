'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

/**
 * Dark Mode Toggle Button
 *
 * Features:
 * - Manual toggle between light/dark mode
 * - Persists preference to localStorage
 * - Auto-detects initial state from localStorage or OS preference
 * - Smooth animations following Design System 2025
 * - Frosted glass effect matching map controls
 */

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Initialize dark mode state on mount
  useEffect(() => {
    setMounted(true)

    // Check current state from DOM (set by initial script in layout.tsx)
    const htmlElement = document.documentElement
    const currentIsDark = htmlElement.classList.contains('dark')
    setIsDark(currentIsDark)
  }, [])

  const toggleDarkMode = () => {
    const htmlElement = document.documentElement
    const newIsDark = !isDark

    if (newIsDark) {
      htmlElement.classList.add('dark')
      localStorage.theme = 'dark'
    } else {
      htmlElement.classList.remove('dark')
      localStorage.theme = 'light'
    }

    setIsDark(newIsDark)
  }

  // Prevent hydration mismatch - don't render until mounted
  if (!mounted) {
    return (
      <button
        className="w-11 h-11 sm:w-9 sm:h-9 rounded-full backdrop-blur-md border bg-white/80 border-white/30 dark:bg-gray-800/80 dark:border-white/10 flex items-center justify-center shadow-sm opacity-0"
        disabled
        aria-label="Loading theme toggle"
      >
        <Sun className="w-5 h-5 sm:w-4 sm:h-4" />
      </button>
    )
  }

  return (
    <button
      onClick={toggleDarkMode}
      className="w-11 h-11 sm:w-9 sm:h-9 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] transition-all duration-ui ease-smooth hover:scale-105 active:scale-95 bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-700/80 dark:border-neutral-700/50"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
    >
      {isDark ? (
        <Moon className="w-5 h-5 sm:w-4 sm:h-4 transition-transform duration-ui ease-smooth" />
      ) : (
        <Sun className="w-5 h-5 sm:w-4 sm:h-4 transition-transform duration-ui ease-smooth" />
      )}
    </button>
  )
}
