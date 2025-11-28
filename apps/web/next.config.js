const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Optimized for Docker/Render deployment
  // Image optimization config
  images: {
    // Allow images from any domain (user-uploaded content, press images)
    // Using unoptimized for external URLs maintains lazy loading
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS sources
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '188.166.248.10', // Production server
      },
    ],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200],
    // Supported image sizes for srcset
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Limit image optimization to reduce server load
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_MAP_PROVIDER: process.env.NEXT_PUBLIC_MAP_PROVIDER || 'mapbox',
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '',
    NEXT_PUBLIC_GOONG_API_KEY: process.env.NEXT_PUBLIC_GOONG_API_KEY || '',
  },
  // MapLibre GL configuration
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // MapLibre GL uses ESM, ensure proper resolution
      'maplibre-gl': 'maplibre-gl/dist/maplibre-gl.js'
    };
    return config;
  },
  // Phase 4: Cache headers for static assets
  async headers() {
    return [
      {
        // Next.js static files - immutable, cache forever
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        // Public images - cache 1 day
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400'
          }
        ]
      },
      {
        // Fonts - cache 1 year
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },
}

module.exports = withNextIntl(nextConfig)
