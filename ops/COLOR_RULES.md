# 🎨 Color & Severity Rules

> **Mục đích:** Quy tắc chính thức để map từ report → severity level → màu sắc trên bản đồ

---

## 🔢 Severity Level (1-4)

### Definition

| Level | Name     | Emoji | Description                          | User Action           |
|-------|----------|-------|--------------------------------------|-----------------------|
| 1     | LOW      | ⚪     | Thông tin thường, dự báo sớm         | Theo dõi              |
| 2     | MEDIUM   | 🟢     | Cảnh báo nhẹ, cần chú ý              | Chuẩn bị              |
| 3     | HIGH     | 🟡     | Nguy hiểm, cần hành động             | Di chuyển nếu cần     |
| 4     | CRITICAL | 🔴     | Khẩn cấp, nguy hiểm đến tính mạng    | Sơ tán ngay           |

---

## 📏 Severity Calculation Rules

### Input Variables
1. **Report Type** (ALERT, SOS, ROAD, NEEDS, INFO)
2. **Trust Score** (0.0 - 1.0)
3. **Source Type** (government, news, community, etc.)
4. **Keywords** in title/description (optional enhancement)

---

### Base Severity by Type

```typescript
const BASE_SEVERITY: Record<string, number> = {
  'SOS': 4,        // Emergency rescue → always critical
  'ALERT': 3,      // Weather alert → default high
  'ROAD': 2,       // Road issue → default medium
  'NEEDS': 2,      // Supply needs → default medium
  'INFO': 1,       // General info → default low
}
```

---

### Trust Score Modifier

```typescript
function adjustSeverityByTrust(baseSeverity: number, trustScore: number): number {
  // Low trust → reduce severity by 1 level
  if (trustScore < 0.5) {
    return Math.max(1, baseSeverity - 1)
  }

  // Very high trust + high base → keep as-is
  if (trustScore >= 0.8) {
    return baseSeverity
  }

  // Medium trust → no change
  return baseSeverity
}
```

**Examples:**
- SOS with trust 0.9 → severity 4 (CRITICAL)
- SOS with trust 0.4 → severity 3 (HIGH) - reduced due to low trust
- ALERT with trust 0.95 → severity 3 (HIGH)
- INFO with trust 0.9 → severity 1 (LOW)

---

### Source Type Boost (Optional)

Certain source types can boost severity by +1 level:

```typescript
const SOURCE_BOOST: Record<string, number> = {
  'gov_weather': +1,        // KTTV → boost by 1
  'gov_disaster': +1,       // PCTT → boost by 1
  'rescue_team': +1,        // Field report → boost by 1
  'news_national': 0,       // No boost
  'news_local': 0,
  'community': 0,
}

function applySourceBoost(severity: number, sourceType: string): number {
  const boost = SOURCE_BOOST[sourceType] || 0
  return Math.min(4, severity + boost)
}
```

**Example:**
- ROAD report from DRVN (gov_transport) with trust 0.96
  - Base: 2 (MEDIUM)
  - Source boost: +1
  - Final: 3 (HIGH) → show as yellow/orange

---

### Keyword Enhancement (Future)

If description contains urgent keywords → boost +1:

**Critical keywords:**
- "cấp cứu", "cứu hộ", "kẹt", "bị nạn", "nguy hiểm", "khẩn cấp"
- "ngập sâu", "lũ quét", "vỡ đập", "sạt lở lớn"

```typescript
function detectUrgentKeywords(text: string): boolean {
  const urgent = ['cấp cứu', 'cứu hộ', 'kẹt', 'ngập sâu', 'lũ quét', 'vỡ đập']
  return urgent.some(keyword => text.toLowerCase().includes(keyword))
}

if (detectUrgentKeywords(report.title + ' ' + report.description)) {
  severity = Math.min(4, severity + 1)
}
```

---

### Complete Algorithm

```typescript
function calculateSeverity(report: Report): number {
  // 1. Base severity from type
  let severity = BASE_SEVERITY[report.type] || 2

  // 2. Adjust by trust score
  severity = adjustSeverityByTrust(severity, report.trust_score)

  // 3. Apply source type boost
  severity = applySourceBoost(severity, report.source)

  // 4. (Optional) Keyword boost
  if (detectUrgentKeywords(report.title + ' ' + (report.description || ''))) {
    severity = Math.min(4, severity + 1)
  }

  // 5. Manual override if severity field exists
  if (report.severity) {
    severity = report.severity
  }

  return severity
}
```

---

## 🎨 Color Mapping

### Primary Colors (Markers on Map)

```typescript
const SEVERITY_COLORS = {
  1: '#10B981',  // Green-500   (LOW)
  2: '#10B981',  // Green-500   (MEDIUM) - same as low for now
  3: '#F59E0B',  // Yellow-500  (HIGH)
  4: '#DC2626',  // Red-600     (CRITICAL)
}

// Alternative: 4-level gradation
const SEVERITY_COLORS_ALT = {
  1: '#10B981',  // Green
  2: '#84CC16',  // Lime (yellow-green)
  3: '#F59E0B',  // Orange
  4: '#DC2626',  // Red
}
```

**Current Implementation:** 3-level (Low/Medium = Green, High = Yellow, Critical = Red)

**Reason:** Simpler visual hierarchy, easier to understand at a glance

---

### Color States

#### Normal (Default)
```css
.marker-severity-1,
.marker-severity-2 {
  background: #10B981; /* Green */
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2); /* Green halo */
}

.marker-severity-3 {
  background: #F59E0B; /* Yellow */
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3);
}

.marker-severity-4 {
  background: #DC2626; /* Red */
  box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.4);
  animation: pulse 2s infinite; /* Pulse for critical */
}
```

#### Hover
```css
.marker:hover {
  transform: scale(1.25);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}
```

#### Selected (Clicked)
```css
.marker.selected {
  border: 3px solid #FFFFFF;
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.5); /* Blue highlight */
}
```

---

### Pulse Animation (Critical Only)

```css
@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.1);
  }
}
```

**Usage:** Only apply to severity 4 (CRITICAL) to draw attention

---

## 🗺️ Map Implementation

### Frontend Code (React/TypeScript)

```typescript
// apps/web/components/MapViewClustered.tsx

interface Report {
  id: string
  type: string
  trust_score: number
  source: string
  severity?: number  // Manual override
  title: string
  description?: string
}

type SeverityLevel = 1 | 2 | 3 | 4

function calculateSeverity(report: Report): SeverityLevel {
  // Use manual override if exists
  if (report.severity) {
    return report.severity as SeverityLevel
  }

  // Base severity
  let severity = 2  // Default medium

  if (report.type === 'SOS') severity = 4
  else if (report.type === 'ALERT') severity = 3
  else if (report.type === 'ROAD' || report.type === 'NEEDS') severity = 2
  else if (report.type === 'INFO') severity = 1

  // Trust adjustment
  if (report.trust_score < 0.5) {
    severity = Math.max(1, severity - 1) as SeverityLevel
  }

  // Source boost
  if (report.source.startsWith('gov_') || report.source.includes('kttv') || report.source.includes('pctt')) {
    severity = Math.min(4, severity + 1) as SeverityLevel
  }

  return severity as SeverityLevel
}

function getMarkerColor(severity: SeverityLevel): string {
  switch (severity) {
    case 1:
    case 2:
      return '#10B981'  // Green
    case 3:
      return '#F59E0B'  // Yellow
    case 4:
      return '#DC2626'  // Red
  }
}

function getMarkerClassName(severity: SeverityLevel): string {
  return `marker marker-severity-${severity} ${severity === 4 ? 'pulse' : ''}`
}
```

---

### Backend API Response

```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "type": "ALERT",
      "title": "Mưa lớn tại Quảng Trị",
      "trust_score": 0.98,
      "source": "kttv_national",
      "severity": 4,  // ← Calculated server-side
      "color": "#DC2626",  // ← Optionally pre-calculated
      "province": "Quảng Trị",
      "lat": 16.8012,
      "lon": 107.0913
    }
  ]
}
```

**Option 1:** Frontend calculates severity (current implementation)
**Option 2:** Backend pre-calculates and sends `severity` + `color` fields

**Recommendation:** Frontend calculation for flexibility, but backend can validate

---

## 📱 UI Components

### Legend (Top-right of map)

```tsx
<div className="absolute top-20 right-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg">
  <h3 className="font-bold text-sm mb-2">Mức độ nguy hiểm</h3>

  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full bg-[#DC2626]" />
      <span className="text-xs">🔴 Khẩn cấp</span>
    </div>

    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full bg-[#F59E0B]" />
      <span className="text-xs">🟡 Cảnh báo cao</span>
    </div>

    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full bg-[#10B981]" />
      <span className="text-xs">🟢 Thông tin</span>
    </div>
  </div>
</div>
```

---

### Sidebar Report Card

```tsx
<article className={`report-card severity-${severity}`}>
  <div className="flex items-center gap-2">
    {/* Color indicator */}
    <div
      className="w-1 h-full"
      style={{ background: getMarkerColor(severity) }}
    />

    {/* Badge */}
    <span className={`badge badge-${report.type}`}>
      {report.type}
    </span>

    {severity === 4 && (
      <span className="badge badge-critical animate-pulse">
        KHẨN CẤP
      </span>
    )}
  </div>

  <h3>{report.title}</h3>
  <p>{report.description}</p>
</article>
```

---

### Hot News Ticker

Ticker background already uses red-orange gradient.
Text color by severity:

```typescript
function getTickerTextClass(severity: SeverityLevel): string {
  switch (severity) {
    case 4: return 'text-white font-bold'  // Critical → bold white
    case 3: return 'text-yellow-100'       // High → light yellow
    default: return 'text-white/90'        // Normal
  }
}
```

---

## 🧪 Testing

### Test Cases

| Report Type | Trust | Source          | Expected Severity | Expected Color |
|-------------|-------|-----------------|-------------------|----------------|
| SOS         | 0.90  | kttv_national   | 4                 | #DC2626 (Red)  |
| ALERT       | 0.95  | kttv_national   | 4 (boosted)       | #DC2626 (Red)  |
| ALERT       | 0.88  | vnexpress       | 3                 | #F59E0B (Yellow)|
| ROAD        | 0.86  | drvn_roads      | 3 (boosted)       | #F59E0B (Yellow)|
| ROAD        | 0.45  | community       | 1 (reduced)       | #10B981 (Green)|
| INFO        | 0.90  | news_local      | 1                 | #10B981 (Green)|
| NEEDS       | 0.70  | citizen_report  | 2                 | #10B981 (Green)|

### Validation Script

```python
# scripts/test_severity_rules.py
test_cases = [
    {"type": "SOS", "trust": 0.9, "source": "kttv_national", "expected": 4},
    {"type": "ALERT", "trust": 0.95, "source": "kttv_national", "expected": 4},
    {"type": "ALERT", "trust": 0.88, "source": "vnexpress_disaster", "expected": 3},
    {"type": "ROAD", "trust": 0.86, "source": "drvn_roads", "expected": 3},
    {"type": "ROAD", "trust": 0.45, "source": "community", "expected": 1},
]

for case in test_cases:
    report = create_mock_report(**case)
    severity = calculate_severity(report)
    assert severity == case["expected"], f"Failed for {case}"

print("✅ All tests passed!")
```

---

## 📊 Analytics & Monitoring

### Metrics to Track

1. **Severity Distribution**
   - % of reports by severity level
   - Goal: 60% low, 30% medium/high, 10% critical

2. **Color Balance**
   - Map should not be all red (alarm fatigue)
   - Aim for balanced color distribution

3. **False Positives**
   - Reports marked CRITICAL but not actually critical
   - Track user feedback / downvotes

4. **Response Time by Severity**
   - Critical reports should get attention in < 5 min
   - High in < 30 min

---

## 🔮 Future Enhancements

### Phase 2
- **User-adjustable thresholds** - Let advanced users customize color rules
- **Heatmap mode** - Aggregate severity → show danger zones
- **Temporal color** - Older reports fade in opacity
- **Weather overlay** - Show radar + severity together

### Phase 3
- **AI severity prediction** - ML model trained on historical data
- **Multi-factor scoring** - Consider time of day, population density, etc.
- **Dynamic legend** - Show only colors currently on map

---

**Prepared by:** FloodWatch Dev Team
**Last updated:** 2025-11-18
