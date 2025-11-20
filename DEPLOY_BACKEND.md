# 🚀 Hướng dẫn Deploy Backend API (Production)

## Tổng quan
Backend Python FastAPI sẽ được deploy riêng trên Railway/Render/Fly.io
Frontend Next.js sẽ gọi API qua `NEXT_PUBLIC_API_URL`

---

## Option A: Deploy lên Railway (Khuyến nghị) ⭐

### 1. Cài Railway CLI
```bash
npm i -g @railway/cli
railway login
```

### 2. Tạo Project mới
```bash
railway init
# Chọn: Create new project
# Tên: floodwatch-api
```

### 3. Link với Postgres Database
```bash
railway add
# Chọn: PostgreSQL
```

### 4. Set Environment Variables
```bash
railway variables set DATABASE_URL=$DATABASE_URL
railway variables set PYTHON_VERSION=3.11
```

### 5. Deploy
```bash
railway up
```

### 6. Lấy URL Production
```bash
railway domain
# Output: floodwatch-api.up.railway.app
```

---

## Option B: Deploy lên Render

### 1. Tạo Web Service mới
- Vào https://render.com/dashboard
- Click "New +" → "Web Service"
- Connect GitHub repo: `nclamvn/floodwatch`
- Chọn branch: `main`

### 2. Cấu hình Service
```
Name: floodwatch-api
Environment: Python 3
Build Command: pip install -r apps/api/requirements.txt
Start Command: cd apps/api && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 3. Set Environment Variables
```
DATABASE_URL = <your-postgres-url>
PYTHON_VERSION = 3.11
```

### 4. Create Service
- Click "Create Web Service"
- Đợi deploy xong (~5-10 phút)

### 5. Lấy URL
```
https://floodwatch-api.onrender.com
```

---

## Option C: Deploy lên Fly.io

### 1. Cài Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Launch App
```bash
cd apps/api
fly launch
# Chọn region: Singapore
# PostgreSQL: Yes
```

### 3. Deploy
```bash
fly deploy
```

---

## Bước 2: Cấu hình Frontend

### 1. Set Environment Variable trên Vercel/Netlify

**Vercel:**
```bash
# Vào: https://vercel.com/your-project/settings/environment-variables
# Thêm:
NEXT_PUBLIC_API_URL = https://your-api-domain.com
```

**Netlify:**
```bash
# Vào: Site settings → Environment variables
# Thêm:
NEXT_PUBLIC_API_URL = https://your-api-domain.com
```

### 2. Redeploy Frontend
```bash
# Vercel: Trigger redeploy từ dashboard
# Netlify: Trigger redeploy từ dashboard
```

---

## Bước 3: Chạy Migration & Seed Data

### Railway:
```bash
railway run alembic upgrade head
railway run python -c "exec(open('../../scripts/seed_ai_forecasts.sql').read())"
```

### Render:
```bash
# SSH vào container
render ssh
cd apps/api
alembic upgrade head
psql $DATABASE_URL < ../../scripts/seed_ai_forecasts.sql
```

---

## Kiểm tra Deployment

### 1. Test API
```bash
curl https://your-api-url.com/health
curl https://your-api-url.com/ai-forecasts?limit=5
```

### 2. Test Frontend
```bash
# Mở browser
https://thongtinmualu.live/map
# Click button AI (tím)
# Xem markers tím xuất hiện
```

---

## Troubleshooting

### Lỗi: Database connection failed
```bash
# Check DATABASE_URL có đúng không
railway variables
# hoặc
render env
```

### Lỗi: Module not found
```bash
# Ensure requirements.txt được install
# Check build logs
```

### Lỗi: CORS
Thêm frontend domain vào CORS trong `apps/api/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://thongtinmualu.live"],
    ...
)
```

---

## Tóm tắt URLs

- **Frontend**: https://thongtinmualu.live
- **Backend API**: https://your-api-domain.com (Railway/Render/Fly.io)
- **Database**: PostgreSQL managed service

