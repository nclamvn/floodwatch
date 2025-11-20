'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Map, { Marker, Popup, NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import Supercluster from 'supercluster'
import { getMapConfig, getStyleUrlWithToken, getCurrentProvider, type BaseMapStyleId } from '@/lib/mapProvider'
import { useLocation } from '@/contexts/LocationContext'
import UserLocationMarker from './UserLocationMarker'
import HazardLayer from './HazardLayer'
import DistressLayer from './DistressLayer'
import TrafficLayer from './TrafficLayer'
import LayerControlPanel, { LayerVisibility } from './LayerControlPanel'
import DisasterLegend from './DisasterLegend'
import { MapControlsGroup } from './MapControlsGroup'
import { WindyModal } from './WindyModal'
import { useHazards } from '@/hooks/useHazards'

interface Report {
  id: string
  type: string
  title: string
  description?: string
  province?: string
  lat?: number
  lon?: number
  trust_score: number
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
}

export default function MapViewClustered({ reports, radiusFilter, targetViewport, onViewportChange, onMapClick, onClearRadius }: MapViewProps) {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [viewState, setViewState] = useState({
    longitude: 107.5,
    latitude: 16.5,
    zoom: 7
  })
  const [baseMapStyle, setBaseMapStyle] = useState<BaseMapStyleId>('streets')
  const [windyModalOpen, setWindyModalOpen] = useState(false)
  const [layerControlOpen, setLayerControlOpen] = useState(false)

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

  // Debug map initialization
  useEffect(() => {
    console.log('🗺️ Map Config:', {
      styleUrl: mapStyleUrl,
      provider: currentProvider,
      baseMapStyle,
      hasToken: !!mapConfig.accessToken
    })
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

  // Fetch hazards near user location
  const { hazards: allHazards, isLoading: hazardsLoading } = useHazards({
    lat: userLocation?.latitude,
    lng: userLocation?.longitude,
    radius_km: 50,
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

  // Create clusters
  const { clusters, supercluster } = useMemo(() => {
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

    const bounds = [
      viewState.longitude - 360 / Math.pow(2, viewState.zoom),
      viewState.latitude - 180 / Math.pow(2, viewState.zoom),
      viewState.longitude + 360 / Math.pow(2, viewState.zoom),
      viewState.latitude + 180 / Math.pow(2, viewState.zoom)
    ] as [number, number, number, number]

    const clusters = cluster.getClusters(bounds, Math.floor(viewState.zoom))

    return { clusters, supercluster: cluster }
  }, [reports, viewState.zoom, viewState.longitude, viewState.latitude])

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

  // Cluster severity levels - based on URGENCY of reports, not just count
  const getClusterLevel = (clusterId: number, pointCount: number, superclusterInstance: any) => {
    try {
      // Get actual reports within this cluster
      const leaves = superclusterInstance.getLeaves(clusterId, Infinity)
      const clusterReports = leaves.map((leaf: any) => leaf.properties.report).filter(Boolean)

      if (clusterReports.length === 0) return 'low'

      // Count high-priority reports (ALERT/SOS with good trust)
      const urgentCount = clusterReports.filter((r: Report) =>
        (r.type === 'ALERT' || r.type === 'SOS') && r.trust_score >= 0.7
      ).length

      const alertSosCount = clusterReports.filter((r: Report) =>
        r.type === 'ALERT' || r.type === 'SOS'
      ).length

      // Priority 1: Many urgent reports → CRITICAL (RED)
      if (urgentCount >= 3) return 'critical'  // 3+ urgent ALERT/SOS → RED
      if (alertSosCount >= 5) return 'critical'  // 5+ ALERT/SOS → RED

      // Priority 2: Some urgent reports → HIGH (ORANGE)
      if (urgentCount >= 1) return 'high'  // 1-2 urgent reports → ORANGE
      if (alertSosCount >= 2) return 'high'  // 2-4 ALERT/SOS → ORANGE

      // Priority 3: RAIN or lower urgency → MEDIUM (YELLOW)
      if (clusterReports.some((r: Report) => r.type === 'RAIN' && r.trust_score >= 0.6)) {
        return 'medium'
      }

      // Fallback: Count-based for non-urgent clusters
      if (pointCount >= 10) return 'medium'
      return 'low'
    } catch (error) {
      // Fallback to count-based if error
      if (pointCount >= 10) return 'high'
      if (pointCount >= 5) return 'medium'
      return 'low'
    }
  }

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
      {/* Navigation controls - positioned to avoid overlap */}
      <NavigationControl position="bottom-right" showCompass={false} />
      <ScaleControl position="bottom-left" />

      {/* User location tracking */}
      <UserLocationMarker />

      {/* Map controls group - includes map styles, location, windy, and layer control buttons */}
      <MapControlsGroup
        baseMapStyle={baseMapStyle}
        onStyleChange={setBaseMapStyle}
        onWindyClick={() => setWindyModalOpen(true)}
        onLayerControlClick={() => setLayerControlOpen(!layerControlOpen)}
        layerControlActive={layerControlOpen}
      />

      {/* Hazard events visualization */}
      <HazardLayer
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

      {/* Render clusters and markers */}
      {clusters.map((cluster: any) => {
        const [longitude, latitude] = cluster.geometry.coordinates
        const { cluster: isCluster, point_count: pointCount } = cluster.properties

        if (isCluster) {
          // Render cluster with severity-based styling (based on report urgency)
          const level = getClusterLevel(cluster.id, pointCount, supercluster)
          const style = getClusterStyle(level)

          return (
            <Marker
              key={`cluster-${cluster.id}`}
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
                onClick={() => {
                  // Always zoom in to expand cluster into smaller clusters or individual markers
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(cluster.id),
                    20
                  )

                  // Smooth zoom animation to expansion level
                  setViewState({
                    ...viewState,
                    longitude,
                    latitude,
                    zoom: expansionZoom
                  })
                }}
                title={`${pointCount} báo cáo (${level}) - Click để tách ra`}
              >
                {pointCount}
              </div>
            </Marker>
          )
        } else {
          // Render individual marker with severity color
          const report = cluster.properties.report
          const severity = getSeverity(report)
          const color = getMarkerColor(severity)
          const emoji = getMarkerEmoji(report.type)

          return (
            <Marker
              key={report.id}
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setSelectedReport(report)
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
        }
      })}

      {/* Popup for selected marker - Modern styling */}
      {selectedReport && selectedReport.lat && selectedReport.lon && (
        <Popup
          longitude={selectedReport.lon}
          latitude={selectedReport.lat}
          anchor="top"
          onClose={() => setSelectedReport(null)}
          closeButton={true}
          closeOnClick={false}
          className="modern-popup"
        >
          <div className="p-4 max-w-xs min-w-[280px]">
            {/* Badge & Trust Score */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 text-xs font-medium rounded ${
                selectedReport.type === 'ALERT' ? 'bg-error-50 text-error-700' :
                selectedReport.type === 'SOS' ? 'bg-warning-50 text-warning-700' :
                selectedReport.type === 'ROAD' ? 'bg-warning-50 text-warning-600' :
                'bg-info-50 text-info-700'
              }`}>
                {selectedReport.type}
              </span>
              <span className="text-xs text-neutral-600 font-medium">
                {(selectedReport.trust_score * 100).toFixed(0)}% tin cậy
              </span>
            </div>

            {/* Title */}
            <h3 className="font-bold text-base text-neutral-900 mb-2 leading-snug">
              {selectedReport.title}
            </h3>

            {/* Description */}
            {selectedReport.description && (
              <p className="text-sm text-neutral-700 mb-3 leading-relaxed">
                {selectedReport.description}
              </p>
            )}

            {/* Meta Info */}
            <div className="text-xs text-neutral-600 space-y-1.5 pt-2 border-t border-neutral-200">
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

      {/* Disaster Legend - Icon and color guide */}
      <DisasterLegend
        lastUpdated={lastDataUpdate}
      />
    </Map>

    {/* Windy Weather Modal */}
    <WindyModal
      isOpen={windyModalOpen}
      onClose={() => setWindyModalOpen(false)}
      initialLat={viewState.latitude}
      initialLon={viewState.longitude}
      initialZoom={viewState.zoom}
    />
  </>
  )
}
