'use client'

import React, { useEffect, useRef, useState } from 'react'
import Map, { Marker, Popup, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import { getMapConfig, getStyleUrlWithToken, getCurrentProvider } from '@/lib/mapProvider'

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
}

export default function MapView({ reports }: MapViewProps) {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [viewState, setViewState] = useState({
    longitude: 107.5,
    latitude: 16.5,
    zoom: 7
  })

  // Get map configuration from abstraction layer
  const mapConfig = getMapConfig()
  const mapStyleUrl = getStyleUrlWithToken()
  const currentProvider = getCurrentProvider()

  // If no map provider token, show instructions
  if (!mapConfig.accessToken || mapConfig.accessToken === '') {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-2xl p-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">⚠️ Cần Map API Key</h2>
          <p className="mb-4">
            Provider hiện tại: <strong>{currentProvider === 'mapbox' ? 'Mapbox' : 'Goong Maps'}</strong>
          </p>

          {currentProvider === 'mapbox' ? (
            <>
              <p className="mb-4">Để hiển thị bản đồ Mapbox:</p>
              <ol className="list-decimal list-inside space-y-2 mb-4 text-sm">
                <li>Truy cập: <a href="https://account.mapbox.com/auth/signup" target="_blank" className="text-neutral-600 underline">Mapbox Signup</a></li>
                <li>Đăng ký miễn phí (50,000 lượt tải/tháng)</li>
                <li>Lấy token → Thêm vào <code className="bg-gray-100 px-1">.env</code>:</li>
              </ol>
              <pre className="bg-gray-900 text-green-400 p-4 rounded mb-4 text-sm">
                NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
              </pre>
            </>
          ) : (
            <>
              <p className="mb-4">Để hiển thị bản đồ Goong Maps:</p>
              <ol className="list-decimal list-inside space-y-2 mb-4 text-sm">
                <li>Truy cập: <a href="https://goong.io" target="_blank" className="text-neutral-600 underline">Goong.io</a></li>
                <li>Đăng ký (cần 24h approve)</li>
                <li>Lấy API key → Thêm vào <code className="bg-gray-100 px-1">.env</code>:</li>
              </ol>
              <pre className="bg-gray-900 text-green-400 p-4 rounded mb-4 text-sm">
                NEXT_PUBLIC_GOONG_API_KEY=your_key_here
              </pre>
            </>
          )}

          <p className="text-sm text-gray-600">
            Sau đó restart: <code className="bg-gray-100 px-1">docker compose restart web</code>
          </p>
        </div>
      </div>
    )
  }

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'ALERT': return '#EF4444' // red
      case 'SOS': return '#F59E0B' // orange
      case 'ROAD': return '#FBBF24' // yellow
      case 'NEEDS': return '#3B82F6' // blue
      default: return '#6B7280' // gray
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

  return (
    <Map
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyleUrl}
    >
      <NavigationControl position="top-right" />
      <ScaleControl />

      {/* Render markers */}
      {reports
        .filter(r => r.lat && r.lon)
        .map((report) => (
          <Marker
            key={report.id}
            longitude={report.lon!}
            latitude={report.lat!}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              setSelectedReport(report)
            }}
          >
            <div
              className="cursor-pointer transform hover:scale-110 transition"
              style={{
                fontSize: '24px',
                filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))`
              }}
            >
              {getMarkerEmoji(report.type)}
            </div>
          </Marker>
        ))}

      {/* Popup for selected marker */}
      {selectedReport && selectedReport.lat && selectedReport.lon && (
        <Popup
          longitude={selectedReport.lon}
          latitude={selectedReport.lat}
          anchor="top"
          onClose={() => setSelectedReport(null)}
          closeButton={true}
          closeOnClick={false}
        >
          <div className="p-2 max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 text-xs rounded ${
                selectedReport.type === 'ALERT' ? 'bg-red-100 text-red-800' :
                selectedReport.type === 'SOS' ? 'bg-orange-100 text-orange-800' :
                selectedReport.type === 'ROAD' ? 'bg-yellow-100 text-yellow-800' :
                'bg-neutral-100 text-neutral-800'
              }`}>
                {selectedReport.type}
              </span>
              <span className="text-xs text-gray-500">
                Trust: {(selectedReport.trust_score * 100).toFixed(0)}%
              </span>
            </div>
            <h3 className="font-semibold mb-1">{selectedReport.title}</h3>
            {selectedReport.description && (
              <p className="text-sm text-gray-600 mb-2">{selectedReport.description}</p>
            )}
            <div className="text-xs text-gray-500">
              <div>📍 {selectedReport.province || 'Không rõ'}</div>
              <div>🕒 {new Date(selectedReport.created_at).toLocaleString('vi-VN')}</div>
            </div>
          </div>
        </Popup>
      )}
    </Map>
  )
}
