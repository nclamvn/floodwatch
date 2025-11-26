'use client'

import { useState, useRef, useEffect } from 'react'
import { HandHeart, Users, ArrowLeft, MapIcon, ArrowRight, Map } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import DarkModeToggle from '@/components/DarkModeToggle'
import HelpMeForm from '@/components/HelpMeForm'
import ICanHelpForm from '@/components/ICanHelpForm'
import HelpRequestsList from '@/components/HelpRequestsList'
import HelpOffersList from '@/components/HelpOffersList'
import { LocationProvider } from '@/contexts/LocationContext'

// Dynamically import RescueMap to avoid SSR issues
const RescueMap = dynamic(() => import('@/components/RescueMap'), {
  ssr: false,
  loading: () => <div className="w-full h-dvh flex items-center justify-center">Đang tải bản đồ cứu trợ...</div>
})

/**
 * Help Connection Page - Kết nối cứu trợ
 *
 * Three-tab interface:
 * 1. "Tôi cần giúp đỡ" - Help requests (people needing assistance)
 * 2. "Tôi có thể giúp" - Help offers (people/orgs offering help)
 * 3. "Bản đồ cứu trợ" - Rescue Intelligence Map (visualize requests & offers)
 *
 * First two tabs: Form (left 40%) + List (right 60%)
 * Third tab: Full-screen map with rescue pins
 */

type TabType = 'need-help' | 'can-help' | 'rescue-map'

export default function HelpConnectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('need-help')
  const [refreshRequests, setRefreshRequests] = useState(0)
  const [refreshOffers, setRefreshOffers] = useState(0)
  const [needHelpFormHeight, setNeedHelpFormHeight] = useState<number | null>(null)
  const [canHelpFormHeight, setCanHelpFormHeight] = useState<number | null>(null)

  // Rescue map counters for mobile header
  const [rescueRequestsCount, setRescueRequestsCount] = useState(0)
  const [rescueOffersCount, setRescueOffersCount] = useState(0)

  const needHelpFormRef = useRef<HTMLDivElement>(null)
  const canHelpFormRef = useRef<HTMLDivElement>(null)

  const handleRequestSubmitted = () => {
    setRefreshRequests(prev => prev + 1)
  }

  const handleOfferSubmitted = () => {
    setRefreshOffers(prev => prev + 1)
  }

  // Callback to receive counts from RescueMap
  const handleRescueCountsChange = (requests: number, offers: number) => {
    setRescueRequestsCount(requests)
    setRescueOffersCount(offers)
  }

  // Measure form heights and sync with list boxes
  useEffect(() => {
    const measureHeights = () => {
      if (needHelpFormRef.current) {
        setNeedHelpFormHeight(needHelpFormRef.current.offsetHeight)
      }
      if (canHelpFormRef.current) {
        setCanHelpFormHeight(canHelpFormRef.current.offsetHeight)
      }
    }

    // Measure immediately
    measureHeights()

    // Measure after a short delay (for any animations/transitions)
    const timer = setTimeout(measureHeights, 100)

    // Measure on window resize
    window.addEventListener('resize', measureHeights)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measureHeights)
    }
  }, [activeTab, refreshRequests, refreshOffers])

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      {/* Header - Design System 2025 */}
      <div className="glass border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10 shadow-elevation-1 relative">
        {/* Back Arrow - Outside Left (Desktop Only) */}
        <Link
          href="/map"
          className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-pill hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-ui ease-smooth"
        >
          <ArrowLeft className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
        </Link>

        {/* Routes Arrow - Outside Right (Desktop Only) */}
        <Link
          href="/routes"
          className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-pill hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-ui ease-smooth"
        >
          <ArrowRight className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
        </Link>

        <div className="container mx-auto px-4" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
          {/* Mobile Header - New Design */}
          <div className="lg:hidden">
            {/* Back Button, Slogan/Counters, and Dark Mode Toggle */}
            <div className="flex justify-between items-center mb-4">
              <Link
                href="/map"
                className="flex items-center justify-center w-10 h-10 rounded-pill hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-ui ease-smooth"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </Link>

              {/* Content changes based on active tab */}
              {activeTab === 'rescue-map' ? (
                /* Rescue Map Tab: Show counters (60% size, no border) */
                <div className="flex items-center gap-3">
                  {/* Red counter - requests */}
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                      <div className="absolute inset-0 w-1 h-1 rounded-full bg-red-500 animate-ping opacity-75" />
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-500 tabular-nums">
                      {rescueRequestsCount}
                    </span>
                  </div>
                  {/* Green counter - offers */}
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                      <div className="absolute inset-0 w-1 h-1 rounded-full bg-green-500 animate-ping opacity-75" />
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-500 tabular-nums">
                      {rescueOffersCount}
                    </span>
                  </div>
                </div>
              ) : (
                /* Other tabs: Show slogan */
                <span className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                  Lá lành đùm lá rách
                </span>
              )}

              <DarkModeToggle />
            </div>

            {/* Tab Buttons - Design System 2025 */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('need-help')}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg font-medium transition-all duration-ui ease-smooth shadow-elevation-1
                  ${activeTab === 'need-help'
                    ? 'bg-danger text-white scale-105'
                    : 'glass border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white/95 dark:hover:bg-neutral-700/90'
                  }
                `}
              >
                <HandHeart className="w-4 h-4" />
                <span className="text-xs">Cần giúp</span>
              </button>
              <button
                onClick={() => setActiveTab('can-help')}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg font-medium transition-all duration-ui ease-smooth shadow-elevation-1
                  ${activeTab === 'can-help'
                    ? 'bg-success text-white scale-105'
                    : 'glass border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white/95 dark:hover:bg-neutral-700/90'
                  }
                `}
              >
                <Users className="w-4 h-4" />
                <span className="text-xs">Có thể giúp</span>
              </button>
              <button
                onClick={() => setActiveTab('rescue-map')}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg font-medium transition-all duration-ui ease-smooth shadow-elevation-1
                  ${activeTab === 'rescue-map'
                    ? 'bg-blue-600 text-white scale-105'
                    : 'glass border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white/95 dark:hover:bg-neutral-700/90'
                  }
                `}
              >
                <MapIcon className="w-4 h-4" />
                <span className="text-xs">Bản đồ</span>
              </button>
            </div>
          </div>

          {/* Desktop Header - Design System 2025 */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-between gap-4">
              {/* Map Button - Flush Left */}
              <Link
                href="/map"
                className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition-colors"
                style={{ fontSize: '0.952em' }}
              >
                Bản đồ
              </Link>

              {/* Tabs - Larger */}
              <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('need-help')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-ui ease-smooth
                  ${activeTab === 'need-help'
                    ? 'bg-danger text-white'
                    : 'glass border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white/95 dark:hover:bg-neutral-700/90'
                  }
                `}
                style={{ fontSize: '1.02em' }}
              >
                <HandHeart className="w-5 h-5" />
                Giúp tôi
              </button>
              <button
                onClick={() => setActiveTab('can-help')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-ui ease-smooth
                  ${activeTab === 'can-help'
                    ? 'bg-success text-white'
                    : 'glass border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white/95 dark:hover:bg-neutral-700/90'
                  }
                `}
                style={{ fontSize: '1.02em' }}
              >
                <Users className="w-5 h-5" />
                Tôi giúp
              </button>
              <button
                onClick={() => setActiveTab('rescue-map')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-ui ease-smooth
                  ${activeTab === 'rescue-map'
                    ? 'bg-blue-600 text-white'
                    : 'glass border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white/95 dark:hover:bg-neutral-700/90'
                  }
                `}
                style={{ fontSize: '1.02em' }}
              >
                <MapIcon className="w-5 h-5" />
                Bản đồ cứu trợ
              </button>
              </div>

              {/* Slogan - Dynamic with shimmer */}
              <div className="relative">
                <p className="text-body-2 italic text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                  {activeTab === 'need-help'
                    ? 'Bầu ơi thương lấy bí cùng'
                    : activeTab === 'can-help'
                    ? 'Tuy rằng khác giống nhưng chung một giàn'
                    : 'Thương người như thể thương thân'}
                </p>
                {/* White/Silver shimmer effect */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer-slogan bg-gradient-to-r from-transparent via-white/50 dark:via-neutral-300/50 to-transparent" />
                </div>
              </div>

              {/* Theme Toggle + Routes Button - Flush Right */}
              <div className="flex items-center gap-2">
                <DarkModeToggle />
                <Link
                  href="/routes"
                  className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition-colors"
                  style={{ fontSize: '0.952em' }}
                >
                  Tuyến đường
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={activeTab === 'rescue-map' ? '' : 'container mx-auto px-4 py-6'}>
        {activeTab === 'need-help' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form - 40% (chiều cao tự nhiên làm chuẩn) */}
            <div ref={needHelpFormRef} className="lg:col-span-2">
              <HelpMeForm onSubmitSuccess={handleRequestSubmitted} />
            </div>
            {/* List - 60% (khớp chiều cao form) */}
            <div
              className="lg:col-span-3"
              style={needHelpFormHeight ? { height: `${needHelpFormHeight}px` } : undefined}
            >
              <HelpRequestsList key={refreshRequests} />
            </div>
          </div>
        ) : activeTab === 'can-help' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form - 40% (chiều cao tự nhiên làm chuẩn) */}
            <div ref={canHelpFormRef} className="lg:col-span-2">
              <ICanHelpForm onSubmitSuccess={handleOfferSubmitted} />
            </div>
            {/* List - 60% (khớp chiều cao form) */}
            <div
              className="lg:col-span-3"
              style={canHelpFormHeight ? { height: `${canHelpFormHeight}px` } : undefined}
            >
              <HelpOffersList key={refreshOffers} />
            </div>
          </div>
        ) : (
          /* Rescue Map - Full Screen */
          <div className="w-full h-[calc(100dvh-64px)]">
            <LocationProvider>
              <RescueMap onCountsChange={handleRescueCountsChange} />
            </LocationProvider>
          </div>
        )}
      </div>
    </div>
  )
}
