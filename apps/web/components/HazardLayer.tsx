'use client'

import React, { useMemo, useState } from 'react'
import { Source, Layer, Marker, Popup } from 'react-map-gl/maplibre'
import { useLocation } from '@/contexts/LocationContext'
import { HazardEvent, HAZARD_TYPE_LABELS, SEVERITY_LEVEL_LABELS, HAZARD_TYPE_ICONS } from '@/types/hazard'

interface HazardLayerProps {
  hazards: HazardEvent[]
  visible?: boolean
  onHazardClick?: (hazard: HazardEvent) => void
}

/**
 * Severity color mapping for map visualization
 */
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626', // red-600
  high: '#F97316',     // orange-500
  medium: '#FBBF24',   // amber-400
  low: '#22C55E',      // green-500
  info: '#3B82F6',     // blue-500
}

/**
 * Generate a circle polygon GeoJSON for a hazard event
 */
function createHazardCircle(hazard: HazardEvent, points: number = 64) {
  if (!hazard.radius_km) return null

  const coords: number[][] = []
  const { lon, lat, radius_km } = hazard

  // Convert km to degrees (approximate)
  const distanceX = radius_km / (111.32 * Math.cos((lat * Math.PI) / 180))
  const distanceY = radius_km / 110.574

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    const x = distanceX * Math.cos(theta)
    const y = distanceY * Math.sin(theta)
    coords.push([lon + x, lat + y])
  }
  coords.push(coords[0]) // Close the polygon

  return {
    type: 'Feature' as const,
    properties: {
      id: hazard.id,
      type: hazard.type,
      severity: hazard.severity,
      starts_at: hazard.starts_at,
      ends_at: hazard.ends_at,
      source: hazard.source,
      distance_km: hazard.distance_km,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  }
}

/**
 * HazardLayer Component
 *
 * Renders hazard events as circles on the map with:
 * - Color based on severity
 * - Radius based on affected area
 * - Center marker for hazard location
 * - Interactive popup with detailed information
 */
export default function HazardLayer({ hazards, visible = true, onHazardClick }: HazardLayerProps) {
  const { userLocation } = useLocation()
  const [selectedHazard, setSelectedHazard] = useState<HazardEvent | null>(null)

  // Generate GeoJSON for hazard circles
  const hazardCirclesGeoJSON = useMemo(() => {
    const features = hazards
      .filter((h) => h.radius_km)
      .map((h) => createHazardCircle(h))
      .filter((f) => f !== null)

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [hazards])

  // Generate GeoJSON for hazard center points
  const hazardPointsGeoJSON = useMemo(() => {
    const features = hazards.map((h) => ({
      type: 'Feature' as const,
      properties: {
        id: h.id,
        type: h.type,
        severity: h.severity,
        starts_at: h.starts_at,
        ends_at: h.ends_at,
        source: h.source,
        distance_km: h.distance_km,
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

  if (hazards.length === 0 || !visible) return null

  // Helper to extract detailed metrics from raw_payload
  const getDetailedMetrics = (hazard: HazardEvent) => {
    const metrics: Array<{ label: string; value: string; icon: string }> = []

    // Extract from raw_payload if available
    if (hazard.raw_payload) {
      const payload = hazard.raw_payload

      // Water level (for floods)
      if (payload.water_level_m || payload.waterLevel) {
        metrics.push({
          label: 'Mức nước',
          value: `${payload.water_level_m || payload.waterLevel} m`,
          icon: '💧'
        })
      }

      // Rainfall intensity (for rain)
      if (payload.rainfall_mm || payload.intensity_mm_h) {
        metrics.push({
          label: 'Cường độ mưa',
          value: `${payload.rainfall_mm || payload.intensity_mm_h} mm/giờ`,
          icon: '🌧️'
        })
      }

      // Accumulated rainfall
      if (payload.accumulated_24h_mm) {
        metrics.push({
          label: 'Tích lũy 24h',
          value: `${payload.accumulated_24h_mm} mm`,
          icon: '📊'
        })
      }

      // Dam discharge (for dam releases)
      if (payload.discharge_rate || payload.flow_rate_m3s) {
        metrics.push({
          label: 'Lưu lượng xả',
          value: `${payload.discharge_rate || payload.flow_rate_m3s} m³/s`,
          icon: '🏗️'
        })
      }

      // Reservoir level
      if (payload.reservoir_level_pct) {
        metrics.push({
          label: 'Mực hồ chứa',
          value: `${payload.reservoir_level_pct}%`,
          icon: '🌊'
        })
      }
    }

    return metrics
  }

  return (
    <>
      {/* Hazard circles (affected area) */}
      {hazardCirclesGeoJSON.features.length > 0 && (
        <Source id="hazard-circles" type="geojson" data={hazardCirclesGeoJSON}>
          {/* Fill layer */}
          <Layer
            id="hazard-circles-fill"
            type="fill"
            paint={{
              'fill-color': [
                'match',
                ['get', 'severity'],
                'critical', SEVERITY_COLORS.critical,
                'high', SEVERITY_COLORS.high,
                'medium', SEVERITY_COLORS.medium,
                'low', SEVERITY_COLORS.low,
                'info', SEVERITY_COLORS.info,
                SEVERITY_COLORS.medium, // default
              ],
              'fill-opacity': 0.2,
            }}
          />
          {/* Border layer */}
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

      {/* Interactive Hazard Markers */}
      {hazards.map((hazard) => (
        <Marker
          key={hazard.id}
          longitude={hazard.lon}
          latitude={hazard.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation()
            setSelectedHazard(hazard)
            onHazardClick?.(hazard)
          }}
        >
          <div className="cursor-pointer transform hover:scale-125 transition-all duration-200">
            {/* Pulsing background */}
            <div
              className="absolute -inset-3 rounded-full animate-ping"
              style={{
                backgroundColor: SEVERITY_COLORS[hazard.severity],
                opacity: 0.3,
              }}
            />
            {/* Icon */}
            <div
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
              style={{
                backgroundColor: SEVERITY_COLORS[hazard.severity],
                boxShadow: `0 4px 12px ${SEVERITY_COLORS[hazard.severity]}66`,
              }}
            >
              <span className="text-xl">{HAZARD_TYPE_ICONS[hazard.type]}</span>
            </div>
          </div>
        </Marker>
      ))}

      {/* Detailed Popup */}
      {selectedHazard && (
        <Popup
          longitude={selectedHazard.lon}
          latitude={selectedHazard.lat}
          anchor="bottom"
          onClose={() => setSelectedHazard(null)}
          closeButton={true}
          closeOnClick={false}
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
                  <span>Bán kính ảnh hưởng: <strong>{selectedHazard.radius_km} km</strong></span>
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
                  <span>Cách bạn: <strong>{selectedHazard.distance_km.toFixed(1)} km</strong></span>
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
