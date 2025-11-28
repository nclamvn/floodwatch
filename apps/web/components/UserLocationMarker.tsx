'use client'

import React, { useMemo } from 'react'
import { Source, Layer, Marker } from 'react-map-gl/maplibre'
import { useLocation } from '@/contexts/LocationContext'
import { useTranslations } from 'next-intl'

/**
 * Generate a GeoJSON circle polygon for a given center and radius
 */
function createCircleGeoJSON(
  longitude: number,
  latitude: number,
  radiusKm: number,
  points: number = 64
) {
  const coords: number[][] = []
  const distanceX = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180))
  const distanceY = radiusKm / 110.574

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    const x = distanceX * Math.cos(theta)
    const y = distanceY * Math.sin(theta)
    coords.push([longitude + x, latitude + y])
  }
  coords.push(coords[0]) // Close the polygon

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  }
}

export default function UserLocationMarker() {
  const { userLocation, alertRadius } = useLocation()
  const t = useTranslations('map')

  // Generate circle GeoJSON
  const circleGeoJSON = useMemo(() => {
    if (!userLocation) return null

    return {
      type: 'FeatureCollection' as const,
      features: [
        createCircleGeoJSON(
          userLocation.longitude,
          userLocation.latitude,
          alertRadius
        ),
      ],
    }
  }, [userLocation, alertRadius])

  if (!userLocation) return null

  return (
    <>
      {/* Alert radius circle */}
      {circleGeoJSON && (
        <Source id="user-alert-radius" type="geojson" data={circleGeoJSON}>
          {/* Fill */}
          <Layer
            id="user-alert-radius-fill"
            type="fill"
            paint={{
              'fill-color': '#3B82F6',
              'fill-opacity': 0.1,
            }}
          />
          {/* Border */}
          <Layer
            id="user-alert-radius-border"
            type="line"
            paint={{
              'line-color': '#3B82F6',
              'line-width': 2,
              'line-opacity': 0.5,
              'line-dasharray': [2, 2],
            }}
          />
        </Source>
      )}

      {/* User position marker */}
      <Marker
        longitude={userLocation.longitude}
        latitude={userLocation.latitude}
        anchor="center"
      >
        <div className="relative">
          {/* Pulsing outer ring */}
          <div
            className="absolute inset-0 rounded-full bg-neutral-500 animate-ping"
            style={{
              width: '32px',
              height: '32px',
              marginLeft: '-16px',
              marginTop: '-16px',
              opacity: 0.4,
            }}
          />

          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full bg-neutral-400"
            style={{
              width: '24px',
              height: '24px',
              marginLeft: '-12px',
              marginTop: '-12px',
              opacity: 0.3,
            }}
          />

          {/* Main dot */}
          <div
            className="relative rounded-full bg-neutral-600 border-4 border-white shadow-lg"
            style={{
              width: '16px',
              height: '16px',
              marginLeft: '-8px',
              marginTop: '-8px',
            }}
          />

          {/* Center white dot */}
          <div
            className="absolute inset-0 rounded-full bg-white"
            style={{
              width: '6px',
              height: '6px',
              marginLeft: '-3px',
              marginTop: '-3px',
            }}
          />
        </div>
      </Marker>

      {/* Radius label */}
      <Marker
        longitude={userLocation.longitude}
        latitude={userLocation.latitude}
        anchor="top"
        offset={[0, 20]}
      >
        <div
          className="
            px-3 py-1.5
            bg-neutral-600 text-white
            rounded-full
            text-xs font-semibold
            shadow-lg
            whitespace-nowrap
          "
        >
          {t('controls.alertRadius', { radius: alertRadius })}
        </div>
      </Marker>
    </>
  )
}
