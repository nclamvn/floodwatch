'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { MapPin, Route, HandHeart, Bell, Navigation, Users } from 'lucide-react'
import DarkModeToggle from '@/components/DarkModeToggle'

// Dynamic import for client-side rain effect
const RainEffect = dynamic(() => import('@/components/RainEffect'), {
  ssr: false,
})

export default function Home() {
  return (
    <main className="relative min-h-screen bg-white dark:bg-neutral-950 overflow-hidden">
      {/* Rain Effect Background */}
      <RainEffect />

      {/* Subtle Professional Background - Light */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950" />

      {/* Subtle Grid Pattern for Professional Feel */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
        backgroundSize: '64px 64px'
      }} />

      {/* Main Content - lifted up by 48px from center */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-32" style={{ marginTop: '-48px' }}>
        <div className="w-full max-w-7xl space-y-16">

          {/* Hero Section - Professional & Serious */}
          <div className="text-center space-y-10">

            {/* Professional Badge with Theme Toggle */}
            <div className="inline-flex items-center gap-2.5 pl-2 pr-5 py-1.5 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-slate-200 dark:border-neutral-800 shadow-sm">
              <DarkModeToggle />
              <span className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                Hệ thống Giám sát Thời gian Thực
              </span>
            </div>

            {/* Hero Title - Professional Typography */}
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-8xl md:text-9xl font-bold tracking-tight leading-[0.9] text-slate-900 dark:text-white">
                Thông tin<br />mưa lũ
              </h1>

              {/* Simple Underline - Minimal */}
              <div className="flex justify-center">
                <div className="h-1 w-24 bg-slate-900 dark:bg-white rounded-full" />
              </div>
            </div>

            {/* Subtitle - Clear & Direct */}
            <p className="text-base sm:text-xl md:text-2xl text-slate-600 dark:text-neutral-400 max-w-3xl mx-auto leading-relaxed font-light">
              Cảnh báo mưa lũ từ KTTV và cộng đồng.
              <br />
              Cập nhật giao thông. Kết nối cứu trợ.
            </p>
          </div>

          {/* Feature Cards - Professional & Clean */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Map Card - Minimal Blue */}
            <Link
              href="/map"
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 p-10 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Subtle Gradient on Hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-100/0 dark:from-blue-950/0 dark:to-blue-900/0 group-hover:from-blue-50/50 group-hover:to-blue-100/30 dark:group-hover:from-blue-950/20 dark:group-hover:to-blue-900/10 transition-all duration-500" />

              <div className="relative space-y-6 z-10">
                {/* Icon + Title - Same Row */}
                <div className="flex items-center gap-4">
                  <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-all duration-500">
                    <MapPin className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white">
                    Bản đồ
                  </h3>
                </div>

                <p className="text-slate-600 dark:text-neutral-400 text-base leading-relaxed">
                  Theo dõi mưa lũ và cảnh báo nguy hiểm trên bản đồ thời gian thực
                </p>

                {/* Simple Arrow */}
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                  <span>Xem bản đồ</span>
                  <svg
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Routes Card - Minimal Green */}
            <Link
              href="/routes"
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 p-10 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-green-100/0 dark:from-emerald-950/0 dark:to-green-900/0 group-hover:from-emerald-50/50 group-hover:to-green-100/30 dark:group-hover:from-emerald-950/20 dark:group-hover:to-green-900/10 transition-all duration-500" />

              <div className="relative space-y-6 z-10">
                {/* Icon + Title - Same Row */}
                <div className="flex items-center gap-4">
                  <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-all duration-500">
                    <Route className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white">
                    Tuyến đường
                  </h3>
                </div>

                <p className="text-slate-600 dark:text-neutral-400 text-base leading-relaxed">
                  Tìm tuyến đường an toàn, tránh vùng ngập lụt và sạt lở
                </p>

                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                  <span>Tìm đường</span>
                  <svg
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Help Card - Minimal Red */}
            <Link
              href="/help"
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 p-10 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 md:col-span-2 lg:col-span-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-rose-100/0 dark:from-red-950/0 dark:to-rose-900/0 group-hover:from-red-50/50 group-hover:to-rose-100/30 dark:group-hover:from-red-950/20 dark:group-hover:to-rose-900/10 transition-all duration-500" />

              <div className="relative space-y-6 z-10">
                {/* Icon + Title - Same Row */}
                <div className="flex items-center gap-4">
                  <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 group-hover:text-red-700 dark:group-hover:text-red-400 transition-all duration-500">
                    <HandHeart className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white">
                    Cứu trợ
                  </h3>
                </div>

                <p className="text-slate-600 dark:text-neutral-400 text-base leading-relaxed">
                  Kết nối người cần giúp đỡ với đội cứu hộ và tình nguyện viên
                </p>

                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                  <span>Kết nối</span>
                  <svg
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          {/* Features Grid - Professional & Minimal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center space-y-4">
              <div className="inline-flex p-5 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                <Bell className="w-10 h-10" strokeWidth={1.5} />
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">Cảnh báo Realtime</h4>
              <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">
                Nhận thông tin cập nhật liên tục từ KTTV
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex p-5 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                <Navigation className="w-10 h-10" strokeWidth={1.5} />
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">Định vị chính xác</h4>
              <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">
                Theo dõi vị trí thời gian thực độ chính xác cao
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex p-5 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                <Users className="w-10 h-10" strokeWidth={1.5} />
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">Cộng đồng</h4>
              <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">
                Kết nối người dân địa phương chia sẻ thông tin
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
