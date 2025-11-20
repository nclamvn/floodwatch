# FloodWatch - Production Deployment Package v1.1.1

**🎯 One-Script Deploy - Copy, Paste, Run**

---

## 📦 PACKAGE CONTENTS

This deployment package contains everything needed for a **60-90 minute production cutover**:

### Core Files (3 files - YOU NEED THESE)

1. **`infra/scripts/deploy_production.sh`** ⭐ ONE-SHOT DEPLOY
   - Automated deployment script
   - Runs all 8 deployment steps
   - Logs to `logs/deploy_TIMESTAMP.log`
   - **This is your main deployment script**

2. **`infra/GO_LIVE_LOG_TEMPLATE.md`**
   - Real-time log template
   - Fill in timestamps and results as you deploy
   - Document decisions and issues

3. **`infra/PRODUCTION_SETUP.md`**
   - Complete server setup guide
   - System requirements, DNS, SSL, environment variables
   - 17 sections covering everything

### Supporting Files (Already in Repository)

**Scripts:**
- `infra/scripts/preflight.sh` - Pre-deployment validation (9 checks)
- `infra/scripts/smoke_test.sh` - Post-deployment testing (7 tests)
- `infra/scripts/prod_up.sh` - Bring up Docker stack
- `infra/scripts/prod_logs.sh` - View logs
- `infra/scripts/prod_backup.sh` - Database backup
- `infra/scripts/prod_restore.sh` - Database restore
- `infra/scripts/generate_secrets.sh` - Auto-generate production secrets

**Configuration:**
- `infra/nginx/conf.d/security_headers.conf` - Security headers
- `infra/logrotate/floodwatch` - Log rotation config
- `.env.prod.example` - Production environment template

**Visual Aids (Print-Ready):**
- `docs/FloodWatch_Deployment_Gantt.html` ⭐ - Interactive timeline (T-15' to T+60')
- `docs/FloodWatch_PreDeployment_Checklist.html` ⭐ - 24-item checklist with sign-off

### Documentation (Reference)

- `docs/RUN_ORDER.md` - 1-page deployment timeline
- `docs/DRILL_PLAYBOOK.md` - Rollback drill procedures
- `infra/ROLLBACK_PLAYBOOK.md` - 4 rollback options (2-10 min)
- `infra/QUICK_REFERENCE.md` - Copy-paste commands
- `docs/WAR_ROOM_CHECKLIST.md` - Hourly health checks
- `docs/HELPCARD_PUBLIC.md` - User guide for rescue teams

---

## 🚀 QUICK START (3 Steps)

> 📋 **Before you start:** Print the pre-deployment checklist
> ```bash
> open docs/FloodWatch_PreDeployment_Checklist.html
> # Cmd/Ctrl+P → Save as PDF → Print
> # Work through 24 items, check off as you complete
> ```

### Step 1: Setup Server

**On your production server:**

```bash
# 1. Install Docker & Docker Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# 2. Clone repository
cd /opt
sudo git clone https://github.com/YOUR_ORG/floodwatch.git
sudo chown -R $USER:$USER /opt/floodwatch
cd /opt/floodwatch

# 3. Create .env.prod (see PRODUCTION_SETUP.md section 4)
nano .env.prod
# Fill in: ADMIN_TOKEN, DATABASE_URL, CORS_ORIGINS, MAPBOX_TOKEN, CLOUDINARY credentials

# 4. Make scripts executable
chmod +x infra/scripts/*.sh

# 5. Setup DNS (see PRODUCTION_SETUP.md section 2)
# Ensure floodwatch.vn and api.floodwatch.vn point to this server

# 6. Open firewall ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 2: Deploy

**Run the one-shot deployment script:**

```bash
cd /opt/floodwatch

# Optional: Dry-run first to see what will happen
DRY_RUN=1 ./infra/scripts/deploy_production.sh

# Actual deployment
./infra/scripts/deploy_production.sh
```

**What happens:**
1. ✅ Preflight checks (disk, memory, ports, env)
2. ✅ Bring up Docker stack (api, web, db, nginx, certbot)
3. ✅ Run database migrations
4. ✅ Seed API keys
5. ✅ Warm up cache (5 hits per endpoint)
6. ✅ Run smoke tests (7 checks)
7. ✅ Display cron template
8. ✅ Check security headers

**Expected time:** 15-20 minutes

**Log location:** `logs/deploy_YYYYMMDD_HHMMSS.log`

### Step 3: Post-Deployment

**Setup cron jobs:**

```bash
crontab -e
# Copy cron template from deployment script output
# Or from PRODUCTION_SETUP.md section 8
```

**Verify deployment:**

```bash
# Health check
curl https://floodwatch.vn/health

# Run smoke tests manually
export API_KEY="<key_from_seed_output>"
export ADMIN_TOKEN="<from_.env.prod>"
./infra/scripts/smoke_test.sh

# Check containers
docker compose -f docker-compose.prod.yml ps
```

**Setup monitoring:**

```bash
# Prometheus (optional)
docker run -d --name prometheus -p 9090:9090 \
  -v $PWD/infra/prometheus:/etc/prometheus \
  prom/prometheus

# Add UptimeRobot monitor
# URL: https://floodwatch.vn/health
# Interval: 60 seconds
```

---

## 📋 DEPLOYMENT CHECKLIST

**Before you start:**
- [ ] Server meets requirements (2 vCPU, 4 GB RAM, 40 GB SSD)
- [ ] Docker & Docker Compose v2 installed
- [ ] DNS configured (floodwatch.vn → server IP)
- [ ] Ports 22, 80, 443 open in firewall
- [ ] `.env.prod` created and filled in
- [ ] Scripts made executable (`chmod +x infra/scripts/*.sh`)

**During deployment:**
- [ ] Preflight checks PASS
- [ ] All containers UP
- [ ] Migrations to `005_performance_indexes`
- [ ] API key captured from seed output
- [ ] Smoke tests 7/7 PASS
- [ ] Security headers present

**After deployment:**
- [ ] Cron jobs configured
- [ ] Monitoring active (Prometheus, UptimeRobot)
- [ ] Log rotation configured (`/etc/logrotate.d/floodwatch`)
- [ ] War-room roster assigned
- [ ] Backup tested (`./infra/scripts/prod_backup.sh`)
- [ ] SSL certificate valid (Let's Encrypt)
- [ ] HELPCARD distributed to rescue teams

---

## 🔧 TROUBLESHOOTING

### Script fails at Step 0 (Preflight)

**Solution:** Fix the failing check and re-run

```bash
# Check disk space
df -h /

# Check inodes
df -i /

# Verify Docker installed
docker --version
docker compose version

# Check .env.prod
cat .env.prod | grep -E "ADMIN_TOKEN|DATABASE_URL|CORS_ORIGINS"
```

### Script fails at Step 1 (Bring up stack)

**Solution:** Check Docker Compose file and logs

```bash
# View logs
docker compose -f docker-compose.prod.yml logs

# Check specific service
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs db

# Restart specific service
docker compose -f docker-compose.prod.yml restart api
```

### Smoke tests fail (<7/7 PASS)

**Solution:** Check which test failed

```bash
# Run smoke tests manually with verbose output
export API_KEY="<key>"
export ADMIN_TOKEN="<token>"
./infra/scripts/smoke_test.sh

# Common fixes:
# - CORS: Check CORS_ORIGINS in .env.prod
# - 401: Check API_KEY and ADMIN_TOKEN
# - 503: Service not up yet, wait 30s and retry
# - Security headers: Include security_headers.conf in nginx config
```

### SSL certificate fails

**Solution:** Ensure DNS and port 80 are ready

```bash
# Check DNS
dig floodwatch.vn +short
dig api.floodwatch.vn +short

# Test port 80 accessible
curl http://floodwatch.vn/.well-known/acme-challenge/test

# Run certbot manually
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d floodwatch.vn -d api.floodwatch.vn \
  --email ops@floodwatch.vn \
  --agree-tos
```

---

## 🔴 ROLLBACK (If Something Goes Wrong)

**If deployment fails and you need to rollback:**

See `infra/ROLLBACK_PLAYBOOK.md` for detailed procedures.

**Quick rollback options:**

### Option D: Emergency Lite-Only Mode (2 minutes)

```bash
# Fastest rollback: redirect /map to /lite
docker compose -f docker-compose.prod.yml exec nginx bash -c "
cat > /etc/nginx/conf.d/emergency_lite_only.conf << 'EOF'
location = /map { return 302 /lite; }
location /map/ { return 302 /lite; }
EOF
nginx -s reload
"
```

### Option A: Rollback Docker Images (3 minutes)

```bash
# Use previous stable image tag
docker compose -f docker-compose.prod.yml pull api:v3-stable web:v3-stable
docker compose -f docker-compose.prod.yml up -d api web
```

### Option B: Rollback Database Migration (5 minutes)

```bash
# Rollback one migration
docker compose -f docker-compose.prod.yml exec api alembic downgrade -1
docker compose -f docker-compose.prod.yml restart api
```

### Option C: Restore Database Backup (8 minutes)

```bash
# Restore from latest backup
docker compose -f docker-compose.prod.yml stop api
./infra/scripts/prod_restore.sh infra/backups/<latest_backup>.sql.gz
docker compose -f docker-compose.prod.yml up -d
```

---

## 📊 SUCCESS CRITERIA

**Deployment is successful when:**

- ✅ `./infra/scripts/deploy_production.sh` completes without errors
- ✅ Smoke tests: 7/7 PASS
- ✅ `curl https://floodwatch.vn/health` returns `{"status":"ok","database":"connected"}`
- ✅ All containers show "Up (healthy)": `docker compose -f docker-compose.prod.yml ps`
- ✅ Security headers present: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- ✅ p95 latency <150ms, error rate <1%

---

## 📞 SUPPORT

**If you encounter issues:**

1. **Check deployment log:**
   ```bash
   tail -f logs/deploy_*.log
   ```

2. **Check service logs:**
   ```bash
   ./infra/scripts/prod_logs.sh api
   ./infra/scripts/prod_logs.sh nginx
   ```

3. **Review troubleshooting section** in PRODUCTION_SETUP.md

4. **Consult documentation:**
   - RUN_ORDER.md - Step-by-step timeline
   - ROLLBACK_PLAYBOOK.md - Emergency procedures
   - QUICK_REFERENCE.md - Common commands

5. **Contact ops team:**
   - Email: ops@floodwatch.vn
   - War-room: (Slack/Telegram channel)

---

## 🎓 PRACTICE BEFORE GO-LIVE

**Recommended: Run deployment on staging first**

```bash
# On staging server
DRY_RUN=1 ./infra/scripts/deploy_production.sh  # Preview
./infra/scripts/deploy_production.sh             # Execute

# Practice rollback (see docs/DRILL_PLAYBOOK.md)
# - Inject fake issue
# - Practice Option A/B/C/D rollback
# - Time how long each takes
# - Document learnings
```

---

## 📚 NEXT STEPS AFTER DEPLOYMENT

1. **Assign war-room roster** (3 shifts, 8-hour each, for first 5 days)
2. **Schedule hourly health checks** (see docs/WAR_ROOM_CHECKLIST.md)
3. **Setup off-site backups** (rsync, rclone, or cloud storage)
4. **Schedule quarterly rollback drill** (see docs/DRILL_PLAYBOOK.md)
5. **Distribute HELPCARD** to rescue teams (docs/HELPCARD_PUBLIC.pdf)
6. **Monitor metrics** (p95, error rate, scraper lag) for first 24 hours

---

## 🎯 TIMELINE SUMMARY

**Total time: 60-90 minutes**

- T-15 to T-5: Setup and preflight (10 min)
- T-5 to T+0: Final prep, backup (5 min)
- T+0 to T+20: Execute deploy_production.sh (20 min)
- T+20 to T+30: Verify and test (10 min)
- T+30 to T+45: Setup cron and monitoring (15 min)
- T+45 to T+60: Documentation and handover (15 min)
- T+60 to T+90: Buffer for issues (30 min)

---

**🚀 Ready to deploy? Run `./infra/scripts/deploy_production.sh`**

**Version:** 1.1.1
**Last updated:** 2025-11-01
**Package maintainer:** Ops Team
