# 🚀 Deploy Backend lên Render - Hướng dẫn nhanh

## Bước 1: Deploy từ Dashboard (5 phút)

### 1.1 Mở Render Dashboard
Truy cập: **https://dashboard.render.com/select-repo?type=web**

### 1.2 Connect GitHub Repository
- Click **"Configure account"** để connect GitHub
- Chọn repository: **nclamvn/floodwatch**
- Branch: **main**
- Click **"Connect"**

### 1.3 Service Configuration
Render sẽ tự động detect `render.yaml` file. Confirm settings:

```
Name: floodwatch-api
Environment: Python 3
Build Command: pip install -r apps/api/requirements.txt
Start Command: cd apps/api && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 1.4 Add PostgreSQL Database
- Scroll down → Click **"New PostgreSQL"**
- Name: **floodwatch-db**
- Plan: **Free**
- Click **"Create Database"**

### 1.5 Environment Variables
Render sẽ tự động set:
- `DATABASE_URL` (từ PostgreSQL database)

Thêm thêm:
- `PYTHON_VERSION` = `3.11`

### 1.6 Deploy
- Click **"Create Web Service"**
- Đợi deployment (~5-10 phút)

---

## Bước 2: Seed Database (1 phút)

Sau khi deploy xong, vào Render Dashboard:

1. Click vào service **floodwatch-api**
2. Click tab **"Shell"** (bên phải)
3. Chạy lệnh:

```bash
psql $DATABASE_URL < scripts/seed_ai_forecasts.sql
```

Xong! Bạn sẽ có 18 AI forecasts mẫu.

---

## Bước 3: Lấy Backend URL

Trong Render Dashboard → Service **floodwatch-api** → Copy URL:

```
https://floodwatch-api.onrender.com
```

---

## Bước 4: Configure Frontend

### 4.1 Vercel (nếu dùng Vercel)
1. Vào: https://vercel.com/nclamvn/projects
2. Select project: **floodwatch** hoặc **thongtinmualu**
3. Settings → Environment Variables
4. Add:
   ```
   NEXT_PUBLIC_API_URL = https://floodwatch-api.onrender.com
   ```
5. Deployments → Redeploy latest

### 4.2 Netlify (nếu dùng Netlify)
1. Vào: https://app.netlify.com/sites
2. Select site: **thongtinmualu**
3. Site settings → Environment variables
4. Add:
   ```
   NEXT_PUBLIC_API_URL = https://floodwatch-api.onrender.com
   ```
5. Deploys → Trigger deploy

---

## Bước 5: Test Production

### 5.1 Test Backend API
```bash
curl https://floodwatch-api.onrender.com/health
curl https://floodwatch-api.onrender.com/ai-forecasts?limit=5
```

### 5.2 Test Frontend
1. Mở: **https://thongtinmualu.live/map**
2. Click button **AI** (tím, góc trên bên phải)
3. Xem markers tím xuất hiện trên map
4. Click vào marker → popup glass morphism với thông tin AI forecast

---

## Troubleshooting

### Lỗi: Build failed
- Check logs trong Render Dashboard
- Ensure `requirements.txt` có đầy đủ dependencies

### Lỗi: Database migration failed
- Vào Shell và chạy manual:
  ```bash
  cd apps/api
  alembic upgrade head
  ```

### Lỗi: CORS on production
- Thêm domain vào `apps/api/app/main.py`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["https://thongtinmualu.live"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

### Lỗi: No AI markers on map
- Check console logs: Network tab
- Verify `NEXT_PUBLIC_API_URL` đã được set đúng
- Ensure frontend đã redeploy sau khi set env var

---

## One-Click Deploy (Alternative)

Render có thể deploy trực tiếp từ `render.yaml`:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nclamvn/floodwatch)

---

## Summary

✅ **Backend URL**: https://floodwatch-api.onrender.com
✅ **Database**: PostgreSQL (Render Free)
✅ **AI Forecasts**: 18 samples seeded
✅ **Frontend**: https://thongtinmualu.live
✅ **Status**: Production ready 🚀
