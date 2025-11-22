import Link from 'next/link'
import { MapPin, Route, HandHeart, Bell, Navigation, Users } from 'lucide-react'

export default function Home() {
  return (
    <main className="relative min-h-screen bg-white dark:bg-neutral-950">
      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-6xl space-y-16">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-neutral-800/50 text-gray-700 dark:text-neutral-300 text-sm font-medium backdrop-blur-sm border border-gray-200 dark:border-neutral-700/50">
              <Bell className="w-4 h-4" />
              Hệ thống Giám sát Thời gian Thực
            </div>

            <h1 className="text-3xl md:text-7xl font-bold bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-neutral-100 dark:via-neutral-300 dark:to-neutral-100 bg-clip-text text-transparent leading-tight">
              Theo dõi mưa lũ
            </h1>

            <p className="text-sm md:text-xl text-gray-600 dark:text-neutral-400 max-w-2xl mx-auto font-light">
              Cảnh báo mưa lũ từ KTTV và cộng đồng, cập nhật tình trạng giao thông, kết nối cứu trợ
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Map Card */}
            <Link
              href="/map"
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-gray-200 dark:border-neutral-800"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="inline-flex p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <MapPin className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-neutral-100">
                  Xem Bản đồ
                </h3>
                <p className="text-gray-600 dark:text-neutral-400 text-sm leading-relaxed">
                  Nhận cảnh báo mưa lũ từ KTTV và cộng đồng trên bản đồ thời gian thực
                </p>
                <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                  <span>Khám phá</span>
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Routes Card */}
            <Link
              href="/routes"
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-neutral-200 dark:border-neutral-800"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="inline-flex p-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                  <Route className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Tuyến đường An toàn
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                  Cập nhật tình trạng giao thông, sạt lở và tìm tuyến đường an toàn
                </p>
                <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                  <span>Tìm đường</span>
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Help Card */}
            <Link
              href="/help"
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-neutral-200 dark:border-neutral-800"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-rose-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="inline-flex p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                  <HandHeart className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Kết nối cứu trợ
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                  Chia sẻ thông tin từ người dân địa phương và kết nối hỗ trợ
                </p>
                <div className="flex items-center text-red-600 dark:text-red-400 text-sm font-medium">
                  <span>Kết nối</span>
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          {/* Feature Highlights - Hidden on mobile */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Cảnh báo Realtime</h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Nhận thông tin cập nhật liên tục</p>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                <Navigation className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Định vị chính xác</h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Theo dõi vị trí thời gian thực</p>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Cộng đồng</h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Kết nối người dân địa phương</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
