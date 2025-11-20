# FloodWatch Privacy & Data Handling Policy

**Version:** 1.0
**Last Updated:** 2025-10-31
**Effective Date:** 2025-11-01

---

## Overview

FloodWatch is committed to protecting user privacy while providing critical flood monitoring information to the public. This document outlines our data handling practices and PII (Personally Identifiable Information) protection measures.

---

## Data We Collect

### Community Reports

When users submit reports via `/report` form, we collect:

**Required:**
- Report type (SOS, ROAD, NEEDS)
- Description text
- GPS coordinates (latitude, longitude)
- Province name

**Optional:**
- District name
- Ward name
- Photos (uploaded to Cloudinary)

**Automatically Collected:**
- Timestamp
- IP address (for rate limiting only, not stored)
- Trust score (calculated)

### Official Sources

From KTTV/Press monitoring:
- Alert titles
- Province information
- Event descriptions
- Timestamps

### Analytics

We do NOT collect:
- ❌ User accounts or login credentials
- ❌ Names
- ❌ Persistent user IDs
- ❌ Device fingerprints
- ❌ Tracking cookies

---

## PII Protection

### What is PII?

Personally Identifiable Information that could identify specific individuals:
- Phone numbers
- Email addresses
- Full names
- Street addresses
- National ID numbers

### PII Scrubbing

**Public Endpoints** (PII automatically scrubbed):
- `/api/v1/reports` - API endpoint
- `/reports` - Web endpoint
- `/lite` - Lite mode
- `/reports/export` - CSV export

**Admin Endpoints** (PII preserved for verification):
- `/ops` - Ops dashboard (requires ADMIN_TOKEN)
- `/deliveries` - Webhook deliveries (requires ADMIN_TOKEN)
- `/subscriptions` - Alert subscriptions (requires ADMIN_TOKEN)

### Scrubbing Rules

**Phone Numbers:**
```
Original: "Gọi 0905-123-456 hoặc +84 90 123 4567"
Scrubbed: "Gọi ***-****-*** hoặc +84-***-***-***"
```

**Email Addresses:**
```
Original: "Liên hệ: rescue@example.com"
Scrubbed: "Liên hệ: ***@***"
```

**Implementation:**
- Applied via middleware (`app/middleware/pii_scrub.py`)
- Regex-based pattern matching
- Runs before response is returned to client
- Does not modify database records

---

## Data Retention

### Reports

- **Active Storage:** 30 days
- **Archive Storage:** 30-365 days (for analysis)
- **Deletion:** After 1 year

### Backups

- **Daily Backups:** Retained for 7 days
- **Weekly Backups:** Retained for 30 days
- **Monthly Backups:** Retained for 1 year

### Logs

- **Application Logs:** 7 days
- **Access Logs:** 30 days
- **Error Logs:** 90 days

---

## Data Access

### Public Access

Anyone can access (with PII scrubbed):
- Recent flood reports
- Road status information
- Aggregated statistics
- Historical data (>30 days old)

No authentication required for public access.

### API Access

Requires API key:
- `/api/v1/*` endpoints
- Rate limited: 120 requests/minute
- PII scrubbed
- Usage logged (API key ID only, not personal data)

### Administrative Access

Requires ADMIN_TOKEN:
- Full report details (including PII for verification)
- Ops dashboard
- Webhook configuration
- Delivery logs

**Who has admin access:**
- Operations team (on-call engineers)
- Database administrators
- Product owner

**Admin actions logged:**
- Timestamp
- Action performed (verify, resolve, merge, invalidate)
- Report ID affected
- No PII logged in admin action logs

---

## Third-Party Services

### Cloudinary

**Purpose:** Image hosting for community report photos

**Data Shared:**
- Photos uploaded by users (optional)
- Upload timestamp

**Privacy:**
- Images public by default (URLs are unguessable but not private)
- Users should NOT upload photos containing PII
- Warning shown on upload form

**Retention:** 90 days, then auto-deleted

### Mapbox

**Purpose:** Map tiles for visualization

**Data Shared:**
- User's IP address (for tile requests)
- Map viewport coordinates (what area user is viewing)

**Privacy:**
- Standard Mapbox privacy policy applies
- No PII shared
- Fallback to OpenStreetMap tiles available

### Telegram (Optional)

**Purpose:** Alert delivery to provincial emergency groups

**Data Shared:**
- Alert text (PII scrubbed)
- Province name
- Timestamp

**Privacy:**
- Only sent to pre-configured group chats
- No individual user data
- Messages contain public information only

---

## User Rights

### Right to Access

Users can:
- View all public reports without registration
- Export data via CSV (PII scrubbed)
- Request specific report deletion via contact form

### Right to Deletion

To request deletion of a specific report:
1. Contact: privacy@floodwatch.vn
2. Provide report ID or approximate timestamp
3. Reason for deletion (optional)

**Response Time:** Within 48 hours

**Note:** Reports critical for emergency response may be retained longer (up to 1 year) per Vietnamese data retention laws.

### Right to Correction

If a report contains incorrect information:
1. Submit new report with correction
2. Or contact ops team to mark original as "invalid"

---

## Security Measures

### Data in Transit

- ✅ HTTPS/TLS for all web traffic
- ✅ Certificate auto-renewal via Let's Encrypt
- ✅ Secure headers (HSTS, CSP, X-Frame-Options)

### Data at Rest

- ✅ PostgreSQL database with access control
- ✅ Encrypted backups
- ✅ Limited database credentials (principle of least privilege)

### Application Security

- ✅ Rate limiting (prevents abuse)
- ✅ Input validation (prevents injection attacks)
- ✅ CORS policy (prevents unauthorized API access)
- ✅ SQL injection protection (SQLAlchemy ORM)

### Operational Security

- ✅ Admin token authentication
- ✅ Audit logs for all admin actions
- ✅ Firewall (only ports 80, 443, 22 open)
- ✅ fail2ban for SSH protection

---

## Data Sharing

### We DO NOT:
- ❌ Sell user data
- ❌ Share data with advertisers
- ❌ Use data for marketing
- ❌ Share data with third parties (except as listed above)

### We DO:
- ✅ Share aggregated statistics with researchers (no PII)
- ✅ Share data with government agencies for emergency response (if requested)
- ✅ Publish open data exports (PII scrubbed)

---

## Compliance

### Vietnamese Law

FloodWatch complies with:
- Personal Data Protection Decree 13/2023/NĐ-CP
- Cybersecurity Law 2018
- Law on Access to Information 2016

### Data Localization

- Server located in: [Server location]
- Data stored in: Vietnam (or specify)
- Backups stored in: Same location

---

## Privacy by Design

### Minimal Data Collection

We only collect data necessary for flood monitoring. Examples of data we DON'T collect:
- User names (reports are anonymous)
- Contact information (except if voluntarily provided in report text)
- Location history (only single GPS point per report)
- Photos of people (discouraged in upload form)

### PII-Free Architecture

Reports are designed to be useful without PII:
- GPS coordinates + description is sufficient
- No need for names or phone numbers
- Community can help without revealing identity

### Automatic Scrubbing

PII scrubbing happens automatically:
- No manual review needed
- Consistent across all public endpoints
- Cannot be disabled for public access

---

## Incident Response

### Data Breach

In the event of a data breach:
1. Incident logged immediately
2. Affected users notified within 72 hours
3. Breach reported to authorities per Vietnamese law
4. Post-mortem published (excluding sensitive details)

### Contact

**Privacy Officer:** privacy@floodwatch.vn
**Security Issues:** security@floodwatch.vn
**General Inquiries:** info@floodwatch.vn

---

## Changes to This Policy

This privacy policy may be updated:
- Version number will increment
- "Last Updated" date will change
- Users will be notified via website banner for 30 days

**Previous versions:** Available at `/docs/privacy/archive`

---

## Acknowledgments

FloodWatch is committed to transparency in data handling. This policy is open-source and available at:
- https://github.com/floodwatch/floodwatch
- `/docs/PRIVACY.md` in source code

**Feedback:** Submit issues or pull requests to improve this policy.

---

**Document Owner:** Privacy Officer
**Review Schedule:** Quarterly
**Last Reviewed:** 2025-10-31
