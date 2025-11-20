'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'

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
        return 'bg-green-100 text-green-800'
      case 'CLOSED':
        return 'bg-red-100 text-red-800'
      case 'RESTRICTED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return '✅'
      case 'CLOSED':
        return '🚫'
      case 'RESTRICTED':
        return '⚠️'
      default:
        return '❓'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow header-light">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">🛣️ Tuyến đường An toàn</h1>
            <div className="flex gap-4">
              <Link href="/map" className="text-blue-600 hover:underline">
                Xem bản đồ
              </Link>
              <Link href="/" className="text-blue-600 hover:underline">
                Trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-4 mb-6 header-light">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tỉnh/Thành phố</label>
              <select
                value={filterProvince}
                onChange={(e) => setFilterProvince(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {provinces.map(p => (
                  <option key={p} value={p}>{p === 'ALL' ? 'Tất cả' : p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Trạng thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="OPEN">✅ Thông thoáng</option>
                <option value="RESTRICTED">⚠️ Hạn chế</option>
                <option value="CLOSED">🚫 Đóng/Chia cắt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Đang tải dữ liệu...</div>
          </div>
        ) : roads.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 text-lg">Không có dữ liệu</div>
            <p className="text-sm text-gray-500 mt-2">
              Thử thay đổi bộ lọc hoặc quay lại sau
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Tìm thấy <strong>{roads.length}</strong> tuyến đường
            </div>

            <div className="space-y-4">
              {roads.map((road) => (
                <div
                  key={road.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">
                        {road.segment_name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>📍 {road.province || 'Không rõ'}</span>
                        {road.district && <span>• {road.district}</span>}
                      </div>
                    </div>

                    <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${getStatusBadge(road.status)}`}>
                      {getStatusIcon(road.status)} {road.status}
                    </span>
                  </div>

                  {road.reason && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm">
                        <strong>Lý do:</strong> {road.reason}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
                    <div className="flex items-center gap-4">
                      <span>🔍 Nguồn: {road.source}</span>
                      {road.last_verified && (
                        <span>
                          🕒 Cập nhật: {new Date(road.last_verified).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>

                    {road.lat && road.lon && (
                      <Link
                        href={`/map?lat=${road.lat}&lon=${road.lon}&zoom=12`}
                        className="text-blue-600 hover:underline"
                      >
                        Xem trên bản đồ →
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
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold mb-2">ℹ️ Lưu ý</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Thông tin được cập nhật tự động từ báo chí và cộng đồng</li>
            <li>• Kiểm tra lại tình hình thực tế trước khi di chuyển</li>
            <li>• Gọi 113/114 để biết thông tin chính xác nhất</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
