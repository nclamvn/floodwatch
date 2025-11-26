'use client'

import React from 'react'
import { useLocation } from '@/contexts/LocationContext'

export default function LocateMeButton() {
  const { userLocation, isLocating, error, requestLocation, clearLocation } = useLocation()

  return (
    <div className="absolute top-[calc(50%+60px)] right-4 z-30 flex flex-col gap-2">
      {/* Main Locate Button - 44px on mobile, 36px on desktop */}
      <button
        onClick={requestLocation}
        disabled={isLocating}
        className={`
          w-11 h-11 sm:w-9 sm:h-9 rounded-full shadow-soft-lg
          flex items-center justify-center
          transition-all duration-200
          ${
            userLocation
              ? 'bg-neutral-600 hover:bg-neutral-700 text-white'
              : 'bg-white/90 hover:bg-white text-neutral-800'
          }
          ${isLocating ? 'cursor-wait opacity-70' : 'cursor-pointer'}
          backdrop-blur supports-[backdrop-filter]:backdrop-blur
          border border-white/20
          hover:scale-105 active:scale-95
        `}
        aria-label="Lấy vị trí của tôi"
        title={userLocation ? 'Cập nhật vị trí' : 'Lấy vị trí của tôi'}
      >
        {isLocating ? (
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )}
      </button>

      {/* Clear location button (when active) - 44px on mobile, 36px on desktop */}
      {userLocation && !isLocating && (
        <button
          onClick={clearLocation}
          className="
            w-11 h-11 sm:w-9 sm:h-9 rounded-full shadow-soft-lg
            bg-white/90 hover:bg-white text-neutral-600 hover:text-red-600
            flex items-center justify-center
            transition-all duration-200
            backdrop-blur supports-[backdrop-filter]:backdrop-blur
            border border-white/20
            hover:scale-105 active:scale-95
          "
          aria-label="Xóa vị trí"
          title="Xóa vị trí"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Error toast */}
      {error && (
        <div
          className="
            absolute top-0 right-16
            bg-red-500 text-white
            px-4 py-2 rounded-lg shadow-lg
            text-sm font-medium
            max-w-xs
            animate-slide-in-right
          "
        >
          {error}
        </div>
      )}

      {/* Location info (when active) */}
      {userLocation && !error && (
        <div
          className="
            absolute top-0 right-16
            bg-white/95 dark:bg-neutral-950/95
            px-4 py-2 rounded-lg shadow-lg
            text-xs
            max-w-xs
            backdrop-blur supports-[backdrop-filter]:backdrop-blur
            border border-white/20
          "
        >
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-semibold mb-1">
            <span className="inline-block w-2 h-2 bg-neutral-600 rounded-full animate-pulse" />
            Vị trí của bạn
          </div>
          <div className="text-neutral-600 dark:text-neutral-400">
            {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
          </div>
          {userLocation.accuracy && (
            <div className="text-neutral-500 dark:text-neutral-500 text-xs mt-1">
              Độ chính xác: ±{Math.round(userLocation.accuracy)}m
            </div>
          )}
        </div>
      )}
    </div>
  )
}
