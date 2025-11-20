# 📋 FloodWatch Operations Guide

## 📁 Cấu trúc thư mục `ops/`

```
ops/
├── README.md                    # File này - tổng quan về ops
├── PRODUCTION_DEPLOY.md         # Hướng dẫn deploy lên production
├── MONITORING_SETUP.md          # Setup giám sát & alerts
├── run_ingestion.sh            # Script chạy data ingestion
├── backup_db.sh                # Script backup database
├── crontab.txt                 # Cấu hình cron jobs
├── cron/                       # Data ingestion scripts
│   ├── kttv_alerts.py          # Thu thập cảnh báo KTTV
│   ├── roads_press_watch.py   # Giám sát tin tức giao thông
│   └── alerts_dispatcher.py   # Gửi alerts qua webhook/telegram
├── configs/
│   └── provinces.json          # Danh sách tỉnh + coordinates
└── scripts/
    └── seed_api_key.py         # Tạo API keys

```

---

## 🚀 Quick Start Guide

### Bước 1: Deploy lên Production (30 phút)

```bash
# 1. SSH vào server
ssh root@188.166.248.10

# 2. Clone/upload code
cd /root && scp -r your-code floodwatch/

# 3. Setup environment
cd floodwatch
cp .env.example .env
nano .env  # Điền thông tin

# 4. Deploy
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verify
curl https://nclam.site/health
```

📖 **Chi tiết:** Xem `PRODUCTION_DEPLOY.md`

---

### Bước 2: Setup Monitoring (15 phút)

```bash
# 1. Đăng ký UptimeRobot (free)
# https://uptimerobot.com

# 2. Tạo 3 monitors:
#    - https://nclam.site/health
#    - https://nclam.site/map
#    - https://nclam.site/reports

# 3. Setup Telegram alerts
```

📖 **Chi tiết:** Xem `MONITORING_SETUP.md`

---

### Bước 3: Tự động hóa Data (10 phút)

```bash
# 1. Copy scripts
chmod +x ops/*.sh

# 2. Install cron jobs
crontab ops/crontab.txt

# 3. Verify
crontab -l
```

---

## 📊 Cron Jobs đã được cấu hình

| Job | Frequency | Description |
|-----|-----------|-------------|
| **KTTV Alerts** | Mỗi 10 phút | Thu thập cảnh báo từ nchmf.gov.vn |
| **Roads Watch** | Mỗi 30 phút | Giám sát tin tức giao thông |
| **Database Backup** | 2:00 AM hàng ngày | Backup PostgreSQL database |
| **Log Cleanup** | 3:00 AM Chủ Nhật | Xóa logs cũ hơn 7 ngày |
| **Health Check** | Mỗi 5 phút | Kiểm tra API có hoạt động |

---

## 🔍 Monitoring Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Health check | `{"status":"ok","database":"connected"}` |
| `/reports` | Data availability | JSON array of reports |
| `/map` | Frontend availability | HTML page with map |

---

## 📈 Daily Operations

### Buổi sáng (9:00 AM)

```bash
# Check system health
./ops/health_check.sh

# Review overnight logs
tail -50 /var/log/floodwatch/ingestion.log

# Check new reports count
docker compose exec db psql -U floodwatch -c \
  "SELECT COUNT(*) FROM reports WHERE created_at > NOW() - INTERVAL '24 hours';"
```

### Hàng tuần (Thứ Hai)

```bash
# Review backup status
ls -lh /var/backups/floodwatch/

# Check disk usage
df -h

# Review error logs
grep ERROR /var/log/floodwatch/*.log | tail -50
```

### Hàng tháng

```bash
# Update dependencies
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Review metrics
# - Total reports this month
# - API uptime percentage (from UptimeRobot)
# - Average response time
```

---

## 🆘 Emergency Contacts & Runbook

### Khi có Alert: "API is down"

```bash
# 1. Check containers
docker compose ps

# 2. View logs
docker compose logs api --tail 50

# 3. Restart if needed
docker compose restart api

# 4. Verify
curl http://localhost:8000/health
```

### Khi có Alert: "No new data"

```bash
# 1. Check ingestion logs
tail -50 /var/log/floodwatch/kttv.log

# 2. Run manually
./ops/run_ingestion.sh kttv

# 3. Check data source
curl https://nchmf.gov.vn  # Verify source is up
```

### Khi có Alert: "Disk full"

```bash
# 1. Check disk usage
df -h

# 2. Clean old backups
find /var/backups/floodwatch -mtime +7 -delete

# 3. Clean old logs
find /var/log/floodwatch -name "*.log" -mtime +7 -delete

# 4. Clean Docker
docker system prune -a --volumes
```

---

## 📝 Logs Location

| Log File | Purpose |
|----------|---------|
| `/var/log/floodwatch/ingestion.log` | Main ingestion runner |
| `/var/log/floodwatch/kttv.log` | KTTV alerts specific |
| `/var/log/floodwatch/roads.log` | Roads watch specific |
| `/var/log/floodwatch/backup.log` | Database backups |
| `/var/log/floodwatch/health.log` | Health checks |

### View logs real-time

```bash
tail -f /var/log/floodwatch/ingestion.log
```

---

## 🔐 Security Best Practices

- [ ] Passwords stored in `.env` (not in code)
- [ ] `.env` added to `.gitignore`
- [ ] Database not exposed to public internet
- [ ] SSH key-only authentication
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] Regular security updates
- [ ] API rate limiting enabled
- [ ] CORS properly configured

---

## 📞 Support & Resources

### Documentation

- **Production Deploy:** `PRODUCTION_DEPLOY.md`
- **Monitoring Setup:** `MONITORING_SETUP.md`
- **API Docs:** https://nclam.site/docs
- **Health Check:** https://nclam.site/health

### External Services

- **UptimeRobot Dashboard:** https://uptimerobot.com/dashboard
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **DigitalOcean Console:** https://cloud.digitalocean.com

### Team Contacts

- **On-call Engineer:** [Your contact]
- **DevOps Lead:** [Your contact]
- **Telegram Alert Channel:** [Your channel]

---

## 🎯 Next Steps (Recommended)

Sau khi hoàn thành 3 bước trên, nên làm tiếp:

### Phase 2: Cải thiện UX (Tuần 2)

1. **Thêm "Nguồn" và "Độ tin cậy" lên UI**
   - Badge trên mỗi report card
   - Icon khác nhau cho từng nguồn

2. **Bộ lọc nâng cao**
   - Filter theo severity
   - Filter theo time range
   - Filter theo vị trí người dùng

3. **"Lần cuối cập nhật" timestamp**
   - Hiển thị trên header/footer

### Phase 3: Alert Channel (Tuần 3)

1. **Telegram Bot cảnh báo**
   - Setup bot với BotFather
   - Implement subscription logic
   - Test với 1-2 user

2. **Email digest hàng ngày**
   - Tổng hợp các alerts quan trọng
   - Gửi lúc 7:00 AM

---

## 📊 Success Metrics

Để đo lường thành công của hệ thống:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Uptime** | 99.5% | UptimeRobot dashboard |
| **API Response Time** | < 500ms | UptimeRobot monitors |
| **New Reports/Day** | > 10 | Database query |
| **Data Freshness** | < 1 hour | Check last ingestion time |
| **Alert Delivery** | < 5 minutes | Telegram bot logs |

---

## 🔄 Change Log

### v2.0.0 - 2025-11-18
- ✅ Production deployment scripts
- ✅ Monitoring setup guide
- ✅ Automated data ingestion (cron)
- ✅ Database backup automation
- ✅ Health check scripts
- ✅ Operations runbook

### Next Release (v2.1.0)
- [ ] Telegram alert bot
- [ ] Email notifications
- [ ] Enhanced UX with trust scores
- [ ] Advanced filtering

---

**Maintainer:** FloodWatch Team
**Last Updated:** 18/11/2025
**Version:** 2.0.0
