'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { MapPin, Pause } from 'lucide-react'
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

interface MediaCarouselProps {
  reports: Report[]
  onReportClick?: (report: Report) => void
}

export default function MediaCarousel({ reports, onReportClick }: MediaCarouselProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Handle image load for fade-in effect
  const handleImageLoad = useCallback((imageUrl: string) => {
    setLoadedImages(prev => new Set([...Array.from(prev), imageUrl]))
  }, [])

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Track scroll position for progress indicator (mobile)
  useEffect(() => {
    if (!isMobile || !scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft
      const cardWidth = 220 + 8 // card width + gap
      const newIndex = Math.round(scrollLeft / cardWidth)
      setActiveIndex(newIndex)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [isMobile])

  // Layer 3: Frontend deduplication before filtering
  const dedupedReports = useMemo(() => {
    const { reports: unique } = deduplicateReports(reports as unknown as import('@/lib/newsDedup').Report[])
    return unique as unknown as Report[]
  }, [reports])

  // Helper to check if image URL is valid (not placeholder, thumbnail, or broken)
  const isValidImageUrl = (url: string): boolean => {
    if (!url || url.trim() === '' || url === '#') return false

    const urlLower = url.toLowerCase()

    // Skip data URLs (base64 placeholders)
    if (urlLower.startsWith('data:')) return false

    // Skip truly invalid patterns
    const invalidPatterns = [
      'thumb', 'thumbnail', 'ico', 'icon', 'avatar', 'logo', 'banner', 'ads',
      'placeholder', 'pixel.gif', 'spacer', 'blank', 'tracking',
      '_thumb', '_small', '_mini', '_xs', '_sm', '_tiny',
      'size=s', 'size=m', 'width=1', 'height=1',
      '/icon/', '/logo/', '/ads/', '/banner/', '/widget/',
      'undefined', 'null'
    ]
    if (invalidPatterns.some(p => urlLower.includes(p))) return false

    // Skip small thumbnails (w100, w150, w200, w250) but allow larger (w700, etc)
    // Also skip 1x1 ratio images (r1x1) but allow others (r3x2)
    const smallThumbPatterns = ['/w100', '/w150', '/w200', '/w250', 'w100_', 'w150_', 'w200_', 'w250_', 'r1x1', '1x1']
    if (smallThumbPatterns.some(p => urlLower.includes(p))) return false

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
      // MINIMAL FILTER: Just require media and basic quality
      if (r.is_deleted) return false

      // Must have media
      if (!r.media || r.media.length === 0) return false

      // Check for valid image URL
      const hasValidImage = r.media.some(url => isValidImageUrl(url))
      if (!hasValidImage) return false

      // Must have some description
      if (!r.description || r.description.length < 50) return false

      // Trust score minimum
      if (r.trust_score < 0.5) return false

      return true
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

  // Render a single news card - 4:3 ratio, 220px width, polished typography
  const renderNewsCard = (report: Report, index: number, keyPrefix: string) => {
    const validImageUrl = report.media?.find(url => isValidImageUrl(url)) || report.media?.[0]
    if (!validImageUrl) return null
    const isLoaded = loadedImages.has(validImageUrl)

    return (
      <div
        key={`${keyPrefix}-${report.id}-${index}`}
        className="relative flex-shrink-0 w-[200px] md:w-[220px] overflow-hidden rounded-xl cursor-pointer group"
        style={{ aspectRatio: '4/3' }}
        onClick={() => onReportClick?.(report)}
      >
        {/* Skeleton placeholder while loading */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-neutral-300/50 dark:bg-zinc-700/50 animate-pulse rounded-xl" />
        )}

        {/* Background Image - next/image with fill for responsive loading */}
        <Image
          src={validImageUrl}
          alt={report.title}
          fill
          sizes="220px"
          className={`object-cover group-hover:scale-105 transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          unoptimized={!validImageUrl.startsWith('/')}
          onLoad={() => handleImageLoad(validImageUrl)}
        />

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {/* Title - 14px, weight 600 */}
          <h4
            className="text-white mb-1.5 line-clamp-2 leading-[1.3]"
            style={{ fontSize: '14px', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
          >
            {decodeHTML(report.title)}
          </h4>

          {/* Metadata - 11px, muted */}
          <div className="flex items-center gap-2 text-white/80" style={{ fontSize: '11px' }}>
            {report.province && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                <span className="truncate max-w-[70px]">{decodeHTML(report.province)}</span>
              </span>
            )}
            <span className="opacity-75">{formatTime(report.created_at)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Mobile: Swipeable horizontal list (no auto-scroll) - 4:3 ratio, 220px cards
  if (isMobile) {
    const displayCount = Math.min(mediaReports.length, 8)

    return (
      <div className="fixed bottom-[25px] left-0 right-0 z-30" style={{ height: '165px' }}>
        {/* Swipeable container with native scroll */}
        <div
          ref={scrollContainerRef}
          className="flex items-start h-full gap-2 px-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory'
          }}
        >
          {mediaReports.map((report, index) => {
            const validImageUrl = report.media?.find(url => isValidImageUrl(url)) || report.media?.[0]
            if (!validImageUrl) return null
            const isLoaded = loadedImages.has(validImageUrl)

            return (
              <div
                key={`mobile-${report.id}-${index}`}
                className="relative flex-shrink-0 w-[200px] overflow-hidden rounded-xl cursor-pointer group snap-start"
                style={{ aspectRatio: '4/3' }}
                onClick={() => onReportClick?.(report)}
              >
                {/* Skeleton placeholder while loading */}
                {!isLoaded && (
                  <div className="absolute inset-0 bg-neutral-300/50 dark:bg-zinc-700/50 animate-pulse rounded-xl" />
                )}

                {/* Background Image - next/image for mobile carousel */}
                <Image
                  src={validImageUrl}
                  alt={report.title}
                  fill
                  sizes="200px"
                  className={`object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                  loading="lazy"
                  unoptimized={!validImageUrl.startsWith('/')}
                  onLoad={() => handleImageLoad(validImageUrl)}
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  {/* Title - 14px, weight 600 */}
                  <h4
                    className="text-white mb-1.5 line-clamp-2 leading-[1.3]"
                    style={{ fontSize: '14px', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {decodeHTML(report.title)}
                  </h4>

                  {/* Metadata - 11px, muted */}
                  <div className="flex items-center gap-2 text-white/80" style={{ fontSize: '11px' }}>
                    {report.province && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[70px]">{decodeHTML(report.province)}</span>
                      </span>
                    )}
                    <span className="opacity-75">{formatTime(report.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress indicator dots - shows active position */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
          {Array.from({ length: displayCount }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                i === activeIndex ? 'bg-white w-3' : 'bg-white/50'
              }`}
            />
          ))}
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

  // Desktop: Auto-scrolling carousel - 4:3 ratio cards (~165px height for 220px width)
  return (
    <div
      className="fixed bottom-[25px] left-0 right-0 z-30 overflow-hidden"
      style={{ height: '165px' }}
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
