// components/MapStyleSwitcher.tsx
import { Map, Satellite, Globe, Mountain } from 'lucide-react'
import type { BaseMapStyleId } from '@/lib/mapProvider'

const OPTIONS: { id: BaseMapStyleId; label: string; shortLabel: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'streets', label: 'Đường phố', shortLabel: 'ĐP', Icon: Map },
  { id: 'hybrid', label: 'Vệ tinh + đường', shortLabel: 'VT+', Icon: Satellite },
  { id: 'satellite', label: 'Vệ tinh', shortLabel: 'VT', Icon: Globe },
  { id: 'outdoors', label: 'Địa hình', shortLabel: 'ĐH', Icon: Mountain },
]

interface Props {
  value: BaseMapStyleId
  onChange: (id: BaseMapStyleId) => void
}

export function MapStyleSwitcher({ value, onChange }: Props) {
  return (
    <div className="flex flex-row gap-2">
      {OPTIONS.map(opt => {
        const Icon = opt.Icon
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={
              'rounded-full w-9 h-9 p-0 text-[10px] font-semibold transition-all duration-200 flex items-center justify-center shadow-lg backdrop-blur-sm border ' +
              (opt.id === value
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                : 'bg-white/90 hover:bg-white text-gray-700 border-gray-200/50 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-700/50')
            }
            title={opt.label}
          >
            <Icon className="w-4 h-4" />
          </button>
        )
      })}
    </div>
  )
}
