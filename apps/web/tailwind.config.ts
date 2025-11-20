import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Design Tokens: Modern & Minimal Color System
      colors: {
        // Primary Accent (Blue - for CTAs, links, active states)
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6', // Main accent
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        // Neutral Grays (for text, backgrounds, borders)
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0A0A0A',
        },
        // Semantic Colors (Alerts & Status)
        success: {
          50: '#F0FDF4',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF',
          500: '#3B82F6',
          600: '#2563EB',
        },
        // Legacy aliases (backward compatibility)
        flood: {
          light: '#60A5FA',
          DEFAULT: '#3B82F6',
          dark: '#1E40AF',
        },
        alert: {
          low: '#22C55E',
          medium: '#F59E0B',
          high: '#F59E0B',
          critical: '#EF4444',
        }
      },
      // Refined Border Radius
      borderRadius: {
        'subtle': '8px',
        'card': '12px',
        'prominent': '16px',
        'sheet': '20px',
      },
      // Soft Shadow System
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft': '0 2px 8px 0 rgb(0 0 0 / 0.04)',
        'soft-md': '0 4px 12px 0 rgb(0 0 0 / 0.05)',
        'soft-lg': '0 8px 24px 0 rgb(0 0 0 / 0.06)',
        'soft-xl': '0 12px 32px 0 rgb(0 0 0 / 0.08)',
      },
      // Consistent Spacing (extend existing Tailwind scale)
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      // Animation easing
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
export default config
