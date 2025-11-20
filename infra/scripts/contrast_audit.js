#!/usr/bin/env node
/**
 * Contrast Audit Script
 *
 * Checks color contrast ratios for WCAG AA compliance
 * - Normal text: 4.5:1 minimum
 * - Large text (18pt+/14pt+ bold): 3:1 minimum
 *
 * Usage: node infra/scripts/contrast_audit.js
 */

// Color pairs to audit (from design tokens)
const colorPairs = {
  'Header text on white': {
    foreground: '#171717', // neutral-900
    background: '#FFFFFF',
    size: 'large',
    location: 'apps/web/app/map/page.tsx:67'
  },
  'Header text on dark': {
    foreground: '#FAFAFA', // neutral-50
    background: '#171717', // neutral-900
    size: 'large',
    location: 'apps/web/app/map/page.tsx:67 (dark mode)'
  },
  'Body text on light bg': {
    foreground: '#404040', // neutral-700
    background: '#FAFAFA', // neutral-50
    size: 'normal',
    location: 'apps/web/app/map/page.tsx:155'
  },
  'Body text on dark bg': {
    foreground: '#D4D4D4', // neutral-300
    background: '#171717', // neutral-900
    size: 'normal',
    location: 'apps/web/app/map/page.tsx:155 (dark mode)'
  },
  'Error badge text': {
    foreground: '#B91C1C', // error-700
    background: '#FEF2F2', // error-50
    size: 'small',
    location: 'apps/web/app/map/page.tsx:136'
  },
  'Warning badge text': {
    foreground: '#B45309', // warning-700
    background: '#FFFBEB', // warning-50
    size: 'small',
    location: 'apps/web/app/map/page.tsx:137'
  },
  'Info badge text': {
    foreground: '#1E40AF', // info-700
    background: '#EFF6FF', // info-50
    size: 'small',
    location: 'apps/web/app/map/page.tsx:139'
  },
  'Secondary text on light': {
    foreground: '#737373', // neutral-500
    background: '#FFFFFF',
    size: 'small',
    location: 'apps/web/app/map/page.tsx:161'
  },
  'Primary button text': {
    foreground: '#FFFFFF',
    background: '#2563EB', // primary-600
    size: 'normal',
    location: 'apps/web/app/map/page.tsx:95'
  },
  'Border on white': {
    foreground: '#E5E5E5', // neutral-200
    background: '#FFFFFF',
    size: 'border',
    location: 'apps/web/app/map/page.tsx:131'
  }
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Calculate relative luminance
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getLuminance(rgb) {
  const { r, g, b } = rgb
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
function getContrastRatio(fg, bg) {
  const fgRgb = hexToRgb(fg)
  const bgRgb = hexToRgb(bg)

  if (!fgRgb || !bgRgb) return 0

  const l1 = getLuminance(fgRgb)
  const l2 = getLuminance(bgRgb)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast passes WCAG AA
 */
function passesWCAG_AA(ratio, size) {
  if (size === 'large') return ratio >= 3.0
  if (size === 'border') return ratio >= 1.5 // Decorative borders (relaxed requirement)
  if (size === 'ui-component') return ratio >= 3.0 // Critical UI components
  return ratio >= 4.5 // Normal text
}

/**
 * Get visual indicator
 */
function getIndicator(passes) {
  return passes ? '✅' : '❌'
}

/**
 * Main audit function
 */
function audit() {
  console.log('\n🎨 FloodWatch Contrast Audit\n')
  console.log('WCAG AA Requirements:')
  console.log('  • Normal text: 4.5:1')
  console.log('  • Large text:  3.0:1')
  console.log('  • UI elements: 3.0:1')
  console.log('  • Borders (decorative): 1.5:1 (advisory)\n')
  console.log('─'.repeat(80))

  let passCount = 0
  let failCount = 0
  let warningCount = 0
  const failures = []
  const warnings = []

  for (const [name, config] of Object.entries(colorPairs)) {
    const ratio = getContrastRatio(config.foreground, config.background)
    const passes = passesWCAG_AA(ratio, config.size)

    // Decorative borders are warnings, not failures
    const isBorder = config.size === 'border'
    const indicator = getIndicator(passes)

    if (passes) {
      passCount++
    } else if (isBorder) {
      warningCount++
      warnings.push({ name, ratio, config })
    } else {
      failCount++
      failures.push({ name, ratio, config })
    }

    console.log(`${indicator} ${name.padEnd(30)} ${ratio.toFixed(2)}:1`)
    console.log(`   ${config.foreground} on ${config.background} (${config.size})`)
    console.log(`   ${config.location}`)
    console.log()
  }

  console.log('─'.repeat(80))
  console.log(`\n📊 Summary: ${passCount} passed, ${failCount} failed, ${warningCount} warnings\n`)

  // Show warnings (non-critical)
  if (warnings.length > 0) {
    console.log('⚠️  Warnings (Decorative elements):\n')
    warnings.forEach(({ name, ratio, config }) => {
      console.log(`⚠️  ${name}`)
      console.log(`   Ratio: ${ratio.toFixed(2)}:1 (advisory minimum: 1.5:1)`)
      console.log(`   Location: ${config.location}`)
      console.log(`   Note: Decorative borders do not fail WCAG AA`)
      console.log()
    })
  }

  // Show failures (critical)
  if (failures.length > 0) {
    console.log('❌ Failed Checks (Critical):\n')
    failures.forEach(({ name, ratio, config }) => {
      let required
      if (config.size === 'normal') required = 4.5
      else if (config.size === 'large') required = 3.0
      else if (config.size === 'ui-component') required = 3.0
      else required = 4.5

      const deficit = (required - ratio).toFixed(2)
      console.log(`❌ ${name}`)
      console.log(`   Ratio: ${ratio.toFixed(2)}:1 (needs ${required}:1, deficit: ${deficit})`)
      console.log(`   Location: ${config.location}`)
      console.log()
    })
    process.exit(1)
  } else {
    console.log('✅ All critical contrast checks passed!\n')
    if (warnings.length > 0) {
      console.log('💡 Consider improving warning items for better accessibility.\n')
    }
    process.exit(0)
  }
}

// Run audit
audit()
