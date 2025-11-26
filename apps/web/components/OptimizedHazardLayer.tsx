'use client'

/**
 * OptimizedHazardLayer
 *
 * Phase 5: Advanced Map Optimization
 * Replaces React Markers with native MapLibre Symbol Layer for better performance.
 * - Uses circle + symbol layers instead of React Markers
 * - Single GeoJSON source for all hazards
 * - Native WebGL rendering (60fps capable)
 * - React Popup only shown when selected
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { HazardEvent, HAZARD_TYPE_LABELS, SEVERITY_LEVEL_LABELS, HAZARD_TYPE_ICONS } from '@/types/hazard'
import { LAYER_ORDER } from '@/lib/layerOrder'

interface OptimizedHazardLayerProps {
  hazards: HazardEvent[]
  visible?: boolean
  onHazardClick?: (hazard: HazardEvent) => void
}

// Severity colors matching design system
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#FBBF24',
  low: '#22C55E',
  info: '#3B82F6',
}

// Text symbols for markers (no sprite sheet needed)
const HAZARD_TEXT_SYMBOLS: Record<string, string> = {
  flood: '🌊',
  heavy_rain: '🌧️',
  storm: '🌀',
  landslide: '⛰️',
  dam_release: '🏗️',
  drought: '☀️',
  default: '⚠️',
}

/**
 * Generate circle polygon for hazard radius
 */
function createHazardCircle(hazard: HazardEvent, points: number = 64) {
  if (!hazard.radius_km) return null

  const coords: number[][] = []
  const { lon, lat, radius_km } = hazard

  const distanceX = radius_km / (111.32 * Math.cos((lat * Math.PI) / 180))
  const distanceY = radius_km / 110.574

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    coords.push([lon + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)])
  }
  coords.push(coords[0])

  return {
    type: 'Feature' as const,
    properties: {
      id: hazard.id,
      severity: hazard.severity,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  }
}

export default function OptimizedHazardLayer({
  hazards,
  visible = true,
  onHazardClick,
}: OptimizedHazardLayerProps) {
  const { current: map } = useMap()
  const [selectedHazard, setSelectedHazard] = useState<HazardEvent | null>(null)

  // Memoized GeoJSON for hazard circles (polygons)
  const circlesGeoJSON = useMemo(() => {
    const features = hazards
      .filter((h) => h.radius_km)
      .map((h) => createHazardCircle(h))
      .filter(Boolean)

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [hazards])

  // Memoized GeoJSON for hazard points (markers)
  const pointsGeoJSON = useMemo(() => {
    const features = hazards.map((h) => ({
      type: 'Feature' as const,
      properties: {
        id: h.id,
        type: h.type,
        severity: h.severity,
        symbol: HAZARD_TEXT_SYMBOLS[h.type] || HAZARD_TEXT_SYMBOLS.default,
        // Priority for sorting (critical on top)
        sortKey: h.severity === 'critical' ? 0 : h.severity === 'high' ? 1 : 2,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [h.lon, h.lat],
      },
    }))

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [hazards])

  // Handle click on hazard marker
  const handleLayerClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const hazardId = feature.properties?.id

      if (hazardId) {
        const hazard = hazards.find((h) => h.id === hazardId)
        if (hazard) {
          // Toggle selection
          if (selectedHazard?.id === hazard.id) {
            setSelectedHazard(null)
          } else {
            setSelectedHazard(hazard)
            onHazardClick?.(hazard)
          }
        }
      }
    },
    [hazards, selectedHazard, onHazardClick]
  )

  // Set up click handlers
  useEffect(() => {
    if (!map) return

    const layerIds = ['hazard-points-outer', 'hazard-points-symbol']

    layerIds.forEach((layerId) => {
      map.on('click', layerId, handleLayerClick)
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = ''
      })
    })

    return () => {
      layerIds.forEach((layerId) => {
        map.off('click', layerId, handleLayerClick)
        map.off('mouseenter', layerId, () => {})
        map.off('mouseleave', layerId, () => {})
      })
    }
  }, [map, handleLayerClick])

  if (hazards.length === 0 || !visible) return null

  // Helper to extract detailed metrics
  const getDetailedMetrics = (hazard: HazardEvent) => {
    const metrics: Array<{ label: string; value: string; icon: string }> = []
    if (hazard.raw_payload) {
      const payload = hazard.raw_payload
      if (payload.water_level_m || payload.waterLevel) {
        metrics.push({
          label: 'Mức nước',
          value: `${payload.water_level_m || payload.waterLevel} m`,
          icon: '💧',
        })
      }
      if (payload.rainfall_mm || payload.intensity_mm_h) {
        metrics.push({
          label: 'Cường độ mưa',
          value: `${payload.rainfall_mm || payload.intensity_mm_h} mm/giờ`,
          icon: '🌧️',
        })
      }
      if (payload.accumulated_24h_mm) {
        metrics.push({
          label: 'Tích lũy 24h',
          value: `${payload.accumulated_24h_mm} mm`,
          icon: '📊',
        })
      }
      if (payload.discharge_rate || payload.flow_rate_m3s) {
        metrics.push({
          label: 'Lưu lượng xả',
          value: `${payload.discharge_rate || payload.flow_rate_m3s} m³/s`,
          icon: '🏗️',
        })
      }
      if (payload.reservoir_level_pct) {
        metrics.push({
          label: 'Mực hồ chứa',
          value: `${payload.reservoir_level_pct}%`,
          icon: '🌊',
        })
      }
    }
    return metrics
  }

  return (
    <>
      {/* Hazard radius circles */}
      {circlesGeoJSON.features.length > 0 && (
        <Source id="hazard-circles" type="geojson" data={circlesGeoJSON}>
          <Layer
            id="hazard-circles-fill"
            type="fill"
            beforeId={undefined}
            paint={{
              'fill-color': [
                'match',
                ['get', 'severity'],
                'critical', SEVERITY_COLORS.critical,
                'high', SEVERITY_COLORS.high,
                'medium', SEVERITY_COLORS.medium,
                'low', SEVERITY_COLORS.low,
                'info', SEVERITY_COLORS.info,
                SEVERITY_COLORS.medium,
              ],
              'fill-opacity': 0.2,
            }}
          />
          <Layer
            id="hazard-circles-border"
            type="line"
            paint={{
              'line-color': [
                'match',
                ['get', 'severity'],
                'critical', SEVERITY_COLORS.critical,
                'high', SEVERITY_COLORS.high,
                'medium', SEVERITY_COLORS.medium,
                'low', SEVERITY_COLORS.low,
                'info', SEVERITY_COLORS.info,
                SEVERITY_COLORS.medium,
              ],
              'line-width': 3,
              'line-opacity': 0.8,
            }}
          />
        </Source>
      )}

      {/* Hazard point markers - Symbol Layer instead of React Markers */}
      <Source id="hazard-points" type="geojson" data={pointsGeoJSON}>
        {/* Outer glow/pulse circle */}
        <Layer
          id="hazard-points-pulse"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 12,
              14, 20,
            ],
            'circle-color': [
              'match',
              ['get', 'severity'],
              'critical', SEVERITY_COLORS.critical,
              'high', SEVERITY_COLORS.high,
              SEVERITY_COLORS.medium,
            ],
            'circle-opacity': 0.3,
            'circle-blur': 0.5,
          }}
        />

        {/* Main marker circle */}
        <Layer
          id="hazard-points-outer"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 8,
              14, 16,
            ],
            'circle-color': [
              'match',
              ['get', 'severity'],
              'critical', SEVERITY_COLORS.critical,
              'high', SEVERITY_COLORS.high,
              'medium', SEVERITY_COLORS.medium,
              'low', SEVERITY_COLORS.low,
              'info', SEVERITY_COLORS.info,
              SEVERITY_COLORS.medium,
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          }}
        />

        {/* Emoji symbol */}
        <Layer
          id="hazard-points-symbol"
          type="symbol"
          layout={{
            'text-field': ['get', 'symbol'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 12,
              14, 18,
            ],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'symbol-sort-key': ['get', 'sortKey'],
          }}
        />
      </Source>

      {/* React Popup - only rendered when a hazard is selected */}
      {selectedHazard && (
        <Popup
          longitude={selectedHazard.lon}
          latitude={selectedHazard.lat}
          anchor="bottom"
          onClose={() => setSelectedHazard(null)}
          closeButton={false}
          closeOnClick={true}
          className="hazard-popup"
        >
          <div className="p-4 min-w-[280px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{HAZARD_TYPE_ICONS[selectedHazard.type]}</span>
              <div className="flex-1">
                <h3 className="font-bold text-base text-neutral-900">
                  {HAZARD_TYPE_LABELS[selectedHazard.type]}
                </h3>
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white mt-1"
                  style={{ backgroundColor: SEVERITY_COLORS[selectedHazard.severity] }}
                >
                  {SEVERITY_LEVEL_LABELS[selectedHazard.severity]}
                </span>
              </div>
            </div>

            {/* Detailed Metrics */}
            {getDetailedMetrics(selectedHazard).length > 0 && (
              <div className="mb-3 space-y-2 pb-3 border-b border-neutral-200">
                {getDetailedMetrics(selectedHazard).map((metric, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-lg">{metric.icon}</span>
                    <span className="text-sm text-neutral-600">{metric.label}:</span>
                    <span className="text-sm font-bold text-neutral-900">{metric.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Standard Info */}
            <div className="text-xs text-neutral-600 space-y-1.5">
              {selectedHazard.radius_km && (
                <div className="flex items-center gap-1.5">
                  <span>📍</span>
                  <span>
                    Bán kính ảnh hưởng: <strong>{selectedHazard.radius_km} km</strong>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span>🕒</span>
                <span>
                  {new Date(selectedHazard.starts_at).toLocaleString('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              {selectedHazard.distance_km !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span>📏</span>
                  <span>
                    Cách bạn: <strong>{selectedHazard.distance_km.toFixed(1)} km</strong>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span>🏛️</span>
                <span className="text-xs">Nguồn: {selectedHazard.source}</span>
              </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}
