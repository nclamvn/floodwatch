'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import Link from 'next/link'
import CustomDropdown from '@/components/CustomDropdown'
import NewsTicker from '@/components/NewsTicker'
import MediaCarousel from '@/components/MediaCarousel'
import { ArticleReadModal } from '@/components/ArticleReadModal'
import RegionalSummaryInput from '@/components/RegionalSummaryInput'
import RegionalSummaryModal from '@/components/RegionalSummaryModal'
import DisasterLegend from '@/components/DisasterLegend'
import { SidebarHotlineTicker } from '@/components/SidebarHotlineTicker'
import { LocationProvider } from '@/contexts/LocationContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getReportTypeLabel } from '@/types/report'
import { decodeHTML } from '@/lib/htmlDecode'

// Dynamically import Map to avoid SSR issues with Mapbox
const MapView = dynamic(() => import('@/components/MapViewClustered'), {
  ssr: false,
  loading: () => <div className="w-full h-screen flex items-center justify-center">Đang tải bản đồ...</div>
})

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

// Traffic/non-disaster keyword filter helper
const trafficKeywords = [
  'container', 'va chạm', 'va cham', 'tai nạn', 'tai nan',
  'giao thông', 'giao thong', 'xe tải', 'xe tai', 'ô tô', 'o to',
  'xe máy', 'xe may', 'đường bộ', 'duong bo',
  'xe buýt', 'xe buyt', 'xe khách', 'xe khach',
  'CSGT', 'csgt', 'công nhân', 'cong nhan', 'KCN', 'kcn'
]

const isTrafficReport = (report: Report) => {
  const text = `${report.title} ${report.description || ''}`.toLowerCase()

  // Check for traffic/worker keywords
  const hasTrafficKeyword = trafficKeywords.some(kw => text.includes(kw.toLowerCase()))

  if (!hasTrafficKeyword) {
    return false  // No traffic keywords → allow
  }

  // Has traffic keywords - only allow if it also has disaster keywords AND medium trust
  const disasterKeywords = ['lũ', 'lu', 'lụt', 'lut', 'sạt lở', 'sat lo', 'ngập', 'ngap', 'mưa lớn', 'mua lon', 'bão', 'bao', 'thiên tai', 'thien tai', 'sơ tán', 'so tan', 'cứu hộ', 'cuu ho', 'cứu nạn', 'cuu nan']
  const hasDisasterKeyword = disasterKeywords.some(kw => text.includes(kw.toLowerCase()))

  // Traffic keywords + disaster keywords + medium trust/disaster type = allow
  // LOWERED from 0.8 to 0.5, ADDED RAIN type to capture flooding/waterlogging
  if (hasDisasterKeyword && (report.type === 'ALERT' || report.type === 'SOS' || report.type === 'RAIN') && report.trust_score >= 0.5) {
    return false  // Real disaster involving traffic → allow
  }

  return true  // Filter out (traffic/worker news, not real disaster)
}

export default function MapPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [selectedProvince, setSelectedProvince] = useState<string>('ALL')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [radiusFilter, setRadiusFilter] = useState<{ lat: number; lng: number; radius: number } | null>(null)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [lastPinnedUpdate, setLastPinnedUpdate] = useState(Date.now())
  const [targetViewport, setTargetViewport] = useState<{ latitude: number; longitude: number; zoom: number } | null>(null)

  // Regional Summary state
  const [summaryData, setSummaryData] = useState<any | null>(null)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  // Legend state
  const [isLegendOpen, setIsLegendOpen] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Filter for sidebar: show important Vietnamese disaster news with content
  const filteredReports = useMemo(
    () => reports.filter(r => {
      // Exclude traffic reports
      if (isTrafficReport(r)) return false

      // Exclude English sources
      const source = r.source || ''
      if (source.includes('/english') || source.includes('/en/')) return false

      // Require minimum title length
      if (!r.title || r.title.length < 15) return false

      // Require Vietnamese characters in title
      const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
      if (!vietnameseChars.test(r.title)) return false

      // Exclude organization/institution names (titles without verbs/action words)
      const orgKeywords = ['Viện ', 'Trung tâm ', 'Bộ ', 'Cục ', 'Chi cục', 'Sở ', 'Phòng ', 'Agency', 'Ministry', 'Center', 'Institute']
      const isOrgName = orgKeywords.some(kw => r.title.startsWith(kw)) && !r.description
      if (isOrgName) return false

      // Prioritize reports with media
      if (r.media && r.media.length > 0) return true

      // Require description for reports without media
      if (!r.description || r.description.length < 20) return false

      // Show high-priority disaster news with description
      if ((r.type === 'ALERT' || r.type === 'SOS') && r.trust_score >= 0.7) return true
      if (r.type === 'RAIN' && r.trust_score >= 0.8) return true

      return false
    }),
    [reports]
  )

  // Select the most important pinned report (ALERT/SOS with highest trust score)
  const pinnedReport = useMemo(
    () => {
      const candidates = reports
        .filter(r => {
          // Must be ALERT or SOS type
          if (r.type !== 'ALERT' && r.type !== 'SOS') return false

          // Must have high trust score
          if (r.trust_score < 0.7) return false

          // Must have title
          if (!r.title || r.title.length < 15) return false

          // Require Vietnamese characters
          const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
          if (!vietnameseChars.test(r.title)) return false

          // Exclude English sources
          const source = r.source || ''
          if (source.includes('/english') || source.includes('/en/')) return false

          return true
        })
        .sort((a, b) => {
          // Prioritize by trust score first
          if (b.trust_score !== a.trust_score) {
            return b.trust_score - a.trust_score
          }
          // Then by recency
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

      return candidates.length > 0 ? candidates[0] : null
    },
    [reports, lastPinnedUpdate]
  )

  // Filter reports for map (based on user-selected filters)
  const mapReports = useMemo(
    () => {
      let filtered = reports

      // Filter by type (Quan tâm dropdown)
      if (filter !== 'ALL') {
        filtered = filtered.filter(r => r.type === filter)
      }

      // Filter by province (Địa phương dropdown)
      if (selectedProvince !== 'ALL') {
        filtered = filtered.filter(r => r.province === selectedProvince)
      }

      // Filter by radius (if active)
      if (radiusFilter) {
        filtered = filtered.filter(r => {
          if (!r.lat || !r.lon) return false
          const distance = calculateDistance(
            radiusFilter.lat,
            radiusFilter.lng,
            r.lat,
            r.lon
          )
          return distance <= radiusFilter.radius
        })
      }

      return filtered
    },
    [reports, filter, selectedProvince, radiusFilter]
  )

  // Auto-refresh pinned report every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastPinnedUpdate(Date.now())
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [])

  // Auto-pan map when province is selected
  useEffect(() => {
    if (selectedProvince !== 'ALL' && provinceCoordinates[selectedProvince]) {
      const coords = provinceCoordinates[selectedProvince]
      setTargetViewport({
        latitude: coords.lat,
        longitude: coords.lng,
        zoom: coords.zoom
      })
    } else if (selectedProvince === 'ALL') {
      // Reset to Vietnam overview when "ALL" is selected
      setTargetViewport({
        latitude: 16.0,
        longitude: 107.5,
        zoom: 8
      })
    }
  }, [selectedProvince])

  useEffect(() => {
    fetchReports()
    // Auto-refresh every 30 seconds (optimized for production with many users)
    const interval = setInterval(fetchReports, 30000)
    return () => clearInterval(interval)
  }, [filter, selectedProvince, radiusFilter])

  const fetchReports = async () => {
    try {
      // Always fetch ALL reports (no filtering at API level)
      // Filtering will be done client-side for map and sidebar only
      const params: any = { limit: 200 }

      const response = await axios.get(`${API_URL}/reports`, { params })
      const fetchedReports = response.data.data || []

      // No filtering here - all filtering done client-side in mapReports
      setReports(fetchedReports)
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Handle regional summary search
  const handleRegionalSearch = async (province: string) => {
    setIsLoadingSummary(true)
    try {
      const response = await axios.get(`${API_URL}/api/v1/regional-summary`, {
        params: {
          province,
          hours: 24
        }
      })
      setSummaryData(response.data)
      setIsSummaryModalOpen(true)
    } catch (error: any) {
      console.error('Error fetching regional summary:', error)
      // Show error message to user
      if (error.response?.data?.detail) {
        alert(error.response.data.detail.message || 'Không thể tải tình hình khu vực. Vui lòng thử lại.')
      } else {
        alert('Không thể tải tình hình khu vực. Vui lòng kiểm tra kết nối và thử lại.')
      }
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const provinces = ['ALL', 'Đà Nẵng', 'Quảng Nam', 'Quảng Trị', 'Thừa Thiên Huế', 'Quảng Bình']

  // Province coordinates for auto-pan
  const provinceCoordinates: Record<string, { lat: number; lng: number; zoom: number }> = {
    'Đà Nẵng': { lat: 16.0544, lng: 108.2022, zoom: 11 },
    'Quảng Nam': { lat: 15.5394, lng: 108.0191, zoom: 10 },
    'Quảng Trị': { lat: 16.7403, lng: 107.1854, zoom: 10 },
    'Thừa Thiên Huế': { lat: 16.4637, lng: 107.5909, zoom: 10 },
    'Quảng Bình': { lat: 17.4676, lng: 106.6229, zoom: 10 },
  }

  // Dropdown options
  const filterOptions = [
    { value: 'ALL', label: 'Quan tâm' },
    { value: 'ALERT', label: 'Cảnh báo' },
    { value: 'SOS', label: 'SOS' },
    { value: 'ROAD', label: 'Đường bộ' },
    { value: 'NEEDS', label: 'Nhu yếu phẩm' }
  ]

  const provinceOptions = provinces.map(p => ({
    value: p,
    label: p === 'ALL' ? 'Địa phương' : p
  }))

  return (
    <ErrorBoundary>
      <LocationProvider>
        <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Header overlay - Voice Player + Filter controls */}
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-50 p-3 sm:p-4"
        aria-label="Site header"
      >
        {/* Layout container */}
        <div className="relative flex items-start justify-end">
          {/* Filter controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Desktop filters - Custom dropdowns with glass effect */}
            <div className="hidden sm:flex items-center gap-2">
              <CustomDropdown
                value={filter}
                onChange={setFilter}
                options={filterOptions}
              />
              <CustomDropdown
                value={selectedProvince}
                onChange={setSelectedProvince}
                options={provinceOptions}
              />
              {/* Help Connection Button */}
              <Link
                href="/help"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-lg transition-all hover:shadow-xl hover:scale-105 backdrop-blur-sm border border-blue-500"
              >
                <span className="whitespace-nowrap">Cứu trợ</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile: News button - Top right */}
      <div className="sm:hidden fixed top-3 right-3 z-[70] flex flex-col gap-2">
        {/* News Toggle Button */}
        <button
          onClick={() => setSheetOpen(!sheetOpen)}
          className="w-14 h-14 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-full font-bold flex flex-col items-center justify-center shadow-lg transition-all backdrop-blur-sm border border-primary-500"
        >
          <span className="text-lg">📋</span>
          {filteredReports.length > 0 && (
            <span className="text-[10px] leading-none mt-0.5">{filteredReports.length}</span>
          )}
        </button>

        {/* Help Connection Button (Mobile) */}
        <Link
          href="/help"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full font-semibold flex items-center justify-center shadow-lg transition-all backdrop-blur-sm border border-blue-500 text-sm"
        >
          Cứu trợ
        </Link>
      </div>

      {/* Gradient overlay for readability */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-16 sm:h-20 bg-gradient-to-b from-black/10 to-transparent" />

      {/* Desktop Sidebar - Overlay on map */}
      <aside className={`hidden md:flex absolute top-16 left-4 bottom-40 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-neutral-900/70 rounded-prominent shadow-soft-xl overflow-hidden z-30 flex-col border border-white/20 dark:border-neutral-700/30 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-96'
      }`}>
        {/* Sidebar Header */}
        <div className={`py-3 bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white flex items-center justify-between ${
          sidebarCollapsed ? 'px-0' : 'px-6'
        }`}>
          {sidebarCollapsed ? (
            // Collapsed: Only show expand icon
            <div className="flex items-center justify-center mx-auto">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
                aria-label="Mở sidebar"
              >
                {/* Expand icon (arrow right) */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : (
            // Expanded: Show title and collapse button
            <>
              <div>
                <h2 className="text-lg font-bold">Bảng tin</h2>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex-shrink-0"
                aria-label="Thu gọn sidebar"
              >
                {/* Collapse icon (arrow left) */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Emergency Hotline Ticker - Only when expanded */}
        {!sidebarCollapsed && <SidebarHotlineTicker />}

        {/* Reports List */}
        {sidebarCollapsed ? (
          // Collapsed: Show only icons vertically
          <div className="flex-1 flex flex-col items-center gap-2 py-4 overflow-y-auto custom-scrollbar">
            {filteredReports.slice(0, 20).map((report) => {
              const getIcon = (type: string) => {
                switch (type) {
                  case 'ALERT': return '⚠️'
                  case 'SOS': return '🆘'
                  case 'ROAD': return '🚧'
                  case 'NEEDS': return '📦'
                  default: return 'ℹ️'
                }
              }
              return (
                <button
                  key={report.id}
                  onClick={() => {
                    setSelectedReport(report)
                    setIsModalOpen(true)
                  }}
                  className="text-2xl hover:scale-125 active:scale-110 transition-transform cursor-pointer"
                  title={report.title}
                >
                  {getIcon(report.type)}
                </button>
              )
            })}
          </div>
        ) : (
          // Expanded: Show full reports list
          <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-24 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400 px-6">
              <div className="text-5xl mb-3 opacity-50">📭</div>
              <p className="text-sm font-medium">Không có dữ liệu</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredReports.map((report) => (
                <article
                  key={report.id}
                  className="p-4 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm border border-white/30 dark:border-neutral-700/30 rounded-card hover:shadow-soft-md hover:border-white/50 dark:hover:border-neutral-600/50 hover:bg-white/80 dark:hover:bg-neutral-800/80 transition-all cursor-pointer group"
                  onClick={() => {
                    setSelectedReport(report)
                    setIsModalOpen(true)
                  }}
                >
                  {/* Type Badge */}
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded text-white ${
                      report.type === 'SOS' ? 'bg-red-700 dark:bg-red-800' :
                      report.type === 'ALERT' ? 'bg-red-600 dark:bg-red-700' :
                      report.type === 'ROAD' ? 'bg-amber-600 dark:bg-amber-700' :
                      report.type === 'RAIN' ? 'bg-blue-600 dark:bg-blue-700' :
                      report.type === 'NEEDS' ? 'bg-purple-600 dark:bg-purple-700' :
                      'bg-gray-600 dark:bg-gray-700'
                    }`}>
                      {getReportTypeLabel(report.type)}
                    </span>
                  </div>

                  {/* Content with optional thumbnail */}
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    {report.media && report.media.length > 0 && (
                      <div className="flex-shrink-0">
                        <img
                          src={report.media[0]}
                          alt={report.title}
                          className="w-16 h-16 object-cover rounded border border-neutral-200 dark:border-neutral-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                        {decodeHTML(report.title)}
                      </h3>

                      {/* Province only */}
                      <div className="flex items-center text-xs text-neutral-500 dark:text-neutral-500">
                        <span className="flex items-center gap-1">
                          <span className="text-sm">📍</span>
                          {report.province ? decodeHTML(report.province) : 'Không rõ'}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          </div>
        )}
      </aside>

      {/* Mobile Bottom Sheet - Spring Animation */}
      {sheetOpen && (
        <>
          {/* Backdrop with fade */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-200"
            onClick={() => setSheetOpen(false)}
          />

          {/* Bottom Sheet - Slide up with spring */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-sheet shadow-soft-xl z-50 max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-300 ease-spring border-t border-neutral-200 dark:border-neutral-800">
            {/* Sheet Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full" />
            </div>

            {/* Sheet Header */}
            <div className="px-5 py-4 bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold mb-0.5">Tin mới nhận</h2>
                <p className="text-sm text-primary-100">{reports.length} báo cáo</p>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors tap-target"
                aria-label="Đóng"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            {/* Reports List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-5 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton h-28 w-full" />
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400 px-6 py-12">
                  <div className="text-6xl mb-4 opacity-50">📭</div>
                  <p className="text-sm font-medium">Không có dữ liệu</p>
                </div>
              ) : (
                <div className="p-4 space-y-3 pb-6">
                  {filteredReports.map((report) => (
                    <article
                      key={report.id}
                      className="p-4 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm border border-white/30 dark:border-neutral-700/30 rounded-card active:scale-[0.98] active:bg-white/80 dark:active:bg-neutral-800/80 transition-all tap-target"
                      onClick={() => {
                        setSelectedReport(report)
                        setIsModalOpen(true)
                      }}
                    >
                      {/* Type Badge & Trust */}
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-3 py-1.5 text-sm font-medium rounded text-white ${
                          report.type === 'SOS' ? 'bg-red-700 dark:bg-red-800' :
                          report.type === 'ALERT' ? 'bg-red-600 dark:bg-red-700' :
                          report.type === 'ROAD' ? 'bg-amber-600 dark:bg-amber-700' :
                          report.type === 'RAIN' ? 'bg-blue-600 dark:bg-blue-700' :
                          report.type === 'NEEDS' ? 'bg-purple-600 dark:bg-purple-700' :
                          'bg-gray-600 dark:bg-gray-700'
                        }`}>
                          {getReportTypeLabel(report.type)}
                        </span>
                      </div>

                      {/* Content with optional thumbnail */}
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        {report.media && report.media.length > 0 && (
                          <div className="flex-shrink-0">
                            <img
                              src={report.media[0]}
                              alt={report.title}
                              className="w-20 h-20 object-cover rounded border border-neutral-200 dark:border-neutral-700"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}

                        {/* Text content */}
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-1 line-clamp-2">
                            {decodeHTML(report.title)}
                          </h3>

                          {/* Province only */}
                          <div className="flex items-center text-sm text-neutral-500 dark:text-neutral-500">
                            <span className="flex items-center gap-1">
                              <span>📍</span>
                              {report.province ? decodeHTML(report.province) : 'Không rõ'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Map area - Full-bleed */}
      <main className="h-full w-full">
        <MapView
          reports={mapReports}
          radiusFilter={radiusFilter}
          targetViewport={targetViewport}
          onViewportChange={() => setTargetViewport(null)}
          onMapClick={(lat, lng) => {
            // Ctrl+Click to set radius filter (20km radius)
            setRadiusFilter({ lat, lng, radius: 20 })
          }}
          onClearRadius={() => setRadiusFilter(null)}
          onExpandArticle={(report) => {
            // Open modal when expand button is clicked
            setSelectedReport(report)
            setIsModalOpen(true)
          }}
          onLegendClick={() => setIsLegendOpen(!isLegendOpen)}
          legendActive={isLegendOpen}
        />
      </main>

      {/* Media Carousel - Auto-playing slideshow above Hot News */}
      <MediaCarousel
        reports={reports}
        onReportClick={(report) => {
          setSelectedReport(report)
          setIsModalOpen(true)
        }}
      />

      {/* Hot News Ticker - Fixed at bottom */}
      <NewsTicker
        reports={reports}
        onReportClick={(report) => {
          setSelectedReport(report)
          setIsModalOpen(true)
        }}
      />

      {/* Article Read Modal - Premium reading experience */}
      <ArticleReadModal
        report={selectedReport}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedReport(null)
        }}
      />

      {/* Regional Summary Input - Bottom-right expandable search */}
      <RegionalSummaryInput
        onSearch={handleRegionalSearch}
        isLoading={isLoadingSummary}
      />

      {/* Regional Summary Modal - AI-powered regional report */}
      <RegionalSummaryModal
        data={summaryData}
        isOpen={isSummaryModalOpen}
        onClose={() => {
          setIsSummaryModalOpen(false)
          setSummaryData(null)
        }}
        onReportClick={(reportId) => {
          // Find report and open ArticleReadModal
          const report = reports.find(r => r.id === reportId)
          if (report) {
            setSelectedReport(report)
            setIsModalOpen(true)
            setIsSummaryModalOpen(false) // Close summary modal
          }
        }}
      />

      {/* Disaster Legend - Controlled from header button */}
      <DisasterLegend
        isOpen={isLegendOpen}
        onClose={() => setIsLegendOpen(false)}
        lastUpdated={reports.length > 0 ? new Date(reports[0].created_at) : undefined}
      />
      </div>
      </LocationProvider>
    </ErrorBoundary>
  )
}
