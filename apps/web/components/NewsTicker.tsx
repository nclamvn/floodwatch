'use client'

import { useEffect, useRef, useState } from 'react'
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

interface NewsTickerProps {
  reports: Report[]
  onReportClick?: (report: Report) => void
}

export default function NewsTicker({ reports, onReportClick }: NewsTickerProps) {
  const tickerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  // Filter and sort for hot news (disaster-related only)
  const hotNews = reports
    .filter(r => {
      const textToCheck = `${r.title} ${r.description || ''}`.toLowerCase()

      // Exclude very short titles (likely spam or incomplete)
      if (r.title.length < 10) return false  // Lowered from 15 to 10

      // Exclude English-only titles (check if mostly English characters)
      const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
      const hasVietnamese = vietnameseChars.test(r.title)
      const englishWordCount = r.title.split(/\s+/).filter(word => /^[a-zA-Z]+$/.test(word)).length
      const totalWordCount = r.title.split(/\s+/).length
      const isEnglishOnly = !hasVietnamese && englishWordCount > totalWordCount * 0.7
      if (isEnglishOnly) return false

      // Exclude traffic/accident reports
      const trafficKeywords = ['container', 'va chạm', 'va cham', 'tai nạn', 'tai nan', 'giao thông', 'giao thong', 'xe tải', 'xe tai', 'ô tô', 'o to', 'xe máy', 'xe may', 'đường bộ', 'duong bo', 'xe buýt', 'xe buyt', 'xe khách', 'xe khach']
      const hasTrafficKeyword = trafficKeywords.some(keyword => textToCheck.includes(keyword))
      if (hasTrafficKeyword) return false

      // Exclude government documents (not disaster consequences)
      const govDocKeywords = ['văn bản', 'van ban', 'công văn', 'cong van', 'thông tư', 'thong tu', 'quyết định', 'quyet dinh', 'chỉ thị', 'chi thi', 'nghị định', 'nghi dinh', 'quyết toán', 'quyet toan', 'hội nghị', 'hoi nghi', 'cuộc họp', 'cuoc hop']
      const hasGovDocKeyword = govDocKeywords.some(keyword => textToCheck.includes(keyword))
      if (hasGovDocKeyword) return false

      // Prioritize disaster consequence news
      const consequenceKeywords = ['thiệt hại', 'thiet hai', 'ngập úng', 'ngap ung', 'cô lập', 'co lap', 'sơ tán', 'so tan', 'di dời', 'di doi', 'thiệt mạng', 'thiet mang', 'mất tích', 'mat tich', 'cứu hộ', 'cuu ho', 'cứu nạn', 'cuu nan', 'hậu quả', 'hau qua', 'ảnh hưởng', 'anh huong', 'sập', 'sap', 'vùi lấp', 'vui lap']
      const hasConsequenceKeyword = consequenceKeywords.some(keyword => textToCheck.includes(keyword))

      // Show disaster-related reports with lower threshold for consequence news
      if (r.type === 'ALERT' || r.type === 'SOS') {
        return r.trust_score >= 0.3  // Lowered from 0.4/0.5
      }
      if (r.type === 'RAIN') {
        return r.trust_score >= 0.4  // Lowered from 0.5/0.6
      }
      // Exclude ROAD and NEEDS - not disaster-related
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

    if (diffMinutes < 1) return 'vừa xong'
    if (diffMinutes < 60) return `${diffMinutes} phút trước`
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} giờ trước`
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-700 dark:to-orange-700 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] overflow-hidden"
      style={{ height: '24px' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* "HOT NEWS" Label */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center bg-black/20 px-3 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wide">Hot News</span>
        </div>
      </div>

      {/* Ticker content */}
      <div
        ref={tickerRef}
        className="flex items-center h-full"
        style={{
          paddingLeft: '110px', // Space for "HOT NEWS" label
          animation: isPaused ? 'none' : 'ticker 25s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running'
        }}
      >
        {/* Duplicate items for seamless loop */}
        {[...hotNews, ...hotNews].map((report, index) => (
          <div
            key={`${report.id}-${index}`}
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
