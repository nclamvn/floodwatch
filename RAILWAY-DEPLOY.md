# 🚂 DEPLOY LÊN RAILWAY.APP - CỰC KỲ ĐƠN GIẢN!

## ⚡ CHỈ 4 BƯỚC (< 10 PHÚT)

Railway.app giống như Vercel nhưng hỗ trợ full-stack (Frontend + Backend + Database)!

---

## 📋 **BƯỚC 1: Push code lên GitHub** (3 phút)

### 1.1. Init Git (nếu chưa có)
```bash
cd /Users/mac/floodwatch

# Check xem đã có git chưa
git status

# Nếu chưa có, init:
git init
```

### 1.2. Commit code
```bash
# Add tất cả files
git add .

# Commit
git commit -m "Initial commit - Ready for Railway deployment"
```

### 1.3. Tạo repo trên GitHub
1. Vào https://github.com/new
2. Tên repo: `floodwatch` (hoặc tên khác)
3. **Chọn Private** (để bảo mật)
4. **KHÔNG tích** "Add README, .gitignore, license" (đã có sẵn)
5. Click "Create repository"

### 1.4. Push lên GitHub
```bash
# Copy lệnh từ GitHub (sẽ giống thế này):
git remote add origin https://github.com/YOUR_USERNAME/floodwatch.git
git branch -M main
git push -u origin main
```

**✅ Xong! Code đã lên GitHub**

---

## 📋 **BƯỚC 2: Deploy lên Railway** (2 phút)

### 2.1. Tạo project
1. Vào https://railway.app
2. Đăng nhập (dùng GitHub account)
3. Click **"New Project"**
4. Chọn **"Deploy from GitHub repo"**
5. Cho phép Railway access GitHub
6. Chọn repo `floodwatch`
7. Click **"Deploy Now"**

**Railway sẽ tự động:**
- ✅ Detect Docker Compose
- ✅ Build images
- ✅ Start containers
- ✅ Generate public URL

**⏱️ Đợi 5-10 phút để build lần đầu**

### 2.2. Check deployment
- Vào tab "Deployments" → Đợi status = "Active"
- Copy URL (dạng: `https://xxx.up.railway.app`)

---

## 📋 **BƯỚC 3: Configure Environment Variables** (2 phút)

### 3.1. Vào Settings
Railway project → **Settings** → **Variables**

### 3.2. Add các biến sau:

**⚠️ QUAN TRỌNG - Copy chính xác:**

```
ADMIN_TOKEN=cd07904694237307b738f80caa2e4580af5e6575e58ded1031bb7cb3eaf4ebe2

POSTGRES_USER=postgres
POSTGRES_PASSWORD=tBHxjIROmus0trs2kR8CIfeyCx6mT5FgBATpZCa1R/U=
POSTGRES_DB=floodwatch_prod
DATABASE_URL=postgresql+psycopg://postgres:tBHxjIROmus0trs2kR8CIfeyCx6mT5FgBATpZCa1R/U=@db:5432/floodwatch_prod

TELEGRAM_BOT_TOKEN=

NEXT_PUBLIC_MAPTILER_KEY=MZqd4PxUtKNEz8uaizVE

ENVIRONMENT=production
NODE_ENV=production

NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app/api
CORS_ORIGINS=https://thongtinmualu.live,https://your-railway-url.up.railway.app

NEXT_PUBLIC_MAP_PROVIDER=maptiler
```

**Thay `your-railway-url` bằng URL Railway của bạn!**

### 3.3. Redeploy
- Sau khi add variables → Railway tự động redeploy
- Hoặc click "Redeploy" button

---

## 📋 **BƯỚC 4: Add Custom Domain** (3 phút)

### 4.1. Generate domain
Railway project → **Settings** → **Domains**

### 4.2. Add domain
1. Click **"Add Domain"**
2. Nhập: `thongtinmualu.live`
3. Railway sẽ cho 2 DNS records:

```
Type: CNAME
Name: @
Value: xxx.up.railway.app

Type: CNAME
Name: www
Value: xxx.up.railway.app
```

### 4.3. Update DNS
Vào **domain provider** của bạn (nơi mua domain):

**Nếu dùng Cloudflare:**
1. Vào Cloudflare dashboard
2. Chọn domain `thongtinmualu.live`
3. DNS → Add record:
   - Type: CNAME
   - Name: @
   - Target: xxx.up.railway.app
   - Proxy status: DNS only (tắt cloud)
4. Add thêm record cho www

**Nếu dùng provider khác:** (GoDaddy, Namecheap, etc.)
- Tương tự, add CNAME records như trên

### 4.4. Đợi DNS propagate
- Thường 5-10 phút
- Check: `nslookup thongtinmualu.live`

**✅ Railway tự động setup SSL certificate!**

---

## 🎉 **XONG! KIỂM TRA WEBSITE**

Truy cập:
```
https://thongtinmualu.live
```

**Phải thấy:**
- ✅ Redirect tự động sang `/map`
- ✅ Map hiển thị với markers
- ✅ Hot News ticker
- ✅ Media carousel
- ✅ Sidebar updates
- ✅ Tin ghim màu đỏ
- ✅ HTTPS (ổ khóa xanh)

---

## 🔧 **QUẢN LÝ SAU KHI DEPLOY**

### Xem logs:
Railway → **Deployments** → Click vào deployment → **View Logs**

### Update code:
```bash
# Commit changes
git add .
git commit -m "Update features"
git push

# Railway tự động detect và redeploy!
```

### Restart services:
Railway → **Settings** → **Restart**

### Check metrics:
Railway → **Metrics** → Xem CPU, Memory, Network usage

---

## 💰 **CHI PHÍ**

### Free Tier:
- $5 credit/tháng (miễn phí)
- Đủ cho project nhỏ với ít traffic

### Nếu vượt free tier:
- Pay as you go
- ~$5-10/tháng cho small project
- Rẻ hơn nhiều so với VPS

---

## 🔍 **TROUBLESHOOTING**

### Deployment failed:
```bash
# Check logs trong Railway
# Thường do:
- Environment variables chưa đúng
- Database connection error
- Build timeout
```

### Website không load:
```bash
# Check:
1. Deployment status = "Active"?
2. Environment variables đã add đủ chưa?
3. NEXT_PUBLIC_API_URL đúng chưa?
4. CORS_ORIGINS có domain của bạn chưa?
```

### Domain không hoạt động:
```bash
# Check DNS:
nslookup thongtinmualu.live

# Phải thấy CNAME pointing to Railway
# Nếu không, kiểm tra lại DNS settings
```

---

## 📞 **HỖ TRỢ**

### Railway Documentation:
https://docs.railway.app/

### Railway Discord:
https://discord.gg/railway

---

## ✅ **CHECKLIST HOÀN THÀNH**

- [ ] Code pushed lên GitHub
- [ ] Project created trên Railway
- [ ] Deployment Active
- [ ] Environment variables configured
- [ ] Custom domain added
- [ ] DNS updated
- [ ] Website accessible tại https://thongtinmualu.live
- [ ] Map hiển thị đầy đủ chức năng

---

**THỜI GIAN TỔNG:** < 10 phút
**ĐỘ KHÓ:** ⭐ Rất đơn giản (như Vercel)
**CHI PHÍ:** Free tier hoặc $5-10/tháng

🎉 **Deploy xong rồi! Dễ hơn Docker trên VPS nhiều!**

Last updated: 2025-11-20
