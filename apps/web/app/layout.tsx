import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { getMapCssUrl } from '@/lib/mapProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://thongtinmualu.live'),
  title: 'Thông tin mưa lũ - thongtinmualu.live',
  description: 'Hệ thống cảnh báo và theo dõi mưa lũ thời gian thực tại Việt Nam. Cập nhật tình trạng ngập lụt, sạt lở, tuyến đường an toàn.',
  keywords: ['mưa lũ', 'ngập lụt', 'cảnh báo thiên tai', 'Việt Nam', 'flood warning', 'disaster alert'],
  authors: [{ name: 'FloodWatch Team' }],
  openGraph: {
    title: 'Thông tin mưa lũ - thongtinmualu.live',
    description: 'Hệ thống cảnh báo và theo dõi mưa lũ thời gian thực tại Việt Nam',
    url: 'https://thongtinmualu.live',
    siteName: 'Thông tin mưa lũ',
    images: [
      {
        url: '/images/logo.png',
        width: 1024,
        height: 1024,
        alt: 'Thông tin mưa lũ Logo',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thông tin mưa lũ - thongtinmualu.live',
    description: 'Hệ thống cảnh báo và theo dõi mưa lũ thời gian thực tại Việt Nam',
    images: ['/images/logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/images/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const mapCssUrl = getMapCssUrl()

  return (
    <html lang="vi">
      <head>
        <link href={mapCssUrl} rel='stylesheet' />
        {/* Dark mode script - runs before React hydration to prevent FOUC */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              if (localStorage.theme === 'dark' ||
                 (!('theme' in localStorage) &&
                  window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark')
              }
            })()
          `
        }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
