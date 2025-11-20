# FloodWatch - Stage 3 Report (72h) 📊

**Date:** 2025-10-31
**Duration:** 72 hours (Incremental delivery)
**Status:** ✅ Core features completed (PRs 6-10)

---

## 1. Tổng quan (Summary)

### ✅ Đã hoàn thành (Completed)

Stage 3 tập trung vào **production-ready features** và **operational tools**:

1. **PR-6: Cloudinary Image Upload** - Community reports can now include up to 3 images with validation
2. **PR-7: Road Event Ingestion** - Automated road status updates from press monitoring
3. **PR-8: Trust Score V1.5** - Enhanced scoring with time decay, duplicate detection, and multi-source agreement
4. **PR-9: Ops Dashboard** - Admin interface for report management with ADMIN_TOKEN authentication
5. **PR-10: Lite Mode + CSV Export** - Low-bandwidth HTML view and data export functionality

### 🔄 Deferred Features

- **PR-11: API Keys + Per-key Rate Limiting** - Can be implemented in Stage 4
- **PR-12: Telegram + Webhook Alerts** - Can be implemented in Stage 4

### Key Achievements

- ✅ Cloudinary integration for image uploads (client-side)
- ✅ Enhanced trust scoring with time decay and duplicate detection
- ✅ Operational dashboard for report management
- ✅ Low-bandwidth access mode (no JavaScript required)
- ✅ CSV export for data analysis
- ✅ Database migration for duplicate tracking
- ✅ Comprehensive structured logging for admin actions

---

## 2. Chi tiết thực hiện (Implementation Details)

### PR-6: Cloudinary Upload + Spam Prevention ✅

**Files Changed:**
- `apps/web/components/ImageUpload.tsx` (NEW)
- `apps/web/app/report/page.tsx` (UPDATED)
- `.env.example` (UPDATED)

**Features:**
- Client-side image upload to Cloudinary using unsigned upload preset
- File validation: 5MB max per image, image/* MIME types only
- Maximum 3 images per report
- Upload progress tracking with percentage display
- Image preview after upload
- Integrated into community report form

**Implementation:**
```typescript
// ImageUpload component validates files before upload
const validateFile = (file: File): string | null => {
  if (!file.type.startsWith('image/')) {
    return 'Only images allowed'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File too large (max 5MB)'
  }
  return null
}
```

**Acceptance Criteria Met:**
- ✅ Supports up to 3 images per report
- ✅ File size limited to 5MB per image
- ✅ Shows upload progress and preview
- ✅ Returns secure URLs stored in report.media array
- ✅ Rate limiting already in place (30 req/min per IP)

**Testing:**
```bash
# Visit the report form
open http://localhost:3000/report

# Try uploading:
# - Valid image (should succeed)
# - >5MB file (should reject)
# - Non-image file (should reject)
# - 4 images (should limit to 3)
```

---

### PR-7: /ingest/road-event + Cron Integration ✅

**Files Changed:**
- `apps/api/app/main.py` (UPDATED - added RoadEventIngest model and endpoint)
- `ops/cron/roads_press_watch.py` (UPDATED - now POSTs to API)

**Features:**
- `POST /ingest/road-event` endpoint for road status ingestion
- Upsert logic based on (segment_name, province) - updates if last_verified is newer
- Integrated roads_press_watch.py cron job to POST events to API
- Hash-based idempotency to prevent duplicate ingestion
- Structured logging for road events

**Implementation:**
```python
# Endpoint with upsert logic
@app.post("/ingest/road-event")
async def ingest_road_event(event: RoadEventIngest, db: Session = Depends(get_db)):
    road = RoadEventRepository.upsert_by_segment(
        db=db,
        segment_name=event.segment_name,
        province=event.province,
        update_data={...}
    )
    logger.info("road_event_ingested", road_id=str(road.id), ...)
```

**Acceptance Criteria Met:**
- ✅ Endpoint accepts road event data with segment_name, status, province
- ✅ Upserts based on (segment_name, province)
- ✅ Cron job successfully POSTs events
- ✅ Idempotency via hash-based deduplication
- ✅ Structured logging with road event details

**Testing:**
```bash
# Run the cron job manually
cd ops/cron
python roads_press_watch.py

# Check API logs for ingestion
# POST to /ingest/road-event with sample data:
curl -X POST http://localhost:8000/ingest/road-event \
  -H "Content-Type: application/json" \
  -d '{
    "segment_name": "QL1A",
    "status": "CLOSED",
    "reason": "Sạt lở nghiêm trọng",
    "province": "Quảng Trị"
  }'

# Query road events
curl http://localhost:8000/road-events?province=Quảng%20Trị
```

---

### PR-8: Trust Score V1.5 Enhanced ✅

**Files Changed:**
- `apps/api/app/services/trust_score.py` (NEW)
- `apps/api/app/database/models.py` (UPDATED - added duplicate_of field)
- `apps/api/app/services/report_repo.py` (UPDATED - added get_recent_for_duplicate_check)
- `apps/api/app/main.py` (UPDATED - integrated TrustScoreCalculator)
- `apps/api/migrations/versions/002_add_duplicate_of.py` (NEW)

**Features:**
- **Time Decay:** -0.1 per 6 hours (prevents old reports from staying at top)
- **Multi-source Agreement:** +0.2 bonus if multiple sources report similar events (60min window, 5km radius)
- **Duplicate Detection:** Uses title similarity (SequenceMatcher ≥0.88) or location proximity (<1km in 60min)
- **Enhanced Scoring Rules:**
  - Official source (KTTV/NCHMF/GOV): +0.5
  - GPS coordinates: +0.3
  - Media (≥1 image): +0.2
  - Province identified: +0.1/-0.1
  - Type bonuses: SOS +0.1, NEEDS +0.05
- **Duplicate Tracking:** `duplicate_of` field links duplicate reports to original

**Implementation:**
```python
class TrustScoreCalculator:
    @staticmethod
    def compute_score(report_data: Dict, existing_reports: Optional[List] = None) -> float:
        score = 0.0
        # ... scoring logic with time decay
        age_hours = (datetime.utcnow() - created_at).total_seconds() / 3600
        decay_periods = int(age_hours / 6)
        score -= decay_periods * 0.1

        # Multi-source agreement check
        if existing_reports:
            agreement_bonus = self._check_multi_source_agreement(...)
            score += agreement_bonus

        return min(1.0, max(0.0, score))

    @staticmethod
    def find_duplicates(report_data: Dict, existing_reports: List) -> List[str]:
        # Uses SequenceMatcher for title similarity
        # or haversine distance for location proximity
        ...
```

**Acceptance Criteria Met:**
- ✅ Trust scores decay over time (6-hour intervals)
- ✅ Multi-source agreement detected (within 60min, 5km)
- ✅ Duplicate detection using both text similarity and location
- ✅ duplicate_of field populated when duplicates found
- ✅ Haversine distance calculation for GPS proximity
- ✅ All scoring rules documented in code comments

**Testing:**
```bash
# Test trust score calculation
# 1. Create report from KTTV (should have high score ~0.8+)
# 2. Create similar community report within 5km (should get +0.2 agreement bonus)
# 3. Create exact duplicate (should be marked with duplicate_of)
# 4. Wait 6 hours (in production) - score should decay by 0.1

# Check duplicate detection
curl -X POST http://localhost:8000/ingest/community \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS",
    "text": "Ngập nặng cần cứu trợ",
    "lat": 16.4637,
    "lon": 107.5909,
    "province": "Quảng Trị"
  }'

# Submit duplicate (should be flagged)
curl -X POST http://localhost:8000/ingest/community \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS",
    "text": "Ngập nặng cần cứu trợ",
    "lat": 16.4640,
    "lon": 107.5910,
    "province": "Quảng Trị"
  }'
```

---

### PR-9: /ops Dashboard + Admin Actions ✅

**Files Changed:**
- `apps/api/app/main.py` (UPDATED - added ops endpoints)

**Features:**
- **GET /ops?token=ADMIN_TOKEN** - HTML dashboard showing all reports
- **Dashboard displays:**
  - ID, Time, Type, Source, Province, Trust Score, Status, Media count, Duplicate badge
  - Color-coded trust scores (green ≥0.7, orange ≥0.4, red <0.4)
  - Color-coded statuses (new=orange, verified=green, merged=blue, resolved=gray, invalid=red)
- **Admin Actions:**
  - `POST /ops/verify/:id` - Mark report as verified
  - `POST /ops/resolve/:id` - Mark report as resolved
  - `POST /ops/invalidate/:id` - Mark report as invalid
  - `POST /ops/merge` - Merge duplicate reports (form-based)
- **Authentication:** Simple token-based via ADMIN_TOKEN env var
- **Structured logging:** All admin actions logged with admin_action=True flag

**Implementation:**
```python
def verify_admin_token(token: Optional[str] = Query(None)):
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

@app.get("/ops", response_class=HTMLResponse)
async def ops_dashboard(
    token: str = Query(...),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    # Returns HTML table with inline action buttons
    ...
```

**Acceptance Criteria Met:**
- ✅ /ops dashboard accessible with ADMIN_TOKEN
- ✅ Shows all reports in HTML table (newest first, limit 200)
- ✅ Displays trust scores with color coding
- ✅ Shows duplicate badge when duplicate_of is set
- ✅ Action buttons for Verify/Resolve/Invalidate
- ✅ Actions update status and redirect back to dashboard
- ✅ All actions logged with structured logging

**Testing:**
```bash
# Get ADMIN_TOKEN from .env (default: dev-admin-token-123)
ADMIN_TOKEN="dev-admin-token-123"

# Access dashboard
open "http://localhost:8000/ops?token=$ADMIN_TOKEN"

# Try clicking action buttons:
# - Verify button (changes status to verified)
# - Resolve button (changes status to resolved)
# - Invalid button (changes status to invalid)

# Check logs for admin actions
docker-compose logs -f api | grep "admin_action"
```

---

### PR-10: /lite Mode + CSV Export ✅

**Files Changed:**
- `apps/api/app/main.py` (UPDATED - added /lite and /reports/export endpoints)

**Features:**
- **GET /lite** - Simple HTML table without JavaScript
  - Minimal CSS (print-friendly)
  - No external dependencies (no Mapbox, no React)
  - Filters: type, province, since (6h/24h/7d)
  - Shows: Time, Type, Source, Province, District, Title, Score, Status
  - Useful for low-bandwidth or print scenarios
- **GET /reports/export?format=csv** - CSV export
  - Supports same filters as /lite
  - Max 1000 reports per export
  - Downloads as attachment with timestamp filename
  - Includes all fields: ID, timestamps, location, trust score, media count, duplicate_of

**Implementation:**
```python
@app.get("/lite", response_class=HTMLResponse)
async def lite_mode(db: Session = Depends(get_db), ...):
    # Returns simple HTML with <table> and minimal inline CSS
    # No JavaScript required
    ...

@app.get("/reports/export")
async def export_reports(db: Session = Depends(get_db), ...):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Created At", "Type", ...])
    for report in reports:
        writer.writerow([...])

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

**Acceptance Criteria Met:**
- ✅ /lite renders simple HTML table (no JavaScript)
- ✅ Supports filters: type, province, since
- ✅ Print-friendly CSS (@media print hides filters)
- ✅ CSV export with Content-Disposition: attachment
- ✅ CSV includes all relevant fields
- ✅ Export respects same filters as /lite

**Testing:**
```bash
# Access lite mode
open http://localhost:8000/lite

# Try filters
open http://localhost:8000/lite?province=Quảng%20Bình
open http://localhost:8000/lite?type=SOS
open http://localhost:8000/lite?since=6h

# Export CSV
curl -O http://localhost:8000/reports/export?format=csv
open floodwatch_reports_*.csv

# Export filtered data
curl -O "http://localhost:8000/reports/export?format=csv&province=Quảng%20Bình&type=SOS"

# Test print mode
open http://localhost:8000/lite
# Press Cmd+P to print - filters should be hidden
```

---

## 3. Database Migrations

### Migration 002: Add duplicate_of Column

**File:** `apps/api/migrations/versions/002_add_duplicate_of.py`

**Changes:**
- Added `duplicate_of` UUID column to `reports` table
- Created index on `duplicate_of` for faster duplicate lookups
- Nullable field (NULL = not a duplicate)

**Running Migration:**
```bash
cd apps/api
alembic upgrade head

# Verify migration
alembic current
# Should show: 002_add_duplicate_of (head)
```

**Rollback:**
```bash
alembic downgrade -1
```

---

## 4. Commands để Test

### Start Services
```bash
# Start all services
docker-compose up -d

# Check services
docker-compose ps

# Watch API logs
docker-compose logs -f api
```

### Test PR-6: Cloudinary Upload
```bash
# Visit report form
open http://localhost:3000/report

# Steps:
# 1. Select report type (SOS/ROAD/NEEDS)
# 2. Enter description
# 3. Click "Get current location"
# 4. Select province
# 5. Upload 1-3 images (test validation)
# 6. Submit report
# 7. Check that media URLs are in response
```

### Test PR-7: Road Event Ingestion
```bash
# Run cron manually
cd ops/cron
python roads_press_watch.py

# Check ingested events
curl http://localhost:8000/road-events | jq

# Ingest custom event
curl -X POST http://localhost:8000/ingest/road-event \
  -H "Content-Type: application/json" \
  -d '{
    "segment_name": "Đèo Hải Vân",
    "status": "RESTRICTED",
    "reason": "Mưa lớn, hạn chế tốc độ",
    "province": "Đà Nẵng"
  }'
```

### Test PR-8: Trust Score V1.5
```bash
# Create official alert (should get high score ~0.8+)
curl -X POST http://localhost:8000/ingest/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "title": "Cảnh báo lũ cấp 3",
    "province": "Quảng Bình",
    "lat": 17.4670,
    "lon": 106.6220,
    "source": "KTTV"
  }]'

# Create community report nearby (should get multi-source bonus)
curl -X POST http://localhost:8000/ingest/community \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS",
    "text": "Nước lũ dâng cao cần cứu trợ",
    "lat": 17.4680,
    "lon": 106.6225,
    "province": "Quảng Bình"
  }'

# Create duplicate (should be flagged)
curl -X POST http://localhost:8000/ingest/community \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS",
    "text": "Nước lũ dâng cao cần cứu trợ",
    "lat": 17.4680,
    "lon": 106.6225,
    "province": "Quảng Bình"
  }'

# Check reports
curl http://localhost:8000/reports | jq '.data[] | {id, trust_score, duplicate_of}'
```

### Test PR-9: Ops Dashboard
```bash
# Get admin token from .env
ADMIN_TOKEN="dev-admin-token-123"

# Access dashboard
open "http://localhost:8000/ops?token=$ADMIN_TOKEN"

# Test without token (should get 401)
curl http://localhost:8000/ops
# {"detail":"Unauthorized: Invalid or missing admin token"}

# Test admin actions via CLI
REPORT_ID="..." # Get ID from dashboard

# Verify report
curl -X POST "http://localhost:8000/ops/verify/$REPORT_ID?token=$ADMIN_TOKEN"

# Check logs
docker-compose logs api | grep "admin_action"
```

### Test PR-10: Lite Mode + CSV Export
```bash
# Access lite mode
open http://localhost:8000/lite

# Test filters
open "http://localhost:8000/lite?type=SOS"
open "http://localhost:8000/lite?province=Quảng%20Bình"
open "http://localhost:8000/lite?since=6h"

# Download CSV
curl -O http://localhost:8000/reports/export?format=csv
cat floodwatch_reports_*.csv

# Download filtered CSV
curl -O "http://localhost:8000/reports/export?format=csv&type=SOS&province=Quảng%20Bình"
```

---

## 5. Logs / Screenshots

### Example: Trust Score Calculation

```json
{
  "event": "community_report_ingested",
  "report_id": "a3f5c7e9-1234-5678-90ab-cdef12345678",
  "type": "SOS",
  "province": "Quảng Bình",
  "trust_score": 0.75,
  "has_media": true,
  "is_duplicate": false,
  "duplicate_of": null,
  "ip": "192.168.1.100",
  "timestamp": "2025-10-31T10:30:45.123456Z"
}
```

### Example: Duplicate Detection

```json
{
  "event": "community_report_ingested",
  "report_id": "b7d8e2f1-5678-90ab-cdef-123456789abc",
  "type": "SOS",
  "province": "Quảng Bình",
  "trust_score": 0.72,
  "has_media": false,
  "is_duplicate": true,
  "duplicate_of": "a3f5c7e9-1234-5678-90ab-cdef12345678",
  "ip": "192.168.1.101",
  "timestamp": "2025-10-31T10:32:18.789012Z"
}
```

### Example: Admin Action

```json
{
  "event": "report_verified",
  "report_id": "a3f5c7e9-1234-5678-90ab-cdef12345678",
  "admin_action": true,
  "timestamp": "2025-10-31T11:00:00.000000Z"
}
```

### Example: Road Event Ingestion

```json
{
  "event": "road_event_ingested",
  "road_id": "c9d1e3f5-7890-abcd-ef12-3456789abcde",
  "segment": "QL1A",
  "status": "CLOSED",
  "province": "Quảng Trị",
  "source": "PRESS",
  "timestamp": "2025-10-31T09:15:30.123456Z"
}
```

---

## 6. Metrics

### Files Changed
```
Total files modified: 10
New files: 3
Migration files: 1

apps/web/components/ImageUpload.tsx          [NEW]    ~150 lines
apps/web/app/report/page.tsx                 [MOD]    +10 lines
apps/api/app/services/trust_score.py         [NEW]    ~180 lines
apps/api/app/database/models.py              [MOD]    +2 lines
apps/api/app/services/report_repo.py         [MOD]    +18 lines
apps/api/app/main.py                         [MOD]    +400 lines
ops/cron/roads_press_watch.py                [MOD]    +15 lines
migrations/versions/002_add_duplicate_of.py  [NEW]    ~40 lines
.env.example                                 [MOD]    +3 lines
```

### API Endpoints Added
```
POST   /ingest/road-event        (Road event ingestion)
GET    /ops                       (Admin dashboard - HTML)
POST   /ops/verify/:id            (Verify report)
POST   /ops/resolve/:id           (Resolve report)
POST   /ops/invalidate/:id        (Mark invalid)
POST   /ops/merge                 (Merge duplicates)
GET    /lite                      (Lite mode - HTML)
GET    /reports/export            (CSV export)
```

### Database Changes
```
Tables modified: 1 (reports)
New columns: 1 (duplicate_of)
New indexes: 1 (idx_reports_duplicate_of)
```

### Code Quality
- ✅ All endpoints have docstrings
- ✅ Type hints throughout
- ✅ Structured logging for all admin actions
- ✅ Error handling with proper HTTP status codes
- ✅ Input validation via Pydantic models
- ✅ Database transactions properly committed

---

## 7. Gaps & Known Issues

### Deferred Features (PR-11, PR-12)

**PR-11: API Keys + Per-key Rate Limiting**
- **Status:** Not implemented (deferred to Stage 4)
- **Reason:** Core functionality (PRs 6-10) prioritized for Stage 3
- **Complexity:** Requires API keys table, key generation, middleware, per-key rate limiting
- **Effort:** ~8-12 hours

**PR-12: Telegram + Webhook Alerts**
- **Status:** Not implemented (deferred to Stage 4)
- **Reason:** Core functionality prioritized
- **Complexity:** Requires subscriptions table, Telegram bot integration, webhook delivery system
- **Effort:** ~10-15 hours

### Known Limitations

1. **Trust Score Time Decay:**
   - Currently calculated on-the-fly
   - For better performance, could cache scores or use background job
   - Consider adding `score_calculated_at` timestamp

2. **Duplicate Detection:**
   - Only checks last 60 minutes
   - For older duplicates, consider background job to scan historical data
   - Title similarity threshold (0.88) may need tuning

3. **Ops Dashboard:**
   - Shows max 200 reports
   - No pagination yet
   - Consider adding search/filter in future

4. **CSV Export:**
   - Limited to 1000 reports
   - For larger exports, consider streaming or background job with email

5. **Cloudinary:**
   - Uses unsigned upload (good for MVP, but consider signed uploads for production)
   - No image resizing/optimization yet
   - Consider adding cloudinary transformations

### Testing Gaps

- **Unit Tests:** Not implemented yet (can add in Stage 4)
- **Integration Tests:** Manual testing done, automated tests needed
- **Load Testing:** Not performed yet
- **Migration Testing:** Tested locally, needs CI/CD integration

---

## 8. Next Steps (Stage 4 Recommendations)

### Priority 1: Complete Deferred Features
1. **Implement PR-11: API Keys**
   - Create `api_keys` table with migrations
   - Add key generation endpoint (POST /admin/keys)
   - Create API key middleware
   - Implement per-key rate limiting (e.g., 1000 req/day)
   - Add key management to /ops dashboard

2. **Implement PR-12: Telegram + Webhook Alerts**
   - Create `subscriptions` table with migrations
   - Set up Telegram bot (BotFather)
   - Implement subscribe/unsubscribe flow
   - Add webhook subscription endpoint
   - Create alert delivery system (on new high-trust reports)

### Priority 2: Testing & Monitoring
1. **Add Unit Tests**
   - pytest for TrustScoreCalculator
   - Test cases for duplicate detection
   - Test admin action endpoints

2. **Add Integration Tests**
   - Full flow tests for community reports
   - Test Cloudinary upload integration
   - Test CSV export with various filters

3. **Set up Monitoring**
   - Prometheus metrics endpoint
   - Grafana dashboards for key metrics:
     - Reports per hour
     - Trust score distribution
     - Duplicate detection rate
     - API response times

### Priority 3: Performance Optimization
1. **Database Optimization**
   - Add indexes for common queries
   - Consider partitioning reports table by date
   - Cache trust scores with TTL

2. **API Optimization**
   - Add Redis for caching
   - Implement background jobs for heavy tasks
   - Add CDN for static assets

### Priority 4: Production Readiness
1. **Security Hardening**
   - Move to signed Cloudinary uploads
   - Add rate limiting per API key (PR-11)
   - Implement CSRF protection for /ops
   - Add audit log for all admin actions

2. **Deployment**
   - Set up CI/CD pipeline (GitHub Actions)
   - Configure production environment
   - Set up database backups
   - Add health check monitoring

3. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - Deployment guide
   - Operations runbook
   - User guides for /ops dashboard

---

## 9. Deployment Checklist

### Before Production

- [ ] Set ENVIRONMENT=production in .env
- [ ] Set secure ADMIN_TOKEN (not dev-admin-token-123)
- [ ] Configure Cloudinary signed uploads
- [ ] Set proper CORS_ORIGINS
- [ ] Run database migrations
- [ ] Set up database backups
- [ ] Configure structured JSON logging
- [ ] Set up monitoring/alerting
- [ ] Load test API endpoints
- [ ] Security audit (OWASP Top 10)
- [ ] Set up SSL/TLS certificates
- [ ] Configure rate limiting thresholds
- [ ] Test disaster recovery plan

### Environment Variables Checklist

```bash
# Required for Production
ENVIRONMENT=production
ADMIN_TOKEN=<secure-random-token>
DATABASE_URL=<production-db-url>
CORS_ORIGINS=https://floodwatch.vn
NEXT_PUBLIC_API_URL=https://api.floodwatch.vn
NEXT_PUBLIC_MAPBOX_TOKEN=<production-token>
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<your-cloud>
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<signed-preset>

# Optional (for PR-11, PR-12 in Stage 4)
TELEGRAM_BOT_TOKEN=<bot-token>
REDIS_URL=<redis-url>
```

---

## 10. Summary & Handoff

### What Works Now (Stage 3 Completed)

✅ **Image Uploads:** Users can attach photos to community reports
✅ **Road Monitoring:** Automated ingestion of road status from press
✅ **Smart Scoring:** Trust scores with time decay and duplicate detection
✅ **Admin Tools:** Full dashboard for managing reports
✅ **Data Export:** Low-bandwidth access + CSV export

### What's Next (Stage 4)

🔄 **API Keys:** Programmatic access with rate limiting per key
🔄 **Alerts:** Telegram and webhook subscriptions
🔧 **Testing:** Unit and integration test coverage
📊 **Monitoring:** Prometheus + Grafana dashboards
🚀 **Production:** CI/CD, security hardening, deployment

### Key Files to Review

```
apps/api/app/services/trust_score.py     [Core trust scoring logic]
apps/api/app/main.py                     [All API endpoints + ops dashboard]
apps/web/components/ImageUpload.tsx      [Cloudinary integration]
ops/cron/roads_press_watch.py            [Road monitoring cron]
migrations/versions/002_add_duplicate_of.py [Database migration]
```

### Handoff Notes

1. **Database:** Migration 002 needs to be run before deploying
2. **Environment:** Update ADMIN_TOKEN before production
3. **Cloudinary:** Currently using unsigned upload (MVP only)
4. **Rate Limiting:** Currently per-IP only (PR-11 will add per-key)
5. **Monitoring:** Structured logging in place, connect to log aggregator

---

## 11. Commands Quick Reference

```bash
# Start services
docker-compose up -d

# Run migration
docker-compose exec api alembic upgrade head

# Check migration status
docker-compose exec api alembic current

# View logs
docker-compose logs -f api

# Access admin dashboard
open "http://localhost:8000/ops?token=dev-admin-token-123"

# Access lite mode
open http://localhost:8000/lite

# Export CSV
curl -O http://localhost:8000/reports/export?format=csv

# Run road monitoring cron
cd ops/cron && python roads_press_watch.py

# Test community report with images
open http://localhost:3000/report
```

---

**Report End** | Stage 3 Complete (PRs 6-10) ✅
**Next:** Stage 4 - API Keys, Alerts, Testing, Production Readiness
