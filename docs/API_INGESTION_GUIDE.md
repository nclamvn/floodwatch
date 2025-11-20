# FloodWatch API Ingestion Guide (Option 1: API-First)

**Version:** 1.1.1
**Last Updated:** 2025-11-10
**Status:** ✅ Production Ready

## Overview

FloodWatch API cung cấp 3 POST endpoints để nhận dữ liệu real-time từ nhiều nguồn khác nhau. Đây là phương pháp được khuyến nghị để đưa hệ thống lên production nhanh nhất.

## Verified Endpoints

### ✅ Tested & Working

| Endpoint | Purpose | Rate Limit | Auth Required |
|----------|---------|------------|---------------|
| `POST /ingest/community` | Báo cáo từ cộng đồng | 30/min per IP | ❌ No |
| `POST /ingest/road-event` | Cập nhật tình trạng đường | None | ❌ No |
| `POST /ingest/alerts` | Cảnh báo từ KTTV/NCHMF | None | ❌ No |

---

## 1. Community Reports (`/ingest/community`)

**Use case:** Nhận báo cáo từ người dân, tổ chức địa phương, field teams.

### Request Model

```json
{
  "type": "SOS",              // Required: "SOS" | "ROAD" | "NEEDS"
  "text": "string",           // Required: Mô tả chi tiết
  "lat": 16.0544,            // Required: -90 to 90
  "lon": 108.2022,           // Required: -180 to 180
  "province": "string",      // Optional: Tỉnh/thành
  "district": "string",      // Optional: Quận/huyện
  "ward": "string",          // Optional: Phường/xã
  "media": []                // Optional: Array of image URLs
}
```

### Example Request

```bash
curl -X POST 'https://your-domain.com/ingest/community' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "SOS",
    "text": "Gia đình 5 người bị cô lập tại xóm 3, cần thực phẩm và nước uống khẩn cấp",
    "lat": 16.0544,
    "lon": 108.2022,
    "province": "Đà Nẵng",
    "district": "Hòa Vang",
    "ward": "Hòa Phú",
    "media": [
      "https://cloudinary.com/image1.jpg",
      "https://cloudinary.com/image2.jpg"
    ]
  }'
```

### Success Response

```json
{
  "status": "success",
  "report_id": "4db50ab4-52e4-4516-848b-41406d6a1b96",
  "trust_score": 0.5,
  "is_duplicate": false,
  "timestamp": "2025-11-10T11:54:15.057249"
}
```

### Rate Limiting

- **30 requests per minute** per IP address
- HTTP 429 nếu vượt limit
- Counter reset mỗi phút

---

## 2. Road Events (`/ingest/road-event`)

**Use case:** Cập nhật tình trạng giao thông từ báo chí, traffic monitors, CSGT.

### Request Model

```json
{
  "segment_name": "string",        // Required: Tên đoạn đường
  "status": "RESTRICTED",          // Required: "OPEN" | "CLOSED" | "RESTRICTED"
  "reason": "string",              // Optional: Lý do
  "province": "string",            // Required: Tỉnh/thành
  "district": "string",            // Optional: Quận/huyện
  "lat": 16.2024,                 // Optional: -90 to 90
  "lon": 108.1158,                // Optional: -180 to 180
  "last_verified": "ISO8601",     // Optional: Thời gian xác minh
  "source": "string"              // Required: Nguồn (PRESS, CSGT, etc.)
}
```

### Example Request

```bash
curl -X POST 'https://your-domain.com/ingest/road-event' \
  -H 'Content-Type: application/json' \
  -d '{
    "segment_name": "QL1A đoạn Hải Vân - Lăng Cô",
    "status": "RESTRICTED",
    "reason": "Sạt lở taluy, hạn chế tốc độ 40km/h",
    "province": "Thừa Thiên Huế",
    "district": "Phú Lộc",
    "lat": 16.2024,
    "lon": 108.1158,
    "source": "VNEXPRESS"
  }'
```

### Success Response

```json
{
  "status": "success",
  "road_id": "cec32307-e935-4fc4-a2a2-4b828401a0c8",
  "segment_name": "QL1A đoạn Hải Vân - Lăng Cô",
  "timestamp": "2025-11-10T11:54:25.585507"
}
```

### Upsert Logic

- **Unique key:** `(segment_name, province)`
- Nếu đã tồn tại → **update** nếu `last_verified` mới hơn
- Nếu chưa tồn tại → **insert**

---

## 3. KTTV Alerts (`/ingest/alerts`)

**Use case:** Nhận cảnh báo từ KTTV/NCHMF qua webhook hoặc API integration.

### Request Model

```json
{
  "title": "string",          // Required: Tiêu đề cảnh báo
  "province": "string",       // Required: Tỉnh/thành
  "lat": 16.4637,            // Optional: -90 to 90
  "lon": 107.5908,           // Optional: -180 to 180
  "level": "high",           // Optional: "low" | "medium" | "high"
  "source": "KTTV",          // Optional: Default "KTTV"
  "description": "string"    // Optional: Mô tả chi tiết
}
```

### Example Request (Batch)

```bash
curl -X POST 'https://your-domain.com/ingest/alerts' \
  -H 'Content-Type: application/json' \
  -d '[
    {
      "title": "Cảnh báo mưa lớn Quảng Nam",
      "province": "Quảng Nam",
      "lat": 15.5394,
      "lon": 108.0191,
      "level": "high",
      "source": "KTTV",
      "description": "Mưa vừa đến mưa to, có nơi mưa rất to từ 18h đến 6h sáng mai"
    },
    {
      "title": "Cảnh báo lũ quét Thừa Thiên Huế",
      "province": "Thừa Thiên Huế",
      "lat": 16.2637,
      "lon": 107.6809,
      "level": "high",
      "source": "NCHMF",
      "description": "Nguy cơ lũ quét, sạt lở đất khu vực miền núi"
    }
  ]'
```

### Success Response

```json
{
  "status": "success",
  "ingested": 2,
  "total_received": 2,
  "timestamp": "2025-11-10T12:00:00.000000"
}
```

### Multi-Source Agreement

- Tự động tăng `trust_score` nếu nhiều nguồn báo cáo cùng vùng
- Duplicate detection dựa trên location proximity (1 giờ gần đây)

---

## Integration Scenarios

### Scenario 1: Mobile App (Community Reports)

```javascript
// React Native / Flutter
async function submitReport(data) {
  const response = await fetch('https://api.floodwatch.vn/ingest/community', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: data.type,
      text: data.description,
      lat: data.location.latitude,
      lon: data.location.longitude,
      province: data.province,
      media: data.imageUrls
    })
  });

  const result = await response.json();
  console.log('Report ID:', result.report_id);
  console.log('Trust Score:', result.trust_score);
}
```

### Scenario 2: News Scraper (Road Events)

```python
import requests
from datetime import datetime

def push_road_event(segment, status, reason, province):
    response = requests.post(
        'https://api.floodwatch.vn/ingest/road-event',
        json={
            'segment_name': segment,
            'status': status,
            'reason': reason,
            'province': province,
            'last_verified': datetime.utcnow().isoformat(),
            'source': 'VNEXPRESS_SCRAPER'
        }
    )
    return response.json()
```

### Scenario 3: KTTV Webhook

```bash
# KTTV server → FloodWatch API
# Cấu hình webhook URL tại KTTV: https://api.floodwatch.vn/ingest/alerts

# KTTV sẽ POST mỗi khi có cảnh báo mới
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Server sẵn sàng (Ubuntu 22.04+, Docker, docker-compose)
- [ ] Domain đã trỏ DNS (A record)
- [ ] SSL certificate (Let's Encrypt qua certbot)
- [ ] `.env.prod` đã cấu hình đầy đủ

### Step 1: Generate Secrets

```bash
cd /opt/floodwatch
./infra/scripts/generate_secrets.sh
nano .env.prod  # Điền MAPBOX_TOKEN, CLOUDINARY, etc.
```

### Step 2: Deploy

```bash
./infra/scripts/deploy_production.sh
```

### Step 3: Test Endpoints

```bash
# Test health
curl https://your-domain.com/health

# Test community report
curl -X POST https://your-domain.com/ingest/community \
  -H 'Content-Type: application/json' \
  -d @test_community.json

# Verify data
curl https://your-domain.com/api/v1/reports?limit=5
```

### Step 4: Monitor

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f api

# Metrics
curl https://your-domain.com/metrics
```

---

## API Keys (Optional)

Nếu muốn bảo vệ endpoints với API keys:

```bash
# Generate API key qua /ops
curl -X POST 'https://your-domain.com/ops/apikeys/create' \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -d '{"org_name": "Partner Org", "scopes": ["ingest"]}'

# Sử dụng key
curl -X POST 'https://your-domain.com/ingest/community' \
  -H 'X-API-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d @data.json
```

---

## Error Handling

### Common Errors

| Status Code | Error | Solution |
|-------------|-------|----------|
| 400 | Validation error | Check required fields |
| 422 | Invalid coordinates | lat: -90 to 90, lon: -180 to 180 |
| 429 | Rate limit exceeded | Wait 60 seconds |
| 500 | Internal server error | Check logs |

### Example Error Response

```json
{
  "detail": [
    {
      "loc": ["body", "lat"],
      "msg": "ensure this value is greater than or equal to -90",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

---

## Performance Characteristics

### Tested Metrics (Local)

- **Throughput:** ~200 requests/second per endpoint
- **Latency (p95):** < 150ms
- **Database:** PostGIS with spatial indexes
- **Trust score calculation:** < 10ms

### Scaling Recommendations

- **< 10k reports/day:** Single server OK
- **10k-100k reports/day:** Add read replicas
- **> 100k reports/day:** Implement queue (Redis + Celery)

---

## Next Steps

### Week 1: Deploy Infrastructure

```bash
# Ngày 1-2: Setup server
./infra/scripts/preflight.sh
./infra/scripts/deploy_production.sh

# Ngày 3-4: Test với partners
# Cung cấp API docs và test endpoints

# Ngày 5-7: Monitor & tune
./infra/scripts/smoke_test.sh
```

### Week 2: Integrate Data Sources

1. **Community App:** Mobile app cho người dân báo cáo
2. **Partner APIs:** KTTV, CSGT webhook integration
3. **News Monitor:** (Optional) Scraper cho báo chí

### Week 3: Optimize

1. Add API keys cho production partners
2. Setup monitoring alerts (UptimeRobot, Grafana)
3. Configure auto-scaling (nếu traffic cao)

---

## Support

**Production Issues:**
- Check logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Smoke test: `./infra/scripts/smoke_test.sh`
- Health check: `curl https://your-domain.com/health`

**Contact:** [Your contact info]

---

**Document Status:** ✅ Tested with local environment (9 reports, 5 road events)
**Last Test:** 2025-11-10 18:54 ICT
