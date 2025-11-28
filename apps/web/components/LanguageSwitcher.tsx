'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/navigation'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const toggleLocale = () => {
    const newLocale = locale === 'vi' ? 'en' : 'vi'
    // next-intl's useRouter handles locale prefix automatically
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <button
      onClick={toggleLocale}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all duration-300 text-sm font-medium text-slate-700 dark:text-neutral-300"
      title={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
    >
      <Globe className="w-4 h-4" />
      <span>{locale === 'vi' ? 'EN' : 'VI'}</span>
    </button>
  )
}
