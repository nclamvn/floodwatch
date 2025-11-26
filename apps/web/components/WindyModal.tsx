'use client'

import { useState, useRef, useEffect } from 'react'
import { Wind, X, Info, Search, MapPin, Loader2 } from 'lucide-react'

interface WindyModalProps {
  isOpen: boolean
  onClose: () => void
  initialLat?: number
  initialLon?: number
  initialZoom?: number
  stormView?: boolean  // New prop for storm path view (zoomed out)
}

interface SearchResult {
  name: string
  lat: number
  lon: number
  country?: string
}

// ============================================
// LOCATION SEARCH CACHE (TTL: 30 minutes)
// ============================================
interface CacheEntry {
  results: SearchResult[]
  timestamp: number
}

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const locationSearchCache = new Map<string, CacheEntry>()

function getCachedResults(query: string): SearchResult[] | null {
  const normalizedQuery = query.toLowerCase().trim()
  const entry = locationSearchCache.get(normalizedQuery)

  if (!entry) return null

  // Check if cache is still valid
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    locationSearchCache.delete(normalizedQuery)
    return null
  }

  return entry.results
}

function setCachedResults(query: string, results: SearchResult[]): void {
  const normalizedQuery = query.toLowerCase().trim()
  locationSearchCache.set(normalizedQuery, {
    results,
    timestamp: Date.now()
  })

  // Cleanup old entries periodically (keep cache size manageable)
  if (locationSearchCache.size > 100) {
    const now = Date.now()
    const entries = Array.from(locationSearchCache.entries())
    entries.forEach(([key, value]) => {
      if (now - value.timestamp > CACHE_TTL_MS) {
        locationSearchCache.delete(key)
      }
    })
  }
}

// Vietnam cities for quick search suggestions
const VIETNAM_CITIES = [
  { name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  { name: 'Huế', lat: 16.4637, lon: 107.5909 },
  { name: 'Nha Trang', lat: 12.2388, lon: 109.1967 },
  { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469 },
  { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881 },
  { name: 'Quy Nhơn', lat: 13.7829, lon: 109.2196 },
  { name: 'Đà Lạt', lat: 11.9404, lon: 108.4583 },
  { name: 'Vũng Tàu', lat: 10.4114, lon: 107.1362 },
  { name: 'Phú Quốc', lat: 10.2899, lon: 103.9840 },
  { name: 'Quảng Ngãi', lat: 15.1214, lon: 108.8044 },
  { name: 'Pleiku', lat: 13.9833, lon: 108.0000 },
  { name: 'Buôn Ma Thuột', lat: 12.6667, lon: 108.0500 },
  { name: 'Vinh', lat: 18.6796, lon: 105.6813 },
]

export function WindyModal({
  isOpen,
  onClose,
  initialLat = 16.5,
  initialLon = 107.5,
  initialZoom = 7,
  stormView = false
}: WindyModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [currentLocation, setCurrentLocation] = useState({ lat: initialLat, lon: initialLon })
  const [locationName, setLocationName] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search for location using Nominatim API (with cache)
  const searchLocation = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    // Check cache first
    const cachedResults = getCachedResults(query)
    if (cachedResults) {
      console.log('[WindySearch] Cache hit for:', query)
      setSearchResults(cachedResults)
      setShowResults(true)
      return
    }

    // First, filter Vietnam cities locally
    const localResults = VIETNAM_CITIES.filter(city =>
      city.name.toLowerCase().includes(query.toLowerCase())
    ).map(city => ({ ...city, country: 'Việt Nam' }))

    if (localResults.length > 0) {
      const results = localResults.slice(0, 5)
      setSearchResults(results)
      setShowResults(true)
      // Cache local results too
      setCachedResults(query, results)
      return
    }

    // If no local results, search via Nominatim API
    setIsSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=vn`,
        { headers: { 'Accept-Language': 'vi' } }
      )
      const data = await response.json()

      const results: SearchResult[] = data.map((item: any) => ({
        name: item.display_name.split(',')[0],
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        country: 'Việt Nam'
      }))

      setSearchResults(results)
      setShowResults(true)

      // Cache API results
      if (results.length > 0) {
        setCachedResults(query, results)
        console.log('[WindySearch] Cached results for:', query)
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(value)
    }, 300)
  }

  // Select a location from results
  const selectLocation = (result: SearchResult) => {
    setCurrentLocation({ lat: result.lat, lon: result.lon })
    setLocationName(result.name)
    setSearchQuery(result.name)
    setShowResults(false)
  }

  if (!isOpen) return null

  // For storm view, zoom out to see Pacific/South China Sea and show wind/pressure overlay
  // Position centered on South China Sea to show storm path approaching Vietnam
  const lat = stormView ? 15.5 : currentLocation.lat  // Use currentLocation for search
  const lon = stormView ? 115.0 : currentLocation.lon  // Use currentLocation for search
  const zoom = stormView ? 5 : (locationName ? 9 : initialZoom)  // Zoom in more when searching specific location
  const overlay = stormView ? 'wind' : 'wind'  // Wind overlay shows storm rotation clearly

  // Windy embed URL with parameters
  // For storm view: add pressure lines, use GFS model for better storm tracking
  const windyUrl = stormView
    ? `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=650&height=450&zoom=${zoom}&level=surface&overlay=wind&product=gfs&menu=&message=true&marker=&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`
    : `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=650&height=450&zoom=${zoom}&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl mx-4 h-[80vh] bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/30 dark:border-neutral-700/30 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 border-b border-slate-200/50 dark:border-gray-700 ${
          stormView
            ? 'bg-gradient-to-r from-yellow-100/80 to-orange-100/80 dark:from-yellow-950 dark:to-orange-950'
            : 'bg-gradient-to-r from-emerald-100/80 to-neutral-100/80 dark:from-emerald-950 dark:to-neutral-950'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              stormView ? 'bg-yellow-500' : 'bg-emerald-600'
            }`}>
              <Wind className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-50">
                {stormView ? 'Đường đi Bão số 15 (Koto)' : 'Dự báo thời tiết Windy'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stormView
                  ? 'Bản đồ gió và áp suất - Biển Đông'
                  : locationName
                    ? `Thời tiết tại ${locationName}`
                    : 'Bản đồ thời tiết tương tác - Miền Trung Việt Nam'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Box - Only show when not in storm view */}
            {!stormView && (
              <div ref={searchRef} className="relative">
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => searchQuery && setShowResults(true)}
                      placeholder="Tìm địa điểm..."
                      className="w-48 sm:w-64 pl-9 pr-3 py-2 text-sm rounded-full bg-white/90 dark:bg-gray-800/90 border border-gray-300/50 dark:border-gray-600/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => selectLocation(result)}
                        className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {result.name}
                          </div>
                          {result.country && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {result.country}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white/95 dark:bg-gray-800/80 dark:hover:bg-gray-700 border border-white/30 dark:border-white/10 text-gray-900 dark:text-gray-300 hover:text-black dark:hover:text-white transition-all flex items-center justify-center shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 flex-shrink-0"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Windy Iframe */}
        <div className="relative w-full h-[calc(100%-120px)] sm:h-[calc(100%-80px)]">
          <iframe
            src={windyUrl}
            className="w-full h-full border-none"
            title="Windy Weather Map"
            loading="lazy"
          />

          {/* Info Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-white text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>
                Dữ liệu từ <strong>Windy.com</strong> - Click vào bản đồ để xem chi tiết, chọn layer từ menu bên phải
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
