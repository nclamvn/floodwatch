# 📅 Kế hoạch Ingest 30 ngày

> **Mục tiêu:** Từ ZERO data → HUB thông tin mưa lũ đầy đủ trong 1 tháng

---

## 🎯 Tổng quan

### Chiến lược
- **Tuần 1-2:** Xây nền móng với nguồn tin **chính thống** (KTTV, báo lớn)
- **Tuần 3:** Bổ sung nguồn **địa phương** (17 báo tỉnh miền Trung)
- **Tuần 4:** Xử lý **trùng lặp** + thêm **manual entry** cho community

### KPI
| Tuần | Nguồn Ingest | Reports/ngày (ước) | Trust Score TB |
|------|--------------|-------------------|----------------|
| 1    | 2-3 nguồn    | 10-20             | 0.90+          |
| 2    | 6-8 nguồn    | 30-50             | 0.88+          |
| 3    | 15-20 nguồn  | 60-100            | 0.85+          |
| 4    | 20-25 nguồn  | 80-120            | 0.80+          |

---

## 📆 TUẦN 1 (Ngày 1-7): Nguồn cấp Nhà nước + Báo lớn

### ✅ Mục tiêu
- Có data **thật** từ nguồn **tin cậy nhất**
- Test pipeline ingest → DB → Web → Telegram
- Trust score ≥ 0.9

### 📋 Nguồn triển khai

#### 1. KTTV National (kttv.gov.vn)
**Priority:** P0 (Cao nhất)
**Method:** HTML Scrape
**Target pages:**
- `/tin-tuc/canh-bao` - Cảnh báo thiên tai
- `/du-bao-thoi-tiet` - Dự báo thời tiết
- `/thong-tin-lu` - Thông tin lũ

**Script:** `scripts/ingest/kttv_scraper.py`
**Cấu trúc:**
```python
def scrape_kttv_alerts():
    """
    - Fetch HTML từ /tin-tuc/canh-bao
    - Parse title, content, date, location
    - Extract province từ nội dung (regex hoặc NER)
    - Geolocate province → lat/lon
    - Create Report với:
      - type: ALERT
      - source: "kttv_national"
      - trust_score: 0.98
      - categories: ["weather_alert", "flood"]
    """
```

**Output:** 3-5 reports/ngày (trung bình)

---

#### 2. VnExpress - Thiên tai (vnexpress.net)
**Priority:** P0
**Method:** RSS hoặc HTML
**RSS Feed:** `https://vnexpress.net/rss/thoi-su.rss` (filter keyword "lũ", "mưa", "bão")
**Fallback:** HTML scrape `/thoi-su/thien-tai`

**Script:** `scripts/ingest/vnexpress_rss.py`
**Cấu trúc:**
```python
def scrape_vnexpress_rss():
    """
    - Parse RSS feed
    - Filter items có từ khóa: lũ, mưa, bão, sạt lở, ngập
    - Extract province từ title/description
    - Geolocate
    - Create Report với:
      - type: ALERT hoặc INFO (dựa vào keyword)
      - source: "vnexpress_disaster"
      - trust_score: 0.90
      - categories: ["flood", "storm", "landslide"]
    """
```

**Output:** 5-10 reports/ngày

---

#### 3. (Optional) DRVN - Đường bộ (drvn.gov.vn)
**Priority:** P1
**Method:** HTML Scrape
**Target:** Tin tức về ngập đường, sạt lở quốc lộ

**Output:** 2-5 reports/ngày

---

### 🧪 Testing
```bash
# Run manual scrape
python scripts/ingest/kttv_scraper.py

# Check DB
docker compose exec api python3 -c "
from app.database import get_db_context, Report
with get_db_context() as db:
    reports = db.query(Report).filter(Report.source == 'kttv_national').all()
    print(f'Found {len(reports)} reports from KTTV')
"

# Check Web
# Open http://localhost:3002/map
# Should see markers with trust_score ≥ 0.9

# Check Telegram
# Subscribe to a province: /subscribe Quảng Trị
# Run scraper again → should receive notification
```

---

## 📆 TUẦN 2 (Ngày 8-14): Báo Trung ương + Địa phương trọng điểm

### ✅ Mục tiêu
- Mở rộng coverage toàn miền Trung
- Thêm 4-5 nguồn báo chính
- Bắt đầu thấy data từ nhiều tỉnh

### 📋 Nguồn triển khai

#### 4. Tuổi Trẻ (tuoitre.vn)
**Method:** HTML Scrape `/thoi-su/thien-tai`
**Trust:** 0.90

#### 5. Thanh Niên (thanhnien.vn)
**Method:** HTML Scrape
**Trust:** 0.90

#### 6. Báo Quảng Trị (baoquangtri.vn)
**Method:** HTML Scrape
**Trust:** 0.88
**Focus:** Lũ quét, sạt lở

#### 7. Báo Thừa Thiên Huế (baothuathienhue.vn)
**Method:** HTML Scrape
**Trust:** 0.88

#### 8. Báo Đà Nẵng (baodanang.vn)
**Method:** HTML Scrape
**Trust:** 0.87
**Focus:** Ngập đô thị, giao thông

---

### 🔧 Improvements
- **Deduplication (Phase 1):** Check title similarity trước khi insert
- **Province Extraction:** Nâng cấp regex → NER model (nếu cần)
- **Scheduling:** Cron job mỗi 30 phút cho KTTV, 1h cho báo

---

### 🧪 Testing
- Mỗi nguồn chạy manual 1 lần → verify DB
- Check web map: should see 30-50 reports
- Telegram: Subscribe nhiều tỉnh → test notifications

---

## 📆 TUẦN 3 (Ngày 15-21): Mở rộng 17 tỉnh + Dedup nâng cao

### ✅ Mục tiêu
- Ingest **TẤT CẢ** 17 báo địa phương trong sources.yaml
- Xây hệ thống **deduplication** thông minh
- Trust score calibration

### 📋 Nguồn triển khai

Add tất cả báo địa phương còn lại (9-23 trong sources.yaml):
- Quảng Nam, Quảng Bình, Bình Định, Phú Yên, Khánh Hòa
- Gia Lai, Kon Tum, Đắk Lắk, Đắk Nông
- Long An, Kiên Giang, An Giang, Cần Thơ, Vĩnh Long, Nghệ An

**Script:** Generic `scripts/ingest/local_news_scraper.py` với config từ `sources.yaml`

---

### 🧠 Deduplication Strategy

#### Problem
Cùng 1 sự kiện, 5 báo đưa tin → 5 reports trùng

#### Solution: Clustering

**Algorithm:**
1. Mỗi report → embedding (title + description)
2. Cosine similarity > 0.8 → cùng cluster
3. Merge cluster thành 1 report "canonical" với:
   - Title: từ nguồn trust_score cao nhất
   - Trust score: trung bình có trọng số
   - Sources: array of all sources
   - Metadata: list all original reports

**Implementation:**
```python
# scripts/dedup/cluster_reports.py
from sentence_transformers import SentenceTransformer
from sklearn.cluster import DBSCAN

def deduplicate_reports(reports: List[Report]):
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    embeddings = model.encode([r.title + ' ' + (r.description or '') for r in reports])

    clustering = DBSCAN(eps=0.2, min_samples=2, metric='cosine').fit(embeddings)

    for cluster_id in set(clustering.labels_):
        if cluster_id == -1: continue  # Outliers
        cluster_reports = [r for i, r in enumerate(reports) if clustering.labels_[i] == cluster_id]
        merge_cluster(cluster_reports)
```

**Run:** Nightly job (3am) để merge reports từ 24h trước

---

### 🧪 Testing
- Tạo 3 reports với title gần giống → run dedup → verify merged
- Check web: Should NOT see duplicates
- Verify trust score calculation

---

## 📆 TUẦN 4 (Ngày 22-30): Manual Entry + Community Sources

### ✅ Mục tiêu
- Xây form nhập tay cho staff/contributors
- Tích hợp manual reports vào map
- (Optional) Thử nghiệm crawl Facebook posts (manual review)

### 📋 Tasks

#### 1. Manual Report Form
**File:** `apps/web/app/submit/page.tsx`
**Features:** (xem MANUAL_REPORT_FORM.md)
- Form with title, type, location picker, severity, source URL
- Auto-assign trust_score dựa vào source type
- Preview on map trước khi submit

**API endpoint:** `POST /reports/manual`

---

#### 2. Staff Training
- Viết hướng dẫn cho staff nhập reports
- Guidelines: khi nào nhập tay, từ nguồn nào
- Trust score policy

---

#### 3. Community Sources (Manual Review Only)
**NOT automated** - chỉ để staff xem rồi nhập tay:
- Facebook Groups (Quảng Trị 24h, etc.)
- OtoSaigon forum
- Zalo groups

**Workflow:**
1. Staff theo dõi group
2. Thấy tin quan trọng → verify cross-check
3. Nhập vào form manual
4. Trust score: 0.6-0.7 (lower than news)

---

### 🧪 Testing
- Staff thử nhập 5-10 reports qua form
- Verify reports xuất hiện trên map với trust score đúng
- Telegram notifications work for manual reports

---

## 🎯 Final Deliverables (End of Week 4)

### ✅ Checklist

- [ ] 20-25 nguồn tin đang ingest tự động
- [ ] 80-120 reports/ngày (trung bình)
- [ ] Deduplication running nightly
- [ ] Manual entry form hoạt động
- [ ] Web map hiển thị đầy đủ với color coding
- [ ] Telegram bot gửi alerts cho subscribers
- [ ] Trust score average ≥ 0.80
- [ ] Không có duplicates (< 5%)

### 📊 Metrics Dashboard

Create simple dashboard showing:
- Reports by source (bar chart)
- Reports by province (map heatmap)
- Trust score distribution (histogram)
- Dedup rate (%)
- Telegram subscribers count

---

## 🔄 Maintenance (After Week 4)

### Daily
- Monitor cron jobs (all scrapers running?)
- Check error logs
- Quick scan for duplicates

### Weekly
- Review trust score calibration
- Add/remove sources if needed
- Staff training updates

### Monthly
- Analyze coverage gaps
- User feedback review
- Source reliability audit

---

## 🚨 Contingency Plans

### If a source blocks us
- Implement polite delays (5-10s between requests)
- Rotate User-Agent
- Contact source for API access
- Fallback to manual monitoring

### If dedup fails
- Increase clustering threshold
- Add manual review step
- Implement user reporting for duplicates

### If staff can't keep up with manual entry
- Focus on high-priority provinces only
- Recruit volunteers
- Improve form UX to speed up entry

---

## 💡 Future Enhancements (Month 2+)

1. **Image/Video ingestion** - Extract flood photos from news
2. **NLP severity detection** - Auto-assign severity from text
3. **Realtime WebSocket** - Push updates to web without refresh
4. **Mobile app** - React Native for iOS/Android
5. **API for partners** - Chia sẻ data với các tổ chức cứu trợ
6. **Historical data** - Archive + analytics

---

**Prepared by:** FloodWatch Dev Team
**Last updated:** 2025-11-18
