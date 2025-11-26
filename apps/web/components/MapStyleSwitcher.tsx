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
              'rounded-full w-9 h-9 p-0 text-[10px] font-semibold transition-all duration-200 flex items-center justify-center shadow-sm backdrop-blur-md border ' +
              (opt.id === value
                ? 'bg-neutral-600 hover:bg-neutral-700 text-white border-neutral-500'
                : 'bg-white/80 hover:bg-white/95 text-gray-900 hover:text-black border-white/30 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700/90 dark:border-white/10')
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
