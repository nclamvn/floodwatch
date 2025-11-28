'use client'

import { useState, useEffect } from 'react'
import { Phone, Mail, MapPin, Users, Clock, AlertTriangle, Heart, X, Building2, Navigation } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { HelpRequest } from '@/hooks/useHelpRequests'
import { HelpOffer } from '@/hooks/useHelpOffers'
import DirectionsModal from '@/components/DirectionsModal'

interface RescueDetailSheetProps {
  data: HelpRequest | HelpOffer
  type: 'request' | 'offer'
  onClose: () => void
}

const urgencyColors: Record<string, { color: string; bgColor: string }> = {
  critical: {
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
  },
  high: {
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
  },
  medium: {
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
  },
  low: {
    color: 'text-neutral-700 dark:text-neutral-400',
    bgColor: 'bg-neutral-100 dark:bg-neutral-900/30 border-neutral-300 dark:border-neutral-700'
  }
}

/**
 * RescueDetailSheet Component (Phase 3.2)
 *
 * Full-screen detail panel showing complete information.
 * - Bottom sheet on mobile (slides up from bottom)
 * - Sidebar on desktop (slides in from right)
 * - All details including location, contact, metadata
 */
export default function RescueDetailSheet({ data, type, onClose }: RescueDetailSheetProps) {
  const t = useTranslations('rescueDetail')
  const tHelp = useTranslations('help')
  const tFilter = useTranslations('rescueFilter')

  const isRequest = type === 'request'
  const request = isRequest ? (data as HelpRequest) : null
  const offer = !isRequest ? (data as HelpOffer) : null

  // Directions modal state (Phase 6.2)
  const [showDirectionsModal, setShowDirectionsModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  // Handle directions click - auto-open Google Maps on mobile, show modal on desktop
  const handleDirectionsClick = () => {
    if (isMobile) {
      // On mobile: auto-open Google Maps app (or fallback to web)
      // Using comgooglemaps:// for iOS, geo: for Android, fallback to web
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lon}`

      // Try to open in Google Maps app, fallback to web browser
      // This URL scheme works on both iOS and Android
      window.location.href = webUrl
    } else {
      // On desktop: show the directions modal with embedded map
      setShowDirectionsModal(true)
    }
  }

  // Clean JCI ID and [STATION] prefix from description
  const cleanDescription = data.description
    .replace(/^\[STATION\]\s*/i, '')
    .replace(/\n*\[JCI ID: \d+\]\s*$/i, '')
    .trim()

  const tPinPopover = useTranslations('pinPopover')

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) {
      return tPinPopover('timeAgo.minutes', { count: diffMins })
    } else if (diffHours < 24) {
      return tPinPopover('timeAgo.hours', { count: diffHours })
    } else {
      return tPinPopover('timeAgo.days', { count: diffDays })
    }
  }

  const urgency = request ? urgencyColors[request.urgency] || urgencyColors.medium : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Detail Sheet - Bottom sheet on mobile, Sidebar on desktop */}
      <div className="fixed inset-x-0 bottom-0 lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[480px] z-50 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden animate-slide-up lg:animate-slide-left">
        {/* Header */}
        <div className={`p-6 border-b border-neutral-200 dark:border-neutral-800 ${
          isRequest ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'
        }`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              {isRequest && request ? (
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border ${urgency?.bgColor} ${urgency?.color}`}>
                    <AlertTriangle className="w-4 h-4" />
                    {tFilter(`urgency.${request.urgency}`)}
                  </span>
                </div>
              ) : offer ? (
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700">
                    <Heart className="w-4 h-4" />
                    {t('readyToHelp')}
                  </span>
                </div>
              ) : null}
              <h2 className="text-2xl font-bold text-slate-900 dark:text-neutral-50">
                {isRequest && request
                  ? t('needs', { type: tHelp(`needsTypes.${request.needs_type}`).toLowerCase() })
                  : offer
                  ? tFilter(`services.${offer.service_type}`)
                  : ''
                }
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 sm:w-10 sm:h-10 p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center"
              aria-label={t('close')}
            >
              <X className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
            </button>
          </div>

          {/* Time info */}
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-400">
            <Clock className="w-4 h-4" />
            <span>{formatTimeAgo(data.created_at)} • {formatDate(data.created_at)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-180px)] lg:h-[calc(100vh-160px)]">
          <div className="p-6 space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50 mb-2">
                {t('description')}
              </h3>
              <p className="text-slate-700 dark:text-neutral-200 whitespace-pre-wrap">
                {cleanDescription}
              </p>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50 mb-3">
                {t('location')}
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-slate-700 dark:text-neutral-200">
                  <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t('coordinates')}:</p>
                    <p className="text-sm text-slate-600 dark:text-neutral-400 font-mono">
                      {data.lat.toFixed(6)}, {data.lon.toFixed(6)}
                    </p>
                  </div>
                </div>
                {data.distance_km !== undefined && (
                  <div className="text-sm text-slate-600 dark:text-neutral-400">
                    {t('distance')}: {data.distance_km < 1
                      ? `${Math.round(data.distance_km * 1000)}m`
                      : `${data.distance_km.toFixed(1)}km`}
                  </div>
                )}
              </div>
            </div>

            {/* People/Capacity Info */}
            {(request?.people_count || offer?.capacity) && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50 mb-3">
                  {isRequest ? t('peopleNeedHelp') : t('capacity')}
                </h3>
                <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
                  <Users className="w-5 h-5" />
                  <span className="text-xl font-bold">
                    {isRequest ? request?.people_count : offer?.capacity} {t('people')}
                  </span>
                </div>

                {/* Special conditions for requests */}
                {isRequest && request && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.has_children && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        👶 {t('hasChildren')}
                      </span>
                    )}
                    {request.has_elderly && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        👴 {t('hasElderly')}
                      </span>
                    )}
                    {request.has_disabilities && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                        ♿ {t('hasDisabilities')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Offer-specific info */}
            {!isRequest && offer && (
              <>
                {offer.coverage_radius_km && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50 mb-2">
                      {t('supportRadius')}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
                      <Navigation className="w-5 h-5" />
                      <span>{offer.coverage_radius_km}km</span>
                    </div>
                  </div>
                )}

                {offer.availability && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50 mb-2">
                      {t('availableTime')}
                    </h3>
                    <p className="text-slate-700 dark:text-neutral-200">{offer.availability}</p>
                  </div>
                )}

                {offer.organization && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50 mb-2">
                      {t('organization')}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
                      <Building2 className="w-5 h-5" />
                      <span className="font-medium">{offer.organization}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-50 mb-3">
                {t('contactInfo')}
              </h3>
              <div className="space-y-3">
                <div className="text-slate-700 dark:text-neutral-200">
                  <p className="font-medium text-sm text-slate-600 dark:text-neutral-400 mb-1">
                    {t('contactPerson')}
                  </p>
                  <p className="text-lg font-semibold">{data.contact_name}</p>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 gap-2">
                  <a
                    href={`tel:${data.contact_phone}`}
                    className={`flex items-center justify-center gap-2 px-4 py-3 text-white text-base font-medium rounded-lg transition-colors ${
                      isRequest
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    <Phone className="w-5 h-5" />
                    {t('callNow')}: {data.contact_phone}
                  </a>

                  <button
                    onClick={handleDirectionsClick}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg transition-colors"
                  >
                    <Navigation className="w-5 h-5" />
                    {t('directions')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide animations */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes slide-left {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        .animate-slide-left {
          animation: slide-left 0.3s ease-out;
        }
      `}</style>

      {/* Directions Modal (Phase 6.2) */}
      {showDirectionsModal && (
        <DirectionsModal
          lat={data.lat}
          lon={data.lon}
          address={data.address}
          destinationName={data.contact_name}
          onClose={() => setShowDirectionsModal(false)}
        />
      )}
    </>
  )
}
