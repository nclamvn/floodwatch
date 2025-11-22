'use client'

import { useState } from 'react'
import { HandHeart, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import HelpMeForm from '@/components/HelpMeForm'
import ICanHelpForm from '@/components/ICanHelpForm'
import HelpRequestsList from '@/components/HelpRequestsList'
import HelpOffersList from '@/components/HelpOffersList'

/**
 * Help Connection Page - Kết nối cứu trợ
 *
 * Two-tab interface:
 * 1. "Tôi cần giúp đỡ" - Help requests (people needing assistance)
 * 2. "Tôi có thể giúp" - Help offers (people/orgs offering help)
 *
 * Each tab: Form (left 40%) + List (right 60%)
 */

type TabType = 'need-help' | 'can-help'

export default function HelpConnectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('need-help')
  const [refreshRequests, setRefreshRequests] = useState(0)
  const [refreshOffers, setRefreshOffers] = useState(0)

  const handleRequestSubmitted = () => {
    setRefreshRequests(prev => prev + 1)
  }

  const handleOfferSubmitted = () => {
    setRefreshOffers(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          {/* Mobile Header - New Design */}
          <div className="lg:hidden">
            {/* Back Button */}
            <div className="flex justify-start mb-4">
              <Link
                href="/"
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </Link>
            </div>

            {/* Centered Titles and Slogan */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <h1 className="text-4xl font-bold text-center">
                <span className="text-red-600 dark:text-red-500">Giúp tôi</span>
                <span className="text-neutral-600 dark:text-neutral-400">, </span>
                <span className="text-green-600 dark:text-green-500">tôi giúp</span>
              </h1>
              <div className="relative">
                <p className="text-lg text-neutral-600 dark:text-neutral-400 text-center italic">
                  Thương người như thể thương thân
                </p>
                {/* Pink shimmer effect */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer-slogan bg-gradient-to-r from-transparent via-pink-400/40 to-transparent" />
                </div>
              </div>
            </div>

            {/* Custom animation for slogan */}
            <style jsx>{`
              @keyframes shimmer-slogan {
                0% {
                  transform: translateX(-100%);
                }
                100% {
                  transform: translateX(100%);
                }
              }

              .animate-shimmer-slogan {
                animation: shimmer-slogan 3s ease-in-out infinite;
              }
            `}</style>

            {/* Tab Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('need-help')}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all shadow-md
                  ${activeTab === 'need-help'
                    ? 'bg-red-600 text-white scale-105'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                  }
                `}
              >
                <HandHeart className="w-5 h-5" />
                <span className="text-sm">Tôi cần giúp đỡ</span>
              </button>
              <button
                onClick={() => setActiveTab('can-help')}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all shadow-md
                  ${activeTab === 'can-help'
                    ? 'bg-green-600 text-white scale-105'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                  }
                `}
              >
                <Users className="w-5 h-5" />
                <span className="text-sm">Tôi có thể giúp</span>
              </button>
            </div>
          </div>

          {/* Desktop Header - Original Design */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-between mb-4">
              {/* Back Button - positioned outside the border */}
              <Link
                href="/"
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors -ml-14"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </Link>

              <div className="flex-1 px-4">
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <HandHeart className="w-7 h-7 text-red-600" />
                  Kết nối cứu trợ
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  Kết nối những người cần giúp đỡ với những người có thể giúp
                </p>
              </div>
              <p className="text-sm italic text-gray-400 dark:text-gray-500 whitespace-nowrap">
                Thương người như thể thương thân
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('need-help')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors
                  ${activeTab === 'need-help'
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                  }
                `}
              >
                <HandHeart className="w-4 h-4" />
                Tôi cần giúp đỡ
              </button>
              <button
                onClick={() => setActiveTab('can-help')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors
                  ${activeTab === 'can-help'
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                  }
                `}
              >
                <Users className="w-4 h-4" />
                Tôi có thể giúp
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === 'need-help' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form - 40% */}
            <div className="lg:col-span-2">
              <HelpMeForm onSubmitSuccess={handleRequestSubmitted} />
            </div>
            {/* List - 60% */}
            <div className="lg:col-span-3">
              <HelpRequestsList key={refreshRequests} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form - 40% */}
            <div className="lg:col-span-2">
              <ICanHelpForm onSubmitSuccess={handleOfferSubmitted} />
            </div>
            {/* List - 60% */}
            <div className="lg:col-span-3">
              <HelpOffersList key={refreshOffers} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
