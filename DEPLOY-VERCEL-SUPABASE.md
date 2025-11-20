# 🚀 DEPLOY SIÊU ĐơN GIẢN - VERCEL + SUPABASE + RAILWAY

## ⚡ 3 BƯỚC - HOÀN TOÀN FREE!

**Stack:**
- 🗄️ **Supabase** = PostgreSQL Database (Free 500MB)
- 🐍 **Railway** = FastAPI Backend (Free $5 credit/month)
- ⚛️ **Vercel** = Next.js Frontend (Free unlimited)

**Tổng thời gian:** < 15 phút

---

## 📋 **BƯỚC 1: Tạo Database trên Supabase** (3 phút)

### 1.1. Tạo project
1. Vào **https://supabase.com**
2. Click **"Start your project"**
3. Đăng nhập bằng GitHub
4. Click **"New project"**

### 1.2. Điền thông tin
- **Name**: `floodwatch-prod`
- **Database Password**: `tBHxjIROmus0trs2kR8CIfeyCx6mT5FgBATpZCa1R/U=`
- **Region**: `Southeast Asia (Singapore)`
- **Pricing Plan**: **Free**

### 1.3. Click "Create new project"
⏱️ Đợi 2-3 phút để Supabase setup database

### 1.4. Lấy Connection String
1. Vào **Settings** → **Database**
2. Tìm phần **Connection string** → Tab **URI**
3. Copy URL (dạng: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`)
4. **Thay `[YOUR-PASSWORD]`** bằng: `tBHxjIROmus0trs2kR8CIfeyCx6mT5FgBATpZCa1R%2FU%3D`
   - ⚠️ Password phải URL-encoded: `/` → `%2F`, `=` → `%3D`

**DATABASE_URL cuối cùng:**
```
postgresql://postgres:tBHxjIROmus0trs2kR8CIfeyCx6mT5FgBATpZCa1R%2FU%3D@db.xxx.supabase.co:5432/postgres
```

### 1.5. Enable PostGIS extension
1. Vào **SQL Editor** (sidebar bên trái)
2. Click **"New query"**
3. Paste và chạy:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
4. Click **"Run"**

✅ **Database ready!**

---

## 📋 **BƯỚC 2: Deploy API lên Railway** (5 phút)

### 2.1. Tạo Railway project
1. Vào **https://railway.app**
2. Đăng nhập bằng GitHub
3. Click **"New Project"**
4. Chọn **"Deploy from GitHub repo"**
5. Authorize Railway → Chọn repo **`nclamvn/floodwatch`**
6. Click **"Deploy"**

### 2.2. Configure root directory
Railway sẽ deploy cả repo, nhưng ta chỉ cần API:

1. Click vào service vừa tạo
2. **Settings** → **Source**
3. **Root Directory**: `apps/api`
4. **Build Command**: (để trống)
5. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Click **"Save"**

### 2.3. Add Environment Variables
Vào **Variables** → Add từng biến sau:

```bash
# Database (từ Supabase)
DATABASE_URL=postgresql://postgres:tBHxjIROmus0trs2kR8CIfeyCx6mT5FgBATpZCa1R%2FU%3D@db.xxx.supabase.co:5432/postgres

# Admin token
ADMIN_TOKEN=cd07904694237307b738f80caa2e4580af5e6575e58ded1031bb7cb3eaf4ebe2

# Telegram (tạm bỏ qua)
TELEGRAM_BOT_TOKEN=

# Environment
ENVIRONMENT=production
PYTHONUNBUFFERED=1
```

### 2.4. Redeploy
- Railway tự động redeploy sau khi add variables
- Đợi deployment **Active**
- Copy **Public URL** (dạng: `https://xxx.railway.app`)

### 2.5. Test API
Mở trình duyệt:
```
https://xxx.railway.app/health
```

Phải thấy: `{"status": "healthy"}`

✅ **API ready!**

---

## 📋 **BƯỚC 3: Deploy Frontend lên Vercel** (5 phút)

### 3.1. Import project
1. Vào **https://vercel.com**
2. Click **"Add New..."** → **"Project"**
3. Import repo: **`nclamvn/floodwatch`**

### 3.2. Configure build settings
**QUAN TRỌNG - Sửa các settings sau:**

**Root Directory:**
```
apps/web
```

**Build Command:**
```
npm run build
```

**Output Directory:**
```
.next
```

**Install Command:**
```
npm install
```

### 3.3. Add Environment Variables
Click **"Environment Variables"** → Add:

```bash
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-URL.railway.app/api
NEXT_PUBLIC_MAPTILER_KEY=MZqd4PxUtKNEz8uaizVE
NEXT_PUBLIC_MAP_PROVIDER=maptiler
NODE_ENV=production
```

**Thay `YOUR-RAILWAY-URL`** bằng URL Railway từ bước 2.4!

### 3.4. Deploy
1. Click **"Deploy"**
2. ⏱️ Đợi 2-3 phút
3. Vercel sẽ cho URL: `https://floodwatch-xxx.vercel.app`

### 3.5. Test website
Mở: `https://floodwatch-xxx.vercel.app/map`

Phải thấy:
- ✅ Map hiển thị
- ✅ Markers load
- ✅ Hot News ticker
- ✅ Media carousel

✅ **Frontend ready!**

---

## 📋 **BƯỚC 4: Chạy Database Migrations** (2 phút)

### 4.1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 4.2. Login
```bash
railway login
```

### 4.3. Link to project
```bash
cd /Users/mac/floodwatch/apps/api
railway link
```
Chọn project vừa tạo

### 4.4. Run migrations
```bash
railway run alembic upgrade head
```

✅ **Database schema ready!**

---

## 📋 **BƯỚC 5: Add Custom Domain** (3 phút)

### 5.1. Vercel - Add domain
1. Vào Vercel project → **Settings** → **Domains**
2. Add domain: `thongtinmualu.live`
3. Vercel cho DNS records:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 5.2. Update DNS
Vào **domain provider** (nơi mua domain):

**Nếu dùng Cloudflare:**
1. DNS → Add record
2. Add cả 2 records trên
3. **Proxy status**: DNS only (tắt cloud ☁️)

### 5.3. Đợi DNS propagate
- Thường 5-10 phút
- Check: `nslookup thongtinmualu.live`

✅ **Domain ready!**

---

## 🎉 **HOÀN THÀNH!**

Truy cập: **https://thongtinmualu.live**

Sẽ tự động redirect sang: **https://thongtinmualu.live/map**

---

## 🔧 **UPDATE CODE SAU NÀY**

### Khi có thay đổi:
```bash
git add .
git commit -m "Update features"
git push
```

**Tự động:**
- ✅ Railway detect → Redeploy API
- ✅ Vercel detect → Redeploy Frontend

**KHÔNG CẦN làm gì thêm!**

---

## 💰 **CHI PHÍ**

### Free Tier:
- **Supabase**: Free 500MB database, 2GB transfer
- **Railway**: Free $5 credit/month (đủ cho API)
- **Vercel**: Free unlimited deploys, 100GB bandwidth

**Tổng:** $0/tháng cho traffic thấp-trung bình!

---

## 🔍 **TROUBLESHOOTING**

### API không connect được database:
```bash
# Check Railway logs
railway logs

# Kiểm tra DATABASE_URL có đúng không
railway variables
```

### Frontend không load data:
1. Check NEXT_PUBLIC_API_URL có đúng không
2. Vào Railway URL/health xem API có hoạt động không
3. Check browser console (F12) xem có CORS error không

### CORS Error:
Thêm vào Railway environment variables:
```bash
CORS_ORIGINS=https://thongtinmualu.live,https://floodwatch-xxx.vercel.app
```

---

## 📞 **HỖ TRỢ**

- **Supabase Docs**: https://supabase.com/docs
- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs

---

**THỜI GIAN TỔNG:** < 15 phút
**ĐỘ KHÓ:** ⭐ Rất đơn giản
**CHI PHÍ:** Free!

🎉 **Đơn giản nhất có thể rồi!**
