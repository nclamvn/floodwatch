'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { MapPin, Route, HandHeart, Bell, Navigation, Users } from 'lucide-react'
import DarkModeToggle from '@/components/DarkModeToggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'

// Dynamic import for client-side rain effect
const RainEffect = dynamic(() => import('@/components/RainEffect'), {
  ssr: false,
})

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.thongtinmualu.live'

export default function Home() {
  const t = useTranslations('home')
  const tNav = useTranslations('nav')

  // Prefetch flag to avoid multiple fetches
  const prefetchedRef = useRef(false)

  // Prefetch map data when hovering over the map card
  const handleMapHover = useCallback(() => {
    if (prefetchedRef.current) return
    prefetchedRef.current = true

    // Prefetch main APIs used by /map page in parallel
    // These will be cached by browser and by our API's Cache-Control headers
    Promise.all([
      fetch(`${API_URL}/reports?limit=200`),
      fetch(`${API_URL}/hazards?lat=16&lng=106&radius_km=500`),
    ]).catch(() => {
      // Silently ignore prefetch errors - not critical
      prefetchedRef.current = false
    })
  }, [])
  return (
    <main className="relative min-h-screen bg-white dark:bg-neutral-950 overflow-hidden">
      {/* Rain Effect Background */}
      <RainEffect />

      {/* Subtle Professional Background - Light */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950" />

      {/* Subtle Grid Pattern for Professional Feel */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
        backgroundSize: '64px 64px'
      }} />

      {/* Main Content - lifted up by 48px from center */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-32" style={{ marginTop: '-48px' }}>
        <div className="w-full max-w-7xl space-y-16">

          {/* Hero Section - Professional & Serious */}
          <div className="text-center space-y-10">

            {/* Professional Badge with Theme Toggle and Language Switcher */}
            <div className="inline-flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-slate-200 dark:border-neutral-800 shadow-sm">
              <DarkModeToggle />
              <span className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                {t('subtitle')}
              </span>
              <div className="w-px h-4 bg-slate-200 dark:bg-neutral-700" />
              <LanguageSwitcher />
            </div>

            {/* Hero Title - Professional Typography (2 lines) */}
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight leading-[0.95] text-slate-900 dark:text-white">
                {/* Split title into 2 lines: first word(s) + last word(s) */}
                {(() => {
                  const words = t('title').split(' ')
                  // For Vietnamese "Thông tin Mưa lũ": line1="Thông tin", line2="Mưa lũ"
                  // For English "Flood Watch": line1="Flood", line2="Watch"
                  const midpoint = Math.ceil(words.length / 2)
                  const line1 = words.slice(0, midpoint).join(' ')
                  const line2 = words.slice(midpoint).join(' ')
                  return (
                    <>
                      <span>{line1}</span>
                      <br />
                      <span>{line2}</span>
                    </>
                  )
                })()}
              </h1>

              {/* Simple Underline - Minimal */}
              <div className="flex justify-center">
                <div className="h-1 w-20 bg-slate-900 dark:bg-white rounded-full" />
              </div>
            </div>

            {/* Subtitle - Clear & Direct (80% smaller) */}
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed font-light">
              {t('tagline')}
            </p>
          </div>

          {/* Feature Cards - Professional & Clean */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Map Card - Minimal Blue */}
            <Link
              href="/map"
              onMouseEnter={handleMapHover}
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 p-10 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Subtle Gradient on Hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-100/0 dark:from-blue-950/0 dark:to-blue-900/0 group-hover:from-blue-50/50 group-hover:to-blue-100/30 dark:group-hover:from-blue-950/20 dark:group-hover:to-blue-900/10 transition-all duration-500" />

              <div className="relative space-y-6 z-10">
                {/* Icon + Title - Same Row */}
                <div className="flex items-center gap-4">
                  <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-all duration-500">
                    <MapPin className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white">
                    {t('cards.map.title')}
                  </h3>
                </div>

                <p className="text-slate-600 dark:text-neutral-400 text-base leading-relaxed">
                  {t('cards.map.description')}
                </p>

                {/* Simple Arrow */}
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                  <span>{t('cards.map.action')}</span>
                  <svg
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Routes Card - Minimal Green */}
            <Link
              href="/routes"
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 p-10 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-green-100/0 dark:from-emerald-950/0 dark:to-green-900/0 group-hover:from-emerald-50/50 group-hover:to-green-100/30 dark:group-hover:from-emerald-950/20 dark:group-hover:to-green-900/10 transition-all duration-500" />

              <div className="relative space-y-6 z-10">
                {/* Icon + Title - Same Row */}
                <div className="flex items-center gap-4">
                  <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-all duration-500">
                    <Route className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white">
                    {t('cards.routes.title')}
                  </h3>
                </div>

                <p className="text-slate-600 dark:text-neutral-400 text-base leading-relaxed">
                  {t('cards.routes.description')}
                </p>

                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                  <span>{t('cards.routes.action')}</span>
                  <svg
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Help Card - Minimal Red */}
            <Link
              href="/help"
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 p-10 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 md:col-span-2 lg:col-span-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-rose-100/0 dark:from-red-950/0 dark:to-rose-900/0 group-hover:from-red-50/50 group-hover:to-rose-100/30 dark:group-hover:from-red-950/20 dark:group-hover:to-rose-900/10 transition-all duration-500" />

              <div className="relative space-y-6 z-10">
                {/* Icon + Title - Same Row */}
                <div className="flex items-center gap-4">
                  <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 group-hover:text-red-700 dark:group-hover:text-red-400 transition-all duration-500">
                    <HandHeart className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white">
                    {t('cards.rescue.title')}
                  </h3>
                </div>

                <p className="text-slate-600 dark:text-neutral-400 text-base leading-relaxed">
                  {t('cards.rescue.description')}
                </p>

                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                  <span>{t('cards.rescue.action')}</span>
                  <svg
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          {/* Features Grid - Professional & Minimal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center space-y-4">
              <div className="inline-flex p-5 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                <Bell className="w-10 h-10" strokeWidth={1.5} />
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{t('features.realtime')}</h4>
              <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">
                {t('features.realtimeDesc')}
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex p-5 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                <Navigation className="w-10 h-10" strokeWidth={1.5} />
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{t('features.location')}</h4>
              <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">
                {t('features.locationDesc')}
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex p-5 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                <Users className="w-10 h-10" strokeWidth={1.5} />
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{t('features.community')}</h4>
              <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">
                {t('features.communityDesc')}
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
