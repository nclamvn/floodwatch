'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import CustomDropdown from '@/components/CustomDropdown'
import { LocationProvider } from '@/contexts/LocationContext'
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import DarkModeToggle from '@/components/DarkModeToggle'
import { getReportTypeLabel } from '@/types/report'
import { decodeHTML } from '@/lib/htmlDecode'
import {
  getCachedStormSummary,
  setCachedStormSummary,
  getStormSummaryCacheAge
} from '@/lib/aiSearchCache'
import { getCachedResponse, setCachedResponse } from '@/lib/apiCache'
import { ArrowLeft } from 'lucide-react'
import { STORAGE_KEYS } from '@/hooks/usePersistedState'

// Phase 1: Lazy load heavy components for faster initial render
const NewsTicker = dynamic(() => import('@/components/NewsTicker'), {
  ssr: false,
  loading: () => null
})

const MediaCarousel = dynamic(() => import('@/components/MediaCarousel'), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-100/50 dark:bg-gray-800/50 animate-pulse rounded-lg" />
})

const ArticleReadModal = dynamic(
  () => import('@/components/ArticleReadModal').then(mod => ({ default: mod.ArticleReadModal })),
  { ssr: false }
)


const StormButton = dynamic(() => import('@/components/StormButton'), {
  ssr: false,
  loading: () => <div className="w-32 h-10 bg-purple-600/50 animate-pulse rounded-full" />
})

const StormSummaryModal = dynamic(() => import('@/components/StormSummaryModal'), {
  ssr: false
})

const DisasterLegend = dynamic(() => import('@/components/DisasterLegend'), {
  ssr: false
})

const SidebarHotlineTicker = dynamic(
  () => import('@/components/SidebarHotlineTicker').then(mod => ({ default: mod.SidebarHotlineTicker })),
  { ssr: false }
)

const SidebarAudioPlayer = dynamic(() => import('@/components/SidebarAudioPlayer'), {
  ssr: false,
  loading: () => <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 animate-pulse rounded-full" />
})

const WindyModal = dynamic(
  () => import('@/components/WindyModal').then(mod => ({ default: mod.WindyModal })),
  { ssr: false }
)

// Dynamically import Map to avoid SSR issues with Mapbox
const MapView = dynamic(() => import('@/components/MapViewClustered'), {
  ssr: false,
  loading: () => <MapSkeleton />
})

// Mobile Pin Popup - rendered at page level for proper z-index stacking
const MobilePinPopup = dynamic(() => import('@/components/MobilePinPopup'), {
  ssr: false
})

// Phase 1: Skeleton UI for instant visual feedback
function MapSkeleton() {
  return (
    <div className="w-full h-screen bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center relative overflow-hidden">
      {/* Vietnam map outline placeholder */}
      <div className="absolute inset-0 opacity-20">
        <svg viewBox="0 0 100 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <path
            d="M50 10 L60 30 L55 50 L60 80 L50 100 L55 130 L45 160 L50 190 L40 180 L35 150 L40 120 L35 90 L45 60 L40 30 Z"
            fill="currentColor"
            className="text-blue-300 dark:text-blue-700"
          />
        </svg>
      </div>
      {/* Loading spinner */}
      <div className="z-10 flex flex-col items-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mb-4" />
        <p className="text-blue-600 dark:text-blue-400 font-medium">Đang tải bản đồ...</p>
      </div>
    </div>
  )
}

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
  const t = useTranslations('map')

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true) // Phase 1: Track initial load for skeleton
  const [filter, setFilter] = useState<string>('ALL')
  const [selectedProvince, setSelectedProvince] = useState<string>('ALL')
  const [isFilterHydrated, setIsFilterHydrated] = useState(false)

  // Load map filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MAP_FILTERS)
      if (stored) {
        const { filter: savedFilter, province: savedProvince } = JSON.parse(stored)
        if (savedFilter) setFilter(savedFilter)
        if (savedProvince) setSelectedProvince(savedProvince)
      }
    } catch (error) {
      console.warn('Failed to load map filters:', error)
    }
    setIsFilterHydrated(true)
  }, [])

  // Save map filters to localStorage when they change
  useEffect(() => {
    if (!isFilterHydrated) return
    try {
      localStorage.setItem(STORAGE_KEYS.MAP_FILTERS, JSON.stringify({
        filter,
        province: selectedProvince
      }))
    } catch (error) {
      console.warn('Failed to save map filters:', error)
    }
  }, [filter, selectedProvince, isFilterHydrated])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [radiusFilter, setRadiusFilter] = useState<{ lat: number; lng: number; radius: number } | null>(null)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Mobile pin popup state - lifted from MapViewClustered for proper z-index stacking
  const [mobilePopupReport, setMobilePopupReport] = useState<Report | null>(null)
  const [lastPinnedUpdate, setLastPinnedUpdate] = useState(Date.now())
  const [targetViewport, setTargetViewport] = useState<{ latitude: number; longitude: number; zoom: number } | null>(null)

  // Legend state
  const [isLegendOpen, setIsLegendOpen] = useState(false)

  // Windy modal state
  const [windyModalOpen, setWindyModalOpen] = useState(false)
  const [windyStormView, setWindyStormView] = useState(false)

  // Storm summary state
  const [stormData, setStormData] = useState<any | null>(null)
  const [isStormModalOpen, setIsStormModalOpen] = useState(false)
  const [isLoadingStorm, setIsLoadingStorm] = useState(false)

  // Viewport state for WindyModal
  const [viewportForWindy, setViewportForWindy] = useState({ lat: 16.0, lon: 108.2, zoom: 8 })

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://188.166.248.10:8000'

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
        longitude: 106.0,
        zoom: 5.5
      })
    }
  }, [selectedProvince])

  // Phase 1: Progressive data loading with timeout
  const fetchReports = useCallback(async (isRefresh = false) => {
    const CACHE_TTL_MS = 30 * 1000 // 30 seconds cache for reports
    const INITIAL_LIMIT = 50 // Load 50 items first for fast initial render
    const FULL_LIMIT = 200 // Then load remaining in background
    const REQUEST_TIMEOUT = 5000 // 5 second timeout

    try {
      // Check cache first for instant response
      const cacheKey = `${API_URL}/reports?limit=${FULL_LIMIT}`
      const cached = getCachedResponse<{ data: Report[] }>(cacheKey)
      if (cached && cached.data) {
        setReports(cached.data)
        setLoading(false)
        setIsInitialLoad(false)
        return
      }

      // Phase 1: Fast initial load with 50 items + timeout
      if (isInitialLoad && !isRefresh) {
        try {
          const initialResponse = await axios.get(`${API_URL}/reports`, {
            params: { limit: INITIAL_LIMIT },
            timeout: REQUEST_TIMEOUT
          })
          const initialReports = initialResponse.data.data || []
          setReports(initialReports)
          setLoading(false)
          setIsInitialLoad(false)

          // Background load: Fetch remaining items after initial render
          setTimeout(async () => {
            try {
              const fullResponse = await axios.get(`${API_URL}/reports`, {
                params: { limit: FULL_LIMIT },
                timeout: REQUEST_TIMEOUT * 2 // Allow more time for full load
              })
              const fullReports = fullResponse.data.data || []
              setCachedResponse(cacheKey, fullResponse.data, CACHE_TTL_MS)
              setReports(fullReports)
            } catch (bgError) {
              console.warn('[Reports] Background load failed:', bgError)
              // Keep initial data, don't fail
            }
          }, 1000) // Wait 1 second before background load

          return
        } catch (initialError) {
          console.warn('[Reports] Initial fast load failed, trying full load:', initialError)
          // Fall through to try full load
        }
      }

      // Full load (for refreshes or if initial load failed)
      const response = await axios.get(`${API_URL}/reports`, {
        params: { limit: FULL_LIMIT },
        timeout: REQUEST_TIMEOUT * 2
      })
      const fetchedReports = response.data.data || []

      // Cache the response
      setCachedResponse(cacheKey, response.data, CACHE_TTL_MS)

      setReports(fetchedReports)
    } catch (error) {
      console.error('[Reports] Error fetching reports:', error)
      // Don't clear existing reports on error
    } finally {
      setLoading(false)
      setIsInitialLoad(false)
    }
  }, [API_URL, isInitialLoad])

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchReports()
    // Auto-refresh every 30 seconds (optimized for production with many users)
    const interval = setInterval(() => fetchReports(true), 30000)
    return () => clearInterval(interval)
  }, [fetchReports])

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

  // Handle storm summary (with 30-minute cache)
  const handleStormClick = async () => {
    console.log('[StormSummary] Fetching storm summary...')

    // Check cache first
    const hours = 72
    const cached = getCachedStormSummary(hours)
    if (cached) {
      const cacheAge = getStormSummaryCacheAge(hours)
      console.log('[StormSummary] Using cached result, age:', cacheAge, 'minutes')
      setStormData(cached)
      setIsStormModalOpen(true)
      return
    }

    setIsLoadingStorm(true)
    try {
      const response = await axios.get(`${API_URL}/api/v1/storm-summary`, {
        params: { hours },  // Last 3 days
        timeout: 60000  // 60 seconds timeout for AI processing
      })
      console.log('[StormSummary] API response:', response.data)

      // Cache the result
      setCachedStormSummary(hours, response.data)

      setStormData(response.data)
      setIsStormModalOpen(true)
    } catch (error: any) {
      console.error('[StormSummary] Error:', error)
      const errorMsg = error.response?.data?.detail?.message
        || error.response?.data?.message
        || error.message
        || 'Không thể tải thông tin bão'
      alert(`Lỗi: ${errorMsg}`)
    } finally {
      setIsLoadingStorm(false)
    }
  }

  // 34 tỉnh/thành phố Việt Nam (từ 1/7/2025)
  const provinces = [
    'ALL',
    // 5 TP trực thuộc Trung ương + Thành phố Huế
    'Hà Nội',
    'TP. Hồ Chí Minh',
    'Hải Phòng',
    'Đà Nẵng',
    'Cần Thơ',
    'Thành phố Huế',
    // 28 tỉnh (theo alphabet)
    'An Giang',
    'Bắc Ninh',
    'Bình Định',
    'Bình Thuận',
    'Cà Mau',
    'Cao Bằng',
    'Đắk Lắk',
    'Điện Biên',
    'Đồng Nai',
    'Đồng Tháp',
    'Gia Lai',
    'Hà Nam',
    'Hà Tĩnh',
    'Hải Dương',
    'Hòa Bình',
    'Hưng Yên',
    'Khánh Hòa',
    'Lạng Sơn',
    'Lào Cai',
    'Lâm Đồng',
    'Long An',
    'Phú Thọ',
    'Quảng Nam',
    'Quảng Ninh',
    'Sóc Trăng',
    'Tây Ninh',
    'Thái Nguyên',
    'Tuyên Quang',
  ]

  // Province coordinates for auto-pan (34 tỉnh/thành phố từ 1/7/2025)
  const provinceCoordinates: Record<string, { lat: number; lng: number; zoom: number }> = {
    // 5 TP trực thuộc TW + Thành phố Huế
    'Hà Nội': { lat: 21.0285, lng: 105.8542, zoom: 10 },
    'TP. Hồ Chí Minh': { lat: 10.8231, lng: 106.6297, zoom: 10 },
    'Hải Phòng': { lat: 20.8449, lng: 106.6881, zoom: 11 },
    'Đà Nẵng': { lat: 16.0544, lng: 108.2022, zoom: 11 },
    'Cần Thơ': { lat: 10.0452, lng: 105.7469, zoom: 10 },
    'Thành phố Huế': { lat: 16.4637, lng: 107.5909, zoom: 10 },
    // 28 tỉnh
    'An Giang': { lat: 10.5216, lng: 105.1259, zoom: 9 },
    'Bắc Ninh': { lat: 21.1861, lng: 106.0763, zoom: 11 },
    'Bình Định': { lat: 14.1665, lng: 109.0590, zoom: 9 },
    'Bình Thuận': { lat: 11.0904, lng: 108.0721, zoom: 9 },
    'Cà Mau': { lat: 9.1769, lng: 105.1524, zoom: 9 },
    'Cao Bằng': { lat: 22.6666, lng: 106.2640, zoom: 9 },
    'Đắk Lắk': { lat: 12.7100, lng: 108.2378, zoom: 9 },
    'Điện Biên': { lat: 21.3860, lng: 103.0230, zoom: 9 },
    'Đồng Nai': { lat: 11.0686, lng: 107.1676, zoom: 9 },
    'Đồng Tháp': { lat: 10.4938, lng: 105.6882, zoom: 9 },
    'Gia Lai': { lat: 13.9830, lng: 108.0191, zoom: 8 },
    'Hà Nam': { lat: 20.5835, lng: 105.9230, zoom: 10 },
    'Hà Tĩnh': { lat: 18.3559, lng: 105.8877, zoom: 9 },
    'Hải Dương': { lat: 20.9373, lng: 106.3146, zoom: 10 },
    'Hòa Bình': { lat: 20.8171, lng: 105.3376, zoom: 9 },
    'Hưng Yên': { lat: 20.6464, lng: 106.0511, zoom: 10 },
    'Khánh Hòa': { lat: 12.2585, lng: 109.0526, zoom: 9 },
    'Lạng Sơn': { lat: 21.8537, lng: 106.7615, zoom: 9 },
    'Lào Cai': { lat: 22.4856, lng: 103.9707, zoom: 9 },
    'Lâm Đồng': { lat: 11.9404, lng: 108.4583, zoom: 9 },
    'Long An': { lat: 10.5360, lng: 106.4131, zoom: 9 },
    'Phú Thọ': { lat: 21.4225, lng: 105.2297, zoom: 9 },
    'Quảng Nam': { lat: 15.5394, lng: 108.0191, zoom: 9 },
    'Quảng Ninh': { lat: 21.0064, lng: 107.2925, zoom: 9 },
    'Sóc Trăng': { lat: 9.6025, lng: 105.9739, zoom: 9 },
    'Tây Ninh': { lat: 11.3351, lng: 106.1099, zoom: 10 },
    'Thái Nguyên': { lat: 21.5942, lng: 105.8482, zoom: 9 },
    'Tuyên Quang': { lat: 21.8237, lng: 105.2181, zoom: 9 },
  }

  // Dropdown options
  const filterOptions = [
    { value: 'ALL', label: t('filters.interest') },
    { value: 'ALERT', label: t('filters.alert') },
    { value: 'SOS', label: t('filters.sos') },
    { value: 'ROAD', label: t('filters.road') },
    { value: 'NEEDS', label: t('filters.needs') }
  ]

  const provinceOptions = provinces.map(p => ({
    value: p,
    label: p === 'ALL' ? t('filters.province') : p
  }))

  return (
    <ErrorBoundary>
      <AudioPlayerProvider>
      <LocationProvider>
        <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Header overlay - Desktop layout */}
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-50 p-3 sm:p-4"
        aria-label="Site header"
      >
        {/* Desktop Layout: Left controls + Right action buttons */}
        <div className="hidden sm:flex items-center justify-between">
          {/* Left side: Back - Theme - Quan tâm - Địa phương - (Khay bản đồ is MapControlsGroup rendered by MapView) */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Back Button - Matching DarkModeToggle size */}
            <Link
              href="/"
              className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full backdrop-blur-xl border shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] transition-all duration-ui ease-smooth hover:scale-105 active:scale-95 bg-white/70 hover:bg-white/80 text-gray-900 border-neutral-300/50 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-700/80 dark:border-neutral-700/50"
              aria-label={t('buttons.backHome')}
            >
              <ArrowLeft className="w-5 h-5 sm:w-4 sm:h-4" />
            </Link>
            {/* Dark Mode Toggle */}
            <DarkModeToggle />
            {/* Quan tâm Dropdown */}
            <CustomDropdown
              value={filter}
              onChange={setFilter}
              options={filterOptions}
            />
            {/* Địa phương Dropdown */}
            <CustomDropdown
              value={selectedProvince}
              onChange={setSelectedProvince}
              options={provinceOptions}
            />
            {/* Note: Khay bản đồ (MapControlsGroup) is rendered inside MapView at position left-16 */}
          </div>

          {/* Right side: Cứu trợ - Tuyến đường - Thời tiết - Bão số 15 */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Help Connection Button */}
            <Link
              href="/help"
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white text-body-1 font-semibold rounded-pill shadow-elevation-1 transition-all duration-ui ease-smooth hover:shadow-elevation-2 hover:scale-105 backdrop-blur-md border border-orange-500"
            >
              <span className="whitespace-nowrap">{t('buttons.rescue')}</span>
            </Link>
            {/* Routes Button */}
            <Link
              href="/routes"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-body-1 font-semibold rounded-pill shadow-elevation-1 transition-all duration-ui ease-smooth hover:shadow-elevation-2 hover:scale-105 backdrop-blur-md border border-blue-500"
            >
              <span className="whitespace-nowrap">{t('buttons.routes')}</span>
            </Link>
            {/* Weather Button (Windy) */}
            <button
              onClick={() => setWindyModalOpen(true)}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-body-1 font-semibold rounded-pill shadow-elevation-1 transition-all duration-ui ease-smooth hover:shadow-elevation-2 hover:scale-105 backdrop-blur-md border border-emerald-500"
            >
              <span className="whitespace-nowrap">{t('buttons.weather')}</span>
            </button>
            {/* Storm Button */}
            <StormButton onClick={handleStormClick} />
          </div>
        </div>
      </header>

      {/* Mobile: Action buttons - Top right - Design System 2025 */}
      {/* Note: Back button, Theme toggle, and Map controls are now in MobileMapControls component */}
      {/* Order: Cứu trợ → Tuyến đường → Thời tiết → Bão số 15 → Tin tức */}
      {/* z-50: Lower than popups (z-[100]/z-[110]) so popups can cover these buttons */}
      <div className="sm:hidden fixed top-3 right-3 z-50 flex flex-col gap-2">
        {/* 1. Help Connection Button - Cứu trợ (Orange) */}
        <Link
          href="/help"
          className="min-w-[90px] h-[36px] px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-pill font-semibold flex items-center justify-center shadow-elevation-1 transition-all duration-ui ease-smooth backdrop-blur-md border border-orange-500 text-body-2"
        >
          {t('buttons.rescue')}
        </Link>

        {/* 2. Routes Button - Tuyến đường (Blue) */}
        <Link
          href="/routes"
          className="min-w-[90px] h-[36px] px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-pill font-semibold flex items-center justify-center shadow-elevation-1 transition-all duration-ui ease-smooth backdrop-blur-md border border-blue-500 text-body-2"
        >
          {t('buttons.routes')}
        </Link>

        {/* 3. Weather Button - Thời tiết (Green) */}
        <button
          onClick={() => setWindyModalOpen(true)}
          className="min-w-[90px] h-[36px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-pill font-semibold flex items-center justify-center shadow-elevation-1 transition-all duration-ui ease-smooth backdrop-blur-md border border-emerald-500 text-body-2"
        >
          {t('buttons.weather')}
        </button>

        {/* 4. Storm Button - Bão số 15 (Purple) */}
        <StormButton onClick={handleStormClick} className="min-w-[90px] h-[36px] px-4 py-2 text-body-2" />

        {/* 5. News Toggle Button - Tin tức (Gray) */}
        <button
          onClick={() => setSheetOpen(!sheetOpen)}
          className="min-w-[90px] h-[36px] px-4 py-2 bg-neutral-600 hover:bg-neutral-700 active:bg-neutral-800 text-white rounded-pill font-semibold flex items-center justify-center shadow-elevation-1 transition-all duration-ui ease-smooth backdrop-blur-md border border-neutral-500 text-body-2"
        >
          <span>{t('buttons.news')}</span>
          {filteredReports.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-pill text-label">{filteredReports.length}</span>
          )}
        </button>
      </div>

      {/* Mobile Pin Popup - Rendered at page level for proper z-index stacking
          This popup is OUTSIDE the Map stacking context, so z-index works correctly
          z-[60] > buttons z-50, allowing popup to cover buttons when opened */}
      <MobilePinPopup
        report={mobilePopupReport}
        onClose={() => setMobilePopupReport(null)}
        onExpand={(report) => {
          setSelectedReport(report)
          setIsModalOpen(true)
          setMobilePopupReport(null)
        }}
      />

      {/* Gradient overlay for readability */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-16 sm:h-20 bg-gradient-to-b from-black/10 to-transparent" />

      {/* Desktop Sidebar - Design System 2025 */}
      {sidebarCollapsed ? (
        // Collapsed: Compact tab with circular audio player + expand arrow
        // Using div instead of button to allow nested button in SidebarAudioPlayer
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSidebarCollapsed(false)}
          onKeyDown={(e) => e.key === 'Enter' && setSidebarCollapsed(false)}
          className="hidden md:flex absolute left-0 top-[72px] z-30 flex-row items-center justify-center gap-2
                     px-2.5 py-2 rounded-r-lg glass shadow-elevation-2 border border-l-0 border-slate-800 dark:border-neutral-700
                     hover:pl-3 transition-all duration-200 group cursor-pointer"
          aria-label={t('sidebar.expand')}
        >
          {/* Circular Audio Player - Click to play/pause (doesn't expand sidebar) */}
          <div onClick={(e) => e.stopPropagation()}>
            <SidebarAudioPlayer collapsed={true} />
          </div>

          {/* Expand Arrow */}
          <svg className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ) : (
        // Expanded: Full sidebar panel
        <aside className="hidden md:flex absolute top-[72px] left-4 bottom-[207px] w-96 rounded-lg glass shadow-elevation-2 border border-slate-800 dark:border-neutral-700 overflow-hidden z-30 flex-col">
          {/* Sidebar Header */}
          <div className="px-6 py-3 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-800 text-neutral-900 dark:text-white flex items-center justify-between gap-3">
            {/* Left: Title + Separator + Audio Player */}
            <div className="flex items-center gap-2.5">
              <h2 className="text-title-2">{t('sidebar.title')}</h2>
              <span className="text-neutral-400 dark:text-neutral-500 text-sm">|</span>
              <SidebarAudioPlayer collapsed={false} />
            </div>

            {/* Right: Simplified collapse button - NO background circle */}
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="flex items-center justify-center -mr-1
                         text-neutral-600 dark:text-neutral-400
                         hover:text-neutral-900 dark:hover:text-white
                         transition-colors duration-200"
              aria-label={t('sidebar.collapse')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Emergency Hotline Ticker */}
          <SidebarHotlineTicker />

          {/* Reports List - Expanded view */}
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
              <p className="text-sm font-medium">{t('sidebar.noData')}</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredReports.map((report) => (
                <article
                  key={report.id}
                  className="p-4 glass rounded-sm border border-neutral-800/50 dark:border-neutral-700/50 hover:shadow-elevation-1 hover:border-neutral-700 dark:hover:border-neutral-600 hover:bg-white/95 dark:hover:bg-neutral-900/95 transition-all duration-ui ease-smooth cursor-pointer group"
                  onClick={() => {
                    setSelectedReport(report)
                    setIsModalOpen(true)
                  }}
                >
                  {/* Type Badge */}
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2.5 py-1 text-label rounded-xs text-white ${
                      report.type === 'SOS' ? 'bg-danger-strong' :
                      report.type === 'ALERT' ? 'bg-danger' :
                      report.type === 'ROAD' ? 'bg-warning' :
                      report.type === 'RAIN' ? 'bg-neutral-600' :
                      report.type === 'NEEDS' ? 'bg-neutral-600' :
                      'bg-neutral-600'
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
                          className="w-16 h-16 object-cover rounded-xs border border-neutral-200 dark:border-neutral-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="font-semibold text-body-2 text-neutral-900 dark:text-neutral-100 mb-1 group-hover:text-neutral-600 dark:group-hover:text-neutral-400 transition-colors duration-ui line-clamp-2">
                        {decodeHTML(report.title)}
                      </h3>

                      {/* Province only */}
                      <div className="flex items-center text-label text-neutral-700 dark:text-neutral-200">
                        <span className="flex items-center gap-1">
                          <span className="text-sm">📍</span>
                          {report.province ? decodeHTML(report.province) : t('sidebar.unknown')}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          </div>
        </aside>
      )}

      {/* Mobile Bottom Sheet - Full Screen Card - Design System 2025 */}
      {sheetOpen && (
        <>
          {/* Backdrop with fade */}
          <div
            className="md:hidden fixed inset-0 bg-black/70 z-[90] animate-in fade-in duration-300"
            onClick={() => setSheetOpen(false)}
          />

          {/* Full Screen Card - Slide up from bottom */}
          <div
            className="md:hidden fixed inset-0 z-[100] flex flex-col bg-white dark:bg-neutral-900 animate-in slide-in-from-bottom duration-300 ease-out"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {/* Sheet Header - Sticky */}
            <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 text-neutral-900 dark:text-white flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
              <div>
                <h2 className="text-title-2 mb-0.5">{t('sidebar.latestNews')}</h2>
                <p className="text-body-2 text-neutral-600 dark:text-neutral-400">{filteredReports.length} {t('sidebar.reports')}</p>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 active:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:active:bg-neutral-500 transition-all duration-ui ease-smooth"
                aria-label={t('sidebar.close')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                  <p className="text-sm font-medium">{t('sidebar.noData')}</p>
                </div>
              ) : (
                <div className="p-4 space-y-3 pb-6">
                  {filteredReports.map((report) => (
                    <article
                      key={report.id}
                      className="p-4 glass rounded-sm border border-neutral-800/50 dark:border-neutral-700/50 active:scale-[0.98] active:bg-white/95 dark:active:bg-neutral-900/95 transition-all duration-ui ease-smooth tap-target"
                      onClick={() => {
                        setSelectedReport(report)
                        setIsModalOpen(true)
                      }}
                    >
                      {/* Type Badge */}
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-3 py-1.5 text-body-2 font-medium rounded-xs text-white ${
                          report.type === 'SOS' ? 'bg-danger-strong' :
                          report.type === 'ALERT' ? 'bg-danger' :
                          report.type === 'ROAD' ? 'bg-warning' :
                          report.type === 'RAIN' ? 'bg-neutral-600' :
                          report.type === 'NEEDS' ? 'bg-neutral-600' :
                          'bg-neutral-600'
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
                              className="w-20 h-20 object-cover rounded-xs border border-neutral-200 dark:border-neutral-700"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}

                        {/* Text content */}
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <h3 className="font-semibold text-body-1 text-neutral-900 dark:text-neutral-100 mb-1 line-clamp-2">
                            {decodeHTML(report.title)}
                          </h3>

                          {/* Province only */}
                          <div className="flex items-center text-body-2 text-neutral-700 dark:text-neutral-200">
                            <span className="flex items-center gap-1">
                              <span>📍</span>
                              {report.province ? decodeHTML(report.province) : t('sidebar.unknown')}
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
          onMobilePinSelect={setMobilePopupReport}
          selectedMobileReport={mobilePopupReport}
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
        excludeReportIds={useMemo(() => {
          // Calculate carousel IDs for deduplication
          return reports
            .filter(r => {
              if (!r.media || r.media.length === 0) return false
              const decodedTitle = decodeHTML(r.title)
              if (decodedTitle.length < 10) return false
              const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
              if (!vietnameseChars.test(decodedTitle)) return false
              const textToCheck = `${decodedTitle} ${r.description ? decodeHTML(r.description) : ''}`.toLowerCase()
              const trafficKeywords = ['container', 'va chạm', 'va cham', 'tai nạn', 'tai nan', 'giao thông', 'giao thong', 'xe tải', 'xe tai', 'ô tô', 'o to']
              if (trafficKeywords.some(kw => textToCheck.includes(kw))) return false
              const govDocKeywords = ['văn bản', 'van ban', 'công văn', 'cong van', 'thông tư', 'thong tu']
              if (govDocKeywords.some(kw => textToCheck.includes(kw))) return false
              if (r.type === 'ALERT' || r.type === 'SOS') return r.trust_score >= 0.2
              if (r.type === 'RAIN') return r.trust_score >= 0.25
              if (r.type === 'ROAD') return r.trust_score >= 0.3
              return false
            })
            .slice(0, 30)
            .map(r => r.id)
        }, [reports])}
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

      {/* Disaster Legend - Controlled from header button */}
      <DisasterLegend
        isOpen={isLegendOpen}
        onClose={() => setIsLegendOpen(false)}
        lastUpdated={reports.length > 0 ? new Date(reports[0].created_at) : undefined}
      />

      {/* Windy Weather Modal */}
      <WindyModal
        isOpen={windyModalOpen}
        onClose={() => {
          setWindyModalOpen(false)
          setWindyStormView(false)  // Reset storm view on close
        }}
        initialLat={viewportForWindy.lat}
        initialLon={viewportForWindy.lon}
        initialZoom={viewportForWindy.zoom}
        stormView={windyStormView}
      />

      {/* Storm Summary Modal */}
      <StormSummaryModal
        data={stormData}
        isOpen={isStormModalOpen}
        onClose={() => setIsStormModalOpen(false)}
        onStormPathClick={() => {
          setWindyStormView(true)
          setWindyModalOpen(true)
          setIsStormModalOpen(false)
        }}
        onReportClick={(reportId) => {
          const report = reports.find(r => r.id === reportId)
          if (report) {
            setSelectedReport(report)
            setIsModalOpen(true)
            setIsStormModalOpen(false)
          }
        }}
      />
      </div>
      </LocationProvider>
      </AudioPlayerProvider>
    </ErrorBoundary>
  )
}
