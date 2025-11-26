'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  Circle,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  LogOut,
  ExternalLink,
  Users,
  HandHeart,
  ShieldCheck,
  Clock,
  X,
  Sun,
  Moon
} from 'lucide-react'
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext'
import {
  getAdminStats,
  updateHelpRequest,
  updateHelpOffer,
  bulkDelete,
  bulkVerify,
} from '@/lib/adminAuth'

// Types
interface HelpRequest {
  id: string
  needs_type: string
  urgency: string
  description: string
  people_count: number | null
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  status: string
  is_verified: boolean
  verified_at: string | null
  created_at: string
}

interface HelpOffer {
  id: string
  offer_type: string
  capacity: number | null
  description: string
  lat: number
  lon: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  availability_start: string | null
  availability_end: string | null
  is_verified: boolean
  verified_at: string | null
  created_at: string
}

interface AdminStats {
  total_requests: number
  total_offers: number
  verified_requests: number
  verified_offers: number
  pending_requests: number
  pending_offers: number
}

type TabType = 'requests' | 'offers'
type FilterType = 'all' | 'verified' | 'unverified'

// Labels
const needsTypeLabels: Record<string, string> = {
  food: 'Thực phẩm',
  water: 'Nước uống',
  shelter: 'Chỗ ở',
  medical: 'Y tế',
  clothing: 'Quần áo',
  transport: 'Di chuyển',
  other: 'Khác'
}

const offerTypeLabels: Record<string, string> = {
  food: 'Thực phẩm',
  water: 'Nước uống',
  shelter: 'Chỗ ở',
  medical: 'Y tế',
  clothing: 'Quần áo',
  transport: 'Di chuyển',
  volunteer: 'Tình nguyện',
  donation: 'Quyên góp',
  other: 'Khác'
}

const urgencyLabels: Record<string, string> = {
  critical: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp'
}

// Dashboard Content
function AdminDashboardContent() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, logout } = useAdminAuth()

  const [activeTab, setActiveTab] = useState<TabType>('requests')
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [offers, setOffers] = useState<HelpOffer[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  const [editingItem, setEditingItem] = useState<HelpRequest | HelpOffer | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // Theme state
  const [isDark, setIsDark] = useState(true)

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin-theme')
    if (savedTheme) {
      setIsDark(savedTheme === 'dark')
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }, [])

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    localStorage.setItem('admin-theme', newTheme ? 'dark' : 'light')
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/admin/rescue/login')
    }
  }, [isAuthenticated, authLoading, router])

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.thongtinmuala.live'

    try {
      const [requestsRes, offersRes, statsRes] = await Promise.all([
        fetch(`${apiUrl}/help/requests?limit=200`),
        fetch(`${apiUrl}/help/offers?limit=200`),
        getAdminStats()
      ])

      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setRequests(data.data || [])
      }

      if (offersRes.ok) {
        const data = await offersRes.json()
        setOffers(data.data || [])
      }

      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated, fetchData])

  // Filter logic
  const getFilteredRequests = (): HelpRequest[] => {
    let filtered = requests
    if (filter === 'verified') filtered = filtered.filter(item => item.is_verified)
    else if (filter === 'unverified') filtered = filtered.filter(item => !item.is_verified)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.description?.toLowerCase().includes(query) ||
        item.contact_name?.toLowerCase().includes(query) ||
        item.contact_phone?.includes(query)
      )
    }
    return filtered
  }

  const getFilteredOffers = (): HelpOffer[] => {
    let filtered = offers
    if (filter === 'verified') filtered = filtered.filter(item => item.is_verified)
    else if (filter === 'unverified') filtered = filtered.filter(item => !item.is_verified)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.description?.toLowerCase().includes(query) ||
        item.contact_name?.toLowerCase().includes(query) ||
        item.contact_phone?.includes(query)
      )
    }
    return filtered
  }

  const filteredRequests = getFilteredRequests()
  const filteredOffers = getFilteredOffers()
  const filteredItems = activeTab === 'requests' ? filteredRequests : filteredOffers

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  // Bulk actions
  const handleBulkVerify = async () => {
    if (selectedIds.size === 0) return
    setIsBulkProcessing(true)
    const result = await bulkVerify(activeTab, Array.from(selectedIds))
    if (result.success) {
      if (activeTab === 'requests') {
        setRequests(prev => prev.map(req =>
          selectedIds.has(req.id) ? { ...req, is_verified: true, verified_at: new Date().toISOString() } : req
        ))
      } else {
        setOffers(prev => prev.map(offer =>
          selectedIds.has(offer.id) ? { ...offer, is_verified: true, verified_at: new Date().toISOString() } : offer
        ))
      }
      setSelectedIds(new Set())
      const statsRes = await getAdminStats()
      if (statsRes.success && statsRes.stats) setStats(statsRes.stats)
    }
    setIsBulkProcessing(false)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Xóa ${selectedIds.size} mục đã chọn?`)) return
    setIsBulkProcessing(true)
    const result = await bulkDelete(activeTab, Array.from(selectedIds))
    if (result.success) {
      if (activeTab === 'requests') {
        setRequests(prev => prev.filter(req => !selectedIds.has(req.id)))
      } else {
        setOffers(prev => prev.filter(offer => !selectedIds.has(offer.id)))
      }
      setSelectedIds(new Set())
      const statsRes = await getAdminStats()
      if (statsRes.success && statsRes.stats) setStats(statsRes.stats)
    }
    setIsBulkProcessing(false)
  }

  // Single item actions
  const handleVerifyItem = async (item: HelpRequest | HelpOffer) => {
    const updateFn = activeTab === 'requests' ? updateHelpRequest : updateHelpOffer
    const result = await updateFn(item.id, { is_verified: !item.is_verified })
    if (result.success) {
      if (activeTab === 'requests') {
        setRequests(prev => prev.map(req =>
          req.id === item.id ? { ...req, is_verified: !req.is_verified, verified_at: !req.is_verified ? new Date().toISOString() : null } : req
        ))
      } else {
        setOffers(prev => prev.map(offer =>
          offer.id === item.id ? { ...offer, is_verified: !offer.is_verified, verified_at: !offer.is_verified ? new Date().toISOString() : null } : offer
        ))
      }
      const statsRes = await getAdminStats()
      if (statsRes.success && statsRes.stats) setStats(statsRes.stats)
    }
  }

  const handleDeleteItem = async (item: HelpRequest | HelpOffer) => {
    if (!confirm('Xóa mục này?')) return
    const result = await bulkDelete(activeTab, [item.id])
    if (result.success) {
      if (activeTab === 'requests') {
        setRequests(prev => prev.filter(req => req.id !== item.id))
      } else {
        setOffers(prev => prev.filter(offer => offer.id !== item.id))
      }
      const statsRes = await getAdminStats()
      if (statsRes.success && statsRes.stats) setStats(statsRes.stats)
    }
  }

  const handleSaveEdit = async (updatedData: {
    description?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string | null
  }) => {
    if (!editingItem) return
    const updateFn = activeTab === 'requests' ? updateHelpRequest : updateHelpOffer
    const result = await updateFn(editingItem.id, {
      description: updatedData.description,
      contact_name: updatedData.contact_name,
      contact_phone: updatedData.contact_phone,
      contact_email: updatedData.contact_email || undefined,
    })
    if (result.success) {
      if (activeTab === 'requests') {
        setRequests(prev => prev.map(req =>
          req.id === editingItem.id ? { ...req, ...updatedData } : req
        ))
      } else {
        setOffers(prev => prev.map(offer =>
          offer.id === editingItem.id ? { ...offer, ...updatedData } : offer
        ))
      }
      setShowEditModal(false)
      setEditingItem(null)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/admin/rescue/login')
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins} phút trước`
    if (diffHours < 24) return `${diffHours} giờ trước`
    if (diffDays < 7) return `${diffDays} ngày trước`
    return date.toLocaleDateString('vi-VN')
  }

  // Loading
  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${
        isDark
          ? 'bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950'
          : 'bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100'
      }`}>
        <div className={`w-6 h-6 border-2 rounded-full animate-spin ${
          isDark ? 'border-white/20 border-t-white' : 'border-neutral-400 border-t-neutral-700'
        }`} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      isDark
        ? 'bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950'
        : 'bg-neutral-100'
    }`}>
      {/* Header - Glass Effect */}
      <header className={`backdrop-blur-2xl border-b sticky top-0 z-40 transition-colors duration-500 ${
        isDark
          ? 'bg-neutral-900/80 border-neutral-800'
          : 'bg-white border-neutral-300'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Quản lý cứu trợ</h1>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>Admin Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 ${
                  isDark
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white'
                    : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link
                href="/help"
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm transition-all duration-300 ${
                  isDark
                    ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white'
                    : 'bg-white hover:bg-neutral-50 border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 shadow-sm'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                Xem trang công khai
              </Link>
              <button
                onClick={handleLogout}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm transition-all duration-300 ${
                  isDark
                    ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300'
                    : 'bg-red-50 hover:bg-red-100 border-red-300 hover:border-red-400 text-red-700 hover:text-red-800'
                }`}
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats - Glass Cards with 3D Effect */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Yêu cầu */}
            <div className={`group relative rounded-2xl p-5 border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl ${
              isDark
                ? 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 hover:shadow-red-500/5'
                : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-sm hover:shadow-red-500/10'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center mb-3">
                  <HandHeart className="w-5 h-5 text-red-500" />
                </div>
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{stats.total_requests}</p>
                <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>Yêu cầu cứu trợ</p>
              </div>
            </div>

            {/* Đề xuất */}
            <div className={`group relative rounded-2xl p-5 border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl ${
              isDark
                ? 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 hover:shadow-emerald-500/5'
                : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-sm hover:shadow-emerald-500/10'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{stats.total_offers}</p>
                <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>Đề xuất hỗ trợ</p>
              </div>
            </div>

            {/* Đã xác minh */}
            <div className={`group relative rounded-2xl p-5 border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl ${
              isDark
                ? 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 hover:shadow-blue-500/5'
                : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-sm hover:shadow-blue-500/10'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5 text-blue-500" />
                </div>
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{stats.verified_requests + stats.verified_offers}</p>
                <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>Đã xác minh</p>
              </div>
            </div>

            {/* Chờ xác minh */}
            <div className={`group relative rounded-2xl p-5 border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl ${
              isDark
                ? 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 hover:shadow-amber-500/5'
                : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-sm hover:shadow-amber-500/10'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center mb-3">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{stats.pending_requests + stats.pending_offers}</p>
                <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>Chờ xác minh</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Table - Glass Container */}
        <div className={`rounded-2xl border overflow-hidden transition-colors duration-500 ${
          isDark
            ? 'bg-neutral-800/50 border-neutral-700'
            : 'bg-white border-neutral-200 shadow-lg'
        }`}>
          {/* Tabs & Search */}
          <div className={`p-5 border-b transition-colors duration-500 ${isDark ? 'border-neutral-700' : 'border-neutral-200'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Tabs - Pill Style */}
              <div className={`flex gap-1 p-1 rounded-xl border transition-colors duration-500 ${
                isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-100 border-neutral-200'
              }`}>
                <button
                  onClick={() => { setActiveTab('requests'); setSelectedIds(new Set()) }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeTab === 'requests'
                      ? isDark
                        ? 'bg-white text-neutral-900 shadow-lg'
                        : 'bg-neutral-900 text-white shadow-lg'
                      : isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
                  }`}
                >
                  <HandHeart className="w-4 h-4" />
                  Yêu cầu ({requests.length})
                </button>
                <button
                  onClick={() => { setActiveTab('offers'); setSelectedIds(new Set()) }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeTab === 'offers'
                      ? isDark
                        ? 'bg-white text-neutral-900 shadow-lg'
                        : 'bg-neutral-900 text-white shadow-lg'
                      : isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Đề xuất ({offers.length})
                </button>
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm..."
                    className={`w-48 md:w-64 pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                      isDark
                        ? 'bg-neutral-900 border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 text-white placeholder:text-neutral-500 focus:ring-neutral-600'
                        : 'bg-neutral-50 border-neutral-300 hover:border-neutral-400 focus:border-neutral-500 text-neutral-900 placeholder:text-neutral-400 focus:ring-neutral-300'
                    }`}
                  />
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm transition-all duration-300 ${
                      isDark
                        ? 'bg-neutral-900 border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white'
                        : 'bg-neutral-50 border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:text-neutral-900'
                    }`}
                  >
                    {filter === 'all' && 'Tất cả'}
                    {filter === 'verified' && 'Đã xác minh'}
                    {filter === 'unverified' && 'Chưa xác minh'}
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showFilterDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showFilterDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                      <div className={`absolute right-0 top-full mt-2 w-44 border rounded-xl shadow-2xl z-20 overflow-hidden ${
                        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
                      }`}>
                        {(['all', 'verified', 'unverified'] as FilterType[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => { setFilter(f); setShowFilterDropdown(false) }}
                            className={`w-full px-4 py-3 text-left text-sm transition-all duration-200 flex items-center justify-between ${
                              filter === f
                                ? isDark ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-900'
                                : isDark ? 'text-neutral-400 hover:bg-neutral-700/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                            }`}
                          >
                            {f === 'all' && 'Tất cả'}
                            {f === 'verified' && 'Đã xác minh'}
                            {f === 'unverified' && 'Chưa xác minh'}
                            {filter === f && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className={`mt-4 flex items-center gap-3 p-4 rounded-xl border ${
                isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-50 border-neutral-200'
              }`}>
                <span className={`text-sm ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  Đã chọn <strong className={isDark ? 'text-white' : 'text-neutral-900'}>{selectedIds.size}</strong> mục
                </span>
                <button
                  onClick={handleBulkVerify}
                  disabled={isBulkProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Xác minh
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className={`ml-auto text-sm transition-colors ${isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
                >
                  Bỏ chọn
                </button>
              </div>
            )}
          </div>

          {/* Table Header */}
          <div className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wider ${
            isDark ? 'bg-neutral-900/50 text-neutral-500' : 'bg-neutral-50 text-neutral-500 border-b border-neutral-200'
          }`}>
            <div className="col-span-1">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                onChange={toggleSelectAll}
                className={`w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0 cursor-pointer ${
                  isDark ? 'border-neutral-600 bg-neutral-800' : 'border-neutral-300 bg-white'
                }`}
              />
            </div>
            <div className="col-span-4">Thông tin</div>
            <div className="col-span-3">Liên hệ</div>
            <div className="col-span-2">Trạng thái</div>
            <div className="col-span-2 text-right">Thao tác</div>
          </div>

          {/* Items */}
          <div className={`divide-y ${isDark ? 'divide-neutral-700/50' : 'divide-neutral-200'}`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className={`w-6 h-6 border-2 rounded-full animate-spin ${
                  isDark ? 'border-neutral-700 border-t-white' : 'border-neutral-300 border-t-neutral-700'
                }`} />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={`text-center py-20 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Không có dữ liệu
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 transition-all duration-300 ${
                    selectedIds.has(item.id)
                      ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                      : isDark ? 'hover:bg-neutral-700/30' : 'hover:bg-neutral-50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="col-span-1 flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className={`w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0 cursor-pointer ${
                        isDark ? 'border-neutral-600 bg-neutral-800' : 'border-neutral-300 bg-white'
                      }`}
                    />
                  </div>

                  {/* Info */}
                  <div className="col-span-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {activeTab === 'requests' && (
                        <>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                            isDark ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                          }`}>
                            {urgencyLabels[(item as HelpRequest).urgency] || (item as HelpRequest).urgency}
                          </span>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                            isDark ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                          }`}>
                            {needsTypeLabels[(item as HelpRequest).needs_type] || (item as HelpRequest).needs_type}
                          </span>
                        </>
                      )}
                      {activeTab === 'offers' && (
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                          isDark ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                        }`}>
                          {offerTypeLabels[(item as HelpOffer).offer_type] || (item as HelpOffer).offer_type}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm line-clamp-2 leading-relaxed ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>{item.description}</p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>{formatDate(item.created_at)}</p>
                  </div>

                  {/* Contact */}
                  <div className="col-span-3">
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-neutral-900'}`}>{item.contact_name}</p>
                    <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{item.contact_phone}</p>
                    {item.contact_email && (
                      <p className={`text-xs truncate mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>{item.contact_email}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {item.is_verified ? (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${
                        isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Đã xác minh
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${
                        isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        Chờ xác minh
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-start justify-end gap-2">
                    {/* Verify Button */}
                    <button
                      onClick={() => handleVerifyItem(item)}
                      className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 ${
                        item.is_verified
                          ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'
                          : isDark
                            ? 'bg-neutral-700 text-neutral-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                            : 'bg-neutral-100 text-neutral-500 hover:bg-emerald-100 hover:text-emerald-600 border border-neutral-200'
                      }`}
                      title={item.is_verified ? 'Bỏ xác minh' : 'Xác minh'}
                    >
                      {item.is_verified ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => { setEditingItem(item); setShowEditModal(true) }}
                      className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 ${
                        isDark
                          ? 'bg-neutral-700 text-neutral-400 hover:bg-blue-500/20 hover:text-blue-400'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-blue-100 hover:text-blue-600 border border-neutral-200'
                      }`}
                      title="Sửa"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 ${
                        isDark
                          ? 'bg-neutral-700 text-neutral-400 hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-red-100 hover:text-red-600 border border-neutral-200'
                      }`}
                      title="Xóa"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <EditModal
          item={editingItem}
          isDark={isDark}
          onClose={() => { setShowEditModal(false); setEditingItem(null) }}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}

// Edit Modal - Glass Style
function EditModal({
  item,
  isDark,
  onClose,
  onSave
}: {
  item: HelpRequest | HelpOffer
  isDark: boolean
  onClose: () => void
  onSave: (data: { description?: string; contact_name?: string; contact_phone?: string; contact_email?: string | null }) => void
}) {
  const [description, setDescription] = useState(item.description)
  const [contactName, setContactName] = useState(item.contact_name)
  const [contactPhone, setContactPhone] = useState(item.contact_phone)
  const [contactEmail, setContactEmail] = useState(item.contact_email || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    await onSave({
      description,
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: contactEmail || null,
    })
    setIsSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-md border overflow-hidden ${
        isDark
          ? 'bg-neutral-900 border-neutral-700'
          : 'bg-white border-neutral-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-neutral-700' : 'border-neutral-200'
        }`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Chỉnh sửa thông tin</h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all duration-300 ${
              isDark ? 'hover:bg-neutral-800 text-neutral-500 hover:text-white' : 'hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-300 resize-none ${
                isDark
                  ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 text-white placeholder:text-neutral-500 focus:ring-neutral-600'
                  : 'bg-neutral-50 border-neutral-300 hover:border-neutral-400 focus:border-neutral-500 text-neutral-900 placeholder:text-neutral-400 focus:ring-neutral-300'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>Tên liên hệ</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-300 ${
                isDark
                  ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 text-white placeholder:text-neutral-500 focus:ring-neutral-600'
                  : 'bg-neutral-50 border-neutral-300 hover:border-neutral-400 focus:border-neutral-500 text-neutral-900 placeholder:text-neutral-400 focus:ring-neutral-300'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>Số điện thoại</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-300 ${
                isDark
                  ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 text-white placeholder:text-neutral-500 focus:ring-neutral-600'
                  : 'bg-neutral-50 border-neutral-300 hover:border-neutral-400 focus:border-neutral-500 text-neutral-900 placeholder:text-neutral-400 focus:ring-neutral-300'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Không bắt buộc"
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-300 ${
                isDark
                  ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 text-white placeholder:text-neutral-500 focus:ring-neutral-600'
                  : 'bg-neutral-50 border-neutral-300 hover:border-neutral-400 focus:border-neutral-500 text-neutral-900 placeholder:text-neutral-400 focus:ring-neutral-300'
              }`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 px-4 border rounded-xl font-medium transition-all duration-300 ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
                  : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700'
              }`}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 hover:shadow-lg disabled:opacity-50 ${
                isDark
                  ? 'bg-white hover:bg-neutral-100 text-neutral-900 hover:shadow-white/20'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-white hover:shadow-neutral-900/20'
              }`}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Main Export
export default function AdminRescuePage() {
  return (
    <AdminAuthProvider>
      <AdminDashboardContent />
    </AdminAuthProvider>
  )
}
