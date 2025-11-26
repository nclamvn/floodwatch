import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Enable class-based dark mode strategy
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ========================================
      // DESIGN TOKENS: FloodWatch Mobile Premium
      // Navy-Slate base, Inter font, Apple-inspired
      // ========================================

      colors: {
        // ===== BASE: Slate (Navy-dark theme) - HIGH CONTRAST =====
        slate: {
          950: '#020617',  // App background (dark mode)
          900: '#0f172a',  // PRIMARY text (light mode), Surface (dark mode)
          800: '#1e293b',  // Border (dark mode)
          700: '#334155',  // SECONDARY text (light mode), Border (dark mode)
          600: '#475569',  // Border (light mode)
          500: '#64748b',  // TERTIARY text (light mode/dark mode)
          400: '#94a3b8',  // TERTIARY text (dark mode)
          300: '#cbd5e1',  // Border (light mode)
          200: '#e2e8f0',  // SECONDARY text (dark mode), Border (light mode)
          100: '#f1f5f9',  // Background (light mode)
          50: '#f8fafc',   // PRIMARY text (dark mode), Background (light mode)
        },

        // ===== PRIMARY ACCENT (Blue - Keep existing) =====
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

        // ===== ACCENT ALIAS (for convenience) =====
        accent: {
          DEFAULT: '#3B82F6',
          hover: '#60A5FA',
        },

        // ===== SEMANTIC: Danger/SOS (Red) =====
        danger: {
          DEFAULT: '#EF4444',   // red-500
          strong: '#B91C1C',    // red-700 for SOS
          light: '#FCA5A5',     // red-300 for text
        },

        // ===== SEMANTIC: Warning (Orange) =====
        warning: {
          DEFAULT: '#F97316',   // orange-500
          hover: '#EA580C',     // orange-600
        },

        // ===== SEMANTIC: Success (Green) =====
        success: {
          DEFAULT: '#22C55E',   // green-500
          hover: '#16A34A',     // green-600
        },

        // ===== LEGACY (backward compatibility) =====
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
        flood: {
          light: '#60A5FA',
          DEFAULT: '#3B82F6',
          dark: '#1E40AF',
        },
        alert: {
          low: '#22C55E',
          medium: '#F59E0B',
          high: '#F97316',
          critical: '#B91C1C',
        }
      },

      // ===== TYPOGRAPHY SCALE (Inter) =====
      fontSize: {
        'title-1': ['22px', { lineHeight: '1.3', fontWeight: '600' }],  // Hero, modal titles
        'title-2': ['18px', { lineHeight: '1.4', fontWeight: '600' }],  // Section titles
        'body-1': ['15px', { lineHeight: '1.6', fontWeight: '400' }],   // Primary text
        'body-2': ['13px', { lineHeight: '1.5', fontWeight: '400' }],   // Secondary text
        'label': ['12px', { lineHeight: '1.3', fontWeight: '500' }],    // Badges, chips, meta
      },

      // ===== BORDER RADIUS SYSTEM =====
      borderRadius: {
        'xs': '6px',      // Chip, badge
        'sm': '10px',     // Input, small card
        'lg': '16px',     // Card, bottom sheet
        'xl': '24px',     // Modal, read mode
        'pill': '9999px', // Buttons, pills
        // Legacy (keep for compatibility)
        'subtle': '8px',
        'card': '12px',
        'prominent': '16px',
        'sheet': '20px',
      },

      // ===== SHADOW & ELEVATION =====
      boxShadow: {
        // Premium elevation
        'elevation-1': '0 8px 24px rgba(0, 0, 0, 0.40)',   // Floating buttons
        'elevation-2': '0 24px 60px rgba(0, 0, 0, 0.50)',  // Modals
        // Legacy soft shadows (keep for compatibility)
        'soft-sm': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft': '0 2px 8px 0 rgb(0 0 0 / 0.04)',
        'soft-md': '0 4px 12px 0 rgb(0 0 0 / 0.05)',
        'soft-lg': '0 8px 24px 0 rgb(0 0 0 / 0.06)',
        'soft-xl': '0 12px 32px 0 rgb(0 0 0 / 0.08)',
      },

      // ===== SPACING (consistent 4px base) =====
      spacing: {
        '18': '4.5rem',  // 72px
        '22': '5.5rem',  // 88px
        // Safe area insets for notched devices (iPhone X+)
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
      },

      // ===== MIN HEIGHT/WIDTH for touch targets =====
      minHeight: {
        'touch': '44px',  // WCAG AA minimum touch target
      },
      minWidth: {
        'touch': '44px',  // WCAG AA minimum touch target
      },

      // ===== HEIGHT for dynamic viewport =====
      height: {
        'dvh': '100dvh',  // Dynamic viewport height (accounts for mobile browser chrome)
        'svh': '100svh',  // Small viewport height
        'lvh': '100lvh',  // Large viewport height
      },
      maxHeight: {
        'dvh': '100dvh',
        'svh': '100svh',
        'lvh': '100lvh',
      },

      // ===== ANIMATION TIMING =====
      transitionDuration: {
        'ui': '180ms',      // Quick UI interactions
        'sheet': '220ms',   // Bottom sheet, modals
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.22, 0.61, 0.36, 1)',  // Apple-style ease-out
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // Legacy spring
      },

      // ===== KEYFRAMES =====
      keyframes: {
        spotlight: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        spotlight: 'spotlight 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
      },
    },
  },
  plugins: [],
}
export default config
