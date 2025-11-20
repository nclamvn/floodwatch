'use client'

import React, { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import { useDistress, DistressReport } from '@/hooks/useDistress'

interface DistressLayerProps {
  lat?: number
  lon?: number
  radius_km?: number
  visible?: boolean
  onDistressClick?: (report: DistressReport) => void
}

/**
 * Urgency color mapping for map visualization
 */
const URGENCY_COLORS: Record<string, string> = {
  critical: '#DC2626', // red-600 - immediate danger
  high: '#F97316',     // orange-500 - urgent
  medium: '#FBBF24',   // amber-400 - needs attention
  low: '#22C55E',      // green-500 - minor
}

/**
 * DistressLayer Component
 *
 * Renders distress reports (rescue requests) on the map with:
 * - Color based on urgency (critical, high, medium, low)
 * - Pulsing animation for critical reports
 * - Visual indicators for children/elderly/injuries
 * - Number of people affected
 */
export default function DistressLayer({
  lat,
  lon,
  radius_km = 30,
  visible = true,
  onDistressClick
}: DistressLayerProps) {
  // Fetch distress reports from API
  const { reports, isLoading, error } = useDistress({
    enabled: visible,
    lat,
    lon,
    radius_km,
    status: 'pending,acknowledged,in_progress', // Only active reports
  })

  // Generate GeoJSON for distress points
  const distressPointsGeoJSON = useMemo(() => {
    const features = reports.map((report) => ({
      type: 'Feature' as const,
      properties: {
        id: report.id,
        urgency: report.urgency,
        status: report.status,
        num_people: report.num_people,
        has_injuries: report.has_injuries,
        has_children: report.has_children,
        has_elderly: report.has_elderly,
        description: report.description,
        contact_name: report.contact_name,
        contact_phone: report.contact_phone,
        distance_km: report.distance_km,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [report.lon, report.lat],
      },
    }))

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [reports])

  if (isLoading || error || reports.length === 0 || !visible) {
    return null
  }

  return (
    <>
      {/* Distress report markers */}
      <Source id="distress-points" type="geojson" data={distressPointsGeoJSON}>
        {/* Large pulsing outer ring for critical reports */}
        <Layer
          id="distress-points-pulse-critical"
          type="circle"
          filter={['==', ['get', 'urgency'], 'critical']}
          paint={{
            'circle-radius': 28,
            'circle-color': URGENCY_COLORS.critical,
            'circle-opacity': 0.4,
            'circle-blur': 0.6,
          }}
        />

        {/* Medium pulsing ring for high urgency */}
        <Layer
          id="distress-points-pulse-high"
          type="circle"
          filter={['==', ['get', 'urgency'], 'high']}
          paint={{
            'circle-radius': 22,
            'circle-color': URGENCY_COLORS.high,
            'circle-opacity': 0.3,
            'circle-blur': 0.5,
          }}
        />

        {/* Outer ring - shows urgency level */}
        <Layer
          id="distress-points-outer"
          type="circle"
          paint={{
            'circle-radius': 16,
            'circle-color': [
              'match',
              ['get', 'urgency'],
              'critical', URGENCY_COLORS.critical,
              'high', URGENCY_COLORS.high,
              'medium', URGENCY_COLORS.medium,
              'low', URGENCY_COLORS.low,
              URGENCY_COLORS.medium, // default
            ],
            'circle-opacity': 0.6,
          }}
        />

        {/* Main marker - white center with urgency border */}
        <Layer
          id="distress-points-main"
          type="circle"
          paint={{
            'circle-radius': 10,
            'circle-color': '#ffffff',
            'circle-stroke-width': 3,
            'circle-stroke-color': [
              'match',
              ['get', 'urgency'],
              'critical', URGENCY_COLORS.critical,
              'high', URGENCY_COLORS.high,
              'medium', URGENCY_COLORS.medium,
              'low', URGENCY_COLORS.low,
              URGENCY_COLORS.medium,
            ],
            'circle-opacity': 1,
          }}
        />

        {/* SOS symbol layer - red cross or emergency icon */}
        <Layer
          id="distress-points-symbol"
          type="symbol"
          layout={{
            'text-field': '🆘',
            'text-size': 14,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-opacity': 1,
          }}
        />

        {/* People count badge - show number of people affected */}
        <Layer
          id="distress-points-count"
          type="symbol"
          filter={['>', ['get', 'num_people'], 1]}
          layout={{
            'text-field': ['get', 'num_people'],
            'text-size': 10,
            'text-font': ['Noto Sans Bold'],
            'text-offset': [1.5, -1.5],
            'text-anchor': 'left',
            'text-allow-overlap': true,
          }}
          paint={{
            'text-color': '#ffffff',
            'text-halo-color': [
              'match',
              ['get', 'urgency'],
              'critical', URGENCY_COLORS.critical,
              'high', URGENCY_COLORS.high,
              'medium', URGENCY_COLORS.medium,
              'low', URGENCY_COLORS.low,
              URGENCY_COLORS.medium,
            ],
            'text-halo-width': 2,
          }}
        />

        {/* Priority indicators - show children/elderly/injuries with small icons */}
        <Layer
          id="distress-points-priority"
          type="symbol"
          filter={[
            'any',
            ['get', 'has_children'],
            ['get', 'has_elderly'],
            ['get', 'has_injuries']
          ]}
          layout={{
            'text-field': [
              'case',
              ['get', 'has_injuries'], '🚑',
              ['get', 'has_children'], '👶',
              ['get', 'has_elderly'], '👴',
              ''
            ],
            'text-size': 12,
            'text-offset': [-1.5, -1.5],
            'text-anchor': 'right',
            'text-allow-overlap': true,
          }}
          paint={{
            'text-opacity': 0.9,
          }}
        />
      </Source>
    </>
  )
}
