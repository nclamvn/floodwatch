/**
 * Admin Authentication Helper Functions
 *
 * Handles admin session management with localStorage
 * Token expires after 24 hours
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.thongtinmuala.live'
const TOKEN_KEY = 'admin_rescue_token'
const TOKEN_EXPIRY_KEY = 'admin_rescue_token_expiry'

// Token expiry: 24 hours
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export interface AdminLoginResponse {
  valid: boolean
  token?: string
  message?: string
  expires_at?: string
}

export interface AdminSession {
  token: string
  expiresAt: number
}

/**
 * Get stored admin session from localStorage
 */
export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null

  const token = localStorage.getItem(TOKEN_KEY)
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)

  if (!token || !expiryStr) return null

  const expiresAt = parseInt(expiryStr, 10)

  // Check if token is expired
  if (Date.now() > expiresAt) {
    clearAdminSession()
    return null
  }

  return { token, expiresAt }
}

/**
 * Save admin session to localStorage
 */
export function saveAdminSession(token: string, expiresAt?: string): void {
  if (typeof window === 'undefined') return

  const expiry = expiresAt
    ? new Date(expiresAt).getTime()
    : Date.now() + TOKEN_TTL_MS

  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString())
}

/**
 * Clear admin session from localStorage
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

/**
 * Check if user is authenticated as admin
 */
export function isAdminAuthenticated(): boolean {
  return getAdminSession() !== null
}

/**
 * Get admin token for API requests
 */
export function getAdminToken(): string | null {
  const session = getAdminSession()
  return session?.token || null
}

/**
 * Login with password
 */
export async function adminLogin(password: string): Promise<AdminLoginResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/verify-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    })

    const data = await response.json()

    if (data.valid && data.token) {
      saveAdminSession(data.token, data.expires_at)
    }

    return data
  } catch (error) {
    console.error('Admin login error:', error)
    return {
      valid: false,
      message: 'Không thể kết nối đến server',
    }
  }
}

/**
 * Logout admin session
 */
export async function adminLogout(): Promise<void> {
  const token = getAdminToken()

  if (token) {
    try {
      await fetch(`${API_BASE}/api/v1/admin/logout`, {
        method: 'POST',
        headers: {
          'X-Admin-Token': token,
        },
      })
    } catch (error) {
      console.error('Admin logout error:', error)
    }
  }

  clearAdminSession()
}

/**
 * Make authenticated API request
 */
export async function adminFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAdminToken()

  if (!token) {
    throw new Error('Not authenticated')
  }

  const headers = new Headers(options.headers)
  headers.set('X-Admin-Token', token)
  headers.set('Content-Type', 'application/json')

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })
}

/**
 * Update help request (admin only)
 */
export async function updateHelpRequest(
  requestId: string,
  data: {
    description?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
    status?: string
    is_verified?: boolean
    notes?: string
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await adminFetch(`/api/v1/help/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })

    if (response.status === 401) {
      clearAdminSession()
      return { success: false, message: 'Phiên đăng nhập hết hạn' }
    }

    const result = await response.json()
    return { success: response.ok, message: result.message || result.detail }
  } catch (error) {
    console.error('Update request error:', error)
    return { success: false, message: 'Lỗi kết nối server' }
  }
}

/**
 * Update help offer (admin only)
 */
export async function updateHelpOffer(
  offerId: string,
  data: {
    description?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
    status?: string
    is_verified?: boolean
    notes?: string
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await adminFetch(`/api/v1/help/offers/${offerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })

    if (response.status === 401) {
      clearAdminSession()
      return { success: false, message: 'Phiên đăng nhập hết hạn' }
    }

    const result = await response.json()
    return { success: response.ok, message: result.message || result.detail }
  } catch (error) {
    console.error('Update offer error:', error)
    return { success: false, message: 'Lỗi kết nối server' }
  }
}

/**
 * Bulk delete items (admin only)
 */
export async function bulkDelete(
  type: 'requests' | 'offers',
  ids: string[]
): Promise<{ success: boolean; deleted_count?: number; message?: string }> {
  try {
    const response = await adminFetch('/api/v1/admin/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ type, ids }),
    })

    if (response.status === 401) {
      clearAdminSession()
      return { success: false, message: 'Phiên đăng nhập hết hạn' }
    }

    const result = await response.json()
    return {
      success: response.ok,
      deleted_count: result.deleted_count,
      message: result.message || result.detail
    }
  } catch (error) {
    console.error('Bulk delete error:', error)
    return { success: false, message: 'Lỗi kết nối server' }
  }
}

/**
 * Bulk verify items (admin only)
 */
export async function bulkVerify(
  type: 'requests' | 'offers',
  ids: string[]
): Promise<{ success: boolean; verified_count?: number; message?: string }> {
  try {
    const response = await adminFetch('/api/v1/admin/bulk-verify', {
      method: 'POST',
      body: JSON.stringify({ type, ids }),
    })

    if (response.status === 401) {
      clearAdminSession()
      return { success: false, message: 'Phiên đăng nhập hết hạn' }
    }

    const result = await response.json()
    return {
      success: response.ok,
      verified_count: result.verified_count,
      message: result.message || result.detail
    }
  } catch (error) {
    console.error('Bulk verify error:', error)
    return { success: false, message: 'Lỗi kết nối server' }
  }
}

/**
 * Get admin statistics
 */
export async function getAdminStats(): Promise<{
  success: boolean
  stats?: {
    total_requests: number
    total_offers: number
    verified_requests: number
    verified_offers: number
    pending_requests: number
    pending_offers: number
  }
  message?: string
}> {
  try {
    const response = await adminFetch('/api/v1/admin/stats')

    if (response.status === 401) {
      clearAdminSession()
      return { success: false, message: 'Phiên đăng nhập hết hạn' }
    }

    const result = await response.json()
    return { success: response.ok, stats: result, message: result.detail }
  } catch (error) {
    console.error('Get stats error:', error)
    return { success: false, message: 'Lỗi kết nối server' }
  }
}
