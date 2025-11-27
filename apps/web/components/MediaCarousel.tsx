'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { MapPin, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
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
}

interface MediaCarouselProps {
  reports: Report[]
  onReportClick?: (report: Report) => void
}

export default function MediaCarousel({ reports, onReportClick }: MediaCarouselProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Layer 3: Frontend deduplication before filtering
  const dedupedReports = useMemo(() => {
    const { reports: unique } = deduplicateReports(reports as unknown as import('@/lib/newsDedup').Report[])
    return unique as unknown as Report[]
  }, [reports])

  // Helper to check if image URL is valid (not placeholder, thumbnail, or broken)
  const isValidImageUrl = (url: string): boolean => {
    if (!url || url.trim() === '' || url === '#') return false

    const urlLower = url.toLowerCase()

    // Skip thumbnails and low-quality indicators
    const invalidPatterns = [
      'thumb', 'thumbnail', 'ico', 'icon', 'avatar', 'logo', 'banner', 'ads',
      'placeholder', 'pixel.gif', '1x1', 'spacer', 'blank', 'tracking',
      '/w100', '/w150', '/w200', '/w250', 'w100_', 'w150_', 'w200_', 'w250_',
      'r1x1', 'data:image', 'base64,', 'undefined', 'null',
      '/50x', '/100x', '/150x', '/200x', '/250x', '/300x',
      '_thumb', '_small', '_mini', '_xs', '_sm', '_tiny',
      'size=s', 'size=m', 'resize=', 'width=1', 'height=1',
      '/icon/', '/logo/', '/ads/', '/banner/', '/widget/'
    ]
    if (invalidPatterns.some(p => urlLower.includes(p))) return false

    // Must have valid image extension
    const validExtensions = ['.jpg', '.jpeg', '.webp', '.png']
    const hasValidExt = validExtensions.some(ext =>
      urlLower.includes(ext + '?') || urlLower.endsWith(ext)
    )
    if (!hasValidExt) return false

    // Must be a valid URL
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // Filter reports with VALID media AND exclude traffic/non-disaster content
  // Only show news from the last 36 hours
  const MAX_AGE_HOURS = 36
  const now = new Date()

  const mediaReports = dedupedReports
    .filter(r => {
      // TIME FILTER: Only show news from last 36 hours
      const reportDate = new Date(r.created_at)
      const ageHours = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60)
      if (ageHours > MAX_AGE_HOURS) return false

      // Must have media with at least one valid image URL
      if (!r.media || r.media.length === 0) return false
      const hasValidImage = r.media.some(url => isValidImageUrl(url))
      if (!hasValidImage) return false

      // Decode HTML entities before filtering to ensure keyword matching works
      const decodedTitle = decodeHTML(r.title)
      const decodedDescription = r.description ? decodeHTML(r.description) : ''
      const textToCheck = `${decodedTitle} ${decodedDescription}`.toLowerCase()

      // Exclude very short titles (likely spam or incomplete)
      if (decodedTitle.length < 10) return false

      // LOCATION FILTER: Exclude foreign/irrelevant locations
      const foreignKeywords = [
        'hong kong', 'hồng kông', 'trung quốc', 'trung quoc', 'china', 'taiwan', 'đài loan', 'dai loan',
        'thái lan', 'thai lan', 'thailand', 'philippines', 'malaysia', 'indonesia', 'singapore',
        'nhật bản', 'nhat ban', 'japan', 'hàn quốc', 'han quoc', 'korea', 'mỹ', 'usa', 'america',
        'châu âu', 'chau au', 'europe', 'úc', 'australia', 'ấn độ', 'an do', 'india',
        'myanmar', 'lào', 'lao', 'campuchia', 'cambodia', 'bắc kinh', 'bac kinh', 'thượng hải', 'thuong hai'
      ]
      const hasForeignKeyword = foreignKeywords.some(keyword => textToCheck.includes(keyword))
      if (hasForeignKeyword) return false

      // Exclude English-only titles (check if mostly English characters)
      const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
      const hasVietnamese = vietnameseChars.test(decodedTitle)
      const englishWordCount = decodedTitle.split(/\s+/).filter(word => /^[a-zA-Z]+$/.test(word)).length
      const totalWordCount = decodedTitle.split(/\s+/).length
      const isEnglishOnly = !hasVietnamese && englishWordCount > totalWordCount * 0.7
      if (isEnglishOnly) return false

      // Exclude traffic/accident reports
      const trafficKeywords = ['container', 'va chạm', 'va cham', 'tai nạn', 'tai nan', 'giao thông', 'giao thong', 'xe tải', 'xe tai', 'ô tô', 'o to', 'xe máy', 'xe may', 'đường bộ', 'duong bo', 'xe buýt', 'xe buyt', 'xe khách', 'xe khach', 'CSGT', 'csgt', 'công nhân', 'cong nhan', 'KCN', 'kcn']
      const hasTrafficKeyword = trafficKeywords.some(keyword => textToCheck.includes(keyword.toLowerCase()))
      if (hasTrafficKeyword) return false

      // Exclude government documents (not disaster consequences)
      const govDocKeywords = ['văn bản', 'van ban', 'công văn', 'cong van', 'thông tư', 'thong tu', 'quyết định', 'quyet dinh', 'chỉ thị', 'chi thi', 'nghị định', 'nghi dinh', 'quyết toán', 'quyet toan', 'hội nghị', 'hoi nghi', 'cuộc họp', 'cuoc hop']
      const hasGovDocKeyword = govDocKeywords.some(keyword => textToCheck.includes(keyword))
      if (hasGovDocKeyword) return false

      // Show disaster-related reports with lower threshold for more content
      if (r.type === 'ALERT' || r.type === 'SOS') {
        return r.trust_score >= 0.15
      }
      if (r.type === 'RAIN') {
        return r.trust_score >= 0.2
      }
      if (r.type === 'ROAD') {
        return r.trust_score >= 0.25
      }
      if (r.type === 'NEEDS') {
        return r.trust_score >= 0.4
      }
      // Include other types with high trust
      return r.trust_score >= 0.5
    })
    .sort((a, b) => {
      // Prioritize news with description (summary)
      const hasDescA = a.description && a.description.length > 30
      const hasDescB = b.description && b.description.length > 30
      if (hasDescA && !hasDescB) return -1
      if (!hasDescA && hasDescB) return 1

      // Boost priority for consequence news - decode HTML before checking
      const textA = `${decodeHTML(a.title)} ${a.description ? decodeHTML(a.description) : ''}`.toLowerCase()
      const textB = `${decodeHTML(b.title)} ${b.description ? decodeHTML(b.description) : ''}`.toLowerCase()
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
    .slice(0, 50) // Increased to 50 for more variety

  if (mediaReports.length === 0) return null

  // Only duplicate for seamless scroll if we have enough items (4+) - for desktop only
  // For 2-3 items, show them 3 times to reduce obvious duplication
  const itemsToShow = mediaReports.length >= 4
    ? [...mediaReports, ...mediaReports] // 2x duplication for 4+ items
    : [...mediaReports, ...mediaReports, ...mediaReports] // 3x duplication for 2-3 items

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

    if (diffMinutes < 1) return 'vừa xong'
    if (diffMinutes < 60) return `${diffMinutes} phút trước`
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} giờ trước`
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })
  }

  // Render a single news card
  const renderNewsCard = (report: Report, index: number, keyPrefix: string) => {
    const validImageUrl = report.media?.find(url => isValidImageUrl(url)) || report.media?.[0]
    if (!validImageUrl) return null

    return (
      <div
        key={`${keyPrefix}-${report.id}-${index}`}
        className="relative flex-shrink-0 h-full w-[200px] overflow-hidden rounded-lg cursor-pointer group"
        onClick={() => onReportClick?.(report)}
      >
        {/* Background Image */}
        <img
          src={validImageUrl}
          alt={report.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          {/* Title */}
          <h4 className="text-white font-bold text-xs mb-1 line-clamp-2 leading-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            {decodeHTML(report.title)}
          </h4>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-white/90 text-[10px]">
            {report.province && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                <span className="truncate max-w-[60px]">{decodeHTML(report.province)}</span>
              </span>
            )}
            <span>{formatTime(report.created_at)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Mobile: Swipeable horizontal list (no auto-scroll)
  if (isMobile) {
    return (
      <div className="fixed bottom-[25px] left-0 right-0 z-30 h-[120px]">
        {/* Swipeable container with native scroll */}
        <div
          ref={scrollContainerRef}
          className="flex items-center h-full gap-2 px-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory'
          }}
        >
          {mediaReports.map((report, index) => {
            const validImageUrl = report.media?.find(url => isValidImageUrl(url)) || report.media?.[0]
            if (!validImageUrl) return null

            return (
              <div
                key={`mobile-${report.id}-${index}`}
                className="relative flex-shrink-0 h-full w-[200px] overflow-hidden rounded-lg cursor-pointer group snap-start"
                onClick={() => onReportClick?.(report)}
              >
                {/* Background Image */}
                <img
                  src={validImageUrl}
                  alt={report.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  {/* Title */}
                  <h4 className="text-white font-bold text-xs mb-1 line-clamp-2 leading-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    {decodeHTML(report.title)}
                  </h4>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-white/90 text-[10px]">
                    {report.province && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[60px]">{decodeHTML(report.province)}</span>
                      </span>
                    )}
                    <span>{formatTime(report.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Scroll indicator dots */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          {mediaReports.slice(0, Math.min(5, mediaReports.length)).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/50" />
          ))}
          {mediaReports.length > 5 && <div className="w-1 h-1 rounded-full bg-white/30" />}
        </div>

        {/* Hide scrollbar CSS */}
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    )
  }

  // Desktop: Auto-scrolling carousel
  return (
    <div
      className="fixed bottom-[25px] left-0 right-0 z-30 h-[120px] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Horizontal scrolling container - scroll right (opposite of hot news) */}
      <div
        className="flex items-center h-full gap-2 px-2"
        style={{
          animation: isPaused ? 'none' : 'scroll-right 25s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running'
        }}
      >
        {/* Duplicate items for seamless loop */}
        {itemsToShow.map((report, index) => renderNewsCard(report, index, 'carousel'))}
      </div>

      {/* Play/Pause Indicator */}
      {isPaused && (
        <div className="absolute top-2 right-4 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full text-white text-[10px] flex items-center gap-1">
          <Pause className="w-2.5 h-2.5" />
          <span>Tạm dừng</span>
        </div>
      )}

      {/* CSS Animation - seamless scroll from left to right */}
      <style jsx>{`
        @keyframes scroll-right {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
