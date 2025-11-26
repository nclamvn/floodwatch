'use client'

/**
 * OptimizedAIForecastLayer
 *
 * Phase 5: Advanced Map Optimization
 * Replaces React Markers with native MapLibre Symbol Layer for better performance.
 * - Uses circle + symbol layers instead of React Markers
 * - Single GeoJSON source for all forecasts
 * - Native WebGL rendering (60fps capable)
 * - React Popup only shown when selected
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { Bot } from 'lucide-react'
import { AIForecast, AI_FORECAST_COLORS, getConfidenceLevel } from '@/types/aiForecast'
import { HAZARD_TYPE_LABELS } from '@/types/hazard'

interface OptimizedAIForecastLayerProps {
  forecasts: AIForecast[]
  visible?: boolean
  onForecastClick?: (forecast: AIForecast) => void
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#FBBF24',
  low: '#22C55E',
  info: '#3B82F6',
}

/**
 * Generate circle polygon for forecast radius
 */
function createForecastCircle(forecast: AIForecast, points: number = 64) {
  if (!forecast.radius_km) return null

  const coords: number[][] = []
  const { lon, lat, radius_km } = forecast

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
      id: forecast.id,
      confidence: forecast.confidence,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  }
}

export default function OptimizedAIForecastLayer({
  forecasts,
  visible = true,
  onForecastClick,
}: OptimizedAIForecastLayerProps) {
  const { current: map } = useMap()
  const [selectedForecast, setSelectedForecast] = useState<AIForecast | null>(null)
  const [showDataSources, setShowDataSources] = useState(false)

  // Memoized GeoJSON for forecast circles
  const circlesGeoJSON = useMemo(() => {
    const features = forecasts
      .filter((f) => f.radius_km)
      .map((f) => createForecastCircle(f))
      .filter(Boolean)

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [forecasts])

  // Memoized GeoJSON for forecast points
  const pointsGeoJSON = useMemo(() => {
    const features = forecasts.map((f) => ({
      type: 'Feature' as const,
      properties: {
        id: f.id,
        confidence: f.confidence,
        confidenceLabel: `${Math.round(f.confidence * 100)}%`,
        severity: f.severity,
        // Sort by confidence (higher on top)
        sortKey: 1 - f.confidence,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [f.lon, f.lat],
      },
    }))

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [forecasts])

  // Handle click on forecast marker
  const handleLayerClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const forecastId = feature.properties?.id

      if (forecastId) {
        const forecast = forecasts.find((f) => f.id === forecastId)
        if (forecast) {
          if (selectedForecast?.id === forecast.id) {
            setSelectedForecast(null)
          } else {
            setSelectedForecast(forecast)
            setShowDataSources(false)
            onForecastClick?.(forecast)
          }
        }
      }
    },
    [forecasts, selectedForecast, onForecastClick]
  )

  // Set up click handlers
  useEffect(() => {
    if (!map) return

    const layerIds = ['ai-forecast-points-outer', 'ai-forecast-points-label']

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

  if (forecasts.length === 0 || !visible) return null

  return (
    <>
      {/* Forecast radius circles */}
      {circlesGeoJSON.features.length > 0 && (
        <Source id="ai-forecast-circles" type="geojson" data={circlesGeoJSON}>
          <Layer
            id="ai-forecast-circles-fill"
            type="fill"
            paint={{
              'fill-color': AI_FORECAST_COLORS.primary,
              'fill-opacity': ['*', ['get', 'confidence'], 0.4],
            }}
          />
          <Layer
            id="ai-forecast-circles-border"
            type="line"
            paint={{
              'line-color': AI_FORECAST_COLORS.primary,
              'line-width': 2,
              'line-dasharray': [3, 2],
              'line-opacity': 0.8,
            }}
          />
        </Source>
      )}

      {/* Forecast point markers - Symbol Layer */}
      <Source id="ai-forecast-points" type="geojson" data={pointsGeoJSON}>
        {/* Glow effect */}
        <Layer
          id="ai-forecast-points-glow"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 14,
              14, 22,
            ],
            'circle-color': AI_FORECAST_COLORS.primary,
            'circle-opacity': 0.2,
            'circle-blur': 0.5,
          }}
        />

        {/* Main circle with gradient effect */}
        <Layer
          id="ai-forecast-points-outer"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 10,
              14, 18,
            ],
            'circle-color': AI_FORECAST_COLORS.primary,
            'circle-stroke-color': AI_FORECAST_COLORS.border,
            'circle-stroke-width': 2,
          }}
        />

        {/* Confidence percentage label */}
        <Layer
          id="ai-forecast-points-label"
          type="symbol"
          layout={{
            'text-field': ['get', 'confidenceLabel'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 9,
              14, 12,
            ],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'symbol-sort-key': ['get', 'sortKey'],
          }}
          paint={{
            'text-color': '#ffffff',
          }}
        />
      </Source>

      {/* React Popup - only rendered when a forecast is selected */}
      {selectedForecast && (
        <Popup
          longitude={selectedForecast.lon}
          latitude={selectedForecast.lat}
          anchor="bottom"
          onClose={() => setSelectedForecast(null)}
          closeButton={false}
          closeOnClick={true}
          className="modern-popup ai-forecast-popup"
        >
          <div className="p-3 sm:p-4 min-w-[240px] sm:min-w-[300px] max-w-[260px] sm:max-w-[380px]">
            {/* Header */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5">
                  <Bot className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base text-neutral-700 dark:text-neutral-400">
                    Dự báo AI – {HAZARD_TYPE_LABELS[selectedForecast.type]}
                  </h3>
                </div>
              </div>

              <div className="text-xs text-neutral-700 mb-2">
                Khung thời gian:{' '}
                {new Date(selectedForecast.forecast_time).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' – '}
                {new Date(selectedForecast.valid_until).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>

              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
                style={{ backgroundColor: SEVERITY_COLORS[selectedForecast.severity] }}
              >
                Rủi ro:{' '}
                {selectedForecast.severity === 'critical'
                  ? 'Rất cao'
                  : selectedForecast.severity === 'high'
                    ? 'Cao'
                    : selectedForecast.severity === 'medium'
                      ? 'Trung bình'
                      : 'Thấp'}
              </span>
            </div>

            {/* AI Summary */}
            {selectedForecast.summary && (
              <div className="mb-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <h4 className="text-sm font-semibold text-neutral-900 mb-1.5">
                  Nội dung dự báo (AI)
                </h4>
                <p className="text-sm text-neutral-700 leading-relaxed break-words">
                  {selectedForecast.summary}
                </p>
              </div>
            )}

            {/* Confidence Meter */}
            <div className="mb-3 pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-1.5 mb-2">
                <span>⏱️</span>
                <span className="text-xs text-neutral-700">
                  Dự báo:{' '}
                  {new Date(selectedForecast.forecast_time).toLocaleString('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              <div className="mb-1.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-700">Độ tin cậy</span>
                  <span className="font-bold" style={{ color: AI_FORECAST_COLORS.dark }}>
                    {Math.round(selectedForecast.confidence * 100)}% (
                    {getConfidenceLevel(selectedForecast.confidence)})
                  </span>
                </div>
                <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${selectedForecast.confidence * 100}%`,
                      backgroundColor: AI_FORECAST_COLORS.primary,
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-neutral-700 italic">
                Ước tính dựa trên mô hình kết hợp dữ liệu mưa, mực nước và lịch sử.
              </p>
            </div>

            {/* Data Sources (Collapsible) */}
            <div className="mb-3">
              <button
                onClick={() => setShowDataSources(!showDataSources)}
                className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 hover:text-neutral-700 transition-colors w-full"
              >
                <span>{showDataSources ? '▾' : '▸'}</span>
                <span>Nguồn dữ liệu sử dụng</span>
                {selectedForecast.data_sources && (
                  <span className="text-xs text-neutral-500">
                    ({selectedForecast.data_sources.length})
                  </span>
                )}
              </button>

              {showDataSources && (
                <ul className="mt-2 space-y-1 text-xs text-neutral-700 max-h-32 overflow-y-auto">
                  {selectedForecast.data_sources && selectedForecast.data_sources.length > 0 ? (
                    selectedForecast.data_sources.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-neutral-400">•</span>
                        <span>{source}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-neutral-400 italic">Không có thông tin nguồn dữ liệu</li>
                  )}
                </ul>
              )}
            </div>

            {/* Additional Info */}
            <div className="text-xs text-neutral-700 space-y-1.5">
              {selectedForecast.radius_km && (
                <div className="flex items-center gap-1.5">
                  <span>📍</span>
                  <span>
                    Bán kính dự báo: <strong>{selectedForecast.radius_km} km</strong>
                  </span>
                </div>
              )}

              {selectedForecast.predicted_duration_hours && (
                <div className="flex items-center gap-1.5">
                  <span>⏲️</span>
                  <span>
                    Dự kiến kéo dài: <strong>{selectedForecast.predicted_duration_hours} giờ</strong>
                  </span>
                </div>
              )}

              {selectedForecast.distance_km !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span>📏</span>
                  <span>
                    Cách bạn: <strong>{selectedForecast.distance_km.toFixed(1)} km</strong>
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-200">
                <span>🤖</span>
                <span className="text-xs text-neutral-500">
                  Model: {selectedForecast.model_name} v{selectedForecast.model_version}
                </span>
              </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}
