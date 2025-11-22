'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { Route, Home, Map, MapPin, Clock, Info, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Filter, Eye } from 'lucide-react'

interface RoadEvent {
  id: string
  segment_name: string
  status: 'OPEN' | 'CLOSED' | 'RESTRICTED'
  reason?: string
  province?: string
  district?: string
  lat?: number
  lon?: number
  last_verified?: string
  source: string
}

export default function RoutesPage() {
  const [roads, setRoads] = useState<RoadEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProvince, setFilterProvince] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const provinces = [
    'ALL',
    'Quảng Bình',
    'Quảng Trị',
    'Thừa Thiên Huế',
    'Đà Nẵng',
    'Quảng Nam',
    'Quảng Ngãi'
  ]

  useEffect(() => {
    fetchRoads()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchRoads, 300000)
    return () => clearInterval(interval)
  }, [filterProvince, filterStatus])

  const fetchRoads = async () => {
    try {
      const params: any = {}
      if (filterProvince !== 'ALL') params.province = filterProvince
      if (filterStatus !== 'ALL') params.status = filterStatus

      const response = await axios.get(`${API_URL}/road-events`, { params })
      setRoads(response.data.data || [])
    } catch (error) {
      console.error('Error fetching roads:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
      case 'CLOSED':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'RESTRICTED':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <CheckCircle className="w-4 h-4" />
      case 'CLOSED':
        return <XCircle className="w-4 h-4" />
      case 'RESTRICTED':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'Thông thoáng'
      case 'CLOSED':
        return 'Đóng/Chia cắt'
      case 'RESTRICTED':
        return 'Hạn chế'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Header */}
      <div className="relative border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300">
                  <Route className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    Tuyến đường An toàn
                  </h1>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Cập nhật tình trạng giao thông thời gian thực
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/map"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-sm font-medium transition-all shadow-lg"
            >
              <Map className="w-4 h-4" />
              Xem bản đồ
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Bộ lọc</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Tỉnh/Thành phố
              </label>
              <select
                value={filterProvince}
                onChange={(e) => setFilterProvince(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:border-transparent transition-all"
              >
                {provinces.map(p => (
                  <option key={p} value={p}>{p === 'ALL' ? 'Tất cả' : p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Trạng thái
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:border-transparent transition-all"
              >
                <option value="ALL">Tất cả</option>
                <option value="OPEN">Thông thoáng</option>
                <option value="RESTRICTED">Hạn chế</option>
                <option value="CLOSED">Đóng/Chia cắt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-neutral-200 dark:border-neutral-700 border-t-neutral-900 dark:border-t-neutral-100 rounded-full animate-spin mb-4"></div>
            <div className="text-neutral-600 dark:text-neutral-400">Đang tải dữ liệu...</div>
          </div>
        ) : roads.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-12 text-center">
            <div className="inline-flex p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-4">
              <Route className="w-8 h-8" />
            </div>
            <div className="text-neutral-400 dark:text-neutral-500 text-lg font-medium mb-2">Không có dữ liệu</div>
            <p className="text-sm text-neutral-500 dark:text-neutral-600">
              Thử thay đổi bộ lọc hoặc quay lại sau
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <div className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 font-medium border border-neutral-200 dark:border-neutral-700">
                {roads.length} tuyến đường
              </div>
            </div>

            <div className="space-y-4">
              {roads.map((road) => (
                <div
                  key={road.id}
                  className="group bg-white dark:bg-neutral-900 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3 transition-colors">
                        {road.segment_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          <span>{road.province || 'Không rõ'}</span>
                        </div>
                        {road.district && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-700">•</span>
                            <span>{road.district}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${getStatusBadge(road.status)} whitespace-nowrap`}>
                      {getStatusIcon(road.status)}
                      {getStatusText(road.status)}
                    </div>
                  </div>

                  {road.reason && (
                    <div className="mb-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        <span className="font-semibold">Lý do:</span> {road.reason}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-500">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Nguồn: {road.source}</span>
                      </div>
                      {road.last_verified && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Cập nhật: {new Date(road.last_verified).toLocaleString('vi-VN')}</span>
                        </div>
                      )}
                    </div>

                    {road.lat && road.lon && (
                      <Link
                        href={`/map?lat=${road.lat}&lon=${road.lon}&zoom=12`}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                      >
                        <Map className="w-4 h-4" />
                        Xem trên bản đồ
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-6 border border-blue-200 dark:border-blue-900">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Lưu ý quan trọng</h3>
              <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Thông tin được cập nhật tự động từ báo chí và cộng đồng</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Kiểm tra lại tình hình thực tế trước khi di chuyển</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Gọi 113/114 để biết thông tin chính xác nhất</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
