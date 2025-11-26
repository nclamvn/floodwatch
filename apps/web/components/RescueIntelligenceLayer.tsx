'use client'

import React, { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import Supercluster from 'supercluster'
import { useHelpRequests, HelpRequest } from '@/hooks/useHelpRequests'
import { useHelpOffers, HelpOffer } from '@/hooks/useHelpOffers'

interface RescueIntelligenceLayerProps {
  lat?: number
  lon?: number
  radius_km?: number
  showRequests?: boolean
  showOffers?: boolean
  onRequestClick?: (request: HelpRequest) => void
  onOfferClick?: (offer: HelpOffer) => void
  selectedPinId?: string | null
  selectedPinType?: 'request' | 'offer' | null
  zoom?: number
  bounds?: [number, number, number, number]
  onClusterClick?: (clusterId: number, longitude: number, latitude: number) => void
}

/**
 * Color mapping for rescue intelligence map
 */
const REQUEST_URGENCY_COLORS: Record<string, string> = {
  critical: '#DC2626', // red-600 - life threatening
  high: '#F97316',     // orange-500 - urgent
  medium: '#FBBF24',   // amber-400 - needs attention
  low: '#3B82F6',      // blue-500 - can wait
}

const OFFER_STATUS_COLORS: Record<string, string> = {
  available: '#22C55E', // green-500 - ready to help
  busy: '#FBBF24',      // amber-400 - currently helping
  offline: '#9CA3AF',   // gray-400 - not available
  unavailable: '#EF4444', // red-500 - cannot help
}

/**
 * RescueIntelligenceLayer Component
 *
 * Renders rescue intelligence on the map with two types of pins:
 * - 🔵 Blue pins for help_requests (people needing rescue)
 * - 🟢 Green pins for help_offers (volunteers/rescuers)
 *
 * Features:
 * - Color-coded by urgency (requests) and status (offers)
 * - Visual indicators for special conditions
 * - Coverage radius visualization for offers
 * - Capacity indicators
 */
export default function RescueIntelligenceLayer({
  lat,
  lon,
  radius_km = 50,
  showRequests = true,
  showOffers = true,
  onRequestClick,
  onOfferClick,
  selectedPinId = null,
  selectedPinType = null,
  zoom = 8,
  bounds,
  onClusterClick
}: RescueIntelligenceLayerProps) {
  // Fetch help requests from API
  const { requests, isLoading: loadingRequests } = useHelpRequests({
    enabled: showRequests,
    lat,
    lon,
    radius_km,
    status: 'active,in_progress',
  })

  // Fetch help offers from API
  const { offers, isLoading: loadingOffers } = useHelpOffers({
    enabled: showOffers,
    lat,
    lon,
    radius_km,
    status: 'active',
  })

  // Initialize Supercluster for requests
  const requestsClusterIndex = useMemo(() => {
    const index = new Supercluster<HelpRequest>({
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
    })

    const points = requests.map(request => ({
      type: 'Feature' as const,
      properties: request,
      geometry: {
        type: 'Point' as const,
        coordinates: [request.lon, request.lat],
      },
    }))

    index.load(points)
    return index
  }, [requests])

  // Initialize Supercluster for offers
  const offersClusterIndex = useMemo(() => {
    const index = new Supercluster<HelpOffer>({
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
    })

    const points = offers.map(offer => ({
      type: 'Feature' as const,
      properties: offer,
      geometry: {
        type: 'Point' as const,
        coordinates: [offer.lon, offer.lat],
      },
    }))

    index.load(points)
    return index
  }, [offers])

  // Get clustered/unclustered points based on zoom and bounds
  const requestsClusters = useMemo(() => {
    if (!bounds) return []
    return requestsClusterIndex.getClusters(bounds, Math.floor(zoom))
  }, [requestsClusterIndex, bounds, zoom])

  const offersClusters = useMemo(() => {
    if (!bounds) return []
    return offersClusterIndex.getClusters(bounds, Math.floor(zoom))
  }, [offersClusterIndex, bounds, zoom])

  // Generate GeoJSON for help requests (blue pins) - with clustering
  const requestsGeoJSON = useMemo(() => {
    console.log('[RescueIntelligenceLayer] Requests clusters:', {
      total: requests.length,
      clusters: requestsClusters.length,
      sampleCluster: requestsClusters[0]
    })

    const features = requestsClusters.map((cluster) => {
      const { geometry, properties } = cluster
      const isCluster = 'cluster' in properties && properties.cluster

      if (isCluster) {
        // Cluster marker
        return {
          type: 'Feature' as const,
          properties: {
            cluster: true,
            cluster_id: properties.cluster_id,
            point_count: properties.point_count,
            type: 'request-cluster',
          },
          geometry,
        }
      } else {
        // Individual request
        const request = properties as HelpRequest
        return {
          type: 'Feature' as const,
          properties: {
            id: request.id,
            type: 'request',
            urgency: request.urgency,
            status: request.status,
            needs_type: request.needs_type,
            people_count: request.people_count,
            has_children: request.has_children || false,
            has_elderly: request.has_elderly || false,
            has_disabilities: request.has_disabilities || false,
            description: request.description,
            contact_name: request.contact_name,
            contact_phone: request.contact_phone,
            verified: request.is_verified,
          },
          geometry,
        }
      }
    })

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [requestsClusters, requests])

  // Generate GeoJSON for help offers (green pins) - with clustering
  const offersGeoJSON = useMemo(() => {
    console.log('[RescueIntelligenceLayer] Offers clusters:', {
      total: offers.length,
      clusters: offersClusters.length,
      sampleCluster: offersClusters[0]
    })

    const features = offersClusters.map((cluster) => {
      const { geometry, properties } = cluster
      const isCluster = 'cluster' in properties && properties.cluster

      if (isCluster) {
        // Cluster marker
        return {
          type: 'Feature' as const,
          properties: {
            cluster: true,
            cluster_id: properties.cluster_id,
            point_count: properties.point_count,
            type: 'offer-cluster',
          },
          geometry,
        }
      } else {
        // Individual offer
        const offer = properties as HelpOffer
        return {
          type: 'Feature' as const,
          properties: {
            id: offer.id,
            type: 'offer',
            service_type: offer.service_type,
            status: offer.status,
            capacity: offer.capacity,
            available_capacity: offer.capacity,
            coverage_radius_km: offer.coverage_radius_km,
            description: offer.description,
            contact_name: offer.contact_name,
            contact_phone: offer.contact_phone,
            organization: offer.organization,
            vehicle_type: offer.vehicle_type,
            verified: offer.is_verified,
          },
          geometry,
        }
      }
    })

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [offersClusters, offers])

  // Generate coverage radius circles for offers
  const coverageRadiusGeoJSON = useMemo(() => {
    // Convert km radius to degrees (approximate)
    const features = offers.map((offer) => {
      const radiusInDegrees = offer.coverage_radius_km / 111 // 1 degree ≈ 111 km

      // Create a circle polygon
      const points = 64
      const coordinates = []
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI
        const dx = radiusInDegrees * Math.cos(angle)
        const dy = radiusInDegrees * Math.sin(angle)
        coordinates.push([offer.lon + dx, offer.lat + dy])
      }

      return {
        type: 'Feature' as const,
        properties: {
          id: offer.id,
          status: offer.status,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coordinates],
        },
      }
    })

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [offers])

  if ((loadingRequests && showRequests) || (loadingOffers && showOffers)) {
    return null
  }

  return (
    <>
      {/* ========== HELP REQUESTS (Blue Pins) ========== */}
      {showRequests && requests.length > 0 && (
        <Source id="help-requests" type="geojson" data={requestsGeoJSON}>
          {/* ========== CLUSTER LAYERS ========== */}
          {/* Cluster background circle - scaled by size */}
          <Layer
            id="help-requests-clusters"
            type="circle"
            filter={['==', ['get', 'type'], 'request-cluster']}
            paint={{
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                20,  // 20px for 2-9 items
                10, 25,  // 25px for 10-49 items
                50, 30,  // 30px for 50-99 items
                100, 35  // 35px for 100+ items
              ],
              'circle-color': '#EF4444', // red-500
              'circle-opacity': 0.7,
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            }}
          />

          {/* Cluster count text */}
          <Layer
            id="help-requests-cluster-count"
            type="symbol"
            filter={['==', ['get', 'type'], 'request-cluster']}
            layout={{
              'text-field': ['get', 'point_count'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 14,
              'text-allow-overlap': true,
            }}
            paint={{
              'text-color': '#ffffff',
            }}
          />

          {/* ========== INDIVIDUAL PIN LAYERS (filtered to exclude clusters) ========== */}
          {/* Large pulsing ring for critical requests */}
          <Layer
            id="help-requests-pulse-critical"
            type="circle"
            filter={['all',
              ['!=', ['get', 'type'], 'request-cluster'],
              ['==', ['get', 'urgency'], 'critical']
            ]}
            paint={{
              'circle-radius': 30,
              'circle-color': REQUEST_URGENCY_COLORS.critical,
              'circle-opacity': 0.3,
              'circle-blur': 0.6,
            }}
          />

          {/* Medium pulsing ring for high urgency */}
          <Layer
            id="help-requests-pulse-high"
            type="circle"
            filter={['all',
              ['!=', ['get', 'type'], 'request-cluster'],
              ['==', ['get', 'urgency'], 'high']
            ]}
            paint={{
              'circle-radius': 24,
              'circle-color': REQUEST_URGENCY_COLORS.high,
              'circle-opacity': 0.25,
              'circle-blur': 0.5,
            }}
          />

          {/* Outer ring - urgency color */}
          <Layer
            id="help-requests-outer"
            type="circle"
            filter={['!=', ['get', 'type'], 'request-cluster']}
            paint={{
              'circle-radius': 18,
              'circle-color': [
                'match',
                ['get', 'urgency'],
                'critical', REQUEST_URGENCY_COLORS.critical,
                'high', REQUEST_URGENCY_COLORS.high,
                'medium', REQUEST_URGENCY_COLORS.medium,
                'low', REQUEST_URGENCY_COLORS.low,
                REQUEST_URGENCY_COLORS.medium,
              ],
              'circle-opacity': 0.5,
            }}
          />

          {/* Main marker - red center (Phase 2: selected state) */}
          <Layer
            id="help-requests-main"
            type="circle"
            filter={['!=', ['get', 'type'], 'request-cluster']}
            paint={{
              'circle-radius': selectedPinType === 'request' && selectedPinId
                ? ['case', ['==', ['get', 'id'], selectedPinId], 16, 12]
                : 12,
              'circle-color': '#EF4444', // red-500
              'circle-stroke-width': selectedPinType === 'request' && selectedPinId
                ? ['case', ['==', ['get', 'id'], selectedPinId], 4, 3]
                : 3,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 1,
            }}
          />

          {/* Help icon symbol */}
          <Layer
            id="help-requests-symbol"
            type="symbol"
            filter={['!=', ['get', 'type'], 'request-cluster']}
            layout={{
              'text-field': '🆘',
              'text-size': 14,
              'text-offset': [0, -0.4],
              'text-anchor': 'center',
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{
              'text-opacity': 1,
            }}
          />

          {/* People count badge */}
          <Layer
            id="help-requests-count"
            type="symbol"
            filter={['all',
              ['!=', ['get', 'type'], 'request-cluster'],
              ['>', ['get', 'people_count'], 1]
            ]}
            layout={{
              'text-field': ['get', 'people_count'],
              'text-size': 10,
              'text-offset': [0, 0.3],
              'text-anchor': 'center',
              'text-allow-overlap': true,
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': '#DC2626',
              'text-halo-width': 1.5,
            }}
          />

          {/* Special condition indicators */}
          <Layer
            id="help-requests-special"
            type="symbol"
            filter={['all',
              ['!=', ['get', 'type'], 'request-cluster'],
              ['any',
                ['get', 'has_children'],
                ['get', 'has_elderly'],
                ['get', 'has_disabilities']
              ]
            ]}
            layout={{
              'text-field': [
                'case',
                ['get', 'has_disabilities'], '♿',
                ['get', 'has_children'], '👶',
                ['get', 'has_elderly'], '👴',
                ''
              ],
              'text-size': 13,
              'text-offset': [-1.6, -1.6],
              'text-anchor': 'right',
              'text-allow-overlap': true,
            }}
            paint={{
              'text-opacity': 0.95,
            }}
          />
        </Source>
      )}

      {/* ========== HELP OFFERS (Green Pins) ========== */}
      {showOffers && offers.length > 0 && (
        <>
          {/* Coverage radius circles - Only visible when zoomed in (zoom > 10) */}
          <Source id="help-offers-coverage" type="geojson" data={coverageRadiusGeoJSON}>
            <Layer
              id="help-offers-coverage-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'match',
                  ['get', 'status'],
                  'available', OFFER_STATUS_COLORS.available,
                  'busy', OFFER_STATUS_COLORS.busy,
                  OFFER_STATUS_COLORS.available,
                ],
                // Ultra-low opacity to prevent map obscuring when many circles overlap
                // Only show when zoomed in very close
                // Reduced further to prevent dark overlapping areas
                'fill-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 0,       // Invisible at zoom 8 and below
                  11, 0,      // Still invisible at zoom 11
                  13, 0.002,  // Ultra-faint at zoom 13 (0.2%)
                  15, 0.005,  // Still very faint at zoom 15 (0.5%)
                  17, 0.01    // Slightly more visible when very close (1%)
                ],
              }}
            />
            <Layer
              id="help-offers-coverage-outline"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'status'],
                  'available', OFFER_STATUS_COLORS.available,
                  'busy', OFFER_STATUS_COLORS.busy,
                  OFFER_STATUS_COLORS.available,
                ],
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 0.5,   // Thinner line when zoomed out
                  12, 1,    // Normal width when zoomed in
                  15, 1.5   // Slightly thicker when very close
                ],
                // Ultra-low opacity for outline to prevent overlap darkness
                // Reduced further to maintain map visibility
                'line-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 0,      // Invisible when zoomed out
                  11, 0,     // Still invisible at zoom 11
                  13, 0.01,  // Ultra-faint at zoom 13 (1%)
                  15, 0.03,  // Slightly more visible at zoom 15 (3%)
                  17, 0.06   // More visible when very close (6%)
                ],
                'line-dasharray': [3, 2],
              }}
            />
          </Source>

          {/* Offer markers */}
          <Source id="help-offers" type="geojson" data={offersGeoJSON}>
            {/* ========== CLUSTER LAYERS ========== */}
            {/* Cluster background circle - scaled by size */}
            <Layer
              id="help-offers-clusters"
              type="circle"
              filter={['==', ['get', 'type'], 'offer-cluster']}
              paint={{
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  20,  // 20px for 2-9 items
                  10, 25,  // 25px for 10-49 items
                  50, 30,  // 30px for 50-99 items
                  100, 35  // 35px for 100+ items
                ],
                'circle-color': '#22C55E', // green-500
                'circle-opacity': 0.7,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
              }}
            />

            {/* Cluster count text */}
            <Layer
              id="help-offers-cluster-count"
              type="symbol"
              filter={['==', ['get', 'type'], 'offer-cluster']}
              layout={{
                'text-field': ['get', 'point_count'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 14,
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#ffffff',
              }}
            />

            {/* ========== INDIVIDUAL PIN LAYERS (filtered to exclude clusters) ========== */}
            {/* Outer ring - status color */}
            <Layer
              id="help-offers-outer"
              type="circle"
              filter={['!=', ['get', 'type'], 'offer-cluster']}
              paint={{
                'circle-radius': 18,
                'circle-color': [
                  'match',
                  ['get', 'status'],
                  'available', OFFER_STATUS_COLORS.available,
                  'busy', OFFER_STATUS_COLORS.busy,
                  'offline', OFFER_STATUS_COLORS.offline,
                  'unavailable', OFFER_STATUS_COLORS.unavailable,
                  OFFER_STATUS_COLORS.available,
                ],
                'circle-opacity': 0.4,
              }}
            />

            {/* Main marker - green center (Phase 2: selected state) */}
            <Layer
              id="help-offers-main"
              type="circle"
              filter={['!=', ['get', 'type'], 'offer-cluster']}
              paint={{
                'circle-radius': selectedPinType === 'offer' && selectedPinId
                  ? ['case', ['==', ['get', 'id'], selectedPinId], 16, 12]
                  : 12,
                'circle-color': '#22C55E', // green-500
                'circle-stroke-width': selectedPinType === 'offer' && selectedPinId
                  ? ['case', ['==', ['get', 'id'], selectedPinId], 4, 3]
                  : 3,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 1,
              }}
            />

            {/* Service type icon */}
            <Layer
              id="help-offers-symbol"
              type="symbol"
              filter={['!=', ['get', 'type'], 'offer-cluster']}
              layout={{
                'text-field': [
                  'match',
                  ['get', 'service_type'],
                  'rescue', '🚁',
                  'transportation', '🚗',
                  'medical', '⚕️',
                  'shelter', '🏠',
                  'food_distribution', '🍲',
                  'supplies', '📦',
                  'volunteer', '🤝',
                  '✅' // default for 'other'
                ],
                'text-size': 14,
                'text-offset': [0, -0.4],
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true,
              }}
              paint={{
                'text-opacity': 1,
              }}
            />

            {/* Capacity badge */}
            <Layer
              id="help-offers-capacity"
              type="symbol"
              filter={['all',
                ['!=', ['get', 'type'], 'offer-cluster'],
                ['>', ['get', 'available_capacity'], 0]
              ]}
              layout={{
                'text-field': ['get', 'available_capacity'],
                'text-size': 10,
                'text-offset': [0, 0.3],
                'text-anchor': 'center',
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#16A34A',
                'text-halo-width': 1.5,
              }}
            />

            {/* Verified badge */}
            <Layer
              id="help-offers-verified"
              type="symbol"
              filter={['all',
                ['!=', ['get', 'type'], 'offer-cluster'],
                ['==', ['get', 'verified'], true]
              ]}
              layout={{
                'text-field': '✓',
                'text-size': 12,
                'text-offset': [-1.6, -1.6],
                'text-anchor': 'right',
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#22C55E',
                'text-halo-width': 2,
              }}
            />
          </Source>
        </>
      )}
    </>
  )
}
