# 🚀 Quick Deploy - nclam.site

**Mục tiêu:** Đưa FloodWatch lên production trong 2-3 giờ

---

## 📋 Thông Tin Cần Có

Trước khi bắt đầu, chuẩn bị:

- [ ] **Server:** Ubuntu 22.04+, 2 CPU, 4GB RAM
- [ ] **Server IP:** `___.___.___.___`
- [ ] **SSH Access:** root hoặc sudo user
- [ ] **Domain:** nclam.site (GoDaddy) ✅
- [ ] **Mapbox Token:** ✅ (đã có)

---

## ⚡ One-Command Deploy (Sau khi có Server)

```bash
# Đợi tôi generate sau khi bạn cung cấp Server IP
```

---

## 📝 Deployment Steps (Chi tiết trong DEPLOY_NCLAM_SITE.md)

### 1️⃣ Setup DNS trên GoDaddy (10 phút)

Login: https://dcc.godaddy.com/ → Domains → nclam.site → DNS

**Add records:**
```
Type   Name   Value              TTL
A      @      YOUR_SERVER_IP     600
A      www    YOUR_SERVER_IP     600
CNAME  api    nclam.site         600
```

**Verify:**
```bash
dig nclam.site +short  # Should return your IP
```

### 2️⃣ Prepare Server (30 phút)

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Install dependencies
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose nginx certbot python3-certbot-nginx git

# Clone repo
cd /opt
sudo git clone YOUR_REPO_URL floodwatch
cd floodwatch
```

### 3️⃣ Configure (15 phút)

```bash
# Generate secrets
sudo ./infra/scripts/generate_secrets.sh

# Edit config
sudo nano .env.prod
# Fill: NEXT_PUBLIC_API_URL=https://nclam.site
# Keep: MAPBOX_TOKEN (already filled)
# Save: Ctrl+O, Enter, Ctrl+X

# Setup nginx
sudo cp configs/nginx_nclam_site.conf /etc/nginx/sites-available/nclam.site
sudo ln -s /etc/nginx/sites-available/nclam.site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4️⃣ SSL Certificate (10 phút)

⚠️ Chỉ chạy sau khi DNS đã propagate!

```bash
sudo certbot --nginx -d nclam.site -d www.nclam.site -d api.nclam.site
# Follow prompts: email → Yes → No → 2 (redirect)
```

### 5️⃣ Deploy (30 phút)

```bash
cd /opt/floodwatch
sudo ./infra/scripts/deploy_production.sh

# Wait for containers
sudo docker-compose -f docker-compose.prod.yml ps
# All should be "Up (healthy)"

# Run migrations
sudo docker-compose -f docker-compose.prod.yml exec api alembic upgrade head

# Optional: Load demo data
sudo docker-compose -f docker-compose.prod.yml exec api alembic upgrade 006
```

### 6️⃣ Verify (10 phút)

```bash
# Test health
curl https://nclam.site/health

# Test POST
curl -X POST https://nclam.site/ingest/community \
  -H 'Content-Type: application/json' \
  -d '{"type":"SOS","text":"Test","lat":16.0544,"lon":108.2022,"province":"Đà Nẵng"}'

# Run smoke test
sudo ./infra/scripts/smoke_test.sh
```

### 7️⃣ Open Browser

- 🌐 https://www.nclam.site/map
- 🔧 https://nclam.site/health
- 📚 https://nclam.site/ (API docs)

---

## ✅ Success Criteria

- [ ] https://nclam.site/health returns `{"status":"ok"}`
- [ ] https://www.nclam.site/map shows map
- [ ] SSL certificate valid (green lock)
- [ ] POST /ingest/community returns success
- [ ] Smoke test passes

---

## 🎯 After Deployment

### Share với Partners

```
API Endpoint: https://nclam.site/ingest/community
Documentation: /opt/floodwatch/docs/API_INGESTION_GUIDE.md
Test: curl -X POST https://nclam.site/ingest/community -d @test.json
```

### Monitor

```bash
# Logs
sudo docker-compose -f docker-compose.prod.yml logs -f api

# UptimeRobot
Add monitor: https://nclam.site/health (5 min interval)
```

### Maintenance

```bash
# Backup DB
sudo ./infra/scripts/prod_backup.sh

# Update code
cd /opt/floodwatch && sudo git pull
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 🆘 Issues?

| Problem | Check | Solution |
|---------|-------|----------|
| DNS not resolving | `dig nclam.site` | Wait 30 min or clear cache |
| Certbot fails | DNS + nginx config | Fix DNS first |
| Container not healthy | `docker logs` | Check `.env.prod` |
| Map not showing | Mapbox token | Verify in `.env.prod` |
| 0 reports | POST test | Run test POST command |

**Full troubleshooting:** See `DEPLOY_NCLAM_SITE.md`

---

## 📞 Cung Cấp Thông Tin Để Generate Commands

Reply với:

1. **Server IP:** `___.___.___.___`
2. **SSH User:** (root hoặc ubuntu?)
3. **Git Repo URL:** (nếu public)

→ Tôi sẽ tạo **one-line script** để deploy!

---

**Status:** Waiting for server details
**Domain:** ✅ nclam.site (GoDaddy)
**Config:** ✅ Ready (nginx + .env template)
**Mapbox:** ✅ Token available
