'use client'

import Image from 'next/image'
import Link from 'next/link'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const SIZES = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const dimension = SIZES[size]

  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <div
        className="relative flex-shrink-0 rounded-xl overflow-hidden shadow-lg"
        style={{ width: dimension, height: dimension }}
      >
        <Image
          src="/images/logo.png"
          alt="Thông tin mưa lũ"
          width={dimension}
          height={dimension}
          className="object-cover"
          priority
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
            {size === 'sm' ? 'TTML' : 'Thông tin mưa lũ'}
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              thongtinmualu.live
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
