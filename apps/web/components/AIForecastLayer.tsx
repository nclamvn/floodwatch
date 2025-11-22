'use client'

import React, { useMemo, useState } from 'react'
import { Source, Layer, Marker, Popup } from 'react-map-gl/maplibre'
import { Bot } from 'lucide-react'
import { AIForecast, AI_FORECAST_COLORS, getConfidenceLevel, getConfidenceColor } from '@/types/aiForecast'
import { HAZARD_TYPE_LABELS, HAZARD_TYPE_ICONS } from '@/types/hazard'

interface AIForecastLayerProps {
  forecasts: AIForecast[]
  visible?: boolean
  onForecastClick?: (forecast: AIForecast) => void
}

/**
 * Severity color mapping (same as HazardLayer for consistency)
 */
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#FBBF24',
  low: '#22C55E',
  info: '#3B82F6',
}

/**
 * Generate a circle polygon GeoJSON for AI forecast
 */
function createForecastCircle(forecast: AIForecast, points: number = 64) {
  if (!forecast.radius_km) return null

  const coords: number[][] = []
  const { lon, lat, radius_km } = forecast

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
      id: forecast.id,
      type: forecast.type,
      severity: forecast.severity,
      confidence: forecast.confidence,
      forecast_time: forecast.forecast_time,
      valid_until: forecast.valid_until,
      model_name: forecast.model_name,
      distance_km: forecast.distance_km,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  }
}

/**
 * AIForecastLayer Component
 *
 * Renders AI/ML forecast events on the map with distinct purple styling to differentiate
 * from real hazard events. Features include:
 * - Purple color scheme (#8B5CF6)
 * - Dashed borders (forecasts are uncertain)
 * - Opacity based on confidence score
 * - Crystal ball icon (🔮)
 * - Detailed popup with confidence meter and data sources
 */
export default function AIForecastLayer({ forecasts, visible = true, onForecastClick }: AIForecastLayerProps) {
  const [selectedForecast, setSelectedForecast] = useState<AIForecast | null>(null)
  const [showDataSources, setShowDataSources] = useState(false)

  // Generate GeoJSON for forecast circles (affected area)
  const forecastCirclesGeoJSON = useMemo(() => {
    const features = forecasts
      .filter((f) => f.radius_km)
      .map((f) => createForecastCircle(f))
      .filter((f) => f !== null)

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [forecasts])

  // Debug logging
  console.log('🔮 AI Forecast Layer:', {
    forecastCount: forecasts.length,
    visible,
    willRender: forecasts.length > 0 && visible
  })

  if (forecasts.length === 0 || !visible) return null

  return (
    <>
      {/* Forecast circles (affected area) - rendered underneath markers */}
      {forecastCirclesGeoJSON.features.length > 0 && (
        <Source id="ai-forecast-circles" type="geojson" data={forecastCirclesGeoJSON}>
          {/* Fill layer with opacity based on confidence */}
          <Layer
            id="ai-forecast-circles-fill"
            type="fill"
            paint={{
              'fill-color': AI_FORECAST_COLORS.primary, // Purple
              'fill-opacity': [
                // Opacity scales with confidence: 0.6 conf = 24%, 1.0 conf = 40%
                '*',
                ['get', 'confidence'],
                0.4,
              ],
            }}
          />
          {/* Dashed border (forecasts are uncertain) */}
          <Layer
            id="ai-forecast-circles-border"
            type="line"
            paint={{
              'line-color': AI_FORECAST_COLORS.primary,
              'line-width': 2,
              'line-dasharray': [3, 2], // Dashed line
              'line-opacity': 0.8,
            }}
          />
        </Source>
      )}

      {/* Interactive Forecast Markers */}
      {forecasts.map((forecast) => (
        <Marker
          key={forecast.id}
          longitude={forecast.lon}
          latitude={forecast.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation()
            setSelectedForecast(forecast)
            setShowDataSources(false) // Reset on new selection
            onForecastClick?.(forecast)
          }}
        >
          <div className="cursor-pointer transform hover:scale-125 transition-all duration-200">
            {/* Glow effect */}
            <div
              className="absolute -inset-3 rounded-full animate-pulse"
              style={{
                backgroundColor: AI_FORECAST_COLORS.primary,
                opacity: 0.2,
              }}
            />
            {/* Icon container - Display confidence % directly on purple circle */}
            <div
              className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${AI_FORECAST_COLORS.primary}, ${AI_FORECAST_COLORS.light})`,
                boxShadow: `0 4px 12px ${AI_FORECAST_COLORS.primary}66`,
                border: `2px solid ${AI_FORECAST_COLORS.border}`,
              }}
            >
              {/* Confidence percentage displayed directly on circle */}
              <span className="text-white text-xs font-bold">
                {Math.round(forecast.confidence * 100)}%
              </span>
            </div>
          </div>
        </Marker>
      ))}

      {/* Detailed Popup - Following UI Spec */}
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
            {/* Header - UI Spec Section 3.3.1 */}
            <div className="mb-3">
              {/* Title Line */}
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5">
                  <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base text-purple-700 dark:text-purple-400">
                    Dự báo AI – {HAZARD_TYPE_LABELS[selectedForecast.type]}
                  </h3>
                </div>
              </div>

              {/* Time & Risk Badge */}
              <div className="text-xs text-neutral-600 mb-2">
                Khung thời gian: {new Date(selectedForecast.forecast_time).toLocaleString('vi-VN', {
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
                Rủi ro: {selectedForecast.severity === 'critical' ? 'Rất cao' :
                         selectedForecast.severity === 'high' ? 'Cao' :
                         selectedForecast.severity === 'medium' ? 'Trung bình' : 'Thấp'}
              </span>
            </div>

            {/* AI Summary - UI Spec Section 3.3.2 */}
            {selectedForecast.summary && (
              <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="text-sm font-semibold text-purple-900 mb-1.5">Nội dung dự báo (AI)</h4>
                <p className="text-sm text-neutral-700 leading-relaxed break-words overflow-wrap-break-word">
                  {selectedForecast.summary}
                </p>
              </div>
            )}

            {/* Confidence Meter - UI Spec Section 3.3.3 */}
            <div className="mb-3 pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-1.5 mb-2">
                <span>⏱️</span>
                <span className="text-xs text-neutral-600">
                  Dự báo: {new Date(selectedForecast.forecast_time).toLocaleString('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              {/* Confidence Progress Bar */}
              <div className="mb-1.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-600">Độ tin cậy</span>
                  <span className="font-bold" style={{ color: AI_FORECAST_COLORS.dark }}>
                    {Math.round(selectedForecast.confidence * 100)}% ({getConfidenceLevel(selectedForecast.confidence)})
                  </span>
                </div>
                {/* Progress bar */}
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

              <p className="text-xs text-neutral-500 italic">
                Ước tính dựa trên mô hình kết hợp dữ liệu mưa, mực nước và lịch sử.
              </p>
            </div>

            {/* Data Sources - UI Spec Section 3.3.4 (Collapsible) */}
            <div className="mb-3">
              <button
                onClick={() => setShowDataSources(!showDataSources)}
                className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 hover:text-purple-700 transition-colors w-full"
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
                <ul className="mt-2 space-y-1 text-xs text-neutral-600 max-h-32 overflow-y-auto">
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
            <div className="text-xs text-neutral-600 space-y-1.5">
              {selectedForecast.radius_km && (
                <div className="flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Bán kính dự báo: <strong>{selectedForecast.radius_km} km</strong></span>
                </div>
              )}

              {selectedForecast.predicted_duration_hours && (
                <div className="flex items-center gap-1.5">
                  <span>⏲️</span>
                  <span>Dự kiến kéo dài: <strong>{selectedForecast.predicted_duration_hours} giờ</strong></span>
                </div>
              )}

              {selectedForecast.distance_km !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span>📏</span>
                  <span>Cách bạn: <strong>{selectedForecast.distance_km.toFixed(1)} km</strong></span>
                </div>
              )}

              {/* AI Model Info */}
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
