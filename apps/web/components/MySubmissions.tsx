'use client'

import { useState, useEffect } from 'react'
import { FileText, Heart, Clock, Trash2, RefreshCw, Eye, AlertCircle, CheckCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Submission {
  id: string
  tracking_code?: string
  needs_type?: string
  service_type?: string
  created_at: string
  status?: string
}

interface SubmissionWithStatus extends Submission {
  currentStatus?: string
  isLoading?: boolean
  error?: boolean
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  active: { label: 'Waiting', color: 'text-blue-600 dark:text-blue-400', icon: 'clock' },
  in_progress: { label: 'Processing', color: 'text-amber-600 dark:text-amber-400', icon: 'refresh' },
  fulfilled: { label: 'Completed', color: 'text-green-600 dark:text-green-400', icon: 'check' },
  expired: { label: 'Expired', color: 'text-neutral-500 dark:text-neutral-400', icon: 'clock' },
  cancelled: { label: 'Cancelled', color: 'text-neutral-500 dark:text-neutral-400', icon: 'x' }
}

const statusConfigVi: Record<string, { label: string }> = {
  active: { label: 'Đang chờ' },
  in_progress: { label: 'Đang xử lý' },
  fulfilled: { label: 'Hoàn thành' },
  expired: { label: 'Hết hạn' },
  cancelled: { label: 'Đã hủy' }
}

export default function MySubmissions() {
  const t = useTranslations('mySubmissions')
  const [myRequests, setMyRequests] = useState<SubmissionWithStatus[]>([])
  const [myOffers, setMyOffers] = useState<SubmissionWithStatus[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedRequests = localStorage.getItem('floodwatch_my_requests')
      const storedOffers = localStorage.getItem('floodwatch_my_offers')

      if (storedRequests) {
        setMyRequests(JSON.parse(storedRequests))
      }
      if (storedOffers) {
        setMyOffers(JSON.parse(storedOffers))
      }
    } catch (e) {
      console.warn('Failed to load submissions from localStorage:', e)
    }
    setIsHydrated(true)
  }, [])

  // Fetch current status for all submissions
  const refreshStatuses = async () => {
    setIsRefreshing(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'

    // Refresh requests
    const updatedRequests = await Promise.all(
      myRequests.map(async (req) => {
        try {
          const response = await fetch(`${apiUrl}/help/requests/${req.id}`)
          if (response.ok) {
            const data = await response.json()
            return { ...req, currentStatus: data.status?.toLowerCase(), isLoading: false, error: false }
          }
          return { ...req, isLoading: false, error: true }
        } catch {
          return { ...req, isLoading: false, error: true }
        }
      })
    )
    setMyRequests(updatedRequests)

    // Refresh offers
    const updatedOffers = await Promise.all(
      myOffers.map(async (offer) => {
        try {
          const response = await fetch(`${apiUrl}/help/offers/${offer.id}`)
          if (response.ok) {
            const data = await response.json()
            return { ...offer, currentStatus: data.status?.toLowerCase(), isLoading: false, error: false }
          }
          return { ...offer, isLoading: false, error: true }
        } catch {
          return { ...offer, isLoading: false, error: true }
        }
      })
    )
    setMyOffers(updatedOffers)
    setIsRefreshing(false)
  }

  const removeRequest = (id: string) => {
    const updated = myRequests.filter(r => r.id !== id)
    setMyRequests(updated)
    localStorage.setItem('floodwatch_my_requests', JSON.stringify(updated))
  }

  const removeOffer = (id: string) => {
    const updated = myOffers.filter(o => o.id !== id)
    setMyOffers(updated)
    localStorage.setItem('floodwatch_my_offers', JSON.stringify(updated))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusDisplay = (status?: string) => {
    if (!status) return null
    const config = statusConfig[status] || statusConfig.active
    const viConfig = statusConfigVi[status] || statusConfigVi.active
    return {
      ...config,
      label: viConfig.label
    }
  }

  if (!isHydrated) {
    return null
  }

  if (myRequests.length === 0 && myOffers.length === 0) {
    return null
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-50 flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-600" />
          {t('title')}
        </h3>
        <button
          onClick={refreshStatuses}
          disabled={isRefreshing}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* My Requests */}
      {myRequests.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            {t('myRequests')} ({myRequests.length})
          </h4>
          <div className="space-y-2">
            {myRequests.map((req) => {
              const statusDisplay = getStatusDisplay(req.currentStatus)
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium text-slate-900 dark:text-neutral-50">
                        {req.needs_type || 'Request'}
                      </span>
                      {statusDisplay && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusDisplay.color} bg-white dark:bg-neutral-950 border`}>
                          {statusDisplay.label}
                        </span>
                      )}
                      {req.error && (
                        <span className="text-xs text-red-500">({t('fetchError')})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-neutral-400">
                      <Clock className="w-3 h-3" />
                      {formatDate(req.created_at)}
                      {req.tracking_code && (
                        <span className="font-mono text-slate-600 dark:text-neutral-300">
                          #{req.tracking_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeRequest(req.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    title={t('remove')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* My Offers */}
      {myOffers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
            <Heart className="w-4 h-4 text-green-500" />
            {t('myOffers')} ({myOffers.length})
          </h4>
          <div className="space-y-2">
            {myOffers.map((offer) => {
              const statusDisplay = getStatusDisplay(offer.currentStatus)
              return (
                <div
                  key={offer.id}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Heart className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-slate-900 dark:text-neutral-50">
                        {offer.service_type || 'Offer'}
                      </span>
                      {statusDisplay && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusDisplay.color} bg-white dark:bg-neutral-950 border`}>
                          {statusDisplay.label}
                        </span>
                      )}
                      {offer.error && (
                        <span className="text-xs text-red-500">({t('fetchError')})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-neutral-400">
                      <Clock className="w-3 h-3" />
                      {formatDate(offer.created_at)}
                      {offer.tracking_code && (
                        <span className="font-mono text-slate-600 dark:text-neutral-300">
                          #{offer.tracking_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeOffer(offer.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    title={t('remove')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
