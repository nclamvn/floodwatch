'use client'

import React, { useMemo, useState } from 'react'
import { Source, Layer, Marker, Popup } from 'react-map-gl/maplibre'
import { useTraffic, TrafficDisruption } from '@/hooks/useTraffic'

interface TrafficLayerProps {
  lat?: number
  lon?: number
  radius_km?: number
  visible?: boolean
  onDisruptionClick?: (disruption: TrafficDisruption) => void
}

/**
 * Severity color mapping for traffic disruptions
 */
const SEVERITY_COLORS: Record<string, string> = {
  impassable: '#DC2626',  // red-600 - road completely blocked
  dangerous: '#F97316',   // orange-500 - hazardous conditions
  slow: '#FBBF24',        // amber-400 - traffic delays
  warning: '#3B82F6',     // blue-500 - advisory
}

/**
 * Icon mapping for disruption types
 */
const DISRUPTION_ICONS: Record<string, string> = {
  flooded_road: '🌊',
  landslide: '⛰️',
  bridge_collapsed: '🌉',
  bridge_flooded: '🌉',
  traffic_jam: '🚗',
  road_damaged: '🚧',
  blocked: '⛔',
}

/**
 * TrafficLayer Component
 *
 * Renders traffic disruptions on the map with:
 * - Color based on severity (impassable, dangerous, slow, warning)
 * - Icons based on disruption type
 * - Road names
 * - Alternative route indicators
 */
export default function TrafficLayer({
  lat,
  lon,
  radius_km = 30,
  visible = true,
  onDisruptionClick
}: TrafficLayerProps) {
  const [selectedDisruption, setSelectedDisruption] = useState<TrafficDisruption | null>(null)

  // Fetch traffic disruptions from API
  const { disruptions, isLoading, error } = useTraffic({
    enabled: visible,
    lat,
    lon,
    radius_km,
    is_active: true, // Only active disruptions
  })

  // Generate GeoJSON for traffic disruption points
  const trafficPointsGeoJSON = useMemo(() => {
    const features = disruptions.map((disruption) => ({
      type: 'Feature' as const,
      properties: {
        id: disruption.id,
        type: disruption.type,
        severity: disruption.severity,
        road_name: disruption.road_name,
        location_description: disruption.location_description,
        description: disruption.description,
        estimated_clearance: disruption.estimated_clearance,
        alternative_route: disruption.alternative_route,
        distance_km: disruption.distance_km,
        icon: DISRUPTION_ICONS[disruption.type] || '🚧',
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [disruption.lon, disruption.lat],
      },
    }))

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [disruptions])

  if (isLoading || error || disruptions.length === 0 || !visible) {
    return null
  }

  // Helper to get severity label
  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      impassable: 'Không thể đi',
      dangerous: 'Nguy hiểm',
      slow: 'Chậm',
      warning: 'Cảnh báo',
    }
    return labels[severity] || severity
  }

  // Helper to get disruption type label
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      flooded_road: 'Đường ngập',
      landslide: 'Sạt lở',
      bridge_collapsed: 'Cầu sập',
      bridge_flooded: 'Cầu ngập',
      traffic_jam: 'Tắc đường',
      road_damaged: 'Đường hư hỏng',
      blocked: 'Đường bị chặn',
    }
    return labels[type] || type
  }

  return (
    <>
      {/* Traffic disruption circles (background visualization) */}
      <Source id="traffic-points" type="geojson" data={trafficPointsGeoJSON}>
        {/* Pulsing ring for impassable roads */}
        <Layer
          id="traffic-points-pulse-impassable"
          type="circle"
          filter={['==', ['get', 'severity'], 'impassable']}
          paint={{
            'circle-radius': 24,
            'circle-color': SEVERITY_COLORS.impassable,
            'circle-opacity': 0.4,
            'circle-blur': 0.5,
          }}
        />

        {/* Outer warning ring */}
        <Layer
          id="traffic-points-outer"
          type="circle"
          paint={{
            'circle-radius': 14,
            'circle-color': [
              'match',
              ['get', 'severity'],
              'impassable', SEVERITY_COLORS.impassable,
              'dangerous', SEVERITY_COLORS.dangerous,
              'slow', SEVERITY_COLORS.slow,
              'warning', SEVERITY_COLORS.warning,
              SEVERITY_COLORS.warning, // default
            ],
            'circle-opacity': 0.7,
          }}
        />

        {/* Inner warning triangle/circle */}
        <Layer
          id="traffic-points-inner"
          type="circle"
          paint={{
            'circle-radius': 9,
            'circle-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-color': [
              'match',
              ['get', 'severity'],
              'impassable', SEVERITY_COLORS.impassable,
              'dangerous', SEVERITY_COLORS.dangerous,
              'slow', SEVERITY_COLORS.slow,
              'warning', SEVERITY_COLORS.warning,
              SEVERITY_COLORS.warning,
            ],
            'circle-opacity': 1,
          }}
        />

        {/* Disruption type icon */}
        <Layer
          id="traffic-points-icon"
          type="symbol"
          layout={{
            'text-field': ['get', 'icon'],
            'text-size': 14,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-opacity': 1,
          }}
        />

        {/* Road name labels */}
        <Layer
          id="traffic-points-label"
          type="symbol"
          filter={['has', 'road_name']}
          layout={{
            'text-field': ['get', 'road_name'],
            'text-size': 11,
            'text-font': ['Noto Sans Bold'],
            'text-offset': [0, 2],
            'text-anchor': 'top',
            'text-max-width': 10,
          }}
          paint={{
            'text-color': '#1F2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          }}
        />

        {/* Alternative route indicator */}
        <Layer
          id="traffic-points-alt-route"
          type="symbol"
          filter={['has', 'alternative_route']}
          layout={{
            'text-field': '↪️',
            'text-size': 12,
            'text-offset': [1.8, 0],
            'text-anchor': 'left',
            'text-allow-overlap': true,
          }}
          paint={{
            'text-opacity': 0.8,
          }}
        />

        {/* Severity badge for impassable/dangerous */}
        <Layer
          id="traffic-points-severity"
          type="symbol"
          filter={[
            'any',
            ['==', ['get', 'severity'], 'impassable'],
            ['==', ['get', 'severity'], 'dangerous']
          ]}
          layout={{
            'text-field': [
              'case',
              ['==', ['get', 'severity'], 'impassable'], '⛔',
              ['==', ['get', 'severity'], 'dangerous'], '⚠️',
              ''
            ],
            'text-size': 10,
            'text-offset': [-1.5, -1.5],
            'text-anchor': 'right',
            'text-allow-overlap': true,
          }}
          paint={{
            'text-opacity': 1,
          }}
        />
      </Source>

      {/* Interactive Markers for click events */}
      {disruptions.map((disruption) => (
        <Marker
          key={disruption.id}
          longitude={disruption.lon}
          latitude={disruption.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation()
            setSelectedDisruption(disruption)
            onDisruptionClick?.(disruption)
          }}
        >
          <div className="cursor-pointer transform hover:scale-125 transition-all duration-200">
            {/* Pulsing background for impassable */}
            {disruption.severity === 'impassable' && (
              <div
                className="absolute -inset-4 rounded-full animate-ping"
                style={{
                  backgroundColor: SEVERITY_COLORS[disruption.severity],
                  opacity: 0.4,
                }}
              />
            )}
            {/* Icon */}
            <div
              className="relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: SEVERITY_COLORS[disruption.severity] || SEVERITY_COLORS.warning,
                boxShadow: `0 4px 12px ${SEVERITY_COLORS[disruption.severity] || SEVERITY_COLORS.warning}66`,
              }}
            >
              <span className="text-xl">{DISRUPTION_ICONS[disruption.type] || '🚧'}</span>
            </div>
          </div>
        </Marker>
      ))}

      {/* Detailed Popup */}
      {selectedDisruption && (
        <Popup
          longitude={selectedDisruption.lon}
          latitude={selectedDisruption.lat}
          anchor="bottom"
          onClose={() => setSelectedDisruption(null)}
          closeButton={false}
          closeOnClick={true}
          className="modern-popup"
          maxWidth="400px"
        >
          <div className="p-4 min-w-[280px] max-w-[380px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{DISRUPTION_ICONS[selectedDisruption.type] || '🚧'}</span>
              <div className="flex-1">
                <h3 className="font-bold text-base text-neutral-900">
                  {getTypeLabel(selectedDisruption.type)}
                </h3>
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white mt-1"
                  style={{ backgroundColor: SEVERITY_COLORS[selectedDisruption.severity] || SEVERITY_COLORS.warning }}
                >
                  {getSeverityLabel(selectedDisruption.severity)}
                </span>
              </div>
            </div>

            {/* Road Information */}
            {selectedDisruption.road_name && (
              <div className="mb-3 pb-3 border-b border-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🛣️</span>
                  <span className="text-sm font-bold text-neutral-900 break-words">{selectedDisruption.road_name}</span>
                </div>
                {selectedDisruption.location_description && (
                  <p className="text-xs text-neutral-600 ml-7 break-words whitespace-normal">
                    {selectedDisruption.location_description}
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            {selectedDisruption.description && (
              <div className="mb-3 pb-3 border-b border-neutral-200">
                <p className="text-sm text-neutral-700 leading-relaxed break-words whitespace-normal">
                  {selectedDisruption.description}
                </p>
              </div>
            )}

            {/* Clearance Time */}
            {selectedDisruption.estimated_clearance && (
              <div className="mb-3 pb-3 border-b border-neutral-200">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⏱️</span>
                  <div className="flex-1">
                    <div className="text-xs text-neutral-600">Dự kiến thông tuyến:</div>
                    <div className="text-sm font-semibold text-neutral-900 mt-0.5">
                      {selectedDisruption.estimated_clearance}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alternative Route */}
            {selectedDisruption.alternative_route && (
              <div className="mb-3 pb-3 border-b border-neutral-200 bg-blue-50 dark:bg-blue-900/20 -mx-4 px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">↪️</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-blue-700 dark:text-blue-400 font-semibold">Đường thay thế:</div>
                    <div className="text-sm text-blue-900 dark:text-blue-300 mt-1 leading-relaxed break-words whitespace-normal">
                      {selectedDisruption.alternative_route}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="text-xs text-neutral-600 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span>🕒</span>
                <span>
                  Bắt đầu: {new Date(selectedDisruption.starts_at).toLocaleString('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              {selectedDisruption.distance_km !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span>📏</span>
                  <span>Cách bạn: <strong>{selectedDisruption.distance_km.toFixed(1)} km</strong></span>
                </div>
              )}
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}
