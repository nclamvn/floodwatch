# FloodWatch V1 - Security Checklist

> Phase 6: Production Security & Hardening

This document provides security checklists for development, staging, and production environments.

---

## 🟢 Development Checklist

Minimal security for local development while maintaining productivity.

### Environment Setup
- [ ] `.env` file exists (copied from `.env.example`)
- [ ] `.env` is in `.gitignore` (never committed)
- [ ] Using placeholder/dummy API keys where possible
- [ ] `ENVIRONMENT=development` is set

### Authentication
- [ ] Admin password is set (can use `ADMIN_RESCUE_PASSWORD` in dev)
- [ ] Default token values changed from examples

### CORS
- [ ] `CORS_ORIGINS=http://localhost:3000` (allow localhost)
- [ ] Can add additional local ports if needed

### Database
- [ ] Local PostgreSQL running with PostGIS
- [ ] Dev database separate from production data

### What's OK in Dev
- ✅ Plaintext admin password (`ADMIN_RESCUE_PASSWORD`)
- ✅ Relaxed CORS (`localhost:*`)
- ✅ Debug logging enabled
- ✅ Rate limiting disabled or lenient
- ✅ Security headers in report-only mode

---

## 🟡 Staging Checklist

Production-like environment for testing before release.

### Environment Setup
- [ ] `ENVIRONMENT=staging`
- [ ] Separate staging database (not production data!)
- [ ] Staging-specific API keys (with lower limits)

### Authentication
- [ ] Use `ADMIN_PASSWORD_HASH` (bcrypt) instead of plaintext
- [ ] Generate hash: `python -c "from app.dependencies.admin_auth import generate_password_hash; print(generate_password_hash('password'))"`
- [ ] Test accounts have non-trivial passwords

### CORS
- [ ] `CORS_ORIGINS` set to staging domain(s) only
- [ ] No wildcards (`*`)

### Security Headers
- [ ] All headers enabled
- [ ] CSP in enforce mode (not report-only)

### Rate Limiting
- [ ] Rate limiting enabled
- [ ] Test rate limit responses

### Logging
- [ ] Audit logging enabled
- [ ] PII scrubbing active
- [ ] No sensitive data in logs

### Testing
- [ ] Test admin login/logout flow
- [ ] Test rate limit responses (429)
- [ ] Test unauthorized access (401/403)
- [ ] Test PII redaction in responses

---

## 🔴 Production Checklist

**CRITICAL**: Complete all items before production deployment.

### Environment Setup
- [ ] `ENVIRONMENT=production`
- [ ] All secrets from secure secrets manager
- [ ] No default/placeholder values remain
- [ ] `.env` file permissions restricted (600)

### Admin Authentication
- [ ] `ADMIN_PASSWORD_HASH` set with bcrypt hash
- [ ] `ADMIN_RESCUE_PASSWORD` is unset or empty
- [ ] Strong password (16+ characters, mixed)
- [ ] Session TTL appropriate (`ADMIN_SESSION_TTL_HOURS`)
- [ ] Admin URL is not publicly advertised

### CORS Configuration
- [ ] `CORS_ORIGINS` = exact production domains only
- [ ] Example: `https://thongtinmuala.live,https://www.thongtinmuala.live`
- [ ] NO wildcards (`*`)
- [ ] NO `localhost`

### Security Headers
- [ ] `X-Frame-Options: DENY` ✓
- [ ] `X-Content-Type-Options: nosniff` ✓
- [ ] `Strict-Transport-Security` enabled ✓
- [ ] `Content-Security-Policy` enforced ✓
- [ ] `Referrer-Policy` set ✓

### Rate Limiting
- [ ] Rate limiting enabled and tested
- [ ] Admin login: 5 attempts / 15 minutes
- [ ] Public writes: 20 requests / 5 minutes
- [ ] Distress endpoints: 30 requests / 5 minutes
- [ ] Redis backend configured (for multi-worker)

### HTTPS/TLS
- [ ] HTTPS only (HTTP redirects to HTTPS)
- [ ] Valid SSL certificate (not self-signed)
- [ ] HSTS enabled with `preload`

### Database
- [ ] Strong database password
- [ ] Database not exposed to internet
- [ ] Regular backups configured
- [ ] Point-in-time recovery enabled

### API Keys
- [ ] All API keys rotated from development
- [ ] OpenAI: Usage limits set in dashboard
- [ ] Cloudinary: Restricted upload presets
- [ ] Telegram: Separate production bot

### Logging & Monitoring
- [ ] Audit logging to secure location
- [ ] PII scrubbing in all logs
- [ ] Error tracking (Sentry) configured
- [ ] Log retention policy set
- [ ] Alerts for security events

### Network Security
- [ ] Firewall rules configured
- [ ] Only necessary ports exposed
- [ ] Internal services not public
- [ ] Admin endpoints IP-restricted if possible

### Backup & Recovery
- [ ] Database backup schedule
- [ ] Tested restore procedure
- [ ] Secrets backup (secure location)
- [ ] Disaster recovery plan documented

---

## 🔐 Security Configuration Summary

### Files Added/Modified in Phase 6

| File | Purpose |
|------|---------|
| `middleware/security_headers.py` | Comprehensive HTTP security headers |
| `middleware/rate_limiter.py` | Configurable rate limiting |
| `dependencies/admin_auth.py` | Bcrypt-based admin authentication |
| `services/audit_log.py` | Admin action audit logging |
| `schemas/public_responses.py` | PII-redacting DTOs |
| `.env.example` | Documented environment variables |

### Security Headers Applied

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-XSS-Protection | 1; mode=block | XSS filter (legacy) |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer |
| HSTS | max-age=31536000 | Force HTTPS |
| CSP | (see config) | Control resource loading |

### Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Admin login | 5 | 15 min |
| Public writes | 20 | 5 min |
| Help requests | 15 | 5 min |
| Distress reports | 30 | 5 min |
| AI endpoints | 10 | 1 min |
| Read endpoints | 100 | 1 min |

### PII Handling

| Field | Public Treatment | Admin Access |
|-------|------------------|--------------|
| Phone | `090***4567` | Full |
| Email | `u***@e***.com` | Full |
| Name | `Nguyen V. A.` | Full |
| Coordinates | ±100m accuracy | Full |

---

## 🚨 Incident Response

### If Credentials Are Leaked

1. **Immediately**:
   - Rotate all affected secrets
   - Invalidate all admin sessions
   - Check audit logs for unauthorized access

2. **Within 1 hour**:
   - Deploy updated secrets
   - Review recent admin actions
   - Enable additional monitoring

3. **Follow-up**:
   - Investigate leak source
   - Review access controls
   - Update this checklist

### Security Contact

For security issues, contact the development team directly.
Do not create public issues for security vulnerabilities.

---

*Last updated: Phase 6 - Production Security & Hardening*
