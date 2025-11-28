import { Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { locales, type Locale } from '@/i18n'
import { ErrorLoggerInit } from '@/components/ErrorLoggerInit'
import '../globals.css'

const inter = Inter({ subsets: ['latin'] })

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params

  const titles: Record<Locale, string> = {
    vi: 'Thông tin mưa lũ - thongtinmualu.live',
    en: 'Vietnam Flood Watch - thongtinmualu.live'
  }

  const descriptions: Record<Locale, string> = {
    vi: 'Hệ thống cảnh báo và theo dõi mưa lũ thời gian thực tại Việt Nam. Cập nhật tình trạng ngập lụt, sạt lở, tuyến đường an toàn.',
    en: 'Real-time flood monitoring and warning system in Vietnam. Updates on flooding, landslides, and safe routes.'
  }

  return {
    title: titles[locale] || titles.vi,
    description: descriptions[locale] || descriptions.vi,
    keywords: locale === 'en'
      ? ['Vietnam flood', 'flood warning', 'disaster monitoring', 'emergency rescue', 'Vietnam weather']
      : ['mưa lũ', 'cảnh báo lũ lụt', 'sạt lở', 'cứu hộ', 'thời tiết Việt Nam'],
    openGraph: {
      title: titles[locale] || titles.vi,
      description: descriptions[locale] || descriptions.vi,
      locale: locale === 'en' ? 'en_US' : 'vi_VN',
      type: 'website',
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  // Get messages for the locale
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Dark mode script - runs before body renders to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Preconnect to critical origins - establishes TCP/TLS early */}
        <link rel="preconnect" href="https://api.thongtinmuala.live" />
        <link rel="preconnect" href="http://188.166.248.10:8000" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://api.thongtinmuala.live" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        {/* Preload MapLibre GL CSS for faster map rendering */}
        <link
          rel="preload"
          href="https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.css"
          as="style"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.css"
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ErrorLoggerInit />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
