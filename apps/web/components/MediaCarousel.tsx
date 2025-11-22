'use client'

import { useState, useEffect } from 'react'
import { MapPin, Images, Pause } from 'lucide-react'
import { decodeHTML } from '@/lib/htmlDecode'

interface Report {
  id: string
  type: string
  title: string
  description?: string
  province?: string
  created_at: string
  trust_score: number
  source: string
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

  // Filter reports with media AND exclude traffic/non-disaster content
  const mediaReports = reports
    .filter(r => {
      // Must have media
      if (!r.media || r.media.length === 0) return false

      // Decode HTML entities before filtering to ensure keyword matching works
      const decodedTitle = decodeHTML(r.title)
      const decodedDescription = r.description ? decodeHTML(r.description) : ''
      const textToCheck = `${decodedTitle} ${decodedDescription}`.toLowerCase()

      // Exclude very short titles (likely spam or incomplete)
      if (decodedTitle.length < 10) return false  // Lowered from 15 to 10

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

      // Prioritize disaster consequence news
      const consequenceKeywords = ['thiệt hại', 'thiet hai', 'ngập úng', 'ngap ung', 'cô lập', 'co lap', 'sơ tán', 'so tan', 'di dời', 'di doi', 'thiệt mạng', 'thiet mang', 'mất tích', 'mat tich', 'cứu hộ', 'cuu ho', 'cứu nạn', 'cuu nan', 'hậu quả', 'hau qua', 'ảnh hưởng', 'anh huong', 'sập', 'sap', 'vùi lấp', 'vui lap']
      const hasConsequenceKeyword = consequenceKeywords.some(keyword => textToCheck.includes(keyword))

      // Show disaster-related reports with lower threshold for more content
      if (r.type === 'ALERT' || r.type === 'SOS') {
        return r.trust_score >= 0.2  // Lowered from 0.3 to show more content
      }
      if (r.type === 'RAIN') {
        return r.trust_score >= 0.25  // Lowered from 0.4 to show more content
      }
      if (r.type === 'ROAD') {
        return r.trust_score >= 0.3  // Now included - road conditions are relevant
      }
      // Exclude only NEEDS - not disaster-related
      return false
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
    .slice(0, 30) // Increased from 20 to 30 for more variety

  if (mediaReports.length === 0) return null

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

    if (diffMinutes < 1) return 'vừa xong'
    if (diffMinutes < 60) return `${diffMinutes} phút trước`
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} giờ trước`
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })
  }

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
        {[...mediaReports, ...mediaReports].map((report, index) => (
          <div
            key={`${report.id}-${index}`}
            className="relative flex-shrink-0 h-full w-[200px] overflow-hidden rounded-lg cursor-pointer group"
            onClick={() => onReportClick?.(report)}
          >
            {/* Background Image */}
            <img
              src={report.media![0]}
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
                {report.media && report.media.length > 1 && (
                  <span className="flex items-center gap-0.5">
                    <Images className="w-2.5 h-2.5" />
                    <span>+{report.media.length - 1}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
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
