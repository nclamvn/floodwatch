# FloodWatch API Specification

> **API Contract**: RESTful endpoints + Request/Response schemas + Error handling

---

## 📋 Table of Contents

- [Tầng 1: Hazard Events API](#tầng-1-hazard-events-api)
- [Tầng 3: Alert Subscriptions API](#tầng-3-alert-subscriptions-api)
- [Tầng 2: Risk Scores API](#tầng-2-risk-scores-api-🔒-future)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Authentication](#authentication)

---

## Tầng 1: Hazard Events API

### Base URL
```
/api/hazards
```

---

### 1.1 GET /api/hazards

Lấy danh sách sự kiện thiên tai (có filtering, pagination).

**Query Parameters**:
```typescript
interface GetHazardsParams {
  // Spatial filters
  lat?: number           // User latitude
  lng?: number           // User longitude
  radius_km?: number     // Search radius (default: 10km)

  // Type filters
  types?: string         // Comma-separated: 'flood,heavy_rain'
  severity?: string      // Comma-separated: 'high,critical'

  // Time filters
  active_only?: boolean  // Only ongoing/upcoming (default: true)
  from?: string          // ISO 8601: '2025-01-19T00:00:00Z'
  to?: string

  // Pagination
  page?: number          // Default: 1
  limit?: number         // Default: 20, max: 100

  // Sorting
  sort?: string          // 'distance' | 'severity' | 'starts_at' (default: 'distance')
}
```

**Request Example**:
```bash
GET /api/hazards?lat=21.0278&lng=105.8342&radius_km=20&types=flood,heavy_rain&active_only=true
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "heavy_rain",
      "severity": "high",
      "location": {
        "type": "Point",
        "coordinates": [105.8342, 21.0278]
      },
      "affected_area": null,
      "radius_km": 15,
      "starts_at": "2025-01-19T14:00:00Z",
      "ends_at": "2025-01-20T02:00:00Z",
      "source": "KTTV",
      "external_id": "KTTV-2025-001",
      "raw_payload": {
        "rainfall_mm": 120,
        "warning_level": 3,
        "affected_districts": ["Ba Đình", "Hoàn Kiếm"]
      },
      "distance_km": 2.5,  // Only if lat/lng provided
      "created_at": "2025-01-19T12:00:00Z",
      "updated_at": "2025-01-19T13:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "total_pages": 1
  },
  "meta": {
    "query_time_ms": 45,
    "filters_applied": {
      "spatial": true,
      "type": ["flood", "heavy_rain"],
      "active_only": true
    }
  }
}
```

---

### 1.2 GET /api/hazards/:id

Lấy chi tiết 1 sự kiện thiên tai.

**Request Example**:
```bash
GET /api/hazards/550e8400-e29b-41d4-a716-446655440000
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "heavy_rain",
    "severity": "high",
    "location": {
      "type": "Point",
      "coordinates": [105.8342, 21.0278]
    },
    "affected_area": {
      "type": "Polygon",
      "coordinates": [[
        [105.8, 21.0],
        [105.9, 21.0],
        [105.9, 21.1],
        [105.8, 21.1],
        [105.8, 21.0]
      ]]
    },
    "radius_km": 15,
    "starts_at": "2025-01-19T14:00:00Z",
    "ends_at": "2025-01-20T02:00:00Z",
    "source": "KTTV",
    "external_id": "KTTV-2025-001",
    "raw_payload": {
      "rainfall_mm": 120,
      "warning_level": 3,
      "affected_districts": ["Ba Đình", "Hoàn Kiếm"],
      "forecast_url": "https://kttv.gov.vn/..."
    },
    "created_at": "2025-01-19T12:00:00Z",
    "updated_at": "2025-01-19T13:30:00Z",
    "created_by": null,

    // Additional computed fields
    "status": "active",  // 'upcoming' | 'active' | 'ended'
    "time_remaining_hours": 10.5
  }
}
```

**Error** (404 Not Found):
```json
{
  "error": {
    "code": "HAZARD_NOT_FOUND",
    "message": "Không tìm thấy sự kiện thiên tai với ID: 550e8400-...",
    "status": 404
  }
}
```

---

### 1.3 POST /api/hazards

Tạo sự kiện thiên tai mới (admin only).

**Authentication**: Required (`Authorization: Bearer <token>`)

**Request Body**:
```json
{
  "type": "flood",
  "severity": "high",
  "location": {
    "type": "Point",
    "coordinates": [105.8342, 21.0278]
  },
  "affected_area": {
    "type": "Polygon",
    "coordinates": [[...]]
  },
  "radius_km": 10,
  "starts_at": "2025-01-19T14:00:00Z",
  "ends_at": "2025-01-20T02:00:00Z",
  "source": "manual_admin",
  "external_id": null,
  "raw_payload": {
    "notes": "Xả lũ hồ Hòa Bình",
    "flow_rate_m3s": 3500
  }
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440002",
    "type": "flood",
    "severity": "high",
    // ... full object
  },
  "meta": {
    "matched_subscriptions": 45,  // Number of users that will be notified
    "notifications_queued": true
  }
}
```

**Validation Error** (400 Bad Request):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "status": 400,
    "details": [
      {
        "field": "location.coordinates",
        "message": "Longitude phải nằm trong khoảng -180 đến 180"
      },
      {
        "field": "severity",
        "message": "Giá trị phải là: info, low, medium, high, critical"
      }
    ]
  }
}
```

---

### 1.4 PATCH /api/hazards/:id

Cập nhật sự kiện thiên tai (admin only).

**Authentication**: Required

**Request Body** (partial update):
```json
{
  "severity": "critical",  // Nâng cấp mức độ
  "ends_at": "2025-01-20T06:00:00Z",  // Gia hạn thời gian
  "raw_payload": {
    "update": "Mưa tăng thêm 50mm/h"
  }
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    // ... full updated object
  },
  "meta": {
    "updated_fields": ["severity", "ends_at", "raw_payload"],
    "severity_changed": true,
    "re_notification_triggered": true  // Sent alerts to users who care about 'critical'
  }
}
```

---

### 1.5 DELETE /api/hazards/:id

Xóa sự kiện thiên tai (admin only, soft delete).

**Authentication**: Required

**Response** (200 OK):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deleted": true,
    "deleted_at": "2025-01-19T15:00:00Z"
  }
}
```

---

## Tầng 3: Alert Subscriptions API

### Base URL
```
/api/subscriptions
```

---

### 3.1 POST /api/subscriptions

Đăng ký cảnh báo mới.

**Authentication**: Optional (public endpoint)

**Request Body**:
```json
{
  "contact_email": "user@example.com",
  "telegram_chat_id": null,
  "phone_number": null,

  "location": {
    "type": "Point",
    "coordinates": [105.8342, 21.0278]
  },
  "radius_km": 5,

  "alert_types": ["flood", "heavy_rain", "dam_release"],
  "min_severity": "medium",
  "notify_via": ["email"],

  "quiet_hours_start": "22:00:00",
  "quiet_hours_end": "07:00:00"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440003",
    "contact_email": "user@example.com",
    "location": {
      "type": "Point",
      "coordinates": [105.8342, 21.0278]
    },
    "radius_km": 5,
    "alert_types": ["flood", "heavy_rain", "dam_release"],
    "min_severity": "medium",
    "notify_via": ["email"],
    "is_active": false,  // Waiting for confirmation
    "confirmed": false,
    "confirmation_token": "abc123...",  // Not exposed in real response
    "created_at": "2025-01-19T15:00:00Z"
  },
  "meta": {
    "confirmation_required": true,
    "confirmation_email_sent": true,
    "confirmation_link": "https://floodwatch.vn/confirm/abc123..."  // Dev only
  }
}
```

**Validation Error** (400):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phải cung cấp ít nhất một phương thức liên hệ (email, telegram, hoặc số điện thoại)",
    "status": 400
  }
}
```

---

### 3.2 GET /api/subscriptions/confirm/:token

Xác nhận email (public link).

**Request Example**:
```bash
GET /api/subscriptions/confirm/abc123def456...
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440003",
    "confirmed": true,
    "is_active": true,
    "confirmed_at": "2025-01-19T15:05:00Z"
  },
  "meta": {
    "message": "Xác nhận thành công! Bạn sẽ nhận cảnh báo từ bây giờ.",
    "nearby_hazards": 2  // Number of active hazards in their area
  }
}
```

**Error** (400 Bad Request):
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Link xác nhận không hợp lệ hoặc đã hết hạn",
    "status": 400
  }
}
```

---

### 3.3 GET /api/subscriptions

Lấy danh sách đăng ký của user (authenticated).

**Authentication**: Required (JWT token with user_id)

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440003",
      "contact_email": "user@example.com",
      "location": {
        "type": "Point",
        "coordinates": [105.8342, 21.0278]
      },
      "radius_km": 5,
      "alert_types": ["flood", "heavy_rain"],
      "min_severity": "medium",
      "notify_via": ["email", "telegram"],
      "is_active": true,
      "confirmed": true,
      "created_at": "2025-01-19T15:00:00Z",
      "last_notified_at": "2025-01-19T16:30:00Z",

      // Computed fields
      "active_hazards_count": 2,
      "total_notifications_sent": 15
    }
  ],
  "pagination": {
    "total": 1
  }
}
```

---

### 3.4 PATCH /api/subscriptions/:id

Cập nhật đăng ký.

**Authentication**: Required (must own subscription)

**Request Body**:
```json
{
  "radius_km": 10,  // Tăng bán kính
  "min_severity": "high",  // Chỉ nhận cảnh báo nghiêm trọng
  "quiet_hours_start": null,  // Tắt quiet hours
  "quiet_hours_end": null
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440003",
    // ... full updated object
  }
}
```

---

### 3.5 DELETE /api/subscriptions/:id

Hủy đăng ký.

**Authentication**: Required (must own subscription)

**Response** (200 OK):
```json
{
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440003",
    "deleted": true,
    "is_active": false
  },
  "meta": {
    "message": "Đã hủy đăng ký cảnh báo thành công"
  }
}
```

---

### 3.6 GET /api/subscriptions/:id/notifications

Lịch sử cảnh báo đã nhận.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "850e8400-e29b-41d4-a716-446655440004",
      "hazard_event": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "type": "heavy_rain",
        "severity": "high"
      },
      "distance_km": 3.2,
      "triggered_at": "2025-01-19T14:05:00Z",
      "sent_at": "2025-01-19T14:05:32Z",
      "delivery_status": "sent",
      "channels": [
        {
          "channel": "email",
          "delivery_status": "delivered",
          "sent_at": "2025-01-19T14:05:32Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

---

## Tầng 2: Risk Scores API (🔒 Future)

### Base URL
```
/api/risk-scores
```

---

### 2.1 GET /api/risk-scores

Lấy điểm rủi ro cho khu vực.

**Query Parameters**:
```typescript
interface GetRiskScoresParams {
  lat?: number
  lng?: number
  district?: string    // VD: "Ba Đình"
  province?: string    // VD: "Hà Nội"
  min_level?: string   // 'moderate' | 'high' | 'very_high'
}
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "950e8400-e29b-41d4-a716-446655440005",
      "district_name": "Ba Đình",
      "province_name": "Hà Nội",
      "risk_level": "high",
      "score": 78.5,
      "factors": {
        "flood_history": 0.6,
        "elevation": 0.3,
        "drainage_capacity": 0.1
      },
      "calculated_at": "2025-01-19T00:00:00Z",
      "valid_until": "2025-01-26T00:00:00Z"
    }
  ]
}
```

---

## Common Patterns

### Request Headers

All requests should include:
```http
Content-Type: application/json
Accept: application/json
User-Agent: FloodWatch-Web/1.0
```

Authenticated requests:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Response Envelope

All successful responses follow this structure:
```json
{
  "data": { /* single object */ },
  // OR
  "data": [ /* array */ ],

  "pagination": {  // Only for list endpoints
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  },

  "meta": {  // Optional metadata
    "query_time_ms": 45,
    "cached": false
  }
}
```

---

### Pagination

Default: `page=1`, `limit=20`
Maximum: `limit=100`

**Request**:
```
GET /api/hazards?page=2&limit=50
```

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 150,
    "total_pages": 3,
    "has_next": true,
    "has_prev": true,
    "next_page": 3,
    "prev_page": 1
  }
}
```

---

### Sorting

**Query parameter**:
```
GET /api/hazards?sort=-severity,starts_at
```

**Convention**:
- `sort=field` → ascending
- `sort=-field` → descending
- Multiple: comma-separated

**Supported fields**:
- `distance` (only if lat/lng provided)
- `severity`
- `starts_at`
- `created_at`

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message in Vietnamese",
    "status": 400,
    "details": [  // Optional, for validation errors
      {
        "field": "location.coordinates",
        "message": "Longitude phải nằm trong khoảng -180 đến 180",
        "value": 500
      }
    ],
    "timestamp": "2025-01-19T15:00:00Z",
    "request_id": "req_abc123"  // For support debugging
  }
}
```

---

### Error Codes

| HTTP Status | Code                     | Description                          |
|-------------|--------------------------|--------------------------------------|
| 400         | `VALIDATION_ERROR`       | Request body/params không hợp lệ     |
| 400         | `INVALID_TOKEN`          | Confirmation token không đúng        |
| 401         | `UNAUTHORIZED`           | Thiếu hoặc sai authentication token  |
| 403         | `FORBIDDEN`              | Không có quyền truy cập resource     |
| 404         | `HAZARD_NOT_FOUND`       | Không tìm thấy sự kiện thiên tai     |
| 404         | `SUBSCRIPTION_NOT_FOUND` | Không tìm thấy đăng ký               |
| 409         | `DUPLICATE_SUBSCRIPTION` | Email đã đăng ký cho vị trí này      |
| 429         | `RATE_LIMIT_EXCEEDED`    | Quá nhiều requests (100/phút)        |
| 500         | `INTERNAL_SERVER_ERROR`  | Lỗi server                           |
| 503         | `SERVICE_UNAVAILABLE`    | Database hoặc worker down            |

---

### Example Error Responses

**400 Validation Error**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "status": 400,
    "details": [
      {
        "field": "radius_km",
        "message": "Bán kính phải từ 1 đến 50 km",
        "value": 100
      }
    ]
  }
}
```

**401 Unauthorized**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token xác thực không hợp lệ hoặc đã hết hạn",
    "status": 401
  }
}
```

**429 Rate Limit**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Bạn đã gửi quá nhiều requests. Vui lòng thử lại sau 60 giây.",
    "status": 429,
    "retry_after": 60
  }
}
```

**500 Internal Server Error**:
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
    "status": 500,
    "request_id": "req_abc123"
  }
}
```

---

## Authentication

### Method: JWT Bearer Token

**Login** (future endpoint):
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@floodwatch.vn",
  "password": "..."
}
```

**Response**:
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "user": {
      "id": "user_123",
      "email": "admin@floodwatch.vn",
      "role": "admin"
    }
  }
}
```

**Using the token**:
```http
GET /api/hazards
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Roles

| Role    | Permissions                                      |
|---------|--------------------------------------------------|
| `public`| GET hazards, POST subscriptions                  |
| `user`  | Manage own subscriptions, view notifications     |
| `admin` | Full CRUD on hazards, view all subscriptions     |

---

## Rate Limiting

| Endpoint Type          | Limit          | Window  |
|------------------------|----------------|---------|
| Public (GET)           | 100 req/min    | 1 min   |
| Public (POST)          | 10 req/min     | 1 min   |
| Authenticated (GET)    | 300 req/min    | 1 min   |
| Authenticated (POST)   | 50 req/min     | 1 min   |
| Admin (all)            | 1000 req/min   | 1 min   |

**Headers returned**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705675200
```

---

## Webhooks (🔒 Future)

Allow external systems to subscribe to hazard events.

**POST /api/webhooks**:
```json
{
  "url": "https://external-system.com/webhook",
  "events": ["hazard.created", "hazard.updated"],
  "secret": "webhook_secret_key"
}
```

**Payload sent to webhook URL**:
```json
{
  "event": "hazard.created",
  "timestamp": "2025-01-19T15:00:00Z",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    // ... full hazard object
  },
  "signature": "sha256=..."  // HMAC signature for verification
}
```

---

## Testing Endpoints

### Health Check
```http
GET /api/health

Response (200 OK):
{
  "status": "healthy",
  "services": {
    "database": "up",
    "redis": "up",
    "worker": "up"
  },
  "version": "1.0.0",
  "uptime_seconds": 86400
}
```

### Debug Endpoint (dev only)
```http
GET /api/debug/subscriptions/:id/match-hazards

Response:
{
  "subscription": { /* ... */ },
  "matched_hazards": [ /* ... */ ],
  "spatial_query": "SELECT ... ST_DWithin(...)",
  "query_explain": "..."
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { FloodWatchClient } from '@floodwatch/sdk'

const client = new FloodWatchClient({
  apiKey: process.env.FLOODWATCH_API_KEY
})

// Get nearby hazards
const hazards = await client.hazards.list({
  lat: 21.0278,
  lng: 105.8342,
  radius_km: 10,
  types: ['flood', 'heavy_rain'],
  active_only: true
})

// Subscribe to alerts
const subscription = await client.subscriptions.create({
  contact_email: 'user@example.com',
  location: { lat: 21.0278, lng: 105.8342 },
  radius_km: 5,
  alert_types: ['flood', 'heavy_rain'],
  notify_via: ['email']
})
```

---

### cURL Examples

**Get hazards**:
```bash
curl -X GET "https://api.floodwatch.vn/api/hazards?lat=21.0278&lng=105.8342&radius_km=10" \
  -H "Accept: application/json"
```

**Create subscription**:
```bash
curl -X POST "https://api.floodwatch.vn/api/subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_email": "user@example.com",
    "location": {"type": "Point", "coordinates": [105.8342, 21.0278]},
    "radius_km": 5,
    "alert_types": ["flood", "heavy_rain"],
    "notify_via": ["email"]
  }'
```

**Create hazard (admin)**:
```bash
curl -X POST "https://api.floodwatch.vn/api/hazards" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "flood",
    "severity": "high",
    "location": {"type": "Point", "coordinates": [105.8342, 21.0278]},
    "radius_km": 10,
    "starts_at": "2025-01-19T14:00:00Z",
    "source": "manual_admin"
  }'
```

---

## API Versioning

Current version: **v1** (implicit in `/api/...` paths)

Future versions will use explicit versioning:
- `/api/v2/hazards`
- Header: `Accept: application/vnd.floodwatch.v2+json`

---

**Last updated**: 2025-01-19
**Version**: 1.0
**Status**: 🔧 Tầng 1 & 3 spec locked, ready for implementation
