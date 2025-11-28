'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react'
import Map, { Marker, Popup, NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import Supercluster from 'supercluster'
import { getMapConfig, getStyleUrlWithToken, getCurrentProvider, type BaseMapStyleId } from '@/lib/mapProvider'
import { useLocation } from '@/contexts/LocationContext'
import UserLocationMarker from './UserLocationMarker'
import OptimizedHazardLayer from './OptimizedHazardLayer'
import DistressLayer from './DistressLayer'
import TrafficLayer from './TrafficLayer'
import LayerControlPanel, { LayerVisibility } from './LayerControlPanel'
import { MapControlsGroup } from './MapControlsGroup'
import { MobileMapControls } from './MobileMapControls'
import { WindyModal } from './WindyModal'
// MobilePinPopup is now rendered in page.tsx for proper z-index stacking
import { useHazards } from '@/hooks/useHazards'

interface Report {
  id: string
  type: string
  source: string
  title: string
  description?: string
  province?: string
  lat?: number
  lon?: number
  trust_score: number
  status: string
  created_at: string
  media?: string[]
}

interface MapViewProps {
  reports: Report[]
  radiusFilter?: { lat: number; lng: number; radius: number } | null
  targetViewport?: { latitude: number; longitude: number; zoom: number } | null
  onViewportChange?: () => void
  onMapClick?: (lat: number, lng: number) => void
  onClearRadius?: () => void
  onExpandArticle?: (report: Report) => void
  onLegendClick?: () => void
  legendActive?: boolean
  // New: Callback for mobile pin popup - lifted to page.tsx level for proper z-index
  onMobilePinSelect?: (report: Report | null) => void
  selectedMobileReport?: Report | null
}

// Helper function to truncate description for popup preview
function truncateDescription(text: string, maxLength: number = 150): string {
  if (!text || text.length <= maxLength) return text

  // Try to cut at sentence end
  const truncated = text.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastComma = truncated.lastIndexOf(',')
  const lastSpace = truncated.lastIndexOf(' ')

  // Prefer cutting at sentence end, then comma, then space
  const cutPoint = lastPeriod > maxLength * 0.7 ? lastPeriod + 1 :
                   lastComma > maxLength * 0.8 ? lastComma + 1 :
                   lastSpace > 0 ? lastSpace : maxLength

  return text.substring(0, cutPoint).trim() + '...'
}

// Memoized Cluster Marker Component - prevents re-render when other parts of map change
interface ClusterMarkerProps {
  id: number
  longitude: number
  latitude: number
  pointCount: number
  level: string
  style: { size: number; bg: string; border: string; shadow: string }
  onClusterClick: (clusterId: number, longitude: number, latitude: number) => void
}

const ClusterMarker = memo(function ClusterMarker({
  id, longitude, latitude, pointCount, level, style, onClusterClick
}: ClusterMarkerProps) {
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
    >
      <div
        className="flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
        style={{
          width: `${style.size}px`,
          height: `${style.size}px`,
          borderRadius: '50%',
          backgroundColor: style.bg,
          color: 'white',
          fontWeight: '700',
          fontSize: pointCount > 99 ? '12px' : '14px',
          border: `3px solid ${style.border}`,
          boxShadow: style.shadow,
        }}
        onClick={() => onClusterClick(id, longitude, latitude)}
        title={`${pointCount} báo cáo (${level}) - Click để tách ra`}
      >
        {pointCount}
      </div>
    </Marker>
  )
})

// Memoized Individual Pin Marker Component
interface PinMarkerProps {
  report: Report
  longitude: number
  latitude: number
  color: string
  emoji: string
  isSelected: boolean
  onPinClick: (report: Report, hasPopup: boolean) => void
}

const PinMarker = memo(function PinMarker({
  report, longitude, latitude, color, emoji, isSelected, onPinClick
}: PinMarkerProps) {
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation()
        onPinClick(report, isSelected)
      }}
    >
      <div
        className="cursor-pointer transform hover:scale-125 transition-all duration-200"
        style={{
          position: 'relative',
          filter: `drop-shadow(0 3px 6px ${color}66)`
        }}
      >
        {/* Colored background circle with breathing animation */}
        <div
          className="marker-glow"
          style={{
            position: 'absolute',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: color,
            top: '-10px',
            left: '-10px'
          }}
        />
        {/* Emoji */}
        <div
          style={{
            fontSize: '24px',
            position: 'relative',
            zIndex: 1
          }}
        >
          {emoji}
        </div>
      </div>
    </Marker>
  )
})

export default function MapViewClustered({ reports, radiusFilter, targetViewport, onViewportChange, onMapClick, onClearRadius, onExpandArticle, onLegendClick, legendActive, onMobilePinSelect, selectedMobileReport }: MapViewProps) {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [viewState, setViewState] = useState({
    longitude: 106.0,  // Toàn Việt Nam
    latitude: 16.0,
    zoom: 5.5
  })
  // Use ref for previousViewState to avoid unnecessary re-renders
  const previousViewStateRef = useRef<{
    longitude: number
    latitude: number
    zoom: number
  } | null>(null)
  const [baseMapStyle, setBaseMapStyle] = useState<BaseMapStyleId>('streets')
  const [windyModalOpen, setWindyModalOpen] = useState(false)
  const [layerControlOpen, setLayerControlOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  // Detect desktop/mobile for zoom controls (debounced)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    const checkDesktop = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setIsDesktop(window.innerWidth >= 640)
      }, 150) // Debounce 150ms
    }
    // Initial check without debounce
    setIsDesktop(window.innerWidth >= 640)
    window.addEventListener('resize', checkDesktop)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', checkDesktop)
    }
  }, [])

  // Layer visibility state - all enabled by default
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    reports: true,
    heavyRain: true,
    flood: true,
    landslide: true,
    damRelease: true,
    storm: true,
    tideSurge: true,
    traffic: true,
    distress: true,
  })

  const [lastDataUpdate, setLastDataUpdate] = useState(new Date())

  // Get map configuration from abstraction layer
  const mapConfig = getMapConfig(baseMapStyle)
  const mapStyleUrl = getStyleUrlWithToken(baseMapStyle)
  const currentProvider = getCurrentProvider()

  // Debug map initialization (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🗺️ Map Config:', {
        styleUrl: mapStyleUrl,
        provider: currentProvider,
        baseMapStyle,
        hasToken: !!mapConfig.accessToken
      })
    }
  }, [mapStyleUrl, currentProvider, baseMapStyle, mapConfig])

  // Handle viewport changes from parent (when province is selected)
  useEffect(() => {
    if (targetViewport) {
      setViewState({
        longitude: targetViewport.longitude,
        latitude: targetViewport.latitude,
        zoom: targetViewport.zoom
      })
      // Notify parent that viewport has been changed
      if (onViewportChange) {
        onViewportChange()
      }
    }
  }, [targetViewport, onViewportChange])

  // Get user location from context
  const { userLocation } = useLocation()

  // Default location (Vietnam center) for initial data fetch
  // This allows hazards/forecasts to load immediately without waiting for GPS
  const DEFAULT_LOCATION = { latitude: 16.0, longitude: 106.0 }
  const effectiveLocation = userLocation || DEFAULT_LOCATION

  // Fetch hazards using effective location (default or GPS)
  const { hazards: allHazards, isLoading: hazardsLoading } = useHazards({
    lat: effectiveLocation.latitude,
    lng: effectiveLocation.longitude,
    radius_km: 100, // Larger radius for default center
    active_only: true,
    refreshInterval: 60000, // Refresh every minute
  })

  // Filter hazards based on layer visibility
  const hazards = useMemo(() => {
    return allHazards.filter(h => {
      if (h.type === 'heavy_rain') return layerVisibility.heavyRain
      if (h.type === 'flood') return layerVisibility.flood
      if (h.type === 'landslide') return layerVisibility.landslide
      if (h.type === 'dam_release') return layerVisibility.damRelease
      if (h.type === 'storm') return layerVisibility.storm
      if (h.type === 'tide_surge') return layerVisibility.tideSurge
      return true
    })
  }, [allHazards, layerVisibility])

  // Update last data update timestamp when hazards change
  useEffect(() => {
    if (allHazards.length > 0) {
      setLastDataUpdate(new Date())
    }
  }, [allHazards])

  // Auto-zoom to user location when it's first set
  useEffect(() => {
    if (userLocation) {
      setViewState(prev => ({
        longitude: userLocation.longitude,
        latitude: userLocation.latitude,
        zoom: 12, // Zoom in when showing user location
      }))
    }
  }, [userLocation?.timestamp]) // Only trigger when location timestamp changes

  // Handle location button click - fly to user location
  const handleLocationClick = useCallback((lat: number, lon: number) => {
    setViewState({
      latitude: lat,
      longitude: lon,
      zoom: 12,
    })
  }, [])

  // Supercluster instance - only recreate when reports change
  const supercluster = useMemo(() => {
    const cluster = new Supercluster({
      radius: 60,
      maxZoom: 16
    })

    const points = reports
      .filter(r => r.lat && r.lon)
      .map(report => ({
        type: 'Feature' as const,
        properties: { report },
        geometry: {
          type: 'Point' as const,
          coordinates: [report.lon!, report.lat!]
        }
      }))

    cluster.load(points)
    return cluster
  }, [reports]) // Only depends on reports, not viewState

  // Clusters - update when viewport changes (but supercluster stays same)
  const clusters = useMemo(() => {
    const bounds = [
      viewState.longitude - 360 / Math.pow(2, viewState.zoom),
      viewState.latitude - 180 / Math.pow(2, viewState.zoom),
      viewState.longitude + 360 / Math.pow(2, viewState.zoom),
      viewState.latitude + 180 / Math.pow(2, viewState.zoom)
    ] as [number, number, number, number]

    return supercluster.getClusters(bounds, Math.floor(viewState.zoom))
  }, [supercluster, viewState.zoom, viewState.longitude, viewState.latitude])

  // Heatmap data for rainfall
  const heatmapData = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: reports
        .filter(r => r.type === 'RAIN' && r.lat && r.lon)
        .map(r => ({
          type: 'Feature' as const,
          properties: {
            intensity: r.trust_score
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [r.lon!, r.lat!]
          }
        }))
    }
  }, [reports])

  // OSM tiles don't need token, so skip this check

  // Pre-compute report urgency levels in O(n) - single pass through reports
  const reportUrgencyMap = useMemo(() => {
    const urgencyMap: Record<string, { isUrgent: boolean; isAlertSos: boolean; hasRain: boolean }> = {}

    for (const report of reports) {
      const isUrgent = (report.type === 'ALERT' || report.type === 'SOS') && report.trust_score >= 0.7
      const isAlertSos = report.type === 'ALERT' || report.type === 'SOS'
      const hasRain = report.type === 'RAIN' && report.trust_score >= 0.6

      urgencyMap[report.id] = { isUrgent, isAlertSos, hasRain }
    }

    return urgencyMap
  }, [reports])

  // Optimized cluster levels - O(n) instead of O(n²)
  // Uses pre-computed urgency map and limits getLeaves to max 20 samples
  const clusterLevels = useMemo(() => {
    const levels: Record<number, string> = {}

    for (const cluster of clusters) {
      if (!cluster.properties.cluster) continue

      const clusterId = cluster.id as number
      const pointCount = cluster.properties.point_count

      if (typeof clusterId !== 'number') continue

      try {
        // OPTIMIZATION: Only sample up to 20 leaves instead of all (Infinity)
        // This gives statistically similar results with O(1) per cluster
        const sampleSize = Math.min(20, pointCount)
        const leaves = supercluster.getLeaves(clusterId, sampleSize)

        let urgentCount = 0
        let alertSosCount = 0
        let hasRain = false

        for (const leaf of leaves) {
          const report = leaf.properties?.report
          if (!report) continue

          const urgency = reportUrgencyMap[report.id]
          if (urgency) {
            if (urgency.isUrgent) urgentCount++
            if (urgency.isAlertSos) alertSosCount++
            if (urgency.hasRain) hasRain = true
          }
        }

        // Scale counts based on sample ratio for clusters with many points
        const scaleFactor = pointCount / sampleSize
        const scaledUrgent = Math.round(urgentCount * scaleFactor)
        const scaledAlertSos = Math.round(alertSosCount * scaleFactor)

        if (scaledUrgent >= 3 || scaledAlertSos >= 5) {
          levels[clusterId] = 'critical'
        } else if (scaledUrgent >= 1 || scaledAlertSos >= 2) {
          levels[clusterId] = 'high'
        } else if (hasRain || pointCount >= 10) {
          levels[clusterId] = 'medium'
        } else {
          levels[clusterId] = 'low'
        }
      } catch {
        levels[clusterId] = pointCount >= 10 ? 'high' : pointCount >= 5 ? 'medium' : 'low'
      }
    }

    return levels
  }, [clusters, supercluster, reportUrgencyMap])

  const getClusterStyle = (level: string) => {
    const baseSize = 30
    const styles = {
      critical: {
        size: baseSize + 30,
        bg: '#DC2626',      // error-600
        border: '#991B1B',  // error-700
        shadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
      },
      high: {
        size: baseSize + 20,
        bg: '#EA580C',      // warning-600
        border: '#C2410C',  // warning-700
        shadow: '0 3px 10px rgba(234, 88, 12, 0.3)'
      },
      medium: {
        size: baseSize + 10,
        bg: '#FBBF24',      // amber-400 (YELLOW)
        border: '#F59E0B',  // amber-500 (darker yellow/orange)
        shadow: '0 2px 8px rgba(251, 191, 36, 0.25)'
      },
      low: {
        size: baseSize,
        bg: '#9CA3AF',      // gray-400 (neutral, not blue)
        border: '#6B7280',  // gray-500
        shadow: '0 2px 6px rgba(156, 163, 175, 0.2)'
      }
    }
    return styles[level as keyof typeof styles] || styles.low
  }

  // Get severity level based on trust_score and type
  const getSeverity = (report: Report): 'high' | 'medium' | 'low' => {
    // ALERT and SOS with high trust = high severity
    if ((report.type === 'ALERT' || report.type === 'SOS') && report.trust_score >= 0.7) {
      return 'high'
    }
    // Medium trust or ROAD events = medium severity
    if (report.trust_score >= 0.4 || report.type === 'ROAD') {
      return 'medium'
    }
    // Low trust = low severity
    return 'low'
  }

  // Get marker color based on severity
  const getMarkerColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return '#DC2626'    // Red - Nguy hiểm
      case 'medium': return '#F59E0B'  // Yellow/Orange - Cảnh báo
      case 'low': return '#10B981'     // Green - Bình thường
    }
  }

  const getMarkerEmoji = (type: string) => {
    switch (type) {
      case 'ALERT': return '⚠️'
      case 'SOS': return '🆘'
      case 'ROAD': return '🚧'
      case 'NEEDS': return '📦'
      default: return '📍'
    }
  }

  // Memoized callbacks to prevent re-renders
  const handleClusterClick = useCallback((clusterId: number, longitude: number, latitude: number) => {
    // Save current position before zooming (using ref, no re-render)
    previousViewStateRef.current = {
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom
    }

    // Zoom to expand cluster
    const expansionZoom = Math.min(
      supercluster.getClusterExpansionZoom(clusterId),
      20
    )

    setViewState({
      ...viewState,
      longitude,
      latitude,
      zoom: expansionZoom
    })
  }, [viewState, supercluster])

  const handlePinClick = useCallback((report: Report, isCurrentlySelected: boolean) => {
    if (isCurrentlySelected) {
      // Second click - restore previous view
      if (previousViewStateRef.current) {
        setViewState(previousViewStateRef.current)
        previousViewStateRef.current = null
      }
      setSelectedReport(null)
      // Also notify parent for mobile popup (lifted state)
      onMobilePinSelect?.(null)
    } else {
      // First click - show popup
      setSelectedReport(report)
      // Also notify parent for mobile popup (lifted state)
      onMobilePinSelect?.(report)
    }
  }, [onMobilePinSelect]) // Add dependency

  // Convert km radius to meters for the circle
  const radiusCircleData = radiusFilter ? {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Point' as const,
        coordinates: [radiusFilter.lng, radiusFilter.lat]
      }
    }]
  } : null

  return (
    <>
    <Map
      mapLib={maplibregl}
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      onClick={(evt) => {
        // Ctrl/Cmd + Click to set radius filter
        if (evt.originalEvent.ctrlKey || evt.originalEvent.metaKey) {
          onMapClick?.(evt.lngLat.lat, evt.lngLat.lng)
        }
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyleUrl}
      cursor={viewState.zoom > 8 ? 'crosshair' : 'grab'}
      attributionControl={false}
    >
      {/* Navigation controls - ONLY rendered on desktop, not mobile */}
      {isDesktop && <NavigationControl position="bottom-right" showCompass={false} />}
      <ScaleControl position="bottom-left" />

      {/* User location tracking */}
      <UserLocationMarker />

      {/* Map controls group - Desktop only - includes map styles, location, windy, and legend buttons */}
      <div className="hidden sm:block">
        <MapControlsGroup
          baseMapStyle={baseMapStyle}
          onStyleChange={setBaseMapStyle}
          onWindyClick={() => setWindyModalOpen(true)}
          onLegendClick={() => onLegendClick?.()}
          legendActive={legendActive}
          onLocationClick={handleLocationClick}
        />
      </div>

      {/* Mobile Map Controls - Left side vertical layout */}
      <MobileMapControls
        baseMapStyle={baseMapStyle}
        onStyleChange={setBaseMapStyle}
        onLegendClick={() => onLegendClick?.()}
        legendActive={legendActive}
        onLocationClick={handleLocationClick}
      />

      {/* Hazard events visualization - Optimized Symbol Layer */}
      <OptimizedHazardLayer
        hazards={hazards}
        visible={layerVisibility.heavyRain || layerVisibility.flood || layerVisibility.landslide || layerVisibility.damRelease || layerVisibility.storm || layerVisibility.tideSurge}
      />

      {/* Emergency distress reports */}
      <DistressLayer
        lat={userLocation?.latitude}
        lon={userLocation?.longitude}
        radius_km={50}
        visible={layerVisibility.distress}
      />

      {/* Traffic disruptions */}
      <TrafficLayer
        lat={userLocation?.latitude}
        lon={userLocation?.longitude}
        radius_km={50}
        visible={layerVisibility.traffic}
      />

      {/* Heatmap layer for RAIN */}
      {heatmapData.features.length > 0 && (
        <Source id="rainfall" type="geojson" data={heatmapData}>
          <Layer
            id="rainfall-heat"
            type="heatmap"
            paint={{
              'heatmap-weight': ['get', 'intensity'],
              'heatmap-intensity': 1,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(33,102,172,0)',
                0.2, 'rgb(103,169,207)',
                0.4, 'rgb(209,229,240)',
                0.6, 'rgb(253,219,199)',
                0.8, 'rgb(239,138,98)',
                1, 'rgb(178,24,43)'
              ],
              'heatmap-radius': 20,
              'heatmap-opacity': 0.6
            }}
          />
        </Source>
      )}

      {/* Radius filter circle */}
      {radiusCircleData && radiusFilter && (
        <Source id="radius-circle" type="geojson" data={radiusCircleData}>
          <Layer
            id="radius-circle-fill"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0, 0,
                20, radiusFilter.radius * 1000 / 0.075 // Convert km to pixels approximately
              ],
              'circle-color': '#3B82F6',
              'circle-opacity': 0.1,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#2563EB',
              'circle-stroke-opacity': 0.8
            }}
          />
        </Source>
      )}

      {/* Radius filter info badge */}
      {radiusFilter && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '16px',
            background: 'rgba(37, 99, 235, 0.95)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span>📍 Bán kính {radiusFilter.radius}km</span>
          <button
            onClick={onClearRadius}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 10px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            ✕ Xóa
          </button>
        </div>
      )}

      {/* Render clusters and markers - using memoized components */}
      {clusters.map((cluster: any) => {
        const [longitude, latitude] = cluster.geometry.coordinates
        const { cluster: isCluster, point_count: pointCount } = cluster.properties

        if (isCluster) {
          // Use pre-computed level from memoized clusterLevels
          const level = clusterLevels[cluster.id] || 'low'
          const style = getClusterStyle(level)

          return (
            <ClusterMarker
              key={`cluster-${cluster.id}`}
              id={cluster.id}
              longitude={longitude}
              latitude={latitude}
              pointCount={pointCount}
              level={level}
              style={style}
              onClusterClick={handleClusterClick}
            />
          )
        } else {
          // Render individual marker with memoized PinMarker component
          const report = cluster.properties.report
          const severity = getSeverity(report)
          const color = getMarkerColor(severity)
          const emoji = getMarkerEmoji(report.type)
          const isSelected = selectedReport?.id === report.id

          return (
            <PinMarker
              key={report.id}
              report={report}
              longitude={longitude}
              latitude={latitude}
              color={color}
              emoji={emoji}
              isSelected={isSelected}
              onPinClick={handlePinClick}
            />
          )
        }
      })}

      {/* Popup for selected marker - Desktop only */}
      {isDesktop && selectedReport && selectedReport.lat && selectedReport.lon && (
        <Popup
          longitude={selectedReport.lon}
          latitude={selectedReport.lat}
          anchor="top"
          onClose={() => setSelectedReport(null)}
          closeButton={false}
          closeOnClick={true}
          className="modern-popup"
        >
          <div className="p-3 sm:p-4 max-w-[260px] sm:max-w-xs min-w-[240px] sm:min-w-[280px] relative">
            {/* Expand button - Top right */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onExpandArticle?.(selectedReport)
              }}
              className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-colors group"
              title="Mở chế độ đọc đầy đủ"
              aria-label="Expand article"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-neutral-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            {/* Badge & Trust Score */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 text-xs font-medium rounded ${
                selectedReport.type === 'ALERT' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                selectedReport.type === 'SOS' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                selectedReport.type === 'ROAD' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              }`}>
                {selectedReport.type}
              </span>
              <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                {(selectedReport.trust_score * 100).toFixed(0)}% tin cậy
              </span>
            </div>

            {/* Title */}
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 mb-2 leading-snug">
              {selectedReport.title}
            </h3>

            {/* Description - Truncated preview */}
            {selectedReport.description && (
              <>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2 leading-relaxed line-clamp-3">
                  {truncateDescription(selectedReport.description, 150)}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-500 italic mb-3">
                  Nhấn icon ↗️ để xem đầy đủ
                </p>
              </>
            )}

            {/* Meta Info */}
            <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📍</span>
                <span className="font-medium">{selectedReport.province || 'Không rõ'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🕒</span>
                <time className="tabular-nums">
                  {new Date(selectedReport.created_at).toLocaleString('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </time>
              </div>
            </div>

            {/* Copyright Footer */}
            <div className="text-[10px] text-neutral-400 dark:text-neutral-800 text-left pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800">
              © Thông tin mưa lũ - Lâm Nguyễn
            </div>
          </div>
        </Popup>
      )}

      {/* Layer Control Panel - Toggle disaster types */}
      {layerControlOpen && (
        <LayerControlPanel
          visibility={layerVisibility}
          onChange={setLayerVisibility}
        />
      )}
    </Map>

    {/* Windy Weather Modal */}
    <WindyModal
      isOpen={windyModalOpen}
      onClose={() => setWindyModalOpen(false)}
      initialLat={viewState.latitude}
      initialLon={viewState.longitude}
      initialZoom={viewState.zoom}
    />

    {/* Mobile Pin Popup is now rendered in page.tsx for proper z-index stacking */}
    {/* The popup state is lifted to parent via onMobilePinSelect callback */}
  </>
  )
}
