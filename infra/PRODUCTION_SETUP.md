# FloodWatch – Production Server Setup

## 1) System Requirements

**Minimum specs:**
- OS: Ubuntu 22.04 LTS (recommended) or Debian 11+
- CPU: 2 vCPU
- RAM: 4 GB
- Storage: 40 GB SSD (minimum)
- Network: Public IP with inbound ports 80, 443, 22

**Required packages:**
```bash
# Docker & Docker Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Basic utilities
sudo apt update
sudo apt install -y curl git tmux vim htop

# Optional but recommended
sudo apt install -y logrotate fail2ban ufw
```

**Optional packages:**

**For PDF snapshots (WeasyPrint):**
```bash
sudo apt install -y \
  libpango-1.0-0 libpangocairo-1.0-0 libpangoft2-1.0-0 \
  libffi-dev libjpeg-dev libxml2-dev libxslt1-dev libcairo2-dev
```

**For load testing:**
```bash
# k6
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6
```

**For monitoring:**
```bash
# Prometheus (via Docker or system package)
docker run -d --name prometheus -p 9090:9090 \
  -v /opt/floodwatch/infra/prometheus:/etc/prometheus \
  prom/prometheus
```

---

## 2) Networking / DNS / SSL

### DNS Configuration

Create A/AAAA records pointing to your server IP:

```
floodwatch.vn          A     <SERVER_PUBLIC_IP>
api.floodwatch.vn      A     <SERVER_PUBLIC_IP>
```

**Verify DNS propagation:**
```bash
dig floodwatch.vn +short
dig api.floodwatch.vn +short
```

### Firewall Setup

**Using UFW (Ubuntu Firewall):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### SSL Certificate (Let's Encrypt)

**First-time certificate request:**

```bash
cd /opt/floodwatch

# Ensure nginx is running and port 80 is accessible
docker compose -f docker-compose.prod.yml up -d nginx

# Request certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d floodwatch.vn -d api.floodwatch.vn \
  --email ops@floodwatch.vn \
  --agree-tos \
  --no-eff-email

# Reload nginx to use new certificates
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

**Auto-renewal (already configured in docker-compose.prod.yml):**
```bash
# Test renewal (dry run)
docker compose -f docker-compose.prod.yml run --rm certbot renew --dry-run

# Actual renewal (cron handles this automatically)
# Add to crontab: 0 3 * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml run --rm certbot renew && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 3) Directory Layout

**Expected structure on production server:**

```
/opt/floodwatch/
├── docker-compose.prod.yml          # Production compose file
├── .env.prod                        # Environment variables (SECRET!)
├── .gitignore
├── README.md
│
├── apps/
│   ├── api/                         # FastAPI backend
│   │   ├── app/
│   │   ├── migrations/
│   │   ├── ops/
│   │   └── Dockerfile
│   └── web/                         # Next.js frontend
│       ├── app/
│       ├── public/
│       └── Dockerfile
│
├── infra/
│   ├── scripts/
│   │   ├── preflight.sh             # Pre-deployment checks
│   │   ├── smoke_test.sh            # Post-deployment tests
│   │   ├── prod_up.sh               # Bring up production stack
│   │   ├── prod_logs.sh             # View logs
│   │   ├── prod_backup.sh           # Database backup
│   │   ├── prod_restore.sh          # Database restore
│   │   └── deploy_production.sh     # ONE-SHOT DEPLOY ⭐
│   │
│   ├── nginx/
│   │   └── conf.d/
│   │       ├── floodwatch.conf      # Main nginx config
│   │       └── security_headers.conf # Security headers
│   │
│   ├── prometheus/
│   │   ├── prometheus.yml.example
│   │   └── alerts.yml.example
│   │
│   ├── logrotate/
│   │   └── floodwatch               # Log rotation config
│   │
│   ├── backups/                     # Database backups (auto-created)
│   ├── GO_LIVE_CHECKLIST.md
│   ├── GO_LIVE_LOG_TEMPLATE.md
│   ├── QUICK_REFERENCE.md
│   ├── ROLLBACK_PLAYBOOK.md
│   └── PRODUCTION_SETUP.md          # This file
│
├── docs/
│   ├── RUN_ORDER.md                 # 1-page deployment timeline
│   ├── DRILL_PLAYBOOK.md            # Rollback drill procedures
│   ├── WAR_ROOM_CHECKLIST.md        # Hourly health checks
│   ├── RUNBOOK.md                   # Incident response
│   ├── HELPCARD_PUBLIC.md           # User guide (for rescue teams)
│   └── ... (other docs)
│
├── logs/                            # Application logs (auto-created)
│   ├── kttv.log
│   ├── roads.log
│   ├── alerts.log
│   ├── snapshot.log
│   └── deploy_*.log
│
└── ops/
    ├── cron/                        # Scheduled tasks
    │   ├── kttv_scraper.py
    │   ├── roads_press_watch.py
    │   ├── alerts_dispatcher.py
    │   └── daily_snapshot.py
    ├── scripts/
    │   └── seed_api_keys.py
    └── snapshots/                   # Daily PDF snapshots (auto-created)
```

---

## 4) Environment Variables (.env.prod)

**Create `/opt/floodwatch/.env.prod` with the following:**

```bash
# Security
ADMIN_TOKEN=<GENERATE_WITH: openssl rand -hex 32>

# Database
DATABASE_URL=postgresql+psycopg://fw_prod_user:<STRONG_PASSWORD>@db:5432/floodwatch

# CORS
CORS_ORIGINS=https://floodwatch.vn,https://api.floodwatch.vn

# Mapbox (for map tiles)
NEXT_PUBLIC_MAPBOX_TOKEN=<YOUR_MAPBOX_TOKEN>

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=<YOUR_CLOUDINARY_CLOUD_NAME>
CLOUDINARY_API_KEY=<YOUR_CLOUDINARY_API_KEY>
CLOUDINARY_API_SECRET=<YOUR_CLOUDINARY_API_SECRET>

# Optional: Telegram notifications
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>

# Optional: Webhook security
WEBHOOK_SECRET=<GENERATE_WITH: openssl rand -hex 32>

# Environment
ENV=production
LOG_LEVEL=INFO
```

**Generate secure tokens:**
```bash
# ADMIN_TOKEN (64 hex characters)
openssl rand -hex 32

# WEBHOOK_SECRET (64 hex characters)
openssl rand -hex 32

# Database password (32 characters)
openssl rand -base64 24
```

**⚠️ IMPORTANT:**
- Never commit `.env.prod` to git!
- Set file permissions: `chmod 600 .env.prod`
- Backup this file securely (encrypted)

---

## 5) Nginx Configuration

**Main config (`infra/nginx/conf.d/floodwatch.conf`):**

Should include security headers:
```nginx
server {
    listen 443 ssl http2;
    server_name floodwatch.vn api.floodwatch.vn;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/floodwatch.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/floodwatch.vn/privkey.pem;

    # Include security headers
    include /etc/nginx/conf.d/security_headers.conf;

    # ... rest of config
}
```

**Security headers file (`infra/nginx/conf.d/security_headers.conf`):**

Already created by deployment package. Should contain:
- HSTS (Strict-Transport-Security)
- CSP (Content-Security-Policy)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

**Verify security headers:**
```bash
curl -I https://floodwatch.vn | grep -E 'strict-transport|content-security|x-frame|x-content'
```

---

## 6) Log Rotation

**Setup logrotate:**

```bash
# Copy config to system logrotate directory
sudo cp /opt/floodwatch/infra/logrotate/floodwatch /etc/logrotate.d/floodwatch
sudo chmod 644 /etc/logrotate.d/floodwatch

# Test configuration
sudo logrotate -d /etc/logrotate.d/floodwatch

# Force rotation manually (for testing)
sudo logrotate -f /etc/logrotate.d/floodwatch

# Verify logs are being rotated
ls -lh /opt/floodwatch/logs/
```

**Logrotate schedule:**
- Application logs (`*.log`): Daily rotation, 14-day retention, gzip compressed
- PDF snapshots (`*.pdf`): Weekly rotation, 8-week retention, gzip compressed

---

## 7) First Deployment (One-Shot)

**Clone repository:**
```bash
cd /opt
sudo git clone https://github.com/YOUR_ORG/floodwatch.git
sudo chown -R $USER:$USER /opt/floodwatch
cd /opt/floodwatch
```

**Setup environment:**
```bash
# Create .env.prod (see section 4 above)
nano .env.prod

# Make scripts executable
chmod +x infra/scripts/*.sh
chmod +x docs/export_helpcard_pdf.sh
```

**Build Docker images (optional, can also pull from registry):**
```bash
docker build -t floodwatch-api:v4-prod ./apps/api
docker build -t floodwatch-web:v4-prod ./apps/web
```

**Run one-shot deployment:**
```bash
cd /opt/floodwatch

# Dry-run first (see what will happen)
DRY_RUN=1 ./infra/scripts/deploy_production.sh

# Actual deployment
./infra/scripts/deploy_production.sh
```

**Check deployment log:**
```bash
tail -f logs/deploy_*.log
```

---

## 8) Cron Jobs (Timezone Asia/Ho_Chi_Minh)

**Edit crontab:**
```bash
crontab -e
```

**Add these lines:**
```cron
# Set timezone for Vietnam
CRON_TZ=Asia/Ho_Chi_Minh

# KTTV scraper (every hour at :05)
5 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/kttv_scraper.py >> logs/kttv.log 2>&1

# Roads press watch (every hour at :35)
35 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/roads_press_watch.py >> logs/roads.log 2>&1

# Alerts dispatcher (every 2 minutes)
*/2 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/alerts_dispatcher.py >> logs/alerts.log 2>&1

# Daily snapshot (23:55 every day)
55 23 * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/daily_snapshot.py >> logs/snapshot.log 2>&1

# Database backup (02:00 every day)
0 2 * * * cd /opt/floodwatch && ./infra/scripts/prod_backup.sh >> logs/backup.log 2>&1

# SSL certificate renewal check (03:00 every day)
0 3 * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml run --rm certbot renew && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload >> logs/certbot.log 2>&1
```

**Verify cron jobs:**
```bash
crontab -l | grep floodwatch
```

**Monitor cron logs:**
```bash
tail -f logs/kttv.log
tail -f logs/roads.log
tail -f logs/alerts.log
tail -f logs/snapshot.log
```

---

## 9) Monitoring Setup

### Prometheus

**Copy example configs:**
```bash
cd /opt/floodwatch
cp infra/prometheus/prometheus.yml.example infra/prometheus/prometheus.yml
cp infra/prometheus/alerts.yml.example infra/prometheus/alerts.yml
```

**Edit prometheus.yml:**
```yaml
# Replace REPLACE_WITH_ADMIN_TOKEN with actual token
# Update targets to match your domain
scrape_configs:
  - job_name: 'floodwatch-api'
    metrics_path: '/metrics'
    params:
      token: ['YOUR_ADMIN_TOKEN_HERE']
    static_configs:
      - targets: ['floodwatch.vn:443']
        labels:
          env: 'production'
```

**Start Prometheus:**
```bash
docker run -d --name prometheus \
  -p 9090:9090 \
  -v /opt/floodwatch/infra/prometheus:/etc/prometheus \
  --restart unless-stopped \
  prom/prometheus
```

**Verify:**
```bash
# Check targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Or open in browser
# http://<SERVER_IP>:9090/targets
```

### Uptime Monitoring

**Recommended services:**
- UptimeRobot (free tier: 50 monitors, 5-min interval)
- Better Uptime
- StatusCake
- Pingdom

**Setup:**
1. Add monitor for: `https://floodwatch.vn/health`
2. Interval: 60 seconds
3. Alert if down for: >2 minutes
4. Notification: Email, Telegram, Slack

---

## 10) Rollback Options

**See `infra/ROLLBACK_PLAYBOOK.md` for detailed procedures.**

**Quick reference:**

| Option | Use Case | RTO | Command |
|--------|----------|-----|---------|
| **A** | Bad image, no DB changes | 3 min | Revert Docker image tag |
| **B** | Bad migration | 5 min | `alembic downgrade -1` |
| **C** | Data corruption | 8 min | `./infra/scripts/prod_restore.sh` |
| **D** | Full system down | 2 min | Enable Lite-only mode (Nginx redirect) |

**Emergency Lite-only mode (Option D):**
```bash
docker compose -f docker-compose.prod.yml exec nginx bash -c "
cat > /etc/nginx/conf.d/emergency_lite_only.conf << 'EOF'
location = /map { return 302 /lite; }
location /map/ { return 302 /lite; }
EOF
nginx -s reload
"
```

---

## 11) Post-Deployment Verification

**Health checks:**
```bash
# Basic health
curl https://floodwatch.vn/health

# Security headers
curl -I https://floodwatch.vn | grep -E 'strict-transport|content-security|x-frame'

# API endpoint
curl -H "X-API-Key: YOUR_KEY" "https://api.floodwatch.vn/api/v1/reports?limit=1"

# Lite mode
curl https://floodwatch.vn/lite
```

**Container status:**
```bash
docker compose -f docker-compose.prod.yml ps
```

**Database connections:**
```bash
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;
"
```

**Metrics:**
```bash
curl -s "https://floodwatch.vn/metrics?token=YOUR_ADMIN_TOKEN" | head -50
```

---

## 12) War-Room Roster

**Assign 3 shifts for first 5 days:**

| Shift | Hours | On-call Engineer | Contact |
|-------|-------|------------------|---------|
| A | 06:00-14:00 | __________ | _______ |
| B | 14:00-22:00 | __________ | _______ |
| C | 22:00-06:00 | __________ | _______ |

**Checklist location:** `docs/WAR_ROOM_CHECKLIST.md`

**Key links to share:**
- Ops Dashboard: `https://floodwatch.vn/ops?token=<ADMIN_TOKEN>`
- Metrics: `https://floodwatch.vn/metrics?token=<ADMIN_TOKEN>`
- Quick Reference: `infra/QUICK_REFERENCE.md`

---

## 13) Backup & Disaster Recovery

**Automated daily backups:**
```bash
# Already in cron (02:00 daily)
./infra/scripts/prod_backup.sh
```

**Manual backup:**
```bash
cd /opt/floodwatch
./infra/scripts/prod_backup.sh
```

**List backups:**
```bash
ls -lh infra/backups/
```

**Restore from backup:**
```bash
./infra/scripts/prod_restore.sh infra/backups/fw_backup_YYYYMMDD_HHMMSS.sql.gz
```

**Off-site backup (recommended):**
```bash
# Copy to remote server
scp infra/backups/fw_backup_*.sql.gz backup-server:/backups/floodwatch/

# Or sync to cloud storage
rclone sync infra/backups/ remote:floodwatch-backups/
```

---

## 14) Security Hardening

**SSH hardening:**
```bash
# Edit /etc/ssh/sshd_config
sudo nano /etc/ssh/sshd_config

# Recommended settings:
# PermitRootLogin no
# PasswordAuthentication no (use SSH keys only)
# Port 2222 (change default port)

# Restart SSH
sudo systemctl restart sshd
```

**Fail2ban (block brute-force attacks):**
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**Firewall (UFW) status:**
```bash
sudo ufw status verbose
```

**Docker security:**
```bash
# Run containers as non-root user
# Set resource limits in docker-compose.yml
# Use read-only filesystems where possible
# Scan images for vulnerabilities
docker scan floodwatch-api:v4-prod
```

---

## 15) Troubleshooting

**Common issues:**

### 1. Port 80/443 already in use
```bash
# Find process using port
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting service (e.g., Apache)
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### 2. Docker Compose not found
```bash
# Install Docker Compose v2
sudo apt install docker-compose-plugin

# Verify
docker compose version
```

### 3. Database connection fails
```bash
# Check database container
docker compose -f docker-compose.prod.yml logs db

# Check DATABASE_URL in .env.prod
grep DATABASE_URL .env.prod

# Test connection
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "SELECT 1;"
```

### 4. SSL certificate fails
```bash
# Ensure port 80 is open
sudo ufw allow 80/tcp

# Check DNS propagation
dig floodwatch.vn +short

# Test dry-run
docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot -w /var/www/certbot -d floodwatch.vn --dry-run
```

### 5. High memory usage
```bash
# Check container stats
docker stats --no-stream

# Restart specific container
docker compose -f docker-compose.prod.yml restart api

# Check logs for memory leaks
docker compose -f docker-compose.prod.yml logs --tail=100 api | grep -i memory
```

---

## 16) Related Documentation

**Deployment:**
- **RUN_ORDER.md** - 1-page deployment timeline
- **GO_LIVE_CHECKLIST.md** - Comprehensive checklist
- **GO_LIVE_LOG_TEMPLATE.md** - Real-time log template

**Operations:**
- **QUICK_REFERENCE.md** - Copy-paste commands
- **WAR_ROOM_CHECKLIST.md** - Hourly health checks
- **RUNBOOK.md** - Incident response procedures

**Emergency:**
- **ROLLBACK_PLAYBOOK.md** - Rollback procedures (2-10 min)
- **DRILL_PLAYBOOK.md** - Practice rollback quarterly

**User guides:**
- **HELPCARD_PUBLIC.md** - Guide for rescue teams and citizens

---

## 17) Success Criteria

**Deployment is successful when:**

- ✅ All containers running (`docker compose ps` shows "Up (healthy)")
- ✅ Health endpoint returns 200: `curl https://floodwatch.vn/health`
- ✅ Smoke tests pass 7/7: `./infra/scripts/smoke_test.sh`
- ✅ Security headers present (HSTS, CSP, X-Frame-Options, etc.)
- ✅ SSL certificate valid (A+ rating on SSL Labs)
- ✅ Cron jobs configured and running
- ✅ Monitoring active (Prometheus targets UP, uptime monitor configured)
- ✅ Backups scheduled and tested
- ✅ War-room roster assigned
- ✅ p95 latency <150ms, error rate <1%

**Post-deployment (first 24 hours):**
- ✅ Hourly health checks completed
- ✅ No critical incidents
- ✅ KTTV scraper running successfully
- ✅ Alerts dispatcher delivering notifications
- ✅ No rollback required

---

**🚀 FloodWatch Production Setup Complete!**

**Version:** 1.1.1
**Last updated:** 2025-11-01
**Maintainer:** Ops Team
