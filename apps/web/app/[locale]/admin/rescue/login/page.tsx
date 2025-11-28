'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sun, Moon } from 'lucide-react'
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext'

function AdminLoginContent() {
  const router = useRouter()
  const { isAuthenticated, isLoading, error, login } = useAdminAuth()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(true)

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin-theme')
    if (savedTheme) {
      setIsDark(savedTheme === 'dark')
    } else {
      // Default to system preference
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }, [])

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    localStorage.setItem('admin-theme', newTheme ? 'dark' : 'light')
  }

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/admin/rescue')
    }
  }, [isAuthenticated, isLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!password.trim()) {
      setLocalError('Vui lòng nhập mật khẩu')
      return
    }

    setIsSubmitting(true)

    try {
      const success = await login(password)
      if (success) {
        router.push('/admin/rescue')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${
        isDark
          ? 'bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950'
          : 'bg-neutral-100'
      }`}>
        <div className={`w-6 h-6 border-2 rounded-full animate-spin ${
          isDark ? 'border-neutral-700 border-t-white' : 'border-neutral-300 border-t-neutral-700'
        }`} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${
      isDark
        ? 'bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950'
        : 'bg-neutral-100'
    }`}>
      {/* Header */}
      <header className="w-full py-4 px-6 flex items-center justify-between">
        <Link
          href="/"
          className={`text-sm transition-colors ${
            isDark ? 'text-neutral-500 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          thongtinmuala.live
        </Link>

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
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-[380px]">
          {/* Glass Card */}
          <div className={`rounded-3xl p-8 transition-all duration-500 ${
            isDark
              ? 'bg-neutral-800/80 border border-neutral-700 shadow-2xl'
              : 'bg-white border border-neutral-200 shadow-xl'
          }`}>
            {/* Title */}
            <div className="text-center mb-8">
              <h1 className={`text-3xl font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-neutral-900'
              }`}>
                Đăng nhập
              </h1>
              <p className={`mt-2 text-sm ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}>
                Admin Dashboard
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Password Input */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3.5 rounded-xl text-base transition-all duration-300 ${
                    isDark
                      ? 'bg-neutral-900 border border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 text-white placeholder:text-neutral-500'
                      : 'bg-neutral-50 border border-neutral-300 hover:border-neutral-400 focus:border-neutral-500 text-neutral-900 placeholder:text-neutral-400'
                  } focus:outline-none focus:ring-2 ${
                    isDark ? 'focus:ring-neutral-600' : 'focus:ring-neutral-300'
                  }`}
                  placeholder="Mật khẩu"
                  disabled={isSubmitting}
                  autoFocus
                  autoComplete="current-password"
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium transition-colors ${
                      isDark
                        ? 'text-neutral-500 hover:text-white'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                )}
              </div>

              {/* Error Message */}
              {(error || localError) && (
                <div className={`px-4 py-3 rounded-xl text-sm ${
                  isDark
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                    : 'bg-red-50 border border-red-300 text-red-700'
                }`}>
                  {localError || error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !password.trim()}
                className={`w-full py-3.5 px-4 rounded-xl text-base font-semibold transition-all duration-300 ${
                  isDark
                    ? 'bg-white hover:bg-neutral-100 text-neutral-900 hover:shadow-lg hover:shadow-white/20 disabled:bg-neutral-700 disabled:text-neutral-500'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-white hover:shadow-lg hover:shadow-neutral-900/20 disabled:bg-neutral-300 disabled:text-neutral-500'
                } disabled:cursor-not-allowed`}
              >
                {isSubmitting ? 'Đang xác thực...' : 'Tiếp tục'}
              </button>
            </form>

            {/* Footer Link */}
            <div className="mt-6 text-center">
              <Link
                href="/help"
                className={`text-sm transition-colors ${
                  isDark ? 'text-neutral-500 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Quay lại trang cứu trợ
              </Link>
            </div>
          </div>

          {/* Security Notice */}
          <p className={`mt-6 text-center text-xs ${
            isDark ? 'text-neutral-600' : 'text-neutral-400'
          }`}>
            Chỉ dành cho quản trị viên được ủy quyền
          </p>
        </div>
      </main>
    </div>
  )
}

// Wrap with Provider
export default function AdminLoginPage() {
  return (
    <AdminAuthProvider>
      <AdminLoginContent />
    </AdminAuthProvider>
  )
}
