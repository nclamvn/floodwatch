# 📝 Manual Report Form - Specification

> **Mục đích:** Form để staff/contributors nhập tay tin từ nguồn không tự động crawl được (Facebook, Zalo groups, phone calls, etc.)

---

## 🎯 Use Cases

### 1. Staff monitoring community sources
- Thấy post quan trọng trên Facebook Group "Quảng Trị 24h"
- Cross-check với nguồn khác
- Nhập vào form → report xuất hiện trên map

### 2. Phone hotline reports
- Người dân gọi hotline báo ngập đường
- Staff ghi chép → nhập form
- Auto-assign trust_score dựa vào "citizen_report"

### 3. NGO/Rescue team field reports
- Đội cứu trợ trực tiếp tại hiện trường
- Chụp ảnh, ghi tọa độ
- Nhập form với trust_score cao (0.85+)

---

## 🧱 Form Structure

### Page: `/submit` (hoặc `/admin/reports/new`)

**Access Control:** Chỉ authenticated users (staff/approved contributors)

---

### ✏️ Fields

#### 1. **Type** (Required)
- Radio buttons or Dropdown
- Options:
  - 🚨 **ALERT** - Cảnh báo thiên tai (mưa lớn, lũ quét, sạt lở)
  - 🆘 **SOS** - Cần cứu trợ khẩn cấp
  - 🚧 **ROAD** - Đường bị ngập/sạt lở/tắc
  - 📦 **NEEDS** - Nhu yếu phẩm (nước, lương thực)
  - ℹ️ **INFO** - Thông tin chung (thời tiết, dự báo)

**Default:** ALERT

---

#### 2. **Title** (Required)
- Text input (max 200 chars)
- Placeholder: "Ví dụ: Ngập sâu 1m tại Quốc lộ 1A đoạn qua Quảng Trị"
- Validation:
  - Min 10 characters
  - No all-caps (suggest proper case)

---

#### 3. **Description** (Optional)
- Textarea (max 1000 chars)
- Placeholder: "Chi tiết tình hình, mức độ nghiêm trọng, số người ảnh hưởng..."
- Rich text (optional): Bold, bullet points

---

#### 4. **Location** (Required)

**Option A: Map Picker (Recommended)**
```
[   Interactive Map   ]
  - Click to set location
  - Search by address
  - Current position button

📍 Selected: 16.8012, 107.0913
   Province: Quảng Trị (auto-detected)
```

**Option B: Manual Input**
- Province dropdown (9 tỉnh miền Trung)
- District input (optional)
- Lat/Lon inputs (for advanced users)

**Auto-detect:**
- After clicking map → reverse geocode → fill province field

---

#### 5. **Severity** (Required)
- Slider hoặc Radio buttons: 1-4
- Visual indicators:

```
1 ⚪ LOW      - Thông tin thường
2 🟢 MEDIUM   - Cảnh báo nhẹ
3 🟡 HIGH     - Nguy hiểm, cần theo dõi
4 🔴 CRITICAL - Khẩn cấp, cần cứu trợ ngay
```

**Default:** 2 (Medium)

**Helper text:**
> **Hướng dẫn chọn Severity:**
> - **Level 4 (CRITICAL):** Người bị kẹt, cần cứu hộ khẩn, ngập > 1.5m
> - **Level 3 (HIGH):** Ngập 0.5-1.5m, đường tắc hoàn toàn, sạt lở lớn
> - **Level 2 (MEDIUM):** Ngập < 0.5m, cảnh báo mưa, giao thông khó khăn
> - **Level 1 (LOW):** Thông tin dự báo, mưa nhẹ, cảnh báo sớm

---

#### 6. **Source Type** (Required)
- Dropdown:
  - 🏛️ Government official (trust: 0.95)
  - 📰 News media (trust: 0.85)
  - 👥 Community group (trust: 0.65)
  - 📞 Citizen phone call (trust: 0.60)
  - 👨‍🚒 Rescue team on-site (trust: 0.90)
  - 🔗 Social media (trust: 0.60)
  - 🧑‍💻 Staff verified (trust: 0.75)

**Auto-calculate trust_score:**
```typescript
const trustScoreMap = {
  'government': 0.95,
  'news_media': 0.85,
  'rescue_team': 0.90,
  'staff_verified': 0.75,
  'community': 0.65,
  'citizen_call': 0.60,
  'social_media': 0.60,
}

// If staff manually verifies (checkbox), boost +0.10
```

---

#### 7. **Source URL** (Optional but Recommended)
- Text input
- Placeholder: "Link Facebook/Zalo/News (nếu có)"
- Validation: Must be valid URL if provided
- Display: Show favicon + domain preview

**Example:**
```
https://www.facebook.com/groups/quangtri24h/posts/123456
→ Preview: 📘 facebook.com/groups/quangtri24h
```

---

#### 8. **Media Upload** (Optional)
- Image/Video upload (max 5 files, 10MB each)
- Drag-and-drop area
- Preview thumbnails
- Auto-extract EXIF GPS if available

```
[  📷 Drag photos here or click to upload  ]

Uploaded:
- [thumbnail] flood_street.jpg (2.3 MB) [×]
- [thumbnail] car_stuck.jpg (1.8 MB) [×]
```

---

#### 9. **Contact Info** (Optional, Private)
- For staff to follow up
- Not displayed publicly
- Fields: Name, Phone, Email

---

### 🎨 Form Layout (Desktop)

```
┌─────────────────────────────────────────────┐
│  📝 Báo cáo tình hình mưa lũ                 │
├─────────────────────────────────────────────┤
│                                              │
│  Type: [🚨 ALERT ▼]                         │
│                                              │
│  Title: [_________________________]          │
│                                              │
│  Description:                                │
│  [                                    ]      │
│  [                                    ]      │
│                                              │
│  ┌─────────────────────┐  Severity: 🟡 HIGH│
│  │                     │  ░░░●═══            │
│  │   MAP PICKER        │  1  2  3  4         │
│  │   (Click to set)    │                     │
│  │                     │  Source Type:       │
│  └─────────────────────┘  [Community ▼]     │
│  📍 Quảng Trị                                │
│     16.8012, 107.0913                        │
│                                              │
│  Source URL: [___________________]           │
│                                              │
│  Media: [📷 Upload photos]                   │
│                                              │
│  ┌──────────────────────────────┐           │
│  │  Preview on Map              │           │
│  │  [mini map with marker]      │           │
│  └──────────────────────────────┘           │
│                                              │
│  [Cancel]              [Submit Report]       │
└─────────────────────────────────────────────┘
```

---

### 📱 Mobile Optimizations

- Full-screen map picker modal
- Larger tap targets (min 44px)
- Photo capture from camera directly
- GPS auto-detect with "Use my location" button
- Simplified layout (stack all fields vertically)

---

## 🔒 Validation & Error Handling

### Client-side
```typescript
const validateForm = (data: FormData) => {
  const errors = []

  if (!data.title || data.title.length < 10) {
    errors.push('Title must be at least 10 characters')
  }

  if (!data.lat || !data.lon) {
    errors.push('Please select a location on the map')
  }

  if (!data.province) {
    errors.push('Province is required')
  }

  if (data.source_url && !isValidUrl(data.source_url)) {
    errors.push('Source URL must be a valid URL')
  }

  return errors
}
```

### Server-side (API)
```python
# POST /reports/manual
@router.post("/reports/manual")
def create_manual_report(
    data: ManualReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate user has permission
    if not current_user.can_submit_reports:
        raise HTTPException(403, "Not authorized")

    # Validate coordinates
    if not (-90 <= data.lat <= 90) or not (-180 <= data.lon <= 180):
        raise HTTPException(400, "Invalid coordinates")

    # Calculate trust_score
    base_trust = TRUST_SCORES[data.source_type]
    if data.staff_verified:
        base_trust = min(base_trust + 0.10, 0.98)

    # Create report
    report = Report(
        type=data.type,
        title=data.title,
        description=data.description,
        province=data.province,
        lat=data.lat,
        lon=data.lon,
        severity=data.severity,
        trust_score=base_trust,
        source=f"manual_{data.source_type}",
        source_url=data.source_url,
        media=data.media,
        status="new",
        created_by=current_user.id
    )
    db.add(report)
    db.commit()

    # Send Telegram notifications
    notify_subscribers_for_alert(db, report)

    return {"success": True, "report_id": report.id}
```

---

## 🎯 UX Best Practices

### 1. **Map-first approach**
- Most important field is location
- Make map picker prominent and easy to use
- Show preview of report on map before submit

### 2. **Smart defaults**
- Pre-fill province if user has a default region
- Remember last selected source_type
- Auto-detect severity based on type (ALERT → severity 3, SOS → severity 4)

### 3. **Instant feedback**
- Show trust_score calculation live
- Preview how marker will look on map (color based on severity)
- Character counter for title/description

### 4. **Confirmation**
- After submit: "✅ Report submitted! View on map"
- Link directly to map zoomed to that location
- Option to submit another report

---

## 🧪 Testing Checklist

- [ ] Submit report with all fields filled → appears on map
- [ ] Submit with minimal fields (only required) → works
- [ ] Invalid coordinates → show error
- [ ] Upload 3 images → all saved correctly
- [ ] Source URL validation → only allows valid URLs
- [ ] Trust score calculation → matches source type
- [ ] Telegram notification sent to subscribers
- [ ] Mobile: map picker works on touch screen
- [ ] Mobile: camera capture works
- [ ] Permission check: unauthorized user → 403 error

---

## 📊 Analytics to Track

- Reports per day by source_type
- Average trust_score of manual reports
- Most active contributors
- Response time (time from event → report submitted)
- Media attachment rate (% of reports with photos)

---

## 🔮 Future Enhancements

### Phase 2
- **Bulk import** - CSV upload for multiple reports
- **Report templates** - Quick templates for common scenarios
- **AI suggestions** - Auto-suggest severity based on description
- **Duplicate detection** - Warn if similar report exists nearby

### Phase 3
- **Community voting** - Let verified users upvote reports
- **Real-time collaboration** - Multiple staff can edit same report
- **Mobile app** - Native iOS/Android for faster field reporting
- **Offline mode** - Save drafts, sync when online

---

**Prepared by:** FloodWatch Dev Team
**Last updated:** 2025-11-18
