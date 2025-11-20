# Emergency API Endpoints - Flood Response

> **Context**: Rapid deployment for Central Vietnam flooding
> **Timeline**: 24-72 hours
> **Priority**: Life-saving features first

---

## API Endpoints Overview

| Priority | Endpoint | Method | Purpose | Time |
|----------|----------|--------|---------|------|
| 🔴 CRITICAL | `/distress` | POST | Submit rescue request | 30min |
| 🔴 CRITICAL | `/distress` | GET | List active distress reports | 20min |
| 🔴 CRITICAL | `/distress/{id}` | PATCH | Update status (admin) | 15min |
| 🟠 HIGH | `/traffic/disruptions` | GET | List active road closures | 30min |
| 🟠 HIGH | `/traffic/disruptions` | POST | Report traffic disruption | 20min |
| 🟠 HIGH | `/check-area` | GET | Check safety of location | 30min |
| 🟡 MEDIUM | `/emergency/summary` | GET | Emergency dashboard data | 20min |

**Total API dev time: ~3 hours**

---

## 1. Distress Reports API (CRITICAL)

### POST `/distress` - Submit Rescue Request

**Purpose**: Allow citizens to report emergency situations requiring rescue.

**Request Body**:
```json
{
  "lat": 12.2388,
  "lon": 109.1967,
  "urgency": "critical",
  "description": "Nhà bị ngập sâu 1.5m, có 2 người già và 3 trẻ em, không thể di chuyển",
  "num_people": 5,
  "has_injuries": false,
  "has_children": true,
  "has_elderly": true,
  "contact_name": "Nguyễn Văn A",
  "contact_phone": "0901234567",
  "media_urls": [
    "https://storage.example.com/distress/image1.jpg"
  ],
  "source": "user_report"
}
```

**Validation**:
- `lat`: required, -90 to 90
- `lon`: required, -180 to 180
- `urgency`: required, enum ['critical', 'high', 'medium', 'low']
- `description`: required, min 10 chars
- `num_people`: optional, default 1, min 1
- `contact_phone`: optional, validated Vietnamese phone format

**Response** (201 Created):
```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "created_at": "2025-11-19T12:34:56Z",
    "status": "pending",
    "urgency": "critical",
    "lat": 12.2388,
    "lon": 109.1967,
    "description": "Nhà bị ngập sâu 1.5m...",
    "num_people": 5,
    "has_injuries": false,
    "has_children": true,
    "has_elderly": true,
    "contact_name": "Nguyễn Văn A",
    "contact_phone": "0901234567",
    "verified": false
  },
  "meta": {
    "message": "Báo cáo khẩn cấp đã được tiếp nhận. Lực lượng cứu hộ sẽ liên hệ sớm nhất.",
    "tracking_code": "DIST-20251119-001"
  }
}
```

**Error Responses**:
- 400: Invalid coordinates or missing required fields
- 429: Rate limit exceeded (max 5 reports per IP per hour)

**Rate Limiting**: 5 requests/hour per IP (prevent spam, but allow legitimate updates)

---

### GET `/distress` - List Distress Reports

**Purpose**: View active rescue requests (for admin dashboard or map visualization).

**Query Parameters**:
```
?lat=12.2388&lon=109.1967&radius_km=20  # Spatial filter
&status=pending,in_progress              # Status filter
&urgency=critical,high                   # Urgency filter
&limit=50                                # Pagination
&offset=0
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "created_at": "2025-11-19T12:34:56Z",
      "updated_at": "2025-11-19T12:35:10Z",
      "status": "pending",
      "urgency": "critical",
      "lat": 12.2388,
      "lon": 109.1967,
      "description": "Nhà bị ngập sâu 1.5m...",
      "num_people": 5,
      "has_injuries": false,
      "has_children": true,
      "has_elderly": true,
      "verified": false,
      "distance_km": 2.3  // If lat/lon provided in query
    }
  ],
  "pagination": {
    "total": 47,
    "limit": 50,
    "offset": 0
  },
  "meta": {
    "critical_count": 12,
    "high_count": 23,
    "pending_count": 35
  }
}
```

**Performance**:
- PostGIS `ST_DWithin` for spatial filtering
- Index on `status` + `urgency`
- Cache results for 30 seconds (rapidly changing data)

---

### PATCH `/distress/{id}` - Update Status (Admin Only)

**Purpose**: Update distress report status as rescue progresses.

**Request Body**:
```json
{
  "status": "in_progress",
  "admin_notes": "Đội cứu hộ số 3 đã xuất phát, dự kiến đến 13:00",
  "assigned_to": "Đội cứu hộ số 3 - Nha Trang",
  "verified": true
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "in_progress",
    "updated_at": "2025-11-19T12:40:00Z",
    "admin_notes": "Đội cứu hộ số 3 đã xuất phát...",
    "assigned_to": "Đội cứu hộ số 3 - Nha Trang"
  }
}
```

**Auth**: Require admin token (future - for MVP, no auth, just log IP)

---

## 2. Traffic Disruptions API (HIGH PRIORITY)

### GET `/traffic/disruptions` - List Active Disruptions

**Purpose**: Show road closures, bridge collapses, landslides on map.

**Query Parameters**:
```
?lat=12.2388&lon=109.1967&radius_km=30
&type=flooded_road,landslide
&severity=impassable,dangerous
&is_active=true
&limit=100
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "created_at": "2025-11-19T08:00:00Z",
      "type": "landslide",
      "severity": "impassable",
      "lat": 12.1234,
      "lon": 108.9878,
      "road_name": "QL27",
      "location_description": "QL27 Km 15, đoạn Nha Trang - Đà Lạt",
      "description": "Sạt lở núi, đất đá vùi đường, tắc hoàn toàn. Ước tính 24h mới thông",
      "starts_at": "2025-11-19T07:30:00Z",
      "ends_at": null,
      "estimated_clearance": "2025-11-20T08:00:00Z",
      "alternative_route": "Đi QL26 qua Đà Lạt - Di Linh",
      "source": "CSGT",
      "verified": true,
      "is_active": true,
      "distance_km": 5.2
    }
  ],
  "pagination": {
    "total": 23,
    "limit": 100
  },
  "meta": {
    "impassable_count": 8,
    "dangerous_count": 10,
    "total_active": 23
  }
}
```

---

### POST `/traffic/disruptions` - Report Traffic Disruption

**Purpose**: Allow users/authorities to report road issues.

**Request Body**:
```json
{
  "lat": 12.1234,
  "lon": 108.9878,
  "type": "flooded_road",
  "severity": "impassable",
  "road_name": "QL1A",
  "location_description": "QL1A Km 1200, đoạn qua cầu Trà Bồng",
  "description": "Nước lũ tràn qua cầu, cao khoảng 0.5m",
  "alternative_route": "Đường tỉnh 626",
  "source": "user_report",
  "media_urls": ["https://..."]
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": "...",
    "created_at": "...",
    "type": "flooded_road",
    "severity": "impassable",
    "verified": false,
    "is_active": true
  },
  "meta": {
    "message": "Cảm ơn bạn đã báo cáo. Thông tin đang được xác minh."
  }
}
```

---

## 3. Check My Area API (HIGH PRIORITY)

### GET `/check-area` - Check Safety Near Location

**Purpose**: Quick API for "Is my area safe?" widget.

**Query Parameters**:
```
?lat=12.2388&lon=109.1967
&radius_km=5  # Default: 5km
```

**Response** (200 OK):
```json
{
  "location": {
    "lat": 12.2388,
    "lon": 109.1967,
    "radius_km": 5
  },
  "risk_assessment": {
    "level": "high",  // low, medium, high, critical
    "score": 7.5,     // 0-10 scale
    "summary": "Khu vực có 2 cảnh báo ngập lụt mức cao và 3 tuyến đường bị chia cắt"
  },
  "nearby_hazards": [
    {
      "type": "flood",
      "severity": "high",
      "distance_km": 2.1,
      "description": "Ngập lụt khu vực trung tâm Nha Trang"
    }
  ],
  "nearby_disruptions": [
    {
      "type": "flooded_road",
      "severity": "impassable",
      "road_name": "QL1A",
      "distance_km": 3.5,
      "description": "Nước ngập cao 0.8m"
    }
  ],
  "nearby_distress": {
    "count": 5,
    "critical_count": 2,
    "closest_distance_km": 1.2
  },
  "recommendations": [
    "🚨 Khu vực nguy hiểm - tránh di chuyển nếu không cần thiết",
    "☎️ Số điện thoại khẩn cấp: 113, 114, 115",
    "🗺️ Tuyến đường thay thế: QL26 (còn thông)"
  ]
}
```

**Logic**:
```python
def calculate_risk_score(hazards, disruptions, distress):
    score = 0

    # Hazards within 5km
    for h in hazards:
        if h.severity == 'critical': score += 3
        elif h.severity == 'high': score += 2
        elif h.severity == 'medium': score += 1

    # Disruptions
    if len(disruptions) >= 3: score += 2  # Many roads blocked

    # Active distress signals
    if distress['critical_count'] > 0: score += 2

    # Normalize to 0-10
    return min(score, 10)
```

**Performance**:
- Single spatial query joining hazards + disruptions + distress
- Cache per location (5km grid) for 5 minutes

---

## 4. Emergency Dashboard API (MEDIUM)

### GET `/emergency/summary` - Overall Situation Summary

**Purpose**: Dashboard widget showing total counts.

**Query Parameters**:
```
?province=Khánh Hòa  # Optional: filter by province
```

**Response** (200 OK):
```json
{
  "timestamp": "2025-11-19T12:45:00Z",
  "province": "Khánh Hòa",
  "summary": {
    "distress_reports": {
      "total_active": 47,
      "critical": 12,
      "high": 23,
      "pending": 35,
      "in_progress": 10,
      "resolved_today": 8
    },
    "hazards": {
      "total_active": 15,
      "critical": 3,
      "high": 7,
      "types": {
        "flood": 8,
        "landslide": 4,
        "heavy_rain": 3
      }
    },
    "traffic_disruptions": {
      "total_active": 23,
      "impassable": 8,
      "dangerous": 10,
      "major_roads_affected": ["QL1A", "QL27", "QL28"]
    }
  },
  "affected_areas": [
    {
      "district": "Nha Trang",
      "severity": "high",
      "distress_count": 18,
      "hazard_count": 5
    },
    {
      "district": "Cam Ranh",
      "severity": "medium",
      "distress_count": 7,
      "hazard_count": 2
    }
  ]
}
```

---

## 5. Implementation Priority Order

### Phase 1: Core Life-Saving (4 hours)

1. **Distress Reports** (2 hours)
   - POST `/distress` (30 min)
   - GET `/distress` (20 min)
   - PATCH `/distress/{id}` (15 min)
   - Test + debug (45 min)

2. **Traffic Disruptions** (1.5 hours)
   - GET `/traffic/disruptions` (30 min)
   - POST `/traffic/disruptions` (20 min)
   - Test + debug (40 min)

3. **Check My Area** (30 min)
   - GET `/check-area` endpoint
   - Risk calculation logic

### Phase 2: Dashboard (1 hour)

4. **Emergency Summary** (1 hour)
   - GET `/emergency/summary`
   - Aggregation queries
   - Province filtering

---

## 6. Rate Limiting & Security

### Rate Limits (SlowAPI)

```python
# Critical endpoints - prevent spam but allow legitimate use
"/distress POST": "5/hour per IP",     # Allow updates
"/distress GET": "60/minute",          # Map visualization
"/traffic/disruptions POST": "10/hour per IP",
"/traffic/disruptions GET": "60/minute",
"/check-area GET": "30/minute per IP"  # Widget polling
```

### Validation Rules

- Phone numbers: Vietnamese format (0X XXXX XXXX)
- Coordinates: Within Vietnam bounds (8-24°N, 102-110°E)
- Description: Min 10 chars, max 2000 chars
- Media URLs: Max 5 per report, validate URL format

### CORS

```python
# Allow web app to call API
origins = [
    "http://localhost:3002",
    "https://floodwatch.vn",
    "https://www.floodwatch.vn"
]
```

---

## 7. Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "INVALID_COORDINATES",
    "message": "Tọa độ không hợp lệ. Vui lòng kiểm tra lại.",
    "details": {
      "lat": "Phải trong khoảng -90 đến 90",
      "lon": "Phải trong khoảng -180 đến 180"
    }
  }
}
```

### Error Codes

- `INVALID_COORDINATES`: Invalid lat/lng
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_URGENCY`: Invalid urgency value
- `DESCRIPTION_TOO_SHORT`: Description < 10 chars
- `REPORT_NOT_FOUND`: Distress report ID not found
- `INVALID_STATUS_TRANSITION`: Cannot change status (e.g., resolved → pending)

---

## 8. Testing Checklist

### Distress Reports
- [ ] Create distress report with valid data → 201
- [ ] Create with invalid coordinates → 400
- [ ] Create with missing description → 400
- [ ] Get distress reports within 10km → returns correct data
- [ ] Get distress reports by urgency filter → correct filtering
- [ ] Update status to in_progress → 200
- [ ] Update status with admin notes → notes saved

### Traffic Disruptions
- [ ] Create traffic disruption → 201
- [ ] Get active disruptions → returns only is_active=true
- [ ] Get disruptions by road name → correct filtering
- [ ] Spatial query within 20km → correct distance calculation

### Check My Area
- [ ] Query safe area → risk_level = low
- [ ] Query dangerous area (near hazards) → risk_level = high
- [ ] Query with invalid coordinates → 400
- [ ] Query returns correct nearby counts

---

## 9. Frontend Integration Notes

### Map Layers

```typescript
// DistressLayer.tsx - Similar to HazardLayer
<Source id="distress-points" type="geojson" data={distressGeoJSON}>
  <Layer
    id="distress-critical"
    type="circle"
    filter={['==', ['get', 'urgency'], 'critical']}
    paint={{
      'circle-radius': 12,
      'circle-color': '#DC2626',  // Red
      'circle-stroke-width': 3,
      'circle-stroke-color': '#FFFFFF'
    }}
  />
</Source>

// TrafficLayer.tsx
<Source id="traffic-disruptions" type="geojson" data={disruptionsGeoJSON}>
  <Layer
    id="traffic-impassable"
    type="symbol"
    layout={{
      'icon-image': 'road-closed',  // Custom icon
      'icon-size': 1.5
    }}
  />
</Source>
```

### Check My Area Widget

```typescript
// components/CheckMyAreaWidget.tsx
const { data, isLoading } = useCheckArea({
  lat: userLocation.latitude,
  lng: userLocation.longitude,
  radius_km: 5
})

return (
  <div className={`alert alert-${data.risk_assessment.level}`}>
    <h3>{data.risk_assessment.summary}</h3>
    <ul>
      {data.recommendations.map(r => <li>{r}</li>)}
    </ul>
  </div>
)
```

---

**Spec complete. Ready to implement APIs immediately.**
