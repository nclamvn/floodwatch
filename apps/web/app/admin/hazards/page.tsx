'use client'

import { useState, useEffect } from 'react'
import { HazardEvent, HazardType, SeverityLevel, HAZARD_TYPE_LABELS, SEVERITY_LEVEL_LABELS } from '@/types/hazard'

interface HazardFormData {
  type: HazardType
  severity: SeverityLevel
  lat: number
  lon: number
  radius_km: number
  starts_at: string
  ends_at: string | null
  source: string
  description?: string
}

export default function HazardsAdminPage() {
  const [hazards, setHazards] = useState<HazardEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingHazard, setEditingHazard] = useState<HazardEvent | null>(null)

  // Form state
  const [formData, setFormData] = useState<HazardFormData>({
    type: 'flood',
    severity: 'medium',
    lat: 21.0278,
    lon: 105.8342,
    radius_km: 10,
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString().slice(0, 16),
    source: 'manual_entry',
    description: '',
  })

  // Fetch hazards
  const fetchHazards = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/hazards?active_only=false&limit=100`)

      if (!response.ok) {
        throw new Error(`Failed to fetch hazards: ${response.statusText}`)
      }

      const data = await response.json()
      setHazards(data.data || [])
    } catch (err) {
      console.error('Error fetching hazards:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHazards()
  }, [])

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const url = editingHazard
        ? `${apiUrl}/hazards/${editingHazard.id}`
        : `${apiUrl}/hazards`

      const method = editingHazard ? 'PATCH' : 'POST'

      const payload = {
        ...formData,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Failed to ${editingHazard ? 'update' : 'create'} hazard`)
      }

      // Success - refresh list and close form
      await fetchHazards()
      setIsFormOpen(false)
      setEditingHazard(null)
      resetForm()
    } catch (err) {
      console.error('Error saving hazard:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) return

    try {
      setIsLoading(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/hazards/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete hazard')
      }

      await fetchHazards()
    } catch (err) {
      console.error('Error deleting hazard:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // Edit hazard
  const handleEdit = (hazard: HazardEvent) => {
    setEditingHazard(hazard)
    setFormData({
      type: hazard.type,
      severity: hazard.severity,
      lat: hazard.lat,
      lon: hazard.lon,
      radius_km: hazard.radius_km || 10,
      starts_at: new Date(hazard.starts_at).toISOString().slice(0, 16),
      ends_at: hazard.ends_at ? new Date(hazard.ends_at).toISOString().slice(0, 16) : null,
      source: hazard.source,
      description: '',
    })
    setIsFormOpen(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      type: 'flood',
      severity: 'medium',
      lat: 21.0278,
      lon: 105.8342,
      radius_km: 10,
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString().slice(0, 16),
      source: 'manual_entry',
      description: '',
    })
  }

  // Severity colors
  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-green-100 text-green-800 border-green-300'
      case 'info': return 'bg-neutral-100 text-neutral-800 border-neutral-300'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quản lý Sự kiện Thiên tai</h1>
              <p className="mt-1 text-sm text-gray-600">
                Tạo và quản lý các cảnh báo thiên tai (lũ, mưa, xả hồ, sạt lở, bão, triều cường)
              </p>
            </div>
            <button
              onClick={() => {
                setIsFormOpen(true)
                setEditingHazard(null)
                resetForm()
              }}
              className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium"
            >
              + Tạo sự kiện mới
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create/Edit Form */}
        {isFormOpen && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingHazard ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}
              </h2>
              <button
                onClick={() => {
                  setIsFormOpen(false)
                  setEditingHazard(null)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type & Severity Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loại thiên tai
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as HazardType })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {Object.entries(HAZARD_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mức độ nghiêm trọng
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as SeverityLevel })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {Object.entries(SEVERITY_LEVEL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location Row */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vĩ độ (Latitude)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kinh độ (Longitude)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.lon}
                    onChange={(e) => setFormData({ ...formData, lon: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bán kính (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.radius_km}
                    onChange={(e) => setFormData({ ...formData, radius_km: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Time Range Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thời gian bắt đầu
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thời gian kết thúc (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.ends_at || ''}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value || null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nguồn dữ liệu
                </label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="VD: KTTV, manual_entry, NCHMF"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ghi chú (tùy chọn)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Thông tin bổ sung về sự kiện..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Submit buttons */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Đang xử lý...' : (editingHazard ? 'Cập nhật' : 'Tạo sự kiện')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false)
                    setEditingHazard(null)
                    resetForm()
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Hazards List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Danh sách sự kiện ({hazards.length})
            </h3>
          </div>

          {isLoading && !isFormOpen ? (
            <div className="p-8 text-center text-gray-500">
              Đang tải...
            </div>
          ) : hazards.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Chưa có sự kiện nào. Tạo sự kiện đầu tiên!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mức độ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vị trí
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bán kính
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thời gian
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nguồn
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {hazards.map((hazard) => (
                    <tr key={hazard.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {HAZARD_TYPE_LABELS[hazard.type]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(hazard.severity)}`}>
                          {SEVERITY_LEVEL_LABELS[hazard.severity]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {hazard.lat.toFixed(4)}, {hazard.lon.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {hazard.radius_km} km
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(hazard.starts_at).toLocaleString('vi-VN', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {hazard.source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(hazard)}
                          className="text-neutral-600 hover:text-neutral-900 mr-4"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(hazard.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
