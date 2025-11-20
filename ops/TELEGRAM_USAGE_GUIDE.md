# 📱 Hướng dẫn sử dụng Telegram Bot - FloodWatch

## ✅ Đã hoàn thành

### 1. Subscribe Flow (Đăng ký nhận cảnh báo theo tỉnh)

**Tính năng:**
- User có thể subscribe nhiều tỉnh
- Hỗ trợ gõ có dấu hoặc không dấu
- Hỗ trợ viết tắt (ví dụ: "Hue" → "Thừa Thiên Huế")

**Cách dùng:**

```
User: /subscribe
Bot: [Hiển thị danh sách 9 tỉnh + hướng dẫn]

User: /subscribe Quảng Trị
Bot: ✅ Đăng ký thành công! Bạn sẽ nhận cảnh báo cho Quảng Trị

User: /subscribe Da Nang
Bot: ✅ Đăng ký thành công! Bạn sẽ nhận cảnh báo cho Đà Nẵng

User: /status
Bot: [Hiển thị danh sách tỉnh đã đăng ký]

User: /unsubscribe
Bot: ✅ Đã hủy tất cả đăng ký
```

**Database:**
- Bảng: `telegram_subscriptions`
- Mỗi user có 1 row duy nhất (unique `chat_id`)
- Tỉnh được lưu dưới dạng JSONB array: `["Quảng Trị", "Đà Nẵng"]`

---

### 2. Auto Alert Sender (Gửi cảnh báo tự động)

**File:** `apps/api/app/services/telegram_alerts.py`

**Function chính:**

```python
notify_subscribers_for_alert(db: Session, alert: Report) -> Dict[str, int]
```

**Cách hoạt động:**
1. Nhận vào 1 `Report` object (alert mới)
2. Tìm tất cả user có subscribe `alert.province`
3. Kiểm tra `trust_score >= min_trust_score`
4. Gửi message Telegram cho từng user
5. Trả về kết quả: `{"sent": 5, "failed": 0, "skipped": 0}`

**Format tin nhắn:**

```
⚠️ ALERT 🔴 CẤP ĐỘ CAO

Cảnh báo mưa lớn Quảng Trị

Dự báo mưa to đến rất to trong 12-24h tới...

📍 Vị trí: Quảng Trị, Hải Lăng
🔍 Độ tin cậy: 85%
📰 Nguồn: Trung tâm Khí tượng Thủy văn
🕒 Thời gian: 2025-11-18 13:30

🗺️ Xem trên bản đồ (link)
```

---

## 🔧 Cách tích hợp vào Ingest Scripts

### Ví dụ 1: Thêm vào script đơn giản

```python
# In ops/kttv_alerts.py

from app.services.telegram_alerts import notify_subscribers_for_alert
from app.database import get_db_context, Report

# Sau khi insert alert vào DB:
new_alert = Report(
    type="ALERT",
    source="KTTV",
    title="Cảnh báo mưa lớn",
    province="Quảng Trị",
    trust_score=0.85,
    ...
)

with get_db_context() as db:
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)

    # THÊM DÒNG NÀY:
    result = notify_subscribers_for_alert(db, new_alert)
    print(f"Telegram: {result['sent']} sent, {result['failed']} failed")
```

### Ví dụ 2: Tích hợp vào FastAPI endpoint

```python
# In apps/api/app/main.py - endpoint /ingest/alerts

@app.post("/ingest/alerts")
async def ingest_alerts(alerts: List[AlertIngest], db: Session = Depends(get_db)):
    for alert in alerts:
        # ... (code hiện tại) ...

        # Save to DB
        created_report = ReportRepository.create(db, report_data)

        # THÊM: Send Telegram notifications
        from app.services.telegram_alerts import notify_subscribers_for_alert
        notify_subscribers_for_alert(db, created_report)

    return {"status": "success", ...}
```

### Ví dụ 3: Chạy từ script độc lập

Xem file: `ops/example_ingest_with_telegram.py`

```bash
# Test gửi alert thử
docker compose exec api python3 /app/../ops/example_ingest_with_telegram.py
```

---

## 🧪 Cách Test

### Test 1: Subscribe flow

1. Mở Telegram, tìm bot của bạn
2. Gửi: `/start`
3. Gửi: `/subscribe`
4. Gửi: `/subscribe Quảng Trị`
5. Check database:

```bash
docker compose exec db psql -U postgres -d floodwatch_dev -c "
SELECT chat_id, username, provinces, is_active
FROM telegram_subscriptions;
"
```

Expected:
```
 chat_id | username | provinces        | is_active
---------+----------+------------------+-----------
 123456  | johndoe  | ["Quảng Trị"]    | t
```

### Test 2: Gửi alert thủ công

```bash
# SSH hoặc docker exec vào API container
docker compose exec api python3 << 'EOF'
from app.database import get_db_context, Report
from app.services.telegram_alerts import notify_subscribers_for_alert
from uuid import uuid4
from datetime import datetime

# Tạo alert giả
alert = Report(
    id=uuid4(),
    type="ALERT",
    source="TEST",
    title="Test cảnh báo Quảng Trị",
    description="Đây là tin thử nghiệm",
    province="Quảng Trị",
    trust_score=0.9,
    status="new",
    media=[],
    created_at=datetime.utcnow()
)

with get_db_context() as db:
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Gửi Telegram
    result = notify_subscribers_for_alert(db, alert)
    print(f"Result: {result}")
EOF
```

Check điện thoại → phải nhận được tin nhắn.

### Test 3: End-to-end (Production-like)

1. **User subscribe:**
   - Telegram: `/subscribe Quảng Trị`

2. **Ingest script chạy tự động (cron hoặc tay):**
   ```bash
   docker compose exec api python3 ops/kttv_alerts.py
   ```

3. **Script phát hiện alert mới:**
   - Ghi vào DB
   - Gọi `notify_subscribers_for_alert`

4. **User nhận tin trên Telegram** (real-time)

---

## 📊 Monitoring & Stats

### Xem số subscriber theo tỉnh

```python
from app.services.telegram_alerts import get_subscriber_count_by_province
from app.database import get_db_context

with get_db_context() as db:
    counts = get_subscriber_count_by_province(db)
    for province, count in counts.items():
        print(f"{province}: {count} subscribers")
```

### Query trực tiếp trong DB

```sql
-- Số user active
SELECT COUNT(*) FROM telegram_subscriptions WHERE is_active = true;

-- Tỉnh nào được subscribe nhiều nhất
SELECT
    province,
    COUNT(*) as subscribers
FROM telegram_subscriptions,
     jsonb_array_elements_text(provinces) as province
WHERE is_active = true
GROUP BY province
ORDER BY subscribers DESC;

-- User nào subscribe nhiều tỉnh nhất
SELECT
    chat_id,
    username,
    jsonb_array_length(provinces) as province_count
FROM telegram_subscriptions
WHERE is_active = true
ORDER BY province_count DESC;
```

---

## 🚀 Next Steps (Tùy chọn)

### 1. Thêm lệnh /unsubscribe từng tỉnh

Hiện tại `/unsubscribe` hủy tất cả. Có thể thêm:

```
/unsubscribe Quảng Trị  → Chỉ hủy tỉnh Quảng Trị
```

### 2. Inline Keyboard (chọn tỉnh bằng nút bấm)

Thay vì gõ text, user bấm nút:

```
Bot: Chọn tỉnh muốn đăng ký:
[Quảng Bình] [Quảng Trị] [Huế]
[Đà Nẵng]    [Quảng Nam] ...
```

### 3. Cài đặt mức độ cảnh báo

```
/settings
→ Chỉ nhận cảnh báo CẤP ĐỘ CAO (trust_score >= 0.8)
→ Nhận tất cả cảnh báo
```

### 4. Gửi ảnh/map screenshot

Khi có alert, gửi kèm:
- Ảnh radar mưa
- Screenshot bản đồ khu vực

### 5. Push notification cho critical alerts

Telegram có thể gửi notification âm thanh đặc biệt cho alert khẩn cấp.

---

## 📝 Summary

✅ **Đã làm xong:**
- Subscribe theo tỉnh (hỗ trợ nhiều tỉnh/user)
- Gửi alert tự động khi có báo cáo mới
- Database migration
- Helper functions
- Example code

🎯 **Chỉ cần:**
1. Tìm bot trên Telegram → `/subscribe Quảng Trị`
2. Trong ingest script, thêm 1 dòng: `notify_subscribers_for_alert(db, alert)`
3. Done! Mọi user subscribe sẽ nhận tin tự động.

---

**File quan trọng:**
- `apps/api/app/telegram_handler.py` - Xử lý lệnh từ user
- `apps/api/app/services/telegram_bot.py` - Gửi tin nhắn
- `apps/api/app/services/telegram_alerts.py` - Logic gửi alert tự động
- `ops/example_ingest_with_telegram.py` - Ví dụ tích hợp

**Bot đã sẵn sàng sử dụng!** 🤖
