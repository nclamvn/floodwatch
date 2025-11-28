'use client'

import {
  Layers,
  MapPin,
  CloudRain,
  Waves,
  Mountain,
  Dam,
  Wind,
  Construction,
  Siren
} from 'lucide-react'

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
    { key: 'reports' as keyof LayerVisibility, Icon: MapPin, label: 'Báo cáo cộng đồng', color: 'text-neutral-600' },
    { key: 'heavyRain' as keyof LayerVisibility, Icon: CloudRain, label: 'Mưa lớn', color: 'text-neutral-500' },
    { key: 'flood' as keyof LayerVisibility, Icon: Waves, label: 'Lũ lụt', color: 'text-red-600' },
    { key: 'landslide' as keyof LayerVisibility, Icon: Mountain, label: 'Sạt lở', color: 'text-orange-600' },
    { key: 'damRelease' as keyof LayerVisibility, Icon: Dam, label: 'Xả đập', color: 'text-neutral-600' },
    { key: 'storm' as keyof LayerVisibility, Icon: Wind, label: 'Bão', color: 'text-gray-700' },
    { key: 'tideSurge' as keyof LayerVisibility, Icon: Waves, label: 'Triều cường', color: 'text-cyan-600' },
    { key: 'traffic' as keyof LayerVisibility, Icon: Construction, label: 'Giao thông chia cắt', color: 'text-amber-600' },
    { key: 'distress' as keyof LayerVisibility, Icon: Siren, label: 'Cứu hộ khẩn cấp', color: 'text-red-700' },
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
    <div className="absolute top-20 left-4 z-40 w-[calc(100vw-32px)] sm:w-72 max-w-72 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md rounded-lg shadow-sm border border-white/30 dark:border-neutral-700/30 overflow-hidden">
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
          className="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-neutral-100/80 dark:bg-neutral-900/20 hover:bg-neutral-200/80 dark:hover:bg-neutral-900/30 rounded-md text-sm font-medium text-neutral-800 dark:text-neutral-400 transition-colors flex items-center justify-between"
        >
          <span>{Object.values(visibility).every(v => v) ? 'Tắt tất cả' : 'Bật tất cả'}</span>
          <span>{Object.values(visibility).filter(v => v).length}/{layers.length}</span>
        </button>

        {/* Individual Layers */}
        {layers.map(layer => {
          const IconComponent = layer.Icon
          return (
            <label
              key={layer.key}
              className="flex items-center gap-2 p-2.5 sm:p-2 min-h-[44px] sm:min-h-0 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-900/50 cursor-pointer transition-colors group"
            >
              <input
                type="checkbox"
                checked={visibility[layer.key]}
                onChange={() => toggleLayer(layer.key)}
                className="w-4 h-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500 focus:ring-offset-0"
              />
              <IconComponent className={`w-4 h-4 ${visibility[layer.key] ? layer.color : 'text-gray-400'}`} />
              <span className={`text-sm font-medium flex-1 ${visibility[layer.key] ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-700 dark:text-neutral-200'}`}>
                {layer.label}
              </span>
              {visibility[layer.key] && (
                <div className={`w-2 h-2 rounded-full ${layer.color === 'text-red-600' ? 'bg-red-600' : layer.color === 'text-neutral-500' ? 'bg-neutral-500' : layer.color === 'text-orange-600' ? 'bg-orange-600' : layer.color === 'text-neutral-600' ? 'bg-neutral-600' : layer.color === 'text-cyan-600' ? 'bg-cyan-600' : layer.color === 'text-amber-600' ? 'bg-amber-600' : 'bg-gray-600'}`} />
              )}
            </label>
          )
        })}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-900/50 border-t border-slate-200/50 dark:border-neutral-700/50">
        <p className="text-xs text-slate-700 dark:text-neutral-200">
          {Object.values(visibility).filter(v => v).length} lớp đang hiển thị
        </p>
      </div>
    </div>
  )
}
