# 🌊 FloodWatch - Hướng dẫn sử dụng nhanh

**Hệ thống giám sát lũ lụt Việt Nam**
**Website:** https://floodwatch.vn

---

## 🎯 Dành cho ai?

- ✅ Lực lượng cứu hộ, tình nguyện viên
- ✅ Người dân vùng lũ cần thông tin khẩn cấp
- ✅ Cơ quan chức năng địa phương
- ✅ Báo chí, truyền thông

---

## 📱 Bản đồ (đầy đủ) vs Chế độ nhẹ (tối ưu data)

### 🗺️ BẢN ĐỒ ĐẦY ĐỦ (Mạng tốt)
**Link:** https://floodwatch.vn/map

**Xem:**
- Bản đồ tương tác với vị trí báo cáo
- Lọc theo tỉnh, loại cảnh báo
- Chi tiết từng điểm nguy hiểm

**Thích hợp:**
- Điều phối cứu hộ từ xa
- Theo dõi diễn biến tổng quan
- Desktop, laptop, tablet
- **Data sử dụng:** ~300-500 KB/lần tải (cần mạng ổn định)

### 📋 CHẾ ĐỘ NHẸ (Tối ưu data, mạng yếu)
**Link:** https://floodwatch.vn/lite

**Đặc điểm:**
- ✅ Tải nhanh (không cần JavaScript)
- ✅ Tiết kiệm data (< 50 KB/trang)
- ✅ Dễ in giấy
- ✅ Hoạt động offline sau khi tải

**Thích hợp:**
- Vùng mạng yếu, mất kết nối
- Điện thoại phổ thông
- Cần in ra giấy
- Tiết kiệm pin

**Cách dùng:**
1. Vào: https://floodwatch.vn/lite
2. Chọn bộ lọc: "Last 6h" / "Last 24h" / "Last 7d"
3. Lọc theo loại: SOS / Alerts / Road
4. Cuộn xuống xem danh sách báo cáo

---

## 🚨 Các loại cảnh báo

| Biểu tượng | Loại | Nghĩa |
|-----------|------|-------|
| 🔴 **SOS** | Khẩn cấp | Cần cứu hộ ngay, nguy hiểm cao |
| 🟠 **ALERT** | Cảnh báo chính thức | Từ KTTV, chính quyền |
| 🟡 **ROAD** | Đường bộ | Ngập, sạt lở, không qua được |
| 🔵 **NEEDS** | Nhu yếu phẩm | Cần lương thực, thuốc men |

---

## 📊 Hiểu thông tin báo cáo

**Mỗi báo cáo có:**
- **Thời gian:** Khi nào xảy ra
- **Tỉnh/huyện:** Ở đâu
- **Mô tả:** Chuyện gì
- **Điểm tin cậy:** 0.0 → 1.0 (càng cao càng chắc)
  - ≥ 0.8: Rất đáng tin
  - 0.5-0.7: Cần xác minh
  - < 0.5: Thông tin chưa rõ

**Trạng thái:**
- 🟠 **new:** Mới nhận, chưa xác minh
- 🟢 **verified:** Đã xác nhận đúng
- 🔵 **resolved:** Đã xử lý xong
- ⚪ **invalid:** Thông tin sai

---

## 💡 Mẹo sử dụng hiệu quả

### 1. Lọc theo vùng
```
/lite?province=Quảng Bình          → Chỉ xem Quảng Bình
/lite?province=Quảng Trị&since=6h  → Quảng Trị, 6 giờ qua
```

### 2. Lọc theo loại khẩn cấp
```
/lite?type=SOS         → Chỉ xem SOS (cần cứu ngay)
/lite?type=ROAD        → Chỉ xem đường bị ngập
```

### 3. Xuất file CSV (cho phân tích)
```
https://floodwatch.vn/reports/export?format=csv&since=24h
```
→ Mở bằng Excel/Google Sheets

### 4. Dùng trên điện thoại
- **Thêm vào màn hình chính:**
  - iPhone: Safari → Share → "Add to Home Screen"
  - Android: Chrome → Menu → "Add to Home screen"
- **Bookmark /lite** để truy cập nhanh khi mất mạng

### 5. In ra giấy (cho trạm cứu hộ)
- Vào /lite
- Chọn bộ lọc phù hợp
- Ctrl+P (Windows) / Cmd+P (Mac)
- In hoặc "Save as PDF"

---

## 🆘 Báo cáo tình huống khẩn cấp

**Đường dẫn:** https://floodwatch.vn/report

**Cần cung cấp:**
1. **Loại:** SOS / ROAD / NEEDS
2. **Mô tả ngắn gọn:** "Nước ngập 2m, 10 người mắc kẹt"
3. **Vị trí:** Bấm "📍 Lấy vị trí" hoặc nhập thủ công
4. **Ảnh** (tùy chọn): Tối đa 3 ảnh, mỗi ảnh < 5MB

**⚠️ Lưu ý bảo mật:**
- ✅ **Không lo về SĐT/email:** Hệ thống TỰ ĐỘNG ẩn thông tin cá nhân (PII scrubbing)
- ✅ Nếu vô tình ghi số điện thoại → hệ thống tự chuyển thành `***-****-***`
- ✅ Email → tự động ẩn thành `***@***`
- ⚠️ **Tuy nhiên:** Vẫn nên tránh đăng thông tin nhạy cảm không cần thiết
- 💬 Nếu cần liên hệ trực tiếp, dùng kênh khác (Zalo, Telegram nhóm cứu hộ)

---

## 📞 Hỗ trợ & Liên hệ

**Kỹ thuật:**
- Email: ops@floodwatch.vn
- Báo lỗi: https://github.com/floodwatch/floodwatch/issues

**Khẩn cấp:**
- Gọi 113 (Cảnh sát)
- Gọi 114 (Cứu hỏa)
- Gọi 115 (Cấp cứu)

**Cộng đồng:**
- Facebook: /floodwatch.vn
- Telegram: @floodwatch_vn

---

## ❓ Câu hỏi thường gặp

**Q: Dữ liệu từ đâu?**
A: Kết hợp từ KTTV (chính thức) + báo cáo cộng đồng (xác minh bởi ops team)

**Q: Tại sao có báo cáo "new" lâu chưa thành "verified"?**
A: Ops team xác minh thủ công, ưu tiên SOS trước. Tin KTTV tự động verified.

**Q: Dùng mất tiền không?**
A: Hoàn toàn miễn phí. Chỉ tốn data mạng (rất ít với /lite).

**Q: Offline có dùng được không?**
A: /lite có thể cache trong trình duyệt. Nếu đã mở 1 lần, có thể xem lại khi mất mạng (chưa có dữ liệu mới).

**Q: Tôi muốn nhận thông báo tự động?**
A: Liên hệ ops@floodwatch.vn để xin API key (dành cho tổ chức).

---

## 🎓 Ví dụ tình huống thực tế

### Tình huống 1: Điều phối cứu hộ
**Bối cảnh:** Bạn là trưởng đội cứu hộ, cần biết vùng nào cần ưu tiên.

**Cách làm:**
1. Mở /map trên laptop
2. Lọc "SOS" + "Last 6h" + tỉnh của bạn
3. Xem bản đồ, chọn điểm gần nhất chưa "resolved"
4. Click vào marker → xem chi tiết
5. Gọi điện xác nhận trước khi xuất phát

### Tình huống 2: Người dân tìm đường tránh lũ
**Bối cảnh:** Bạn cần đi từ A → B, sợ đường ngập.

**Cách làm:**
1. Mở /lite trên điện thoại (tiết kiệm pin)
2. Lọc "ROAD" + tỉnh của bạn
3. Xem danh sách đường bị ngập
4. Tránh các tuyến đó, chọn đường khác

### Tình huống 3: Truyền thông cần số liệu
**Bối cảnh:** Báo chí cần báo cáo số lượng SOS trong 24h qua.

**Cách làm:**
1. Vào /lite?type=SOS&since=24h
2. Đếm số lượng (hoặc xuất CSV)
3. Lọc theo từng tỉnh nếu cần chi tiết

---

## ✅ Checklist cho người dùng mới

- [ ] Đã bookmark /lite và /map
- [ ] Đã test load trang trong vùng mạng yếu
- [ ] Đã biết cách lọc theo tỉnh/loại
- [ ] Đã lưu số hotline 113/114/115
- [ ] Đã chia sẻ link cho đội cứu hộ

---

**🌊 FloodWatch - Cùng nhau vượt lũ an toàn**

*Hệ thống hoạt động 24/7 trong mùa mưa lũ*
*Cập nhật mỗi giờ từ KTTV + cộng đồng*

**Version:** 1.0 | **Cập nhật:** 2025-11-01

---

*📄 In trang này và dán ở trạm cứu hộ để mọi người dễ tra cứu*
