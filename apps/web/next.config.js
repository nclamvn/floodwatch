/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
}

module.exports = nextConfig
