'use client'

/**
 * Emergency Hotline Bar
 * Displays critical emergency numbers for disaster response
 * Positioned above the news ticker at the bottom of the screen
 */

export function EmergencyHotline() {
  const emergencyNumbers = [
    { label: 'Cứu Nạn', number: '112', icon: '🆘' },
    { label: 'Cứu Hỏa', number: '114', icon: '🔥' },
    { label: 'Cấp Cứu', number: '115', icon: '🚑' },
  ]

  const handleCall = (number: string) => {
    // On mobile devices, initiate phone call
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
      window.location.href = `tel:${number}`
    }
  }

  return (
    <div className="fixed bottom-[24px] left-0 right-0 z-[35] h-5">
      {/* Yellow/Amber gradient background for emergency visibility */}
      <div className="relative h-full w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500 border-t border-yellow-400/30 shadow-lg">
        {/* Content container */}
        <div className="flex items-center justify-center h-full px-4">
          {/* Pulsing emergency icon */}
          <div className="flex items-center gap-1.5 mr-3">
            <span className="text-xs animate-pulse">🚨</span>
            <span className="text-[10px] font-bold text-white uppercase tracking-wider hidden sm:inline">
              KHẨN CẤP
            </span>
          </div>

          {/* Emergency numbers */}
          <div className="flex items-center gap-2 sm:gap-4">
            {emergencyNumbers.map((item, index) => (
              <button
                key={item.number}
                onClick={() => handleCall(item.number)}
                className="group flex items-center gap-1 hover:scale-105 transition-transform cursor-pointer active:scale-95"
                aria-label={`Gọi ${item.label}: ${item.number}`}
              >
                {/* Desktop: Full label */}
                <span className="hidden sm:inline text-[10px] font-semibold text-white/90 group-hover:text-white">
                  {item.label}:
                </span>

                {/* Number - always visible */}
                <span className="text-xs font-bold text-white group-hover:underline">
                  {item.number}
                </span>

                {/* Separator dot (except last item) */}
                {index < emergencyNumbers.length - 1 && (
                  <span className="text-white/60 text-xs ml-1 hidden sm:inline">•</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      </div>

      {/* Mobile responsive: Show icon + numbers only, hide labels */}
      <style jsx>{`
        @media (max-width: 640px) {
          button {
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  )
}
