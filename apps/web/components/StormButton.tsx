'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface StormButtonProps {
  onClick: () => void | Promise<void>
  className?: string
  isLoading?: boolean
}

export default function StormButton({ onClick, className = '', isLoading = false }: StormButtonProps) {
  const t = useTranslations('storm')
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    console.log('[StormButton] Clicked!')
    setLoading(true)
    try {
      await onClick()
    } finally {
      setLoading(false)
    }
  }

  const showLoading = isLoading || loading

  // Check if custom sizing is provided via className
  const hasCustomSize = className.includes('h-[') || className.includes('min-w-[')

  return (
    <button
      onClick={handleClick}
      disabled={showLoading}
      className={`
        ${hasCustomSize ? '' : 'px-6 py-2'}
        bg-yellow-500 hover:bg-yellow-600
        text-white font-semibold
        rounded-pill
        shadow-elevation-1
        transition-all duration-ui ease-smooth
        hover:shadow-elevation-2 hover:scale-105
        backdrop-blur-md
        border border-yellow-400
        disabled:opacity-70 disabled:cursor-wait
        flex items-center justify-center
        ${className}
      `}
      aria-label={t('info')}
    >
      <span className="whitespace-nowrap flex items-center gap-2">
        {showLoading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {t('button')}
      </span>
    </button>
  )
}
