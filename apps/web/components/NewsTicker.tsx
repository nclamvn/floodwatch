'use client'

import { useRef, useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { decodeHTML } from '@/lib/htmlDecode'
import { deduplicateReports } from '@/lib/newsDedup'

interface Report {
  id: string
  type: string
  title: string
  description?: string
  province?: string
  created_at: string
  trust_score: number
  source: string
  source_domain?: string
  normalized_title?: string
  status: string
  lat?: number
  lon?: number
  media?: string[]
  // News Quality fields (Phase: News Quality Track)
  is_deleted?: boolean
  content_status?: 'full' | 'partial' | 'excerpt' | 'failed'
}

interface NewsTickerProps {
  reports: Report[]
  onReportClick?: (report: Report) => void
  onVoiceClick?: () => void
  excludeReportIds?: string[]  // IDs of reports to exclude (e.g., already in carousel)
}

export default function NewsTicker({ reports, onReportClick, onVoiceClick, excludeReportIds = [] }: NewsTickerProps) {
  const tickerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const locale = useLocale()
  const t = useTranslations('newsTicker')
  const isEnglish = locale === 'en'

  // Layer 3: Frontend deduplication before filtering
  const dedupedReports = useMemo(() => {
    const { reports: unique } = deduplicateReports(reports as unknown as import('@/lib/newsDedup').Report[])
    return unique as unknown as Report[]
  }, [reports])

  // Filter and sort for hot news (disaster-related only)
  // STRICT: Only show news from last 36 hours, Vietnam only, no traffic accidents
  const MAX_AGE_HOURS = 36
  const now = new Date()

  const hotNews = dedupedReports
    .filter(r => {
      // NEWS QUALITY FILTER: Exclude deleted and failed content
      if (r.is_deleted) return false
      if (r.content_status === 'failed') return false
      // NewsTicker is less strict than carousel - allows excerpt and partial
      // Require minimum description length (relaxed to 80 chars)
      if (!r.description || r.description.length < 80) return false
      // Ticker requires decent trust score (0.6+)
      if (r.trust_score < 0.6) return false

      // TIME FILTER: Only show news from last 36 hours - STRICT
      const reportDate = new Date(r.created_at)
      const ageHours = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60)
      if (ageHours > MAX_AGE_HOURS) return false

      // Exclude reports that are already in the carousel
      if (excludeReportIds.includes(r.id)) return false

      const textToCheck = `${r.title} ${r.description || ''}`.toLowerCase()

      // Exclude very short titles (likely spam or incomplete)
      if (r.title.length < 10) return false

      // LOCATION FILTER: Exclude foreign/irrelevant locations - STRICT
      const foreignKeywords = [
        'hong kong', 'hồng kông', 'trung quốc', 'trung quoc', 'china', 'taiwan', 'đài loan', 'dai loan',
        'thái lan', 'thai lan', 'thailand', 'philippines', 'malaysia', 'indonesia', 'singapore',
        'nhật bản', 'nhat ban', 'japan', 'hàn quốc', 'han quoc', 'korea', 'mỹ', 'usa', 'america',
        'châu âu', 'chau au', 'europe', 'úc', 'australia', 'ấn độ', 'an do', 'india',
        'myanmar', 'lào', 'lao', 'campuchia', 'cambodia', 'bắc kinh', 'bac kinh', 'thượng hải', 'thuong hai'
      ]
      if (foreignKeywords.some(keyword => textToCheck.includes(keyword))) return false

      // Language filter based on locale
      const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
      const hasVietnamese = vietnameseChars.test(r.title)
      const englishWordCount = r.title.split(/\s+/).filter(word => /^[a-zA-Z]+$/.test(word)).length
      const totalWordCount = r.title.split(/\s+/).length
      const isEnglishOnly = !hasVietnamese && englishWordCount > totalWordCount * 0.7

      // For English locale: prefer English articles (from international sources)
      // For Vietnamese locale: exclude English-only articles
      if (isEnglish) {
        // English locale: show both English and Vietnamese news (prefer English)
        // Don't filter out based on language
      } else {
        // Vietnamese locale: exclude English-only articles
        if (isEnglishOnly) return false
      }

      // TRAFFIC FILTER: Exclude traffic/accident reports - STRICT
      const trafficKeywords = [
        'container', 'va chạm', 'va cham', 'tai nạn', 'tai nan', 'giao thông', 'giao thong',
        'xe tải', 'xe tai', 'ô tô', 'o to', 'xe máy', 'xe may', 'đường bộ', 'duong bo',
        'xe buýt', 'xe buyt', 'xe khách', 'xe khach', 'CSGT', 'csgt', 'tông', 'tong',
        'đâm', 'dam', 'lật xe', 'lat xe', 'cháy xe', 'chay xe', 'nổ xe', 'no xe',
        'tử vong giao thông', 'chết giao thông', 'thương vong giao thông'
      ]
      if (trafficKeywords.some(keyword => textToCheck.includes(keyword.toLowerCase()))) return false

      // Exclude government documents (not disaster consequences)
      const govDocKeywords = ['văn bản', 'van ban', 'công văn', 'cong van', 'thông tư', 'thong tu', 'quyết định', 'quyet dinh', 'chỉ thị', 'chi thi', 'nghị định', 'nghi dinh', 'quyết toán', 'quyet toan', 'hội nghị', 'hoi nghi', 'cuộc họp', 'cuoc hop']
      if (govDocKeywords.some(keyword => textToCheck.includes(keyword))) return false

      // Only show disaster-related types (ALERT, SOS, RAIN)
      // Exclude ROAD and NEEDS - not disaster-related
      if (r.type === 'ALERT' || r.type === 'SOS' || r.type === 'RAIN') {
        return true
      }
      return false
    })
    .sort((a, b) => {
      // Boost priority for news with media and description
      const hasMediaA = a.media && a.media.length > 0
      const hasMediaB = b.media && b.media.length > 0
      const hasDescA = a.description && a.description.length > 30
      const hasDescB = b.description && b.description.length > 30

      // Prioritize news with both media and description
      const completeA = hasMediaA && hasDescA
      const completeB = hasMediaB && hasDescB
      if (completeA && !completeB) return -1
      if (!completeA && completeB) return 1

      // Then prioritize news with media
      if (hasMediaA && !hasMediaB) return -1
      if (!hasMediaA && hasMediaB) return 1

      // Boost priority for consequence news
      const textA = `${a.title} ${a.description || ''}`.toLowerCase()
      const textB = `${b.title} ${b.description || ''}`.toLowerCase()
      const consequenceKeywords = ['thiệt hại', 'thiet hai', 'ngập úng', 'ngap ung', 'cô lập', 'co lap', 'sơ tán', 'so tan', 'thiệt mạng', 'thiet mang', 'cứu hộ', 'cuu ho', 'cứu nạn', 'cuu nan']
      const hasConsequenceA = consequenceKeywords.some(kw => textA.includes(kw))
      const hasConsequenceB = consequenceKeywords.some(kw => textB.includes(kw))

      if (hasConsequenceA && !hasConsequenceB) return -1
      if (!hasConsequenceA && hasConsequenceB) return 1

      // Sort by severity then time
      const severityA = a.type === 'ALERT' || a.type === 'SOS' ? a.trust_score : a.trust_score * 0.8
      const severityB = b.type === 'ALERT' || b.type === 'SOS' ? b.trust_score : b.trust_score * 0.8
      if (severityB !== severityA) return severityB - severityA
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 40) // Increased from 20 to 40 for more variety

  if (hotNews.length === 0) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'ALERT': return '⚠️'
      case 'SOS': return '🆘'
      case 'ROAD': return '🚧'
      case 'RAIN': return '🌊'
      case 'NEEDS': return '📦'
      default: return '📍'
    }
  }

  const getSeverityColor = (report: Report) => {
    if ((report.type === 'ALERT' || report.type === 'SOS') && report.trust_score >= 0.7) {
      return 'text-red-600 dark:text-red-400'
    }
    if (report.trust_score >= 0.4) {
      return 'text-orange-600 dark:text-orange-400'
    }
    return 'text-green-600 dark:text-green-400'
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

    if (diffMinutes < 1) return t('justNow')
    if (diffMinutes < 60) return t('minutesAgo', { count: diffMinutes })
    if (diffMinutes < 1440) return t('hoursAgo', { count: Math.floor(diffMinutes / 60) })
    return date.toLocaleDateString(isEnglish ? 'en-US' : 'vi-VN', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-700 dark:to-orange-700 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] overflow-hidden"
      style={{ height: '24px' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* "HOT NEWS" Label */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center bg-black/20 px-2 z-10 backdrop-blur-sm gap-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wide">{t('hotNews')}</span>
        </div>

        {/* Voice Button */}
        {onVoiceClick && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onVoiceClick()
            }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-all"
            aria-label={t('listenVoice')}
            title={t('listenVoice')}
          >
            <svg
              className="w-3 h-3 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </button>
        )}
      </div>

      {/* Ticker content */}
      <div
        ref={tickerRef}
        className="flex items-center h-full"
        style={{
          paddingLeft: '130px', // Space for "HOT NEWS" label + voice button
          animation: isPaused ? 'none' : 'ticker 25s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running'
        }}
      >
        {/* Duplicate items for seamless loop */}
        {[...hotNews, ...hotNews].map((report, index) => (
          <div
            key={`ticker-${report.id}-${index}`}
            className="inline-flex items-center gap-2 px-4 cursor-pointer hover:bg-white/10 transition-colors flex-shrink-0"
            onClick={() => onReportClick?.(report)}
            style={{ minWidth: 'max-content' }}
          >
            {/* Icon */}
            <span className="text-base">{getIcon(report.type)}</span>

            {/* Content */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs">{decodeHTML(report.title)}</span>
              {report.province && (
                <span className="text-xs opacity-90">• {decodeHTML(report.province)}</span>
              )}
              <span className="text-xs opacity-75">{formatTime(report.created_at)}</span>
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-white/30 ml-3" />
          </div>
        ))}
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
