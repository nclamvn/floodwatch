# FloodWatch – Go-Live Communications Templates
**Version:** 1.0 • **Last updated:** 2025-11-01
**Owners:** {{COMMS_OWNER_NAME}} (Comms Lead), {{OPS_OWNER_NAME}} (Ops Lead)
**Channels:** Public (Facebook Page, Zalo OA, Telegram Channel), Internal (Slack #floodwatch-go-live, Email), SMS (stakeholders)

> Mục tiêu: Bộ mẫu thông báo ngắn – rõ – đúng thời điểm cho giai đoạn cutover 60–90 phút, sự cố (nếu có), và tổng kết 24h đầu.

---

## 0) Placeholders – điền trước khi dùng
- **Cửa sổ triển khai:** {{WINDOW_START}} → {{WINDOW_END}} ({{DURATION_MIN}} phút)
- **Liên kết chính:**
  - Website: https://floodwatch.vn (vd: https://floodwatch.vn)
  - Bản đồ: https://floodwatch.vn/map (vd: https://floodwatch.vn/map)
  - Chế độ nhẹ: https://floodwatch.vn/lite (vd: https://floodwatch.vn/lite)
  - Tài liệu API: https://api.floodwatch.vn/docs
  - Ops Dashboard (nội bộ): {{OPS_DASH_URL}}
  - Metrics (nội bộ): {{METRICS_URL}}
- **Liên hệ & kênh:**
  - Email ops: ops@floodwatch.vn
  - Hotline/Zalo: {{HOTLINE}}
  - Slack incident: {{SLACK_INCIDENT_CHANNEL}}
  - Hashtag: #FloodWatchGoLive (vd: #FloodWatchGoLive)
- **Thông số khoẻ hệ thống (điền sau khi test):**
  - p95 latency: {{P95_MS}} ms
  - Error rate: {{ERROR_RATE_PCT}} %
  - Scraper lag: {{SCRAPER_LAG_MIN}} phút

---

## 1) Pre-Cutover Announcement (T-30')

### A. Bản công khai (FB/Zalo/Telegram)
**Tiêu đề:** FloodWatch bảo trì ngắn để nâng cấp – {{DURATION_MIN}} phút
**Nội dung (VI):**
Trong **{{DURATION_MIN}} phút** tới ({{WINDOW_START}} → {{WINDOW_END}}), FloodWatch sẽ bảo trì để bật các cải tiến hiệu năng và độ ổn định cho mùa mưa lũ.
- Trong thời gian này: **Bản đồ đầy đủ** có thể tạm gián đoạn.
- **Chế độ nhẹ** vẫn khả dụng: https://floodwatch.vn/lite (tối ưu cho băng thông thấp).
- Đội ngũ trực **war-room** 24/7.
Cảm ơn bạn đã đồng hành! #FloodWatchGoLive

*(EN)*
We'll perform a short maintenance **({{DURATION_MIN}} min, {{WINDOW_START}} → {{WINDOW_END}})** to roll out performance & stability upgrades.
- **Full map** may be temporarily unavailable.
- **Lite mode** remains available: https://floodwatch.vn/lite.
Thank you for your patience! #FloodWatchGoLive

### B. Nội bộ (Slack #floodwatch-go-live)
**Message:**
T-30' 🟦 *Pre-cutover heads-up*
- Window: **{{WINDOW_START}} → {{WINDOW_END}} ({{DURATION_MIN}}m)**
- Roles: Decider {{DECIDER}}, Driver {{DRIVER}}, Scribe {{SCRIBE}}, Observer {{OBSERVER}}
- Links: Ops {{OPS_DASH_URL}} · Metrics {{METRICS_URL}}
- Rollback matrix: `infra/ROLLBACK_PLAYBOOK.md`
➡️ Scribe mở `infra/GO_LIVE_LOG_TEMPLATE.md` – bắt đầu timestamp.

### C. Email (đội đối tác/BNN, tuỳ chọn)
Subject: [Heads-up] FloodWatch cutover {{WINDOW_START}} → {{WINDOW_END}} ({{DURATION_MIN}}m)
Body: (tóm tắt như bản công khai, kèm https://floodwatch.vn/lite và liên hệ ops@floodwatch.vn)

---

## 2) Cutover Start (T-0)

### A. Công khai (comment dưới bài Pre-cutover, hoặc post mới ngắn)
Bắt đầu bảo trì theo kế hoạch **({{WINDOW_START}} → {{WINDOW_END}})**.
**Lite mode**: https://floodwatch.vn/lite. Tiến độ sẽ cập nhật sau kiểm thử. #FloodWatchGoLive

### B. Nội bộ (Slack)
T-0 🔴 *Cutover started*. Driver chạy `deploy_production.sh` (DRY_RUN={{DRY_RUN_FLAG}}). Scribe log mọi checkpoint.

---

## 3) Post-Cutover Success (sau khi Smoke Test 7/7 PASS)

### A. Công khai
**Tiêu đề:** FloodWatch đã hoạt động bình thường ✅
**Nội dung (VI):**
Nâng cấp hoàn tất. Hệ thống đã **trở lại bình thường**.
- Truy cập bản đồ: https://floodwatch.vn/map · **Chế độ nhẹ**: https://floodwatch.vn/lite
- Hiệu năng mục tiêu: p95 < 150 ms, lỗi < 1%.
Cảm ơn bạn đã chờ đợi. Nếu gặp lỗi, hãy báo về ops@floodwatch.vn.

*(EN)*
Upgrade complete. **All systems operational.**
Map: https://floodwatch.vn/map · Lite: https://floodwatch.vn/lite. Thanks for your patience!

### B. Nội bộ (Slack)
T+~{{ELAPSED_MIN}}' 🟢 *Smoke 7/7 PASS*
- p95={{P95_MS}} ms · errors={{ERROR_RATE_PCT}}% · scraper lag={{SCRAPER_LAG_MIN}}m
- Cron set; metrics live {{METRICS_URL}}
- Close cutover at {{NOW_TIME}} unless objections.

---

## 4) Incident / Rollback Notice (nếu cần)

### A. Công khai – Degraded/Read-only (Lite-only Mode)
**Tiêu đề:** Thông báo tạm thời – chuyển sang Chế độ nhẹ 🟠
Do lưu lượng/tắc nghẽn, FloodWatch tạm **chuyển sang Chế độ nhẹ** tại https://floodwatch.vn/lite.
Đội ngũ đang khắc phục, dự kiến **{{ETA_MIN}} phút**. Xin cảm ơn!

*(EN)* Temporary *Lite mode* at https://floodwatch.vn/lite due to load. ETA {{ETA_MIN}} min.

### B. Công khai – Rollback (nếu phải quay lại bản ổn định)
**Tiêu đề:** Khôi phục phiên bản ổn định 🔄
Để đảm bảo an toàn, chúng tôi **tạm thời khôi phục phiên bản ổn định**.
**Lite mode** vẫn khả dụng: https://floodwatch.vn/lite. Cập nhật tiếp theo trong **{{ETA_MIN}} phút**.

### C. Nội bộ – Slack (kích hoạt Playbook)
🔴 *Trigger rollback path {{RB_OPTION}} (RTO {{RTO_MIN}}m)*
- Lý do: {{INCIDENT_REASON}}
- Lựa chọn: A/B/C/D theo `infra/ROLLBACK_PLAYBOOK.md`
- Comms: Public post đã gửi (link), cập nhật tiếp theo **{{NEXT_UPDATE_MIN}}'**.

---

## 5) Recovery / All-Clear

### A. Công khai
**Tiêu đề:** FloodWatch hoạt động trở lại 🟢
Sự cố đã được khắc phục. Truy cập bản đồ: https://floodwatch.vn/map · **Chế độ nhẹ**: https://floodwatch.vn/lite
Cảm ơn cộng đồng đã kiên nhẫn!

### B. Nội bộ – Slack
🟢 *All-clear*. Post-mortem trong 48h. Gán RCA doc cho {{RCA_OWNER}}; hạn chót {{RCA_DEADLINE}}.

---

## 6) Next-Day Metrics Recap (H+24h)

### A. Công khai (tuỳ chọn)
**Tiêu đề:** 24h sau nâng cấp – hệ thống ổn định 📈
- p95: {{P95_24H_MS}} ms · Error: {{ERROR_24H_PCT}}%
- Số báo cáo mới: {{NEW_REPORTS_24H}}
Cảm ơn các đội hỗ trợ & cộng đồng! #FloodWatchGoLive

### B. Nội bộ – Slack/Email
**Subject:** [Recap] FloodWatch 24h post-cutover
- Uptime: {{UPTIME_24H_PCT}}% · p95: {{P95_24H_MS}} ms
- Top issues + fixes: {{TOP_ISSUES_LIST}}
- Action items: {{ACTION_ITEMS_LIST}} (chủ → hạn)

---

## 7) Quick Send Plan (ai gửi – gửi ở đâu – khi nào)
| Timepoint | Message | Channel(s) | Owner |
|---|---|---|---|
| T-30' | Pre-cutover announcement | FB/Zalo/Telegram | {{COMMS_OWNER_NAME}} |
| T-30' | Heads-up nội bộ | Slack #floodwatch-go-live | {{DRIVER}} |
| T-0 | Cutover start | Comment/public short | {{COMMS_OWNER_NAME}} |
| T+~{{ELAPSED_MIN}}' | Post-cutover success | Public + Slack | {{SCRIBE}} |
| If degraded | Lite-only mode | Public + Slack | {{DECIDER}} |
| If rollback | Rollback notice | Public + Slack | {{DECIDER}} |
| H+24h | Metrics recap | Public (tuỳ chọn) + Email | {{OPS_OWNER_NAME}} |

---

## 8) Tone & Style
- **Ngắn – rõ – không kỹ thuật** cho công chúng; **chuẩn xác – đầy đủ** cho nội bộ.
- Luôn đưa **đường link thay thế** (https://floodwatch.vn/lite) khi có gián đoạn.
- Xưng hô trung tính, tránh đổ lỗi; tập trung vào **thời gian** và **giải pháp**.

---

## 9) Snippets Nhanh (copy-paste)
- **Lite-only enable (nội bộ, đã có trong QUICK_REFERENCE):**
  "Hệ thống tạm chuyển sang **Chế độ nhẹ** để đảm bảo truy cập ổn định: https://floodwatch.vn/lite. Dự kiến cập nhật tiếp theo trong {{NEXT_UPDATE_MIN}} phút."
- **All-clear:**
  "Nâng cấp hoàn tất, hệ thống đã **ổn định**. Bản đồ: https://floodwatch.vn/map · **Chế độ nhẹ**: https://floodwatch.vn/lite."

---

## 10) Liên hệ
- Ops: ops@floodwatch.vn · Hotline: {{HOTLINE}}
- Incident Slack: {{SLACK_INCIDENT_CHANNEL}}
- Repo issues: {{REPO_ISSUES_URL}}
