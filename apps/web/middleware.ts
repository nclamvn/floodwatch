import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n'

export default createMiddleware({
  // A list of all locales that are supported
  locales,
  // Used when no locale matches
  defaultLocale,
  // Don't add prefix for default locale (Vietnamese)
  // /map for Vietnamese, /en/map for English
  localePrefix: 'as-needed',
  // Don't auto-detect locale from Accept-Language header
  // User must explicitly go to /en/... for English
  localeDetection: false
})

export const config = {
  // Match all pathnames except for
  // - /api routes
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - Static files (e.g., /favicon.ico, /images/...)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
