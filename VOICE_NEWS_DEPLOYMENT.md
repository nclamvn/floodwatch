# 🎙️ FloodWatch AI Voice News - Hướng dẫn Triển khai

## 📋 Tóm tắt tính năng

- ✅ AI tự động viết bản tin (OpenAI GPT-4o-mini)
- ✅ Đọc bản tin bằng giọng AI (OpenAI TTS)
- ✅ Luân phiên giọng Nam (onyx) ↔ Nữ (nova)
- ✅ Tự động cập nhật mỗi 10 phút
- ✅ Audio lưu trên Cloudinary CDN
- ✅ Chỉ giữ 1 file audio (latest), tiết kiệm storage

---

## 🚀 Triển khai nhanh (3 phút)

### **Bước 1: Chuẩn bị thông tin**

Trước khi bắt đầu, hãy chuẩn bị:

1. **OpenAI API Key** (https://platform.openai.com/api-keys)
   - ⚠️ **QUAN TRỌNG**: Tạo key MỚI, không dùng key đã share công khai!
   - Ví dụ: `sk-proj-AbCd...XyZ`

2. **Cloudinary Credentials** (https://cloudinary.com)
   - Cloud Name
   - API Key
   - API Secret

### **Bước 2: Chạy script setup tự động**

```bash
cd /Users/mac/floodwatch/apps/api

# Chạy script setup (sẽ hỏi thông tin từng bước)
./setup-voice-news.sh
```

Script sẽ tự động:
- ✅ Tạo file `.env` từ template
- ✅ Cài đặt dependencies (openai, cloudinary, gtts)
- ✅ Test kết nối OpenAI
- ✅ Test kết nối Cloudinary
- ✅ Xác nhận mọi thứ hoạt động

### **Bước 3: Khởi động API server**

```bash
# Từ thư mục apps/api
uvicorn app.main:app --reload --port 8000
```

### **Bước 4: Test API**

Mở terminal mới:

```bash
# Test endpoint
curl http://localhost:8000/ai-news/latest

# Kết quả mong đợi: JSON với audio_url
```

### **Bước 5: Khởi động Frontend**

```bash
cd /Users/mac/floodwatch/apps/web
npm run dev
```

### **Bước 6: Mở trình duyệt**

```
http://localhost:3000/map
```

**Click vào icon 🔊 (góc trên bên phải) để nghe bản tin!**

---

## 🔧 Setup thủ công (nếu script lỗi)

### **1. Tạo file `.env`**

```bash
cd /Users/mac/floodwatch/apps/api
cp .env.example .env
```

### **2. Điền thông tin vào `.env`**

```bash
# Mở file .env và điền:
nano .env
```

```env
OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
TTS_ALTERNATING_VOICES=true
```

### **3. Cài dependencies**

```bash
pip install -r requirements.txt
```

### **4. Test Python imports**

```bash
python3 -c "import openai; import cloudinary; from gtts import gTTS; print('✅ All imports OK')"
```

---

## 🧪 Testing

### **Test 1: API Health**

```bash
curl http://localhost:8000/health
```

### **Test 2: Tạo bulletin thủ công**

```bash
curl -X POST http://localhost:8000/ai-news/regenerate \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### **Test 3: Lấy bulletin mới nhất**

```bash
curl http://localhost:8000/ai-news/latest | jq .
```

Kết quả mong đợi:

```json
{
  "data": {
    "title": "Bản tin 1 phút - 10:30",
    "summary_text": "Đây là bản tin FloodWatch...",
    "audio_url": "https://res.cloudinary.com/.../audio.mp3",
    "priority_level": "low",
    "regions_affected": ["Miền Bắc"],
    "key_points": [...]
  }
}
```

### **Test 4: Nghe audio**

Copy `audio_url` từ response trên và mở trong browser:

```
https://res.cloudinary.com/your-cloud/video/upload/.../audio.mp3
```

---

## 📊 Logs & Monitoring

### **Xem log voice alternation**

```bash
# Từ thư mục apps/api
tail -f logs/floodwatch.log | grep voice_alternated
```

Output mong đợi:

```json
{
  "event": "voice_alternated",
  "previous": "nova",
  "next": "onyx",
  "gender": "male"
}
```

### **Xem log bulletin generation**

```bash
tail -f logs/floodwatch.log | grep bulletin
```

---

## 🔄 Background Job (Auto-refresh mỗi 10 phút)

Background job đã được tích hợp sẵn trong `ingestion_scheduler.py`.

Khi API server chạy:
- ✅ Job tự động chạy mỗi 10 phút
- ✅ Tạo bulletin mới
- ✅ Upload lên Cloudinary
- ✅ Ghi đè file cũ

**Không cần cấu hình thêm!**

---

## 🐳 Docker Deployment (Optional)

Nếu dùng Docker:

```bash
# Build
docker-compose build api

# Run
docker-compose up -d

# Check logs
docker-compose logs -f api
```

---

## 🌐 Deploy lên Production

### **Railway/Render:**

1. **Add Environment Variables:**

```
OPENAI_API_KEY=sk-proj-...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
TTS_ALTERNATING_VOICES=true
```

2. **Deploy:**

```bash
git push railway main
# hoặc
git push render main
```

3. **Verify:**

```bash
curl https://your-app.railway.app/ai-news/latest
```

---

## ❓ Troubleshooting

### **Lỗi: "OpenAI API key not found"**

```bash
# Check .env file
cat apps/api/.env | grep OPENAI_API_KEY

# Đảm bảo key đúng format: sk-proj-...
```

### **Lỗi: "Cloudinary upload failed"**

```bash
# Test credentials
python3 -c "
import cloudinary
cloudinary.config(
    cloud_name='YOUR_CLOUD_NAME',
    api_key='YOUR_API_KEY',
    api_secret='YOUR_API_SECRET'
)
print('✅ OK')
"
```

### **Lỗi: "No module named 'openai'"**

```bash
pip install --upgrade openai cloudinary gtts
```

### **Audio không phát được**

- ✅ Check audio_url có accessible không
- ✅ Check CORS settings trên Cloudinary
- ✅ Check browser console có lỗi không

---

## 💰 Chi phí ước tính

**Chạy 24/7:**
- 144 bulletin/ngày × $0.008 = **$1.15/ngày**
- **$35/tháng**

**Chỉ chạy giờ hành chính (8h-18h):**
- 60 bulletin/ngày × $0.008 = **$0.48/ngày**
- **$14/tháng**

---

## 📞 Support

Nếu gặp vấn đề:

1. Check logs: `tail -f logs/floodwatch.log`
2. Check API health: `curl http://localhost:8000/health`
3. Check ENV variables: `cat .env`
4. Restart API server

---

## ✅ Checklist cuối cùng

- [ ] OpenAI API key đã được set
- [ ] Cloudinary credentials đã được set
- [ ] Dependencies đã cài (`pip install -r requirements.txt`)
- [ ] API server chạy OK (`curl http://localhost:8000/health`)
- [ ] Frontend chạy OK (`npm run dev`)
- [ ] Audio player hiển thị trên map
- [ ] Click 🔊 button → player mở
- [ ] Audio phát được
- [ ] Giọng đọc rõ ràng
- [ ] Background job chạy mỗi 10 phút

**🎉 Nếu tất cả OK → Sẵn sàng deploy production!**
