# 🤖 Telegram Bot Setup Guide - FloodWatch

## Mục tiêu
Tạo bot Telegram để gửi cảnh báo mưa lũ tự động đến người dùng theo vị trí họ chọn.

---

## Bước 1: Tạo Telegram Bot (10 phút)

### 1.1. Mở Telegram và tìm @BotFather

1. Mở app Telegram
2. Tìm kiếm: `@BotFather`
3. Nhấn `Start`

### 1.2. Tạo bot mới

```
Bạn: /newbot
BotFather: Alright, a new bot. How are we going to call it? Please choose a name for your bot.

Bạn: FloodWatch Vietnam
BotFather: Good. Now let's choose a username for your bot...

Bạn: floodwatch_vn_bot
BotFather: Done! Your bot is ready. Access token: 1234567890:ABCDEF...
```

### 1.3. Lưu Bot Token

**⚠️ Quan trọng:** Copy token và lưu lại!

Token sẽ có dạng:
```
1234567890:ABCDEFghIJKLmnoPQRstuVWXyz0123456
```

### 1.4. (Optional) Đặt ảnh và mô tả cho bot

```
/setuserpic - Upload ảnh logo
/setdescription - Thêm mô tả bot
/setabouttext - Thêm thông tin "About"
```

**Mô tả mẫu:**
```
🌊 Bot cảnh báo mưa lũ tự động cho Việt Nam

✅ Cảnh báo real-time khi có mưa lớn
✅ Thông tin đường ngập, sạt lở
✅ Bản đồ trực quan

Powered by FloodWatch
```

---

## Bước 2: Cấu hình Bot Token trên Server (5 phút)

### 2.1. SSH vào server

```bash
ssh root@188.166.248.10
cd /root/floodwatch
```

### 2.2. Thêm Bot Token vào .env

```bash
nano .env
```

Thêm dòng này (thay YOUR_BOT_TOKEN bằng token thật):

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFghIJKLmnoPQRstuVWXyz0123456
```

Save và thoát (Ctrl+X, Y, Enter)

### 2.3. Restart API để load token mới

```bash
docker compose -f docker-compose.prod.yml restart api
```

Verify:
```bash
docker compose -f docker-compose.prod.yml logs api | grep Telegram
```

---

## Bước 3: Tạo Database Migration (5 phút)

### 3.1. Tạo migration file

```bash
docker compose -f docker-compose.prod.yml exec api alembic revision -m "add_telegram_subscriptions"
```

### 3.2. Edit migration file

File sẽ được tạo tại: `apps/api/alembic/versions/xxx_add_telegram_subscriptions.py`

Thêm vào function `upgrade()`:

```python
def upgrade():
    op.create_table(
        'telegram_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('chat_id', sa.Integer(), unique=True, nullable=False, index=True),
        sa.Column('username', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('provinces', postgresql.JSONB(), default=[], nullable=False, server_default='[]'),
        sa.Column('min_trust_score', sa.Float(), default=0.5, nullable=False)
    )

def downgrade():
    op.drop_table('telegram_subscriptions')
```

### 3.3. Run migration

```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

Verify:
```bash
docker compose -f docker-compose.prod.yml exec db psql -U floodwatch floodwatch_prod -c "\d telegram_subscriptions"
```

---

## Bước 4: Setup Webhook (10 phút)

### 4.1. Cách A: Dùng Webhook (Recommended cho Production)

**Ưu điểm:** Real-time, không cần polling

1. Set webhook URL:

```bash
curl -X POST "https://nclam.site/telegram/webhook/set?webhook_url=https://nclam.site/telegram/webhook"
```

2. Verify webhook:

```bash
curl https://nclam.site/telegram/webhook/info
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://nclam.site/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 4.2. Cách B: Dùng Polling (Cho Testing)

**Ưu điểm:** Dễ test local

Chạy polling script:

```bash
docker compose exec api python ops/telegram_polling.py
```

---

## Bước 5: Test Bot (5 phút)

### 5.1. Test với user đầu tiên

1. Mở Telegram
2. Tìm bot của bạn: `@floodwatch_vn_bot`
3. Nhấn `Start`

Bot sẽ trả lời:
```
👋 Chào mừng đến với FloodWatch Bot!
...
```

### 5.2. Test subscription

```
Bạn: /subscribe
Bot: [Hiển thị danh sách tỉnh]

Bạn: Đà Nẵng
Bot: ✅ Đăng ký thành công!
```

### 5.3. Test alert gửi thủ công

```bash
# SSH vào server
docker compose exec -T db psql -U floodwatch floodwatch_prod << EOF
-- Lấy chat_id của user vừa subscribe
SELECT chat_id, provinces FROM telegram_subscriptions WHERE is_active = true;
EOF

# Gửi test alert bằng curl
curl -X POST https://nclam.site/telegram/test-alert \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": 123456789,
    "report": {
      "type": "ALERT",
      "title": "Test - Cảnh báo mưa lớn",
      "description": "Đây là tin thử nghiệm",
      "province": "Đà Nẵng",
      "trust_score": 0.9,
      "source": "KTTV",
      "created_at": "2025-11-18T10:00:00",
      "lat": 16.0544,
      "lon": 108.2022
    }
  }'
```

---

## Bước 6: Tích hợp vào Alert Dispatcher (5 phút)

### 6.1. Update ops/cron/alerts_dispatcher.py

File đã có sẵn function `send_telegram()`, chỉ cần verify:

```python
def send_telegram(self, report: Report) -> bool:
    """Send Telegram message to subscribed users"""
    # Query all active subscriptions for this province
    subscriptions = db.query(TelegramSubscription).filter(
        TelegramSubscription.is_active == True,
        TelegramSubscription.provinces.contains([report.province])
    ).all()

    for sub in subscriptions:
        telegram_bot.send_alert(sub.chat_id, report.to_dict())
```

### 6.2. Test end-to-end

1. Tạo 1 report mới có severity cao:

```bash
curl -X POST https://nclam.site/ingest/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "title": "Cảnh báo mưa lớn cấp độ SEVERE tại Đà Nẵng",
    "province": "Đà Nẵng",
    "lat": 16.0544,
    "lon": 108.2022,
    "level": "high",
    "source": "KTTV",
    "description": "Mưa lớn kéo dài trong 12-24h tới"
  }]'
```

2. Chờ 2 phút (alerts_dispatcher chạy mỗi 2 phút)

3. Check Telegram - bot sẽ tự động gửi alert!

---

## Bước 7: Monitoring & Logs (5 phút)

### 7.1. Check bot logs

```bash
# View real-time logs
docker compose -f docker-compose.prod.yml logs -f api | grep -i telegram

# View webhook deliveries
curl https://nclam.site/telegram/webhook/info
```

### 7.2. Check subscriptions trong DB

```bash
docker compose exec db psql -U floodwatch floodwatch_prod -c "
SELECT
    chat_id,
    username,
    is_active,
    provinces,
    created_at
FROM telegram_subscriptions
ORDER BY created_at DESC;
"
```

### 7.3. Thống kê

```bash
# Số user đang active
docker compose exec db psql -U floodwatch floodwatch_prod -c "
SELECT COUNT(*) as total_users FROM telegram_subscriptions WHERE is_active = true;
"

# Tỉnh nào được subscribe nhiều nhất
docker compose exec db psql -U floodwatch floodwatch_prod -c "
SELECT
    province,
    COUNT(*) as subscribers
FROM telegram_subscriptions,
     jsonb_array_elements_text(provinces) as province
WHERE is_active = true
GROUP BY province
ORDER BY subscribers DESC;
"
```

---

## 🆘 Troubleshooting

### Issue 1: Bot không trả lời

**Kiểm tra:**
```bash
# 1. Token có đúng không?
docker compose exec api printenv | grep TELEGRAM

# 2. Webhook có set chưa?
curl https://nclam.site/telegram/webhook/info

# 3. API logs có error?
docker compose logs api --tail 50 | grep -i telegram
```

**Fix:**
```bash
# Reset webhook và set lại
curl -X POST https://nclam.site/telegram/webhook/delete
curl -X POST "https://nclam.site/telegram/webhook/set?webhook_url=https://nclam.site/telegram/webhook"
```

### Issue 2: Không nhận được alerts

**Kiểm tra:**
```bash
# 1. User đã subscribe chưa?
docker compose exec db psql -U floodwatch floodwatch_prod -c "
SELECT * FROM telegram_subscriptions WHERE chat_id = YOUR_CHAT_ID;
"

# 2. Alerts dispatcher có chạy không?
grep "alerts_dispatcher" /var/log/floodwatch/ingestion.log

# 3. Test gửi thủ công
curl -X POST https://nclam.site/telegram/test-alert ...
```

### Issue 3: Webhook timeout

**Nguyên nhân:** Telegram timeout sau 60 giây

**Fix:** Webhook handler phải response nhanh (<3 giây)

---

## 📊 Success Metrics

Sau khi setup xong, đo lường:

| Metric | Target | How to Check |
|--------|--------|--------------|
| **Bot Response Time** | <2 seconds | Test với /start command |
| **Webhook Delivery** | 100% | Check /telegram/webhook/info |
| **Alert Delivery Time** | <5 minutes | From report created to Telegram sent |
| **User Subscriptions** | 10+ trong tuần 1 | Query database |

---

## 🎯 Next Steps

Sau khi bot chạy ổn:

1. **Thêm commands:**
   - `/help` - Hướng dẫn sử dụng
   - `/status` - Xem trạng thái đăng ký
   - `/unsubscribe` - Hủy đăng ký

2. **Inline keyboard:**
   - Buttons để chọn tỉnh (thay vì gõ text)
   - Buttons để chọn mức độ alert

3. **Rich media:**
   - Gửi ảnh satellite khi có bão
   - Gửi map screenshot

4. **Analytics:**
   - Track số user active
   - Track engagement rate
   - A/B test message format

---

## 📝 Bot Commands Reference

### User Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Bắt đầu sử dụng bot | `/start` |
| `/subscribe` | Đăng ký nhận cảnh báo | `/subscribe` |
| `/unsubscribe` | Hủy đăng ký | `/unsubscribe` |
| `/status` | Xem trạng thái | `/status` |
| `/help` | Hướng dẫn | `/help` |

### Admin Commands (Tùy chọn)

| Command | Description |
|---------|-------------|
| `/broadcast` | Gửi tin đến tất cả users |
| `/stats` | Xem thống kê bot |

---

## 🔐 Security Checklist

- [ ] Bot token stored securely in .env (not in code)
- [ ] .env added to .gitignore
- [ ] Webhook uses HTTPS (not HTTP)
- [ ] Rate limiting enabled on webhook endpoint
- [ ] User input validated (prevent SQL injection)
- [ ] Chat IDs stored as integers (not strings)

---

**Setup by:** _______________
**Date:** _______________
**Bot Username:** @floodwatch_vn_bot
**Webhook URL:** https://nclam.site/telegram/webhook
