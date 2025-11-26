'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import Map, { NavigationControl, MapRef } from 'react-map-gl/maplibre'
import { RotateCcw, Filter, MapPin, MapPinned, Loader2 } from 'lucide-react'
import RescueIntelligenceLayer from '@/components/RescueIntelligenceLayer'
import PinPopover from '@/components/PinPopover'
import RescueDetailSheet from '@/components/RescueDetailSheet'
import RescueFilterPanel from '@/components/RescueFilterPanel'
import UserLocationMarker from '@/components/UserLocationMarker'
import { useHelpRequests, HelpRequest } from '@/hooks/useHelpRequests'
import { useHelpOffers, HelpOffer } from '@/hooks/useHelpOffers'
import { useRescueFilters } from '@/hooks/useRescueFilters'
import { useLocation } from '@/contexts/LocationContext'
import { getMapConfig, getStyleUrlWithToken } from '@/lib/mapProvider'

/**
 * RescueMap Component
 *
 * Full-screen map displaying rescue intelligence:
 * - 🔵 Blue pins for help requests (people needing rescue)
 * - 🟢 Green pins for help offers (volunteers/rescuers)
 *
 * Features:
 * - Layer toggles for requests and offers
 * - Navigation controls (zoom, rotate)
 * - Geolocation button
 * - Glass morphism UI matching Design System 2025
 */
export default function RescueMap() {
  // Use LocationContext instead of local state
  const { userLocation: locationData, isLocating, requestLocation } = useLocation()

  // Convert LocationContext format to the format needed by API hooks
  const userLocation = locationData ? { lat: locationData.latitude, lon: locationData.longitude } : null

  // Get map configuration (supports Goong Maps and MapTiler)
  const mapConfig = getMapConfig()
  const mapStyleUrl = getStyleUrlWithToken()

  const [viewState, setViewState] = useState({
    latitude: 16.0544, // Central Vietnam (Da Nang)
    longitude: 108.2022,
    zoom: 8,
  })

  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | undefined>(undefined)

  // Smart zoom state management (Phase 1)
  const mapRef = useRef<MapRef>(null)
  const [lastViewState, setLastViewState] = useState<any | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [selectedPinType, setSelectedPinType] = useState<'request' | 'offer' | null>(null)
  const [hasInitializedView, setHasInitializedView] = useState(false)

  // Popover state (Phase 3.1)
  const [popoverData, setPopoverData] = useState<HelpRequest | HelpOffer | null>(null)
  const [popoverType, setPopoverType] = useState<'request' | 'offer' | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null)

  // Detail sheet state (Phase 3.2)
  const [detailSheetData, setDetailSheetData] = useState<HelpRequest | HelpOffer | null>(null)
  const [detailSheetType, setDetailSheetType] = useState<'request' | 'offer' | null>(null)

  // Filter state (Phase 5)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const {
    filters,
    updateFilter,
    toggleArrayValue,
    setArrayValues,
    resetFilters,
    activeFiltersCount,
    getApiFilters,
  } = useRescueFilters()

  // Location filter state - track whether to filter by user location
  const [useLocationFilter, setUseLocationFilter] = useState(false)

  // Fetch help requests and offers with filters (Phase 5)
  // Only pass location params when location filter is active
  const { requests: allRequests } = useHelpRequests({
    enabled: filters.showRequests,
    lat: useLocationFilter ? userLocation?.lat : undefined,
    lon: useLocationFilter ? userLocation?.lon : undefined,
    radius_km: useLocationFilter ? filters.radiusKm : undefined,
    status: getApiFilters.requestStatus || 'active,in_progress',
    needs_type: getApiFilters.requestNeedsType,
    urgency: getApiFilters.requestUrgency,
    verified_only: filters.verifiedOnly,
  })

  const { offers: allOffers } = useHelpOffers({
    enabled: filters.showOffers,
    lat: useLocationFilter ? userLocation?.lat : undefined,
    lon: useLocationFilter ? userLocation?.lon : undefined,
    radius_km: useLocationFilter ? filters.radiusKm : undefined,
    status: getApiFilters.offerStatus || 'active',
    service_type: getApiFilters.offerServiceType,
    min_capacity: filters.minCapacity || undefined,
    verified_only: filters.verifiedOnly,
  })

  // Client-side search filtering (Phase 5)
  const requests = useMemo(() => {
    if (!filters.searchQuery.trim()) return allRequests

    const query = filters.searchQuery.toLowerCase()
    return allRequests.filter(request =>
      request.contact_name.toLowerCase().includes(query) ||
      request.contact_phone.includes(query) ||
      request.description.toLowerCase().includes(query) ||
      request.address?.toLowerCase().includes(query)
    )
  }, [allRequests, filters.searchQuery])

  const offers = useMemo(() => {
    if (!filters.searchQuery.trim()) return allOffers

    const query = filters.searchQuery.toLowerCase()
    return allOffers.filter(offer =>
      offer.contact_name.toLowerCase().includes(query) ||
      offer.contact_phone.includes(query) ||
      offer.description.toLowerCase().includes(query) ||
      offer.address?.toLowerCase().includes(query) ||
      offer.organization?.toLowerCase().includes(query)
    )
  }, [allOffers, filters.searchQuery])

  // Update bounds when map moves (for clustering)
  const handleMove = useCallback((evt: any) => {
    setViewState(evt.viewState)

    const map = mapRef.current?.getMap()
    if (map) {
      const bounds = map.getBounds()
      setMapBounds([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ])
    }
  }, [])

  // Handle location button click - request location and pan to it
  const handleLocationClick = useCallback(() => {
    if (locationData) {
      // Pan map to existing location and enable location filtering
      mapRef.current?.flyTo({
        center: [locationData.longitude, locationData.latitude],
        zoom: 11,
        duration: 1000
      })
      setUseLocationFilter(true)
    } else {
      // Request new location
      requestLocation()
    }
  }, [locationData, isLocating, requestLocation])

  // Auto-pan to user location when acquired and enable location filtering
  useEffect(() => {
    if (locationData) {
      mapRef.current?.flyTo({
        center: [locationData.longitude, locationData.latitude],
        zoom: 11,
        duration: 1000
      })
      setUseLocationFilter(true)
    }
  }, [locationData?.timestamp])

  // Auto-adjust initial view to center on data when first loaded
  useEffect(() => {
    // Only run once when data first loads
    if (hasInitializedView) return
    if (!mapRef.current) return

    // Wait for both requests and offers to load
    const allPoints = [...requests, ...offers]
    if (allPoints.length === 0) return

    // Calculate bounding box of all points
    const lons = allPoints.map(p => p.lon)
    const lats = allPoints.map(p => p.lat)

    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)

    // Fit map to show all points with padding
    const map = mapRef.current.getMap()
    if (map) {
      map.fitBounds(
        [[minLon, minLat], [maxLon, maxLat]],
        {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 1500,
          maxZoom: 10 // Don't zoom in too close
        }
      )
      setHasInitializedView(true)
    }
  }, [requests, offers, hasInitializedView])

  // Smart zoom + popover: Toggle zoom on pin click (Phase 1 + 3.1 + 4)
  const handleMapClick = useCallback((event: any) => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Check for cluster clicks first (Phase 4)
    const clusterFeatures = map.queryRenderedFeatures(event.point, {
      layers: ['help-requests-clusters', 'help-offers-clusters']
    })

    if (clusterFeatures.length > 0) {
      // Clicked on a cluster - zoom in to expand
      const feature = clusterFeatures[0]
      const coordinates = (feature.geometry as any).coordinates
      map.flyTo({
        center: coordinates,
        zoom: Math.min(viewState.zoom + 3, 16),
        duration: 800
      })
      return
    }

    // Check for individual pin clicks
    const features = map.queryRenderedFeatures(event.point, {
      layers: ['help-requests-main', 'help-offers-main']
    })

    if (features.length > 0) {
      const feature = features[0]
      const pinId = feature.properties?.id
      const pinType = feature.layer.id.includes('request') ? 'request' : 'offer'

      // Find the actual data for the popover
      const pinData = pinType === 'request'
        ? requests.find(r => r.id === pinId)
        : offers.find(o => o.id === pinId)

      // If clicking the same pin, restore previous view and close popover
      if (selectedPinId === pinId) {
        if (lastViewState) {
          map.flyTo({
            center: [lastViewState.longitude, lastViewState.latitude],
            zoom: lastViewState.zoom,
            duration: 800
          })
        }
        setSelectedPinId(null)
        setSelectedPinType(null)
        setLastViewState(null)
        setPopoverData(null)
        setPopoverType(null)
        setPopoverPosition(null)
      } else {
        // Save current view and zoom to pin
        const currentView = {
          latitude: viewState.latitude,
          longitude: viewState.longitude,
          zoom: viewState.zoom
        }
        setLastViewState(currentView)
        setSelectedPinId(pinId)
        setSelectedPinType(pinType)

        // Show popover with data
        if (pinData) {
          setPopoverData(pinData)
          setPopoverType(pinType)
        }

        // Zoom to pin
        const coords = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates
        map.flyTo({
          center: coords,
          zoom: 15,
          duration: 800
        })

        // Update popover position after zoom animation completes
        setTimeout(() => {
          if (pinData) {
            const point = map.project(coords)
            const mapContainer = map.getContainer().getBoundingClientRect()
            setPopoverPosition({
              x: mapContainer.left + point.x,
              y: mapContainer.top + point.y
            })
          }
        }, 850) // Slightly after animation duration
      }
    } else {
      // Clicked on empty map - close popover only
      setPopoverData(null)
      setPopoverType(null)
      setPopoverPosition(null)
    }
  }, [viewState, selectedPinId, lastViewState, requests, offers])

  // Reset view to overview (Phase 1)
  const handleResetView = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Calculate bounding box of all points to show everything
    const allPoints = [...requests, ...offers]

    if (allPoints.length > 0) {
      const lons = allPoints.map(p => p.lon)
      const lats = allPoints.map(p => p.lat)

      const minLon = Math.min(...lons)
      const maxLon = Math.max(...lons)
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)

      // Fit map to show all points
      map.fitBounds(
        [[minLon, minLat], [maxLon, maxLat]],
        {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 1000,
          maxZoom: 10
        }
      )
    } else {
      // Fallback to default Vietnam center if no data
      map.flyTo({
        center: [108.2022, 16.0544],
        zoom: 8,
        duration: 1000
      })
    }

    setSelectedPinId(null)
    setSelectedPinType(null)
    setLastViewState(null)
    setPopoverData(null)
    setPopoverType(null)
    setPopoverPosition(null)
    // Disable location filtering to show all pins again
    setUseLocationFilter(false)
  }, [requests, offers])

  // Popover handlers (Phase 3.1)
  const handleClosePopover = useCallback(() => {
    setPopoverData(null)
    setPopoverType(null)
    setPopoverPosition(null)
  }, [])

  const handleViewDetails = useCallback(() => {
    // Phase 3.2 - Open detail sheet with full info
    if (popoverData && popoverType) {
      setDetailSheetData(popoverData)
      setDetailSheetType(popoverType)
      handleClosePopover()
    }
  }, [popoverData, popoverType, handleClosePopover])

  // Detail sheet handlers (Phase 3.2)
  const handleCloseDetailSheet = useCallback(() => {
    setDetailSheetData(null)
    setDetailSheetType(null)
  }, [])

  return (
    <div className="relative w-full h-full">
      {/* Hide MapLibre logo and attribution */}
      <style jsx global>{`
        .maplibregl-ctrl-logo,
        .maplibregl-ctrl-attrib {
          display: none !important;
        }
        /* Cursor pointer on interactive pins (Phase 2) */
        .maplibregl-canvas-container.maplibregl-interactive {
          cursor: default;
        }
        .maplibregl-canvas-container.maplibregl-interactive:active {
          cursor: grabbing;
        }
      `}</style>

      {/* Map Container */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onClick={handleMapClick}
        mapStyle={mapStyleUrl}
        style={{ width: '100%', height: '100%' }}
        maxZoom={18}
        minZoom={6}
        interactiveLayerIds={['help-requests-main', 'help-offers-main', 'help-requests-clusters', 'help-offers-clusters']}
      >
        {/* Rescue Intelligence Layer */}
        <RescueIntelligenceLayer
          lat={useLocationFilter ? userLocation?.lat : undefined}
          lon={useLocationFilter ? userLocation?.lon : undefined}
          radius_km={useLocationFilter ? filters.radiusKm : undefined}
          showRequests={filters.showRequests}
          showOffers={filters.showOffers}
          selectedPinId={selectedPinId}
          selectedPinType={selectedPinType}
          zoom={viewState.zoom}
          bounds={mapBounds}
        />

        {/* Navigation Controls */}
        <NavigationControl position="top-right" />

        {/* User Location Marker */}
        <UserLocationMarker />
      </Map>

      {/* Action Buttons - Top Left */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {/* Reset View Button */}
        <button
          onClick={handleResetView}
          className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl rounded-full shadow-xl px-3 py-2 flex items-center gap-2 hover:scale-105 transition-transform duration-200"
          title="Quay lại tổng quan"
        >
          <RotateCcw className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Đặt lại
          </span>
        </button>

        {/* My Location Button */}
        <button
          onClick={handleLocationClick}
          disabled={isLocating}
          className={`bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl rounded-full shadow-xl px-3 py-2 flex items-center gap-2 transition-transform duration-200 ${
            isLocating ? 'cursor-wait opacity-70' : 'hover:scale-105'
          }`}
          title="Vị trí của tôi"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 text-neutral-700 dark:text-neutral-300 animate-spin" />
          ) : locationData ? (
            <MapPinned className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <MapPin className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          )}
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Vị trí
          </span>
        </button>

        {/* Filter Button (Phase 5) */}
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl rounded-full shadow-xl px-3 py-2 flex items-center gap-2 hover:scale-105 transition-transform duration-200 relative"
          title="Bộ lọc"
        >
          <Filter className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Lọc
          </span>
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Breathing Stats Pills - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
        {/* Request Pill - Red Breathing */}
        <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl rounded-full shadow-xl px-3 py-1.5 flex items-center gap-2">
          <div className="relative">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping opacity-75" />
          </div>
          <span className="text-lg font-bold text-red-600 dark:text-red-500 tabular-nums">
            {requests.length}
          </span>
        </div>

        {/* Offer Pill - Green Breathing */}
        <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl rounded-full shadow-xl px-3 py-1.5 flex items-center gap-2">
          <div className="relative">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-green-500 animate-ping opacity-75" />
          </div>
          <span className="text-lg font-bold text-green-600 dark:text-green-500 tabular-nums">
            {offers.length}
          </span>
        </div>
      </div>

      {/* Pin Popover (Phase 3.1) */}
      {popoverData && popoverType && popoverPosition && (
        <PinPopover
          data={popoverData}
          type={popoverType}
          position={popoverPosition}
          onClose={handleClosePopover}
          onViewDetails={handleViewDetails}
        />
      )}

      {/* Detail Sheet (Phase 3.2) */}
      {detailSheetData && detailSheetType && (
        <RescueDetailSheet
          data={detailSheetData}
          type={detailSheetType}
          onClose={handleCloseDetailSheet}
        />
      )}

      {/* Filter Panel (Phase 5) */}
      {showFilterPanel && (
        <RescueFilterPanel
          filters={filters}
          onUpdateFilter={updateFilter}
          onToggleArrayValue={toggleArrayValue}
          onSetArrayValues={setArrayValues}
          onReset={resetFilters}
          onClose={() => setShowFilterPanel(false)}
          requestsCount={requests.length}
          offersCount={offers.length}
        />
      )}
    </div>
  )
}
