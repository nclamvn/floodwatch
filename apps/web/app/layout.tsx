import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { getMapCssUrl } from '@/lib/mapProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Theo dõi mưa lũ - Hệ thống Giám sát Mưa Lũ',
  description: 'Real-time flood monitoring and alert system for Vietnam',
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
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
