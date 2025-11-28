'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, Phone, Users, Star, Truck, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

interface HelpOffer {
  id: string
  organization_name: string
  service_type: string
  description: string
  capacity: number | null
  coverage_radius_km: number
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  status: string
  created_at: string
  // Matching-specific fields
  distance_km?: number
  suitability_score?: number
  match_reasons?: string[]
}

interface HelpRequest {
  id: string
  needs_type: string
  urgency: string
  description: string
  contact_name: string
  contact_phone: string
}

interface MatchingOffersModalProps {
  isOpen: boolean
  onClose: () => void
  request: HelpRequest
}

const serviceTypeLabels: Record<string, string> = {
  food: 'Thực phẩm',
  water: 'Nước uống',
  shelter: 'Chỗ ở',
  medical: 'Y tế',
  transport: 'Di chuyển',
  supplies: 'Vật tư',
  rescue: 'Cứu hộ',
  clothing: 'Quần áo',
  other: 'Khác'
}

const needsTypeLabels: Record<string, string> = {
  food: 'Thực phẩm',
  water: 'Nước uống',
  shelter: 'Chỗ ở',
  medical: 'Y tế',
  clothing: 'Quần áo',
  transport: 'Di chuyển',
  other: 'Khác'
}

export default function MatchingOffersModal({ isOpen, onClose, request }: MatchingOffersModalProps) {
  const [offers, setOffers] = useState<HelpOffer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'

  useEffect(() => {
    if (isOpen && request?.id) {
      fetchMatches()
    }
  }, [isOpen, request?.id])

  const fetchMatches = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/help/requests/${request.id}/matches?limit=10`)
      if (!response.ok) {
        throw new Error('Failed to fetch matches')
      }
      const data = await response.json()
      setOffers(data.data || [])
    } catch (err) {
      setError('Không thể tải danh sách đề nghị hỗ trợ')
      console.error('Error fetching matches:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-success-500 to-success-600 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Đề nghị hỗ trợ phù hợp
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Cho yêu cầu: {needsTypeLabels[request.needs_type] || request.needs_type}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[calc(90vh-180px)] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-neutral-200 dark:border-neutral-700 border-t-success-500 rounded-full mb-4" />
              <p className="text-slate-600 dark:text-neutral-400">Đang tìm đề nghị phù hợp...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="w-12 h-12 text-warning-500 mb-4" />
              <p className="text-slate-600 dark:text-neutral-400">{error}</p>
              <button
                onClick={fetchMatches}
                className="mt-4 px-4 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-slate-300 dark:text-neutral-600 mb-4" />
              <p className="text-slate-600 dark:text-neutral-400 text-center">
                Chưa có đề nghị hỗ trợ phù hợp trong khu vực.
              </p>
              <p className="text-slate-500 dark:text-neutral-500 text-sm mt-2 text-center">
                Yêu cầu của bạn đã được ghi nhận, các tổ chức cứu trợ sẽ liên hệ khi có khả năng hỗ trợ.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700/30 rounded-xl p-3">
                <p className="text-sm text-info-700 dark:text-info-400">
                  Tìm thấy <strong>{offers.length}</strong> đề nghị hỗ trợ phù hợp. Liên hệ trực tiếp để được hỗ trợ nhanh nhất.
                </p>
              </div>

              {/* Offers List */}
              {offers.map((offer, index) => (
                <div
                  key={offer.id}
                  className="bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl p-4 hover:shadow-lg transition-shadow"
                >
                  {/* Score Badge */}
                  {offer.suitability_score && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400">
                        <Star className="w-3 h-3" />
                        Phù hợp {Math.round(offer.suitability_score)}%
                      </span>
                      {offer.distance_km !== undefined && (
                        <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-neutral-400">
                          <MapPin className="w-4 h-4" />
                          {offer.distance_km < 1
                            ? `${Math.round(offer.distance_km * 1000)}m`
                            : `${offer.distance_km.toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Organization Name */}
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                    {offer.organization_name}
                  </h3>

                  {/* Service Type & Capacity */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300">
                      {serviceTypeLabels[offer.service_type] || offer.service_type}
                    </span>
                    {offer.capacity && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-neutral-400">
                        <Truck className="w-3 h-3" />
                        Hỗ trợ được {offer.capacity} người
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-neutral-400">
                      <MapPin className="w-3 h-3" />
                      Bán kính {offer.coverage_radius_km}km
                    </span>
                  </div>

                  {/* Match Reasons */}
                  {offer.match_reasons && offer.match_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {offer.match_reasons.map((reason, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-700/30"
                        >
                          <CheckCircle className="w-3 h-3" />
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {offer.description && (
                    <p className="text-sm text-slate-600 dark:text-neutral-400 mb-4 line-clamp-2">
                      {offer.description}
                    </p>
                  )}

                  {/* Contact */}
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-neutral-700 pt-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-neutral-300 flex-1">
                      {offer.contact_name}
                    </span>
                    <a
                      href={`tel:${offer.contact_phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Gọi ngay
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-neutral-800 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-neutral-100 font-medium rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
