# 🗺️ Web Map Features - User Guide

## ✅ Các tính năng đã implement

### 1. **Màu phân cấp độ nguy hiểm** (Severity Color Coding) 🔴🟡🟢

**Mục đích:** Người dùng nhìn ngay biết vùng nào nguy hiểm nhất

**Cách hoạt động:**
- **🔴 Đỏ (Nguy hiểm cao)**: Alert/SOS với trust_score ≥ 70%
- **🟡 Vàng (Cảnh báo)**: Trust_score 40-70% hoặc sự kiện đường bộ
- **🟢 Xanh (Bình thường)**: Trust_score < 40%

**Hiển thị:**
- Marker có halo màu xung quanh (pulse animation)
- Legend ở góc phải trên cho biết ý nghĩa màu
- Emoji + màu phối hợp để dễ nhận biết

**Code location:**
- `apps/web/components/MapViewClustered.tsx` - functions `getSeverity()`, `getMarkerColor()`

---

### 2. **Hot News Ticker** 📰 (Tin chạy ngang màn hình)

**Mục đích:** Hiển thị tin nóng như đài truyền hình

**Tính năng:**
- Chạy ngang ở đáy màn hình
- Tự động lọc tin HOT (chỉ hiện tin quan trọng: ALERT/SOS/ROAD với trust score cao)
- Pause khi hover chuột
- Click vào tin → có thể zoom tới vị trí (tùy chỉnh)
- Hiển thị: Icon + Tiêu đề + Tỉnh + Thời gian

**Thiết kế:**
- Gradient đỏ-cam (eye-catching)
- Label "HOT NEWS" với dot nhấp nháy
- Scroll mượt, lặp vô tận

**Code location:**
- `apps/web/components/NewsTicker.tsx`
- Integrated in `apps/web/app/map/page.tsx`

---

### 3. **Filter theo bán kính** (Radius Filter) 📍

**Mục đích:** Click 1 điểm trên bản đồ → chỉ hiện tin trong phạm vi X km quanh đó

**Cách sử dụng:**
1. Giữ **Ctrl** (Windows) hoặc **Cmd** (Mac)
2. Click vào 1 điểm bất kỳ trên map
3. Hệ thống vẽ vòng tròn bán kính 20km màu xanh
4. Sidebar + Ticker chỉ hiển thị tin trong vòng tròn
5. Badge hiện ở góc trái dưới: "📍 Bán kính 20km" với nút [✕ Xóa]

**Chi tiết kỹ thuật:**
- Sử dụng Haversine formula để tính khoảng cách
- Filter client-side sau khi fetch từ API
- Vòng tròn vẽ bằng Mapbox circle layer

**Code location:**
- `apps/web/app/map/page.tsx` - state `radiusFilter`, function `calculateDistance()`
- `apps/web/components/MapViewClustered.tsx` - radius circle visualization

---

### 4. **Filter theo tỉnh (tương tác dropdown)** 🏙️

**Hiện tại:**
- Dropdown ở góc phải trên
- Chọn tỉnh → API filter → chỉ hiện tin tỉnh đó

**Tương lai (có thể mở rộng):**
- Click vào vùng tỉnh trên bản đồ → tự động set filter tỉnh đó
- Cần thêm GeoJSON boundaries của các tỉnh miền Trung

---

## 🎨 UI/UX Highlights

### Màu sắc & Design System
- **Primary Blue**: `#2563EB` (filters, controls)
- **Error Red**: `#DC2626` (high severity)
- **Warning Orange**: `#F59E0B` (medium severity)
- **Success Green**: `#10B981` (low severity)
- **Gradient Ticker**: `from-red-600 to-orange-600`

### Animations
- Marker hover: `scale-125` + shadow tăng
- Pulse effect: vòng tròn màu quanh marker
- Ticker scroll: `60s linear infinite`
- Smooth transitions: `duration-200`

### Responsive
- Desktop: Sidebar cố định bên trái
- Mobile: Bottom sheet slide up
- Ticker: Thu nhỏ text trên mobile
- Legend: Có thể ẩn trên màn hình nhỏ (tùy chỉnh)

---

## 📊 Luồng người dùng (User Flow)

### Scenario 1: Xem tổng quan
1. Mở trang `/map`
2. Nhìn bản đồ → nhận biết ngay vùng đỏ (nguy hiểm), vàng (cảnh báo), xanh (bình thường)
3. Đọc ticker dưới → biết tin HOT nhất
4. Scroll sidebar → xem chi tiết từng báo cáo

### Scenario 2: Tìm tin quanh vị trí cụ thể
1. Ctrl+Click vào 1 điểm (ví dụ: nhà mình)
2. Vòng tròn 20km hiện ra
3. Sidebar chỉ hiển thị tin trong vòng tròn
4. Nếu cần mở rộng: Click [✕ Xóa] để reset

### Scenario 3: Lọc theo loại + tỉnh
1. Dropdown góc phải: chọn "SOS" + "Quảng Trị"
2. Bản đồ chỉ hiện marker SOS ở Quảng Trị
3. Sidebar update theo
4. Ticker vẫn hiện tin HOT toàn vùng (không bị filter)

---

## 🚀 Cách test

### 1. Test Severity Colors
```bash
# Tạo test reports với trust_score khác nhau
docker compose exec api python3 << EOF
from app.database import get_db_context, Report
from uuid import uuid4
from datetime import datetime

reports = [
    {"trust_score": 0.9, "province": "Quảng Trị", "title": "HIGH - Đỏ"},
    {"trust_score": 0.5, "province": "Đà Nẵng", "title": "MEDIUM - Vàng"},
    {"trust_score": 0.2, "province": "Quảng Nam", "title": "LOW - Xanh"}
]

with get_db_context() as db:
    for r in reports:
        report = Report(
            id=uuid4(),
            type="ALERT",
            source="TEST",
            title=r["title"],
            province=r["province"],
            trust_score=r["trust_score"],
            lat=16.0 + (reports.index(r) * 0.5),
            lon=108.0,
            status="new",
            media=[],
            created_at=datetime.utcnow()
        )
        db.add(report)
    db.commit()
EOF
```

Refresh web → sẽ thấy 3 marker màu khác nhau!

### 2. Test Hot News Ticker
- Tạo ít nhất 3-5 reports với `type=ALERT` và `trust_score >= 0.7`
- Mở `/map` → ticker sẽ chạy
- Hover chuột → ticker pause
- Click 1 item → console log report (có thể custom zoom tới vị trí)

### 3. Test Radius Filter
- Zoom vào 1 vùng có nhiều marker
- Ctrl+Click vào 1 điểm
- Xem vòng tròn xanh hiện ra
- Sidebar chỉ hiển thị marker trong vòng tròn
- Click [✕ Xóa] → reset

---

## 📁 Files Changed

### New Files
- `apps/web/components/NewsTicker.tsx` - Ticker component

### Modified Files
- `apps/web/app/map/page.tsx`
  - Added `radiusFilter` state
  - Added `calculateDistance()` function
  - Integrated `NewsTicker` component
  - Pass props to MapView

- `apps/web/components/MapViewClustered.tsx`
  - Added `getSeverity()` and `getMarkerColor()` functions
  - Updated marker rendering with color halos
  - Added severity legend
  - Added radius circle layer
  - Added map click handler
  - Added radius filter badge UI

---

## 🔧 Configuration

### Radius size (hiện tại: 20km)
Để đổi:
```typescript
// In apps/web/app/map/page.tsx, line ~336
setRadiusFilter({ lat, lng, radius: 20 })  // Change 20 to desired km
```

### Ticker speed
```typescript
// In apps/web/components/NewsTicker.tsx, line ~127
animation: isPaused ? 'none' : 'ticker 60s linear infinite',
// Change 60s to slower (90s) or faster (30s)
```

### Severity thresholds
```typescript
// In apps/web/components/MapViewClustered.tsx
const getSeverity = (report: Report) => {
  if ((report.type === 'ALERT' || report.type === 'SOS') && report.trust_score >= 0.7) {
    return 'high'  // Change 0.7 threshold here
  }
  // ...
}
```

---

## ✨ Next Steps (Optional Features)

### 1. Province Boundaries Click-to-Filter
- Thêm GeoJSON layer cho boundaries 9 tỉnh miền Trung
- onClick province → set `selectedProvince` state
- Highlight province đang chọn

### 2. Adjustable Radius
- Thay vì cố định 20km, cho user chọn 10/20/50km
- Slider hoặc buttons

### 3. Save Filters
- LocalStorage lưu filter preferences
- Auto-restore khi user quay lại

### 4. Ticker Click → Zoom
Hiện tại ticker click chỉ console.log. Có thể:
```typescript
onReportClick={(report) => {
  if (report.lat && report.lon) {
    // Zoom to report location
    setViewState({
      longitude: report.lon,
      latitude: report.lat,
      zoom: 12
    })
  }
}}
```

### 5. Mobile Optimizations
- Hide legend on small screens
- Smaller ticker height on mobile
- Swipe gestures for radius clear

---

## 🎯 Summary

✅ **4 Features Implemented:**
1. Severity color coding (Red/Yellow/Green)
2. Hot News ticker (scrolling banner)
3. Radius filter (Ctrl+Click)
4. Enhanced UI with legend

🚀 **Ready to use!** Chỉ cần:
```bash
docker compose up -d
# Open http://localhost:3002/map
```

**Người dùng sẽ có trải nghiệm:**
- Nhìn ngay biết vùng nào nguy hiểm (màu)
- Đọc tin HOT ở ticker
- Click để lọc theo bán kính
- Sidebar tự động update

**Hub thông tin 1 nguồn hoàn chỉnh!** 🎉
