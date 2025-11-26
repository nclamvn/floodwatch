'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Route, Map, ArrowLeft, Info, Search, Loader2 } from 'lucide-react'
import DarkModeToggle from '@/components/DarkModeToggle'
import RouteCard, { RouteSegment, RouteStatus, normalizeStatus } from '@/components/RouteCard'
import RouteSummaryBar, { RouteSummary } from '@/components/RouteSummaryBar'
import RouteFilterPanel, { RouteFilters } from '@/components/RouteFilterPanel'
import RouteDetailModal from '@/components/RouteDetailModal'
import { useRoutes, DEFAULT_ROUTE_FILTERS } from '@/hooks/useRoutes'

export default function RoutesPage() {
  // Filter state
  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_ROUTE_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoute, setSelectedRoute] = useState<RouteSegment | null>(null)

  // Fetch routes with SWR
  const { routes, total, isLoading, isValidating, mutate } = useRoutes(filters, {
    refreshInterval: 30000 // 30 seconds
  })

  // Compute summary from routes
  const summary: RouteSummary | null = useMemo(() => {
    if (routes.length === 0 && isLoading) return null

    const byStatus: Record<RouteStatus, number> = {
      OPEN: 0,
      LIMITED: 0,
      DANGEROUS: 0,
      CLOSED: 0
    }

    routes.forEach(route => {
      byStatus[route.status]++
    })

    return {
      total: routes.length,
      by_status: byStatus,
      last_updated: new Date().toISOString()
    }
  }, [routes, isLoading])

  // Handle status filter from summary bar
  const handleStatusFilter = (status: RouteStatus | null) => {
    if (status === null) {
      setFilters(prev => ({ ...prev, status: [] }))
    } else {
      setFilters(prev => ({ ...prev, status: [status] }))
    }
  }

  // Filter routes by search query
  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes

    const query = searchQuery.toLowerCase()
    return routes.filter(route =>
      route.segment_name.toLowerCase().includes(query) ||
      route.province?.toLowerCase().includes(query) ||
      route.district?.toLowerCase().includes(query) ||
      route.status_reason?.toLowerCase().includes(query)
    )
  }, [routes, searchQuery])

  // Sort routes
  const sortedRoutes = useMemo(() => {
    const sorted = [...filteredRoutes]

    switch (filters.sortBy) {
      case 'risk_score':
        // Sort by risk: CLOSED > DANGEROUS > LIMITED > OPEN, then by risk_score
        sorted.sort((a, b) => {
          const statusOrder: Record<RouteStatus, number> = { CLOSED: 0, DANGEROUS: 1, LIMITED: 2, OPEN: 3 }
          const statusDiff = statusOrder[a.status] - statusOrder[b.status]
          if (statusDiff !== 0) return statusDiff
          return (b.risk_score ?? 0) - (a.risk_score ?? 0)
        })
        break

      case 'created_at':
        sorted.sort((a, b) => {
          const dateA = new Date(a.verified_at || a.created_at || 0).getTime()
          const dateB = new Date(b.verified_at || b.created_at || 0).getTime()
          return dateB - dateA
        })
        break

      case 'status':
        sorted.sort((a, b) => {
          const statusOrder: Record<RouteStatus, number> = { CLOSED: 0, DANGEROUS: 1, LIMITED: 2, OPEN: 3 }
          return statusOrder[a.status] - statusOrder[b.status]
        })
        break
    }

    return sorted
  }, [filteredRoutes, filters.sortBy])

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                aria-label="Quay lại trang chủ"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </Link>

              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                  <Route className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    Tuyến đường An toàn
                  </h1>
                  <p className="hidden sm:block text-sm text-neutral-500 dark:text-neutral-400">
                    Cập nhật tình trạng giao thông thời gian thực
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <DarkModeToggle />
              <Link
                href="/map"
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg"
              >
                <Map className="w-4 h-4" />
                Xem bản đồ
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary Bar */}
        <RouteSummaryBar
          summary={summary}
          isLoading={isLoading}
          onStatusClick={handleStatusFilter}
          activeStatus={filters.status.length === 1 ? filters.status[0] : null}
          onRefresh={() => mutate()}
        />

        {/* Filter Panel */}
        <RouteFilterPanel
          filters={filters}
          onChange={setFilters}
          isCollapsible={true}
          defaultExpanded={false}
        />

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên đường, tỉnh, quận/huyện..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
              {sortedRoutes.length} tuyến đường
            </span>
            {searchQuery && (
              <span className="text-neutral-500">
                (tìm kiếm: "{searchQuery}")
              </span>
            )}
          </div>

          {/* Loading indicator */}
          {isValidating && !isLoading && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang cập nhật...</span>
            </div>
          )}
        </div>

        {/* Routes Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-neutral-200 dark:border-neutral-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">Đang tải dữ liệu...</p>
          </div>
        ) : sortedRoutes.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-12 text-center">
            <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mb-4">
              <Route className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {searchQuery ? 'Không tìm thấy tuyến đường' : 'Tình hình giao thông ổn định'}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-500 max-w-md mx-auto">
              {searchQuery
                ? `Không có kết quả cho "${searchQuery}". Thử tìm kiếm khác hoặc xóa bộ lọc.`
                : 'Không có cảnh báo đường bộ nào được xác minh trong 3 ngày qua. Hệ thống chỉ hiển thị thông tin có nguồn kiểm chứng để đảm bảo độ tin cậy.'}
            </p>
            {(searchQuery || filters.status.length > 0 || filters.province !== 'Tất cả') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilters(DEFAULT_ROUTE_FILTERS)
                }}
                className="mt-4 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-xl transition-colors"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedRoutes.map(route => (
              <RouteCard
                key={route.id}
                route={route}
                onDetailClick={(r) => setSelectedRoute(r)}
              />
            ))}
          </div>
        )}

        {/* Warning Box */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-5 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Lưu ý quan trọng
              </h3>
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">⚠</span>
                  <span><strong>Một số tin chưa có nguồn kiểm chứng:</strong> Các thẻ có nền vàng cần được xác nhận thêm</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">⚠</span>
                  <span><strong>Chỉ hiển thị tin trong 3 ngày:</strong> Tin cũ hơn đã bị loại bỏ vì có thể không còn chính xác</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5 font-bold">!</span>
                  <span><strong>BẮT BUỘC gọi 113/114</strong> để xác nhận tình hình thực tế trước khi di chuyển vào vùng nguy hiểm</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Map FAB */}
      <Link
        href="/map"
        className="sm:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-emerald-600 dark:bg-emerald-600 text-white shadow-xl hover:scale-105 transition-transform"
        aria-label="Xem bản đồ"
      >
        <Map className="w-6 h-6" />
      </Link>

      {/* Route Detail Modal */}
      {selectedRoute && (
        <RouteDetailModal
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  )
}
