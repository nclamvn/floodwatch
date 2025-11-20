'use client'

import { Layers } from 'lucide-react'

export interface LayerVisibility {
  reports: boolean
  heavyRain: boolean
  flood: boolean
  landslide: boolean
  damRelease: boolean
  storm: boolean
  tideSurge: boolean
  traffic: boolean
  distress: boolean
}

interface LayerControlPanelProps {
  visibility: LayerVisibility
  onChange: (visibility: LayerVisibility) => void
}

export default function LayerControlPanel({ visibility, onChange }: LayerControlPanelProps) {
  const layers = [
    { key: 'reports' as keyof LayerVisibility, icon: '📍', label: 'Báo cáo cộng đồng', color: 'text-blue-600' },
    { key: 'heavyRain' as keyof LayerVisibility, icon: '🌧️', label: 'Mưa lớn', color: 'text-blue-500' },
    { key: 'flood' as keyof LayerVisibility, icon: '🌊', label: 'Lũ lụt', color: 'text-red-600' },
    { key: 'landslide' as keyof LayerVisibility, icon: '⛰️', label: 'Sạt lở', color: 'text-orange-600' },
    { key: 'damRelease' as keyof LayerVisibility, icon: '🏗️', label: 'Xả đập', color: 'text-purple-600' },
    { key: 'storm' as keyof LayerVisibility, icon: '🌀', label: 'Bão', color: 'text-gray-700' },
    { key: 'tideSurge' as keyof LayerVisibility, icon: '🌊', label: 'Triều cường', color: 'text-cyan-600' },
    { key: 'traffic' as keyof LayerVisibility, icon: '🚧', label: 'Giao thông chia cắt', color: 'text-amber-600' },
    { key: 'distress' as keyof LayerVisibility, icon: '🆘', label: 'Cứu hộ khẩn cấp', color: 'text-red-700' },
  ]

  const toggleLayer = (key: keyof LayerVisibility) => {
    onChange({
      ...visibility,
      [key]: !visibility[key]
    })
  }

  const toggleAll = () => {
    const allOn = Object.values(visibility).every(v => v)
    const newVisibility = Object.keys(visibility).reduce((acc, key) => ({
      ...acc,
      [key]: !allOn
    }), {} as LayerVisibility)
    onChange(newVisibility)
  }

  return (
    <div className="absolute top-20 left-4 z-40 w-72 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-lg shadow-lg border border-white/20 dark:border-neutral-700/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          <h3 className="font-bold text-sm">Lớp hiển thị</h3>
        </div>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
        {/* Toggle All */}
        <button
          onClick={toggleAll}
          className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md text-sm font-medium text-blue-700 dark:text-blue-400 transition-colors flex items-center justify-between"
        >
          <span>{Object.values(visibility).every(v => v) ? 'Tắt tất cả' : 'Bật tất cả'}</span>
          <span>{Object.values(visibility).filter(v => v).length}/{layers.length}</span>
        </button>

        {/* Individual Layers */}
        {layers.map(layer => (
          <label
            key={layer.key}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors group"
          >
            <input
              type="checkbox"
              checked={visibility[layer.key]}
              onChange={() => toggleLayer(layer.key)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-lg">{layer.icon}</span>
            <span className={`text-sm font-medium flex-1 ${visibility[layer.key] ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'}`}>
              {layer.label}
            </span>
            {visibility[layer.key] && (
              <div className={`w-2 h-2 rounded-full ${layer.color === 'text-red-600' ? 'bg-red-600' : layer.color === 'text-blue-500' ? 'bg-blue-500' : layer.color === 'text-orange-600' ? 'bg-orange-600' : layer.color === 'text-purple-600' ? 'bg-purple-600' : layer.color === 'text-cyan-600' ? 'bg-cyan-600' : layer.color === 'text-amber-600' ? 'bg-amber-600' : 'bg-gray-600'}`} />
            )}
          </label>
        ))}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200/50 dark:border-neutral-700/50">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {Object.values(visibility).filter(v => v).length} lớp đang hiển thị
        </p>
      </div>
    </div>
  )
}
