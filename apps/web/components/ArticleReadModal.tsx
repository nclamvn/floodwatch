'use client'

import { useEffect, useState } from 'react'
import { X, ExternalLink, MapPin, Clock, Volume2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { decodeHTML } from '@/lib/htmlDecode'
import axios from 'axios'

interface Report {
  id: string
  created_at: string
  type: string
  source: string
  title: string
  description?: string
  province?: string
  lat?: number
  lon?: number
  trust_score: number
  status: string
  media?: string[]
}

interface ArticleReadModalProps {
  report: Report | null
  isOpen: boolean
  onClose: () => void
}

export function ArticleReadModal({ report, isOpen, onClose }: ArticleReadModalProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Fetch AI summary if no description
  useEffect(() => {
    if (!isOpen || !report) return
    if (report.description && report.description.trim().length > 0) return

    const fetchAiSummary = async () => {
      setLoadingSummary(true)
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await axios.post(`${API_URL}/reports/${report.id}/generate-summary`)
        setAiSummary(response.data.summary)
      } catch (error) {
        console.error('Failed to generate AI summary:', error)
        setAiSummary(null)
      } finally {
        setLoadingSummary(false)
      }
    }

    fetchAiSummary()
  }, [isOpen, report])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)

    // Lock body scroll when modal is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen || !report) return null

  // Format timestamp
  const formattedDate = format(new Date(report.created_at), "HH:mm · dd/MM/yyyy", { locale: vi })

  // Get region display
  const regionDisplay = report.province ? decodeHTML(report.province) : 'Miền Trung'

  // Filter high-quality images (remove thumbnails and low-quality images)
  const filterHighQualityImages = (images: string[] | undefined): string[] => {
    if (!images || images.length === 0) return []

    return images.filter(url => {
      // Skip if URL contains thumbnail indicators
      const thumbnailKeywords = [
        'thumb', 'thumbnail', 'ico', 'icon', 'avatar',
        'logo', 'banner', 'ads', 'tracking',
        '/50x', '/100x', '/150x', '/200x',  // Small dimension indicators
        '_thumb', '_small', '_mini', '_xs', '_sm',
        'size=s', 'size=m', 'resize=',
        'static-tuoitre', 'logotuoitre', 'banner_gg',
        '/icon/', '/logo/', '/ads/', '/banner/'
      ]

      const urlLower = url.toLowerCase()
      if (thumbnailKeywords.some(keyword => urlLower.includes(keyword))) {
        return false
      }

      // Only include valid image extensions
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
      if (!validExtensions.some(ext => urlLower.includes(ext))) {
        return false
      }

      return true
    })
  }

  // Get filtered high-quality images
  const highQualityImages = filterHighQualityImages(report.media)

  // Get first image for hero
  const heroImage = highQualityImages[0]

  // Parse description into paragraphs - handle different formats
  // Use AI summary if no description available
  const contentToDisplay = report.description || aiSummary
  let paragraphs: string[] = []

  if (contentToDisplay) {
    // Try double newline first (proper paragraph breaks)
    const doubleSplit = contentToDisplay.split('\n\n').filter(p => p.trim())
    if (doubleSplit.length > 1) {
      paragraphs = doubleSplit
    } else {
      // Try single newline (line breaks)
      const singleSplit = contentToDisplay.split('\n').filter(p => p.trim())
      if (singleSplit.length > 1) {
        paragraphs = singleSplit
      } else {
        // Just use the full content as one paragraph
        paragraphs = [contentToDisplay.trim()]
      }
    }
  }

  // Extract domain from source URL for display
  const getSourceDomain = (url: string) => {
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
      return domain.replace('www.', '')
    } catch {
      return url
    }
  }

  const sourceDomain = getSourceDomain(report.source)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container - Desktop Premium / Mobile Bottom Sheet */}
      <div
        className="relative w-full mx-4 flex flex-col max-h-[92vh] rounded-t-2xl sm:rounded-3xl sm:max-w-[920px] sm:max-h-[85vh] sm:mx-auto bg-zinc-900/90 backdrop-blur-3xl supports-[backdrop-filter]:backdrop-blur-3xl border border-zinc-700/30 shadow-[0_24px_60px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 p-4 sm:p-7"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 sm:mb-5">
          {/* Left: Metadata badges */}
          <div className="flex flex-col gap-2">
            {/* Region badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/40 backdrop-blur-sm border border-zinc-700/40">
              <MapPin className="w-3.5 h-3.5 text-zinc-300" />
              <span className="text-xs font-medium text-zinc-200">
                {regionDisplay}
              </span>
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Cập nhật: {formattedDate}</span>
            </div>
          </div>

          {/* Right: Close button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800/70 hover:bg-zinc-700/70 active:bg-zinc-600/70 backdrop-blur-sm border border-zinc-700/40 flex items-center justify-center transition-all duration-200 group"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 -mr-2 scrollbar-thin scrollbar-thumb-zinc-700/50 scrollbar-track-transparent">
          {/* Article Title */}
          <h1
            id="article-modal-title"
            className="text-xl sm:text-2xl md:text-[26px] font-bold text-white leading-tight mb-3 sm:mb-4 break-words"
          >
            {decodeHTML(report.title)}
          </h1>

          {/* Source Info & Link */}
          <div className="flex flex-wrap items-center gap-3 mb-4 sm:mb-5 pb-4 border-b border-zinc-700/30">
            {/* Source badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/40">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 flex items-center justify-center text-[10px] font-bold text-white">
                {sourceDomain[0].toUpperCase()}
              </div>
              <span className="text-xs font-medium text-neutral-300">
                {sourceDomain}
              </span>
            </div>

            {/* Original article link */}
            <a
              href={report.source.startsWith('http') ? report.source : `https://${report.source}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/40 hover:bg-zinc-700/50 border border-zinc-700/50 hover:border-zinc-600/60 text-xs font-medium text-zinc-200 hover:text-white transition-all duration-200 group"
            >
              <span>Xem bài gốc</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            {/* "Listen Summary" placeholder - Future feature */}
            <button
              disabled
              title="Tính năng sắp có"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/20 border border-neutral-700/30 text-xs font-medium text-neutral-500 cursor-not-allowed opacity-50"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Nghe tóm tắt</span>
            </button>
          </div>

          {/* Hero Image */}
          {heroImage && (
            <div className="mb-5 sm:mb-6 -mx-1">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-800/50">
                <img
                  src={heroImage}
                  alt={report.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Additional Images Gallery (if more than 1 high-quality image) */}
          {highQualityImages.length > 1 && (
            <div className="mb-5 sm:mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {highQualityImages.slice(1, 7).map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-video rounded-lg overflow-hidden bg-neutral-800/50"
                  >
                    <img
                      src={img}
                      alt={`${report.title} - Ảnh ${idx + 2}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Article Content */}
          <article
            className="prose prose-invert prose-sm sm:prose-base max-w-none prose-headings:!text-white prose-p:!text-zinc-100 prose-p:leading-relaxed prose-a:!text-zinc-400 prose-a:no-underline prose-a:hover:underline prose-strong:!text-white prose-strong:font-semibold prose-ul:!text-zinc-100 prose-ol:!text-zinc-100 prose-li:!text-zinc-100 prose-blockquote:!text-zinc-200 prose-blockquote:border-zinc-700"
          >
            {loadingSummary ? (
              <div className="flex items-center gap-2 text-zinc-100 italic">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tạo tóm tắt bằng AI...</span>
              </div>
            ) : paragraphs.length > 0 ? (
              <>
                {!report.description && aiSummary && (
                  <div className="mb-4 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
                    <p className="text-xs !text-zinc-400 mb-2 flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      Tóm tắt được tạo bởi AI
                    </p>
                  </div>
                )}
                {paragraphs.map((paragraph, idx) => (
                  <p key={idx} className="mb-4 !text-zinc-100">
                    {decodeHTML(paragraph)}
                  </p>
                ))}
              </>
            ) : (
              <p className="!text-zinc-100 italic">
                Nội dung chi tiết không khả dụng. Vui lòng xem bài gốc để đọc đầy đủ.
              </p>
            )}
          </article>

          {/* Bottom spacing for scroll */}
          <div className="h-4" />
        </div>

        {/* Footer - Disclaimer */}
        <div className="mt-4 pt-4 border-t border-zinc-700/30">
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Dữ liệu tổng hợp từ các nguồn chính thống. FloodWatch chỉ tái hiện nội dung,
            vui lòng xem chi tiết tại bài gốc nếu cần xác minh thông tin.
          </p>
        </div>
      </div>

      {/* Mobile: Bottom sheet slide-up animation */}
      <style jsx>{`
        @media (max-width: 640px) {
          [role="dialog"] > div:last-of-type {
            align-self: flex-end;
            margin-bottom: 0;
          }
        }
      `}</style>
    </div>
  )
}
