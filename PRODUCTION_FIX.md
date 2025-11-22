# 🚨 PRODUCTION API FIX - HƯỚNG DẪN KHẮC PHỤC

## ⚠️ Vấn đề hiện tại

API tại `https://api.thongtinmualu.live` đang **CRASH KHI KHỞI ĐỘNG** do thiếu 3 environment variables quan trọng.

### Triệu chứng:
- ❌ CORS errors trên browser console
- ❌ 500 Internal Server Error
- ❌ "Failed to fetch" trên tất cả endpoints
- ❌ Không có dữ liệu hiển thị trên trang

### Nguyên nhân gốc rễ:
API bị crash trong quá trình khởi động vì scheduler cần `OPENAI_API_KEY` để chạy AI news bulletin job.

---

## 🔧 GIẢI PHÁP: Set Environment Variables trên Render

### Bước 1: Truy cập Render Dashboard

1. Mở trình duyệt và truy cập: **https://dashboard.render.com**
2. Đăng nhập với tài khoản của bạn
3. Tìm service: **floodwatch-api**
4. Click vào service để mở

### Bước 2: Vào Tab Environment

1. Bên trái sidebar, click tab **"Environment"**
2. Kéo xuống phần **"Environment Variables"**
3. Click nút **"Add Environment Variable"**

### Bước 3: Thêm 3 Environment Variables

#### 🔑 Variable 1: OPENAI_API_KEY (CRITICAL - BẮT BUỘC)

```
Key:   OPENAI_API_KEY
Value: sk-proj-YOUR_ACTUAL_OPENAI_KEY_HERE
```

**Cách lấy:**
1. Truy cập: https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Đặt tên: "FloodWatch Production"
4. Copy key (chỉ hiện 1 lần!)
5. Paste vào Render

⚠️ **QUAN TRỌNG**:
- Key trong file `.env` local đã BỊ LỘ trong logs → KHÔNG dùng lại
- Phải tạo key MỚI cho production
- Lưu key vào nơi an toàn (1Password, etc.)

#### 🖼️ Variable 2: CLOUDINARY_API_SECRET (BẮT BUỘC)

```
Key:   CLOUDINARY_API_SECRET
Value: YOUR_CLOUDINARY_SECRET_HERE
```

**Cách lấy:**
1. Truy cập: https://console.cloudinary.com
2. Click "Dashboard" → "API Keys"
3. Tìm **"API Secret"** (ẩn, click "Reveal" để xem)
4. Copy và paste vào Render

#### 🔐 Variable 3: ADMIN_TOKEN (KHUYẾN NGHỊ)

```
Key:   ADMIN_TOKEN
Value: [Xem file .env.production.example - token đã được generate sẵn]
```

**Token đã được tạo sẵn cho bạn trong file `.env.production.example`**

---

### Bước 4: Trigger Manual Deploy

Sau khi đã thêm **CẢ 3** environment variables:

1. Scroll lên đầu trang
2. Tìm nút **"Manual Deploy"**
3. Click dropdown → Chọn **"Deploy latest commit"**
4. Chờ 5-10 phút để Render build và deploy

### Bước 5: Theo dõi Deployment

1. Click tab **"Logs"** để xem quá trình deploy
2. Tìm dòng log:
   ```
   🚀 FloodWatch API v2.0.0 started successfully
   🤖 Starting data ingestion scheduler...
   ✅ Scheduler started successfully
   ```
3. Nếu thấy OpenAI errors → Key chưa đúng hoặc invalid

---

## ✅ KIỂM TRA API ĐÃ HOẠT ĐỘNG

### Test 1: Health Endpoint

Mở terminal và chạy:

```bash
curl https://api.thongtinmualu.live/health
```

**Kết quả mong đợi:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "database": "connected"
}
```

### Test 2: Reports Endpoint

```bash
curl https://api.thongtinmualu.live/reports?limit=5
```

**Kết quả mong đợi:**
```json
{
  "data": [...],
  "total": 123,
  "limit": 5
}
```

### Test 3: CORS Headers

```bash
curl -I -X OPTIONS https://api.thongtinmualu.live/reports \
  -H "Origin: https://thongtinmualu.live" \
  -H "Access-Control-Request-Method: GET"
```

**Phải thấy:**
```
Access-Control-Allow-Origin: https://thongtinmualu.live
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

### Test 4: Kiểm tra Frontend

1. Mở: https://thongtinmualu.live
2. Mở Developer Tools (F12)
3. Tab **Console** - Không còn CORS errors
4. Tab **Network** - API calls thành công (200 OK)
5. Bản đồ hiển thị dữ liệu

---

## 🔍 TROUBLESHOOTING

### Lỗi: API vẫn không start sau khi set env vars

**Nguyên nhân:** Chưa trigger manual deploy

**Giải pháp:**
1. Vào Render Dashboard
2. Click "Manual Deploy" → "Deploy latest commit"
3. Chờ 5-10 phút

### Lỗi: OpenAI authentication failed

**Nguyên nhân:** API key không đúng hoặc đã revoke

**Giải pháp:**
1. Tạo key MỚI trên OpenAI Platform
2. Update `OPENAI_API_KEY` trên Render
3. Trigger redeploy

### Lỗi: Cloudinary upload failed

**Nguyên nhân:** `CLOUDINARY_API_SECRET` sai

**Giải pháp:**
1. Kiểm tra lại secret trên Cloudinary Dashboard
2. Copy chính xác (không có khoảng trắng thừa)
3. Update trên Render → Redeploy

### Lỗi: CORS vẫn còn sau khi fix

**Nguyên nhân:** Browser cache hoặc API chưa restart

**Giải pháp:**
1. Hard refresh browser: `Ctrl + Shift + R` (hoặc `Cmd + Shift + R`)
2. Xóa cache: Settings → Privacy → Clear browsing data
3. Thử incognito mode
4. Kiểm tra Render logs xem API đã restart chưa

---

## 📋 CHECKLIST HOÀN THÀNH

- [ ] ✅ Đã tạo OpenAI API key MỚI
- [ ] ✅ Đã lấy Cloudinary API Secret
- [ ] ✅ Đã có Admin Token (từ file .env.production.example)
- [ ] ✅ Đã set cả 3 env vars trên Render Dashboard
- [ ] ✅ Đã trigger "Manual Deploy"
- [ ] ✅ Deployment logs hiển thị "started successfully"
- [ ] ✅ `/health` endpoint trả về 200 OK
- [ ] ✅ `/reports` endpoint trả về dữ liệu
- [ ] ✅ Frontend load được data
- [ ] ✅ Không còn CORS errors trong console

---

## 🎯 TẠI SAO VẤN ĐỀ NÀY XẢY RA?

### Timeline của vấn đề:

1. **render.yaml có 3 env vars với `sync: false`**
   - Nghĩa là: PHẢI set thủ công, KHÔNG tự động deploy từ YAML

2. **API startup gọi `start_scheduler()`**
   - Scheduler chạy AI news bulletin job mỗi 15 phút
   - Job này cần OpenAI API key

3. **OpenAI client init sẽ FAIL nếu không có key**
   - API crash ngay khi khởi động
   - Trả về 500 error cho tất cả requests

4. **Browser thấy network error → hiểu nhầm là CORS issue**
   - Thực ra API đang crash, chưa kịp xử lý CORS
   - User fix CORS (đúng!) nhưng vấn đề gốc vẫn còn

5. **Giải pháp: Set env vars → API start thành công**
   - CORS middleware hoạt động bình thường
   - Tất cả endpoints trả về dữ liệu

---

## 💡 PHÒNG TRÁNH SAU NÀY

### 1. Document environment variables

File này (`PRODUCTION_FIX.md`) đã được tạo để tham khảo.

### 2. Use secure secret management

- Dùng 1Password/Bitwarden để lưu keys
- KHÔNG commit keys vào Git
- Rotate keys định kỳ (3-6 tháng)

### 3. Monitor API health

Set up monitoring:
- Uptime monitoring: https://uptimerobot.com (free)
- Error tracking: Render Dashboard → Logs
- Alert khi API down > 5 phút

### 4. Test deployment locally first

Trước khi deploy production:
```bash
# Test với Docker Compose
docker-compose up --build
curl http://localhost:8000/health
```

---

## 📞 HỖ TRỢ

Nếu vẫn gặp vấn đề sau khi làm theo hướng dẫn:

1. **Kiểm tra Render logs**: Dashboard → Logs tab
2. **Chạy test script**: `./scripts/test-api.sh`
3. **Xem chi tiết lỗi**: Copy full error từ logs
4. **Liên hệ**: Tạo issue trên GitHub với logs đầy đủ

---

**Cập nhật lần cuối:** $(date)
**Version:** 1.0.0
