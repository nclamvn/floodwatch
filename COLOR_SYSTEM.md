# FloodWatch Color System - HIGH CONTRAST

## 📐 WCAG AAA Standard (Contrast Ratio ≥ 7:1 for body text)

---

## 🌓 Dark Mode Architecture

**Strategy**: Class-based dark mode (`darkMode: 'class'` in tailwind.config.ts)

- JavaScript automatically detects system preference and applies `.dark` class to `<html>`
- All dark mode styles use `dark:` prefix (e.g., `dark:bg-slate-950`)
- CSS custom properties update automatically based on `.dark` class
- Preference saved to `localStorage` for persistence

**Files**:
- `tailwind.config.ts`: Line 4 - `darkMode: 'class'`
- `layout.tsx`: Lines 24-35 - Dark mode detection script
- `globals.css`: Lines 36-55 - `.dark` class CSS variables

---

## 🎨 Semantic Background Utilities

Use these semantic class names for clear, consistent background contexts:

| Utility | Light Mode | Dark Mode | Usage |
|---------|------------|-----------|-------|
| `.bg-page` | `bg-white` | `bg-slate-950` | Main app background |
| `.bg-surface` | `bg-white` | `bg-slate-900` | Cards, panels, containers |
| `.bg-elevated` | `bg-slate-50` | `bg-slate-800` | Raised cards, modals, dropdowns |
| `.bg-subtle` | `bg-slate-100` | `bg-slate-700` | Hover states, selected items |
| `.glass` | `rgba(255,255,255,0.95)` | `rgba(15,23,42,0.95)` | Glass morphism effect |

**Semantic Text Utilities** (auto dark mode):

| Utility | Light Mode | Dark Mode | Usage |
|---------|------------|-----------|-------|
| `.text-primary` | `text-slate-900` | `text-slate-50` | Headings, important content |
| `.text-secondary` | `text-slate-700` | `text-slate-200` | Body text, descriptions |
| `.text-tertiary` | `text-slate-500` | `text-slate-400` | Meta info, labels |

**Semantic Border Utilities**:

| Utility | Light Mode | Dark Mode |
|---------|------------|-----------|
| `.border-subtle` | `border-slate-200` | `border-slate-700` |
| `.border-default` | `border-slate-300` | `border-slate-600` |

---

## 🎨 Slate Color Usage Guide

### **Light Mode** (white/light backgrounds)

| Usage | Class | Hex | Contrast |
|-------|-------|-----|----------|
| **Primary Text** (headings, body) | `text-slate-900` | #0f172a | ✅ 16.1:1 |
| **Secondary Text** (labels, meta) | `text-slate-700` | #334155 | ✅ 9.4:1 |
| **Tertiary Text** (hints, disabled) | `text-slate-500` | #64748b | ✅ 4.8:1 (AA) |
| **Borders** | `border-slate-200`, `border-slate-300` | #e2e8f0, #cbd5e1 | - |
| **Backgrounds** | `bg-slate-50`, `bg-slate-100` | #f8fafc, #f1f5f9 | - |

### **Dark Mode** (dark backgrounds)

| Usage | Class | Hex | Contrast |
|-------|-------|-----|----------|
| **Primary Text** (headings, body) | `text-slate-50` | #f8fafc | ✅ 16.2:1 |
| **Secondary Text** (labels, meta) | `text-slate-200` | #e2e8f0 | ✅ 12.1:1 |
| **Tertiary Text** (hints, disabled) | `text-slate-400` | #94a3b8 | ✅ 5.2:1 (AA) |
| **Borders** | `border-slate-700`, `border-slate-800` | #334155, #1e293b | - |
| **Backgrounds** | `bg-slate-900`, `bg-slate-950` | #0f172a, #020617 | - |

---

## 🚨 INCORRECT Usage (Low Contrast - DO NOT USE)

### ❌ Light Mode Mistakes:
- `text-slate-600` on white → 3.8:1 (FAIL)
- `text-slate-400` on white → 2.3:1 (FAIL)

### ❌ Dark Mode Mistakes:
- `text-slate-600` on dark → 2.1:1 (FAIL)
- `text-slate-500` on dark → 3.2:1 (FAIL)

---

## ✅ CORRECT Component Patterns

### **Component → Background → Text Mapping**

| Component Type | Background Class | Text Classes |
|----------------|------------------|--------------|
| **Main Page** | `.bg-page` | `.text-primary` for headings<br/>`.text-secondary` for body |
| **Card** | `.bg-surface` or `.glass` | `.text-primary` for titles<br/>`.text-secondary` for content |
| **Modal** | `.bg-elevated` | `.text-primary` for heading<br/>`.text-secondary` for body |
| **Button** | `.bg-surface` | `.text-primary` |
| **Hover State** | `.bg-subtle` | `.text-primary` |

### 1. **Using Semantic Utilities (RECOMMENDED)**
```tsx
// Page background
<main className="bg-page">
  <h1 className="text-primary">Heading</h1>
  <p className="text-secondary">Body text</p>
</main>

// Card
<div className="bg-surface border-subtle">
  <h3 className="text-primary">Card Title</h3>
  <p className="text-secondary">Card description</p>
  <span className="text-tertiary">Meta info</span>
</div>

// Modal
<div className="bg-elevated">
  <h2 className="text-primary">Modal Title</h2>
  <p className="text-secondary">Modal content</p>
</div>
```

### 2. **Using Direct Tailwind Classes**
```tsx
// If you need more control, use direct Tailwind classes:
<div className="bg-white dark:bg-slate-900">
  <h3 className="text-slate-900 dark:text-slate-50">Title</h3>
  <p className="text-slate-700 dark:text-slate-200">Description</p>
</div>
```

### 3. **Glass Elements**
```tsx
// .glass utility provides 95% opacity backgrounds + blur
<div className="glass">
  <h3 className="text-primary">Glass Card</h3>
  <p className="text-secondary">Content</p>
</div>
```

---

## 🎯 Quick Reference

**ALWAYS use these combinations:**

```tsx
// Light Mode
text-slate-900  // Primary (headings, important text)
text-slate-700  // Secondary (body text, descriptions)
text-slate-500  // Tertiary (hints, placeholders)

// Dark Mode
dark:text-slate-50   // Primary
dark:text-slate-200  // Secondary
dark:text-slate-400  // Tertiary
```

**NEVER use:**
- `text-slate-600` (too light on white, too dark on dark)
- `text-slate-300` on dark backgrounds (too low contrast)

---

## 📊 Semantic Colors (Already High Contrast)

| Color | Light | Dark | Usage |
|-------|-------|------|-------|
| **Danger** | `bg-danger` (#EF4444) | Same | ✅ Alerts, SOS |
| **Warning** | `bg-warning` (#F97316) | Same | ✅ Warnings |
| **Success** | `bg-success` (#22C55E) | Same | ✅ Success states |
| **Primary** | `bg-primary-600` | `bg-primary-400` | ✅ CTAs, accents |

---

## 🛠️ How to Fix Existing Code

### Before (Low Contrast):
```tsx
<p className="text-slate-600 dark:text-slate-400">
```

### After (High Contrast):
```tsx
<p className="text-slate-700 dark:text-slate-200">
```

---

---

## 🔧 Migration Guide

### Old Approach (Manual dark: variants everywhere):
```tsx
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
  <p className="text-slate-700 dark:text-slate-200">...</p>
</div>
```

### New Approach (Semantic utilities):
```tsx
<div className="bg-surface text-primary">
  <p className="text-secondary">...</p>
</div>
```

**Benefits**:
- Less code duplication
- Consistent design language
- Easier to maintain
- Self-documenting

---

## 📋 Common Mistakes & Solutions

### ❌ Mistake 1: Missing dark: variant
```tsx
<p className="text-slate-900">  {/* White text on white bg in dark mode! */}
```

**✅ Solution**: Use semantic utility or add dark: variant
```tsx
<p className="text-primary">  {/* Auto handles dark mode */}
// OR
<p className="text-slate-900 dark:text-slate-50">
```

### ❌ Mistake 2: Wrong text color for background
```tsx
<div className="bg-slate-900">  {/* Dark background */}
  <p className="text-slate-900">  {/* Dark text = invisible! */}
</div>
```

**✅ Solution**: Match text to background context
```tsx
<div className="bg-surface">  {/* Auto: white (light) / slate-900 (dark) */}
  <p className="text-primary">  {/* Auto: slate-900 (light) / slate-50 (dark) */}
</div>
```

### ❌ Mistake 3: Using neutral-* colors
```tsx
<div className="bg-neutral-800 text-neutral-300">
```

**✅ Solution**: Use slate-* colors from design system
```tsx
<div className="bg-slate-900 dark:bg-slate-800 text-slate-900 dark:text-slate-200">
// OR better:
<div className="bg-surface text-primary">
```

---

**Last Updated**: 2025-01-23
**Standard**: WCAG 2.1 Level AAA
**Dark Mode**: Class-based strategy
