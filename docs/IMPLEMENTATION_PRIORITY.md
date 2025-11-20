# Emergency Implementation Priority - 24-72h Timeline

> **Context**: Central Vietnam flooding crisis
> **Goal**: Deploy life-saving features as fast as possible
> **Strategy**: Parallel development where possible, sequential testing

---

## ⏱️ Timeline Overview

```
Hour 0-3   [████████████] Database + Core APIs
Hour 3-6   [████████████] Frontend Components
Hour 6-9   [████████████] Testing + Refinement
Hour 9-12  [████████████] Admin Tools + Dashboard
Hour 12-24 [████████████] Polish + Deploy
```

---

## 🎯 Phase 1: Foundation (Hour 0-3) - START NOW

### Task 1.1: Database Migrations ⏰ 1 hour

**Priority**: 🔴 CRITICAL - Must complete before API work

```
├── 009_emergency_distress.py       (30 min)
├── 010_emergency_traffic.py        (20 min)
└── 011_hazard_polygon.py           (10 min)
```

**Steps**:
1. Create migration files
2. Run `alembic upgrade head`
3. Verify tables created: `psql -c "\d distress_reports"`
4. Insert sample data for testing

**Acceptance**:
- [ ] `distress_reports` table exists with all indexes
- [ ] `traffic_disruptions` table exists with all indexes
- [ ] `hazard_events.impact_geometry` column added
- [ ] Triggers working (lat/lon extraction, updated_at)
- [ ] Sample data inserted successfully

---

### Task 1.2: Repository Classes ⏰ 1.5 hours

**Priority**: 🔴 CRITICAL

```
apps/api/app/services/
├── distress_repo.py           (45 min)
└── traffic_repo.py            (45 min)
```

**Distress Repository Methods** (Priority Order):
1. `create()` - Create new distress report
2. `get_active()` - Get active reports (status filtering)
3. `get_nearby()` - Spatial query within radius
4. `update_status()` - Admin status updates
5. `get_by_urgency()` - Filter by urgency level

**Traffic Repository Methods**:
1. `create()` - Create new disruption
2. `get_active()` - Get active disruptions
3. `get_in_area()` - Spatial query
4. `get_by_road()` - Filter by road name
5. `mark_resolved()` - Set is_active=false

**Acceptance**:
- [ ] All CRUD methods implemented
- [ ] Spatial queries use PostGIS `ST_DWithin()`
- [ ] Distance calculation with Haversine formula
- [ ] Error handling for invalid data
- [ ] Unit tests pass (basic)

---

### Task 1.3: Core API Endpoints ⏰ 2 hours

**Priority**: 🔴 CRITICAL - Life-saving endpoints first

#### Batch 1: Distress APIs (1 hour)
```
POST   /distress                    (30 min)
GET    /distress                    (20 min)
PATCH  /distress/{id}               (10 min)
```

#### Batch 2: Traffic APIs (45 min)
```
GET    /traffic/disruptions         (25 min)
POST   /traffic/disruptions         (20 min)
```

#### Batch 3: Check Area API (15 min)
```
GET    /check-area                  (15 min)
```

**Testing**:
```bash
# Test distress creation
curl -X POST http://localhost:8002/distress \
  -H "Content-Type: application/json" \
  -d '{"lat":12.2388,"lon":109.1967,"urgency":"critical",...}'

# Test spatial query
curl "http://localhost:8002/distress?lat=12.2388&lon=109.1967&radius_km=10"
```

**Acceptance**:
- [ ] All endpoints return correct status codes
- [ ] Spatial queries return correct distances
- [ ] Rate limiting works (SlowAPI)
- [ ] Error handling with proper messages
- [ ] Manual API tests documented

---

## 🎨 Phase 2: Frontend (Hour 3-6)

### Task 2.1: Map Layers ⏰ 2 hours

**Priority**: 🟠 HIGH

```
apps/web/components/
├── DistressLayer.tsx              (45 min)
├── TrafficLayer.tsx               (45 min)
└── CheckMyAreaWidget.tsx          (30 min)
```

**DistressLayer** (like HazardLayer):
- GeoJSON point features
- Color by urgency (critical=red, high=orange)
- Popup with details
- Icon: 🆘

**TrafficLayer**:
- GeoJSON point/line features
- Color by severity (impassable=red, dangerous=orange)
- Popup with road info + alternative route
- Icon: 🚧

**CheckMyAreaWidget**:
- Floating widget on map
- Shows risk level + nearby hazards count
- Recommendations list
- Auto-refresh every 60s

**Acceptance**:
- [ ] Distress points show on map with correct colors
- [ ] Traffic disruptions show with correct icons
- [ ] Widget displays risk assessment
- [ ] Clicking markers shows popups
- [ ] Layers toggle on/off

---

### Task 2.2: Report Forms ⏰ 1.5 hours

**Priority**: 🟠 HIGH

```
apps/web/components/
├── ReportDistressForm.tsx         (45 min)
└── ReportTrafficForm.tsx          (45 min)
```

**ReportDistressForm**:
- Modal/drawer on map
- Auto-fill location from GPS
- Urgency dropdown
- Description textarea
- Number of people input
- Contact info (optional)
- Submit button

**ReportTrafficForm**:
- Similar structure
- Type dropdown (flooded_road, landslide, etc.)
- Severity dropdown
- Road name input
- Alternative route textarea

**Acceptance**:
- [ ] Forms validate required fields
- [ ] GPS auto-fill works
- [ ] Success message after submit
- [ ] Error handling for API failures
- [ ] Form resets after success

---

### Task 2.3: Custom Hooks ⏰ 30 min

```
apps/web/hooks/
├── useDistress.ts                 (15 min)
├── useTraffic.ts                  (10 min)
└── useCheckArea.ts                (5 min)
```

Same pattern as `useHazards.ts`:
- Fetch data from API
- Auto-refresh capability
- Loading & error states
- Type-safe interfaces

---

## 🧪 Phase 3: Testing & Refinement (Hour 6-9)

### Task 3.1: End-to-End Testing ⏰ 1.5 hours

**Priority**: 🟡 MEDIUM

**Test Scenarios**:
1. **Distress Flow**:
   - User clicks "Report Emergency"
   - Fill form with critical urgency
   - Submit → marker appears on map
   - Admin updates status → marker color changes

2. **Traffic Flow**:
   - User reports flooded road
   - Disruption appears on map
   - Other users see warning
   - Admin marks resolved → disappears

3. **Check My Area**:
   - User moves map
   - Widget updates with new risk level
   - Hazards + disruptions counted correctly

**Tools**:
- Manual testing in browser
- Postman for API tests
- Browser DevTools Network tab

**Acceptance**:
- [ ] All user flows work end-to-end
- [ ] No console errors
- [ ] API responses < 500ms (spatial queries)
- [ ] Mobile responsive (basic)

---

### Task 3.2: Performance Optimization ⏰ 1 hour

**Priority**: 🟡 MEDIUM

**Targets**:
- Spatial queries: < 200ms
- Map render: < 100ms with 50+ markers
- API rate limiting: working correctly

**Optimizations**:
1. Add Redis caching for `/check-area` (5 min TTL)
2. Debounce map movements (widget updates)
3. Limit GeoJSON features to viewport bounds
4. Add database query logging

---

### Task 3.3: Bug Fixes & Polish ⏰ 30 min

- Fix map marker clustering (if too many distress)
- Adjust popup positioning
- Mobile touch interactions
- Error message localization (Vietnamese)

---

## 🛠️ Phase 4: Admin Tools (Hour 9-12)

### Task 4.1: Admin Dashboard ⏰ 2 hours

**Priority**: 🟢 NICE-TO-HAVE (but useful)

```
apps/web/app/admin/
├── distress/page.tsx              (60 min)
├── traffic/page.tsx               (45 min)
└── dashboard/page.tsx             (15 min)
```

**Admin Distress Panel**:
- Table of active distress reports
- Sort by urgency, created_at
- Status update dropdown
- Assign to rescue team
- Notes textarea
- Mark resolved

**Admin Traffic Panel**:
- Table of active disruptions
- Verify reports (user_report → verified)
- Set estimated clearance time
- Mark resolved

**Emergency Dashboard**:
- Total counts (distress, hazards, traffic)
- Map overview
- Recent activity feed

---

### Task 4.2: Notifications (Future) ⏰ 1 hour

**Priority**: 🟢 PHASE 2 (not urgent for MVP)

Simple webhook notifications:
- When critical distress created → POST to rescue dispatch system
- When major road blocked → notify traffic control

---

## 📱 Phase 5: Mobile & Polish (Hour 12-24)

### Task 5.1: Mobile Optimization ⏰ 2 hours

- Touch-friendly buttons
- Bottom sheets for forms (mobile)
- GPS permission handling
- Offline mode (cache last known data)

### Task 5.2: Accessibility ⏰ 1 hour

- ARIA labels for screen readers
- Keyboard navigation
- High contrast mode for emergency situations
- Font size controls

### Task 5.3: Documentation ⏰ 1 hour

```
docs/
├── USER_GUIDE.md                  - Hướng dẫn dân dùng
├── ADMIN_GUIDE.md                 - Hướng dẫn admin
└── API_DOCS.md                    - API documentation
```

---

## 🚀 Deployment Checklist

### Pre-Deploy (30 min)
- [ ] Run all migrations on production DB
- [ ] Set environment variables (NEXT_PUBLIC_API_URL)
- [ ] Configure rate limiting for production
- [ ] Set up error tracking (Sentry)
- [ ] Enable CORS for production domain

### Deploy (15 min)
- [ ] Build web container: `docker compose build web`
- [ ] Restart services: `docker compose up -d`
- [ ] Verify health checks
- [ ] Smoke test all endpoints

### Post-Deploy (15 min)
- [ ] Monitor logs for errors
- [ ] Test on mobile device
- [ ] Check database query performance
- [ ] Announce to users (social media, SMS)

---

## 🎯 Success Metrics (72h Target)

### Technical Metrics
- [ ] API uptime: > 99.5%
- [ ] Average response time: < 300ms
- [ ] Zero critical bugs
- [ ] All core features working

### User Impact Metrics
- [ ] Distress reports created: > 0 (measure adoption)
- [ ] Traffic disruptions reported: > 10
- [ ] Check My Area queries: > 100
- [ ] Admin actions (status updates): > 5

### Feedback Loop
- Monitor social media mentions
- Track API error rates
- Collect user feedback (in-app)
- Iterate based on real usage

---

## 🔄 Parallel Work Assignments (If Team Available)

### Developer 1: Backend
- Migrations
- Repositories
- API endpoints

### Developer 2: Frontend
- Map layers
- Report forms
- Widgets

### Developer 3: Admin/Testing
- Admin dashboard
- End-to-end testing
- Documentation

**Timeline**: 6 hours with team vs. 12 hours solo

---

## 📝 Current Status

- [x] Sprint 1 foundation complete
- [x] Database spec written
- [x] API spec written
- [ ] **NEXT: Create migrations (START NOW)**

---

**Ready to code. Starting with migrations in 3... 2... 1...**
