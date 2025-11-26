'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getAdminSession,
  adminLogin,
  adminLogout,
  isAdminAuthenticated,
  AdminLoginResponse,
} from '@/lib/adminAuth'

interface AdminAuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (password: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check authentication status on mount
  const checkAuth = useCallback(() => {
    const authenticated = isAdminAuthenticated()
    setIsAuthenticated(authenticated)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Login function
  const login = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const result: AdminLoginResponse = await adminLogin(password)

      if (result.valid) {
        setIsAuthenticated(true)
        setError(null)
        return true
      } else {
        setIsAuthenticated(false)
        setError(result.message || 'Mật khẩu không đúng')
        return false
      }
    } catch (err) {
      setError('Lỗi kết nối server')
      setIsAuthenticated(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await adminLogout()
    } finally {
      setIsAuthenticated(false)
      setError(null)
      setIsLoading(false)
    }
  }, [])

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
