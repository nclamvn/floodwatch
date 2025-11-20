# FloodWatch - Visual Aids & Print Materials

**Quick reference for deployment planning and execution visuals**

---

## 📊 Available Visual Aids

### 1. **FloodWatch_Deployment_Gantt.html** (22 KB)

**Interactive deployment timeline with color-coded phases**

**Use case:**
- Wall display during war-room deployment
- Share with team for pre-deployment review
- Print as reference poster

**Features:**
- Visual timeline T-15' → T+60' (75 minutes)
- Color-coded phases:
  - 🔵 Blue = Normal steps
  - 🔴 Red = Deployment start
  - 🟠 Orange = First-time only (SSL)
  - 🟢 Green = Completion
- 10 major deployment phases
- Decision gates (A/B/C) clearly marked
- Command snippets for copy-paste
- Print-optimized CSS

**How to use:**
```bash
# Open in browser
open docs/FloodWatch_Deployment_Gantt.html

# Print to PDF
# 1. Cmd+P (Mac) / Ctrl+P (Windows)
# 2. Destination: Save as PDF
# 3. Margins: Default
# 4. Save as: FloodWatch_Deployment_Gantt.pdf

# Share with team
# - Email PDF to war-room participants
# - Display on second monitor during deployment
# - Print poster for operations room wall
```

**Phases included:**
1. T-15': Freeze & War-room
2. T-10': Preflight Checks
3. T-5': Pre-deployment Backup
4. T+0': Deployment Start
5. T+5': Containers & Migrations
6. T+10': Warm-up & Smoke Tests
7. T+20': SSL Certificate (first-time)
8. T+30': Cron & Monitoring
9. T+40': Load Test (optional)
10. T+50': Public Announcement

---

### 2. **FloodWatch_PreDeployment_Checklist.html** (22 KB)

**Comprehensive pre-deployment checklist with 24 items**

**Use case:**
- Pre-deployment validation (D-1 to H-1)
- Sign-off document for deployment approval
- Audit trail for compliance

**Features:**
- 24 checkbox items across 5 sections
- Visual checkboxes for printing
- Command snippets with expected outputs
- Sign-off section (Driver + Decider)
- Fill-in fields for date/time/names
- Print-optimized for physical signing

**How to use:**
```bash
# Open in browser
open docs/FloodWatch_PreDeployment_Checklist.html

# Print to PDF
# 1. Cmd+P (Mac) / Ctrl+P (Windows)
# 2. Save as PDF: FloodWatch_PreDeployment_Checklist.pdf

# Physical workflow
# 1. Print checklist
# 2. Work through items day before deployment
# 3. Check off boxes as completed
# 4. Sign at bottom when 100% complete
# 5. Scan signed copy for records
```

**Sections:**
1. 🔐 Secrets & Environment (5 items)
2. 🌐 Server & Network (6 items)
3. 🏥 Capacity & Health (5 items)
4. 🔄 Rollback & Emergency (6 items)
5. 🚀 Final Commands (5 items)

---

## 🎯 Recommended Workflow

### Pre-Deployment (D-1)

1. **Print Checklist**
   ```bash
   open docs/FloodWatch_PreDeployment_Checklist.html
   # Print → Work through 24 items → Sign off
   ```

2. **Review Gantt**
   ```bash
   open docs/FloodWatch_Deployment_Gantt.html
   # Share with team, discuss timeline
   ```

3. **Prepare Materials**
   - Print Gantt as poster for war-room
   - Email PDFs to all participants
   - Bookmark HTML files for quick access

### During Deployment (H-0)

**Setup:**
- **Monitor 1:** Terminal (executing commands)
- **Monitor 2:** Gantt HTML (track progress)
- **Paper:** RUN_ORDER.md + GO_LIVE_LOG_TEMPLATE.md

**Roles:**
- **Driver:** Uses RUN_ORDER.md for commands
- **Observer:** Watches Gantt, tracks time
- **Scribe:** Fills GO_LIVE_LOG_TEMPLATE.md
- **Decider:** References Gantt decision gates

### Post-Deployment

1. Archive signed checklist (PDF)
2. File deployment log
3. Update Gantt with actual times for next deployment

---

## 🖨️ Printing Tips

### For Best Results

**Gantt Timeline:**
- Orientation: Portrait or Landscape (both work)
- Paper: A3 for wall poster, A4 for reference
- Color: Highly recommended (color-coded phases)
- Margins: Default or Minimum

**Pre-Deployment Checklist:**
- Orientation: Portrait
- Paper: A4 / Letter
- Color: Optional (works in B&W)
- Margins: Default
- Duplex: No (single-sided for signing)

### Print Commands

**macOS:**
```bash
# Open and print
open docs/FloodWatch_Deployment_Gantt.html
# Cmd+P → Configure → Print or Save as PDF

open docs/FloodWatch_PreDeployment_Checklist.html
# Cmd+P → Configure → Print or Save as PDF
```

**Windows:**
```bash
# Open in default browser
start docs/FloodWatch_Deployment_Gantt.html
# Ctrl+P → Configure → Print or Save as PDF

start docs/FloodWatch_PreDeployment_Checklist.html
# Ctrl+P → Configure → Print or Save as PDF
```

**Linux:**
```bash
# Open in default browser
xdg-open docs/FloodWatch_Deployment_Gantt.html
# Ctrl+P → Configure → Print or Save as PDF

xdg-open docs/FloodWatch_PreDeployment_Checklist.html
# Ctrl+P → Configure → Print or Save as PDF
```

---

## 📂 File Locations

```
/opt/floodwatch/
└── docs/
    ├── FloodWatch_Deployment_Gantt.html      # Interactive timeline
    ├── FloodWatch_PreDeployment_Checklist.html  # 24-item checklist
    ├── RUN_ORDER.md                          # 1-page text timeline
    ├── DRILL_PLAYBOOK.md                     # Rollback drill procedures
    ├── WAR_ROOM_CHECKLIST.md                 # Hourly health checks
    ├── HELPCARD_PUBLIC.md                    # User guide
    └── VISUAL_AIDS_README.md                 # This file
```

---

## 🎨 Customization

**Want to customize these files for your environment?**

### Option 1: Edit HTML Directly

Both HTML files are self-contained with embedded CSS. You can:
- Change colors
- Update domain names
- Add your logo
- Adjust timeline phases

### Option 2: Request Pre-filled Version

Provide:
- `DOMAIN` (e.g., floodwatch.vn)
- `API_KEY` (demo key for examples)
- `ADMIN_TOKEN` (demo token for examples)
- Company logo (optional)

---

## 🔗 Related Documents

**Execution:**
- `docs/RUN_ORDER.md` - 1-page step-by-step timeline
- `infra/GO_LIVE_LOG_TEMPLATE.md` - Real-time logging template

**Planning:**
- `infra/GO_LIVE_CHECKLIST.md` - Comprehensive checklist
- `infra/PRODUCTION_SETUP.md` - Complete setup guide

**Emergency:**
- `infra/ROLLBACK_PLAYBOOK.md` - 4 rollback options
- `docs/RUNBOOK.md` - Incident response

**Training:**
- `docs/DRILL_PLAYBOOK.md` - Quarterly rollback drill

---

## ✅ Validation

**Verify files work:**

```bash
# Check files exist
ls -lh docs/FloodWatch_*.html

# Expected output:
# FloodWatch_Deployment_Gantt.html (22 KB)
# FloodWatch_PreDeployment_Checklist.html (22 KB)

# Test in browser
open docs/FloodWatch_Deployment_Gantt.html
# Should see: Timeline with 10 phases, color-coded

open docs/FloodWatch_PreDeployment_Checklist.html
# Should see: 5 sections, 24 checkboxes
```

---

## 📞 Support

**If you encounter issues with visual aids:**

1. Check browser compatibility (works best in Chrome, Firefox, Safari)
2. Ensure files are opened via `file://` protocol or HTTP server
3. For printing issues, try different browsers
4. Consult `infra/DEPLOYMENT_PACKAGE_README.md` for troubleshooting

---

**📊 FloodWatch Visual Aids v1.1.1**

**Last updated:** 2025-11-01
**Maintainer:** Ops Team
