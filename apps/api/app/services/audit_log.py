"""
Audit Logging Service

Phase 6: Production Security & Hardening
Logs all admin actions for security and compliance.
"""
import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
from dataclasses import dataclass, asdict
from sqlalchemy import Column, String, DateTime, Text, create_engine
from sqlalchemy.orm import Session

# Import database only if needed
try:
    from app.database import Base, get_db
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False


class AuditAction(str, Enum):
    """Types of auditable actions"""
    # Authentication
    ADMIN_LOGIN = "admin_login"
    ADMIN_LOGIN_FAILED = "admin_login_failed"
    ADMIN_LOGOUT = "admin_logout"

    # Help requests
    HELP_REQUEST_CREATE = "help_request_create"
    HELP_REQUEST_UPDATE = "help_request_update"
    HELP_REQUEST_DELETE = "help_request_delete"
    HELP_REQUEST_VERIFY = "help_request_verify"

    # Help offers
    HELP_OFFER_CREATE = "help_offer_create"
    HELP_OFFER_UPDATE = "help_offer_update"
    HELP_OFFER_DELETE = "help_offer_delete"
    HELP_OFFER_VERIFY = "help_offer_verify"

    # Bulk operations
    BULK_DELETE = "bulk_delete"
    BULK_VERIFY = "bulk_verify"

    # Reports
    REPORT_VERIFY = "report_verify"
    REPORT_RESOLVE = "report_resolve"
    REPORT_INVALIDATE = "report_invalidate"
    REPORT_MERGE = "report_merge"

    # Hazards
    HAZARD_CREATE = "hazard_create"
    HAZARD_UPDATE = "hazard_update"
    HAZARD_DELETE = "hazard_delete"

    # Distress
    DISTRESS_UPDATE = "distress_update"
    DISTRESS_DELETE = "distress_delete"

    # System
    SCRAPER_TRIGGER = "scraper_trigger"
    CONFIG_CHANGE = "config_change"


@dataclass
class AuditEntry:
    """Audit log entry"""
    timestamp: str
    action: str
    actor_id: Optional[str]  # Admin token hash or identifier
    actor_ip: Optional[str]
    resource_type: Optional[str]
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    success: bool
    error_message: Optional[str] = None


class AuditLogger:
    """
    Audit logger for admin actions.

    Logs to:
    1. Structured log file (always)
    2. Database table (if configured)
    """

    def __init__(self):
        self._logger = self._setup_logger()
        self._db_enabled = os.getenv("AUDIT_LOG_DB", "false").lower() == "true"

    def _setup_logger(self) -> logging.Logger:
        """Set up structured audit logger"""
        logger = logging.getLogger("audit")
        logger.setLevel(logging.INFO)

        # Only add handler if not already present
        if not logger.handlers:
            # File handler for audit logs
            audit_log_path = os.getenv("AUDIT_LOG_PATH", "logs/audit.log")

            # Ensure directory exists
            os.makedirs(os.path.dirname(audit_log_path) or ".", exist_ok=True)

            handler = logging.FileHandler(audit_log_path)
            handler.setLevel(logging.INFO)

            # JSON formatter for structured logs
            formatter = logging.Formatter('%(message)s')
            handler.setFormatter(formatter)

            logger.addHandler(handler)

        return logger

    def _get_actor_hash(self, token: Optional[str]) -> Optional[str]:
        """Hash admin token for privacy in logs"""
        if not token:
            return None
        import hashlib
        return hashlib.sha256(token.encode()).hexdigest()[:16]

    def log(
        self,
        action: AuditAction,
        actor_token: Optional[str] = None,
        actor_ip: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> AuditEntry:
        """
        Log an audit entry.

        Args:
            action: The action being performed
            actor_token: Admin session token (will be hashed)
            actor_ip: IP address of the actor
            resource_type: Type of resource (e.g., "help_request")
            resource_id: ID of the affected resource
            details: Additional details (will be sanitized)
            success: Whether the action succeeded
            error_message: Error message if failed
        """
        # Create entry
        entry = AuditEntry(
            timestamp=datetime.utcnow().isoformat() + "Z",
            action=action.value if isinstance(action, AuditAction) else action,
            actor_id=self._get_actor_hash(actor_token),
            actor_ip=self._sanitize_ip(actor_ip),
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            details=self._sanitize_details(details),
            success=success,
            error_message=error_message
        )

        # Log to file
        self._log_to_file(entry)

        # Log to database if enabled
        if self._db_enabled:
            self._log_to_db(entry)

        return entry

    def _sanitize_ip(self, ip: Optional[str]) -> Optional[str]:
        """Sanitize IP address (partial for privacy in some cases)"""
        if not ip:
            return None
        # Keep full IP for security investigations
        return ip

    def _sanitize_details(self, details: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Remove sensitive data from details"""
        if not details:
            return None

        # Fields to redact
        sensitive_fields = {
            "password", "token", "api_key", "secret",
            "phone", "contact_phone", "email", "contact_email"
        }

        sanitized = {}
        for key, value in details.items():
            if key.lower() in sensitive_fields:
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_details(value)
            else:
                sanitized[key] = value

        return sanitized

    def _log_to_file(self, entry: AuditEntry):
        """Write entry to log file as JSON"""
        try:
            log_line = json.dumps(asdict(entry), ensure_ascii=False)
            self._logger.info(log_line)
        except Exception as e:
            # Fallback to basic logging
            logging.error(f"Failed to write audit log: {e}")

    def _log_to_db(self, entry: AuditEntry):
        """Write entry to database (if enabled)"""
        # Placeholder for database logging
        # Implement when AuditLog model is added to database
        pass

    # Convenience methods for common actions

    def log_admin_login(
        self,
        actor_ip: str,
        success: bool,
        error_message: Optional[str] = None
    ):
        """Log admin login attempt"""
        action = AuditAction.ADMIN_LOGIN if success else AuditAction.ADMIN_LOGIN_FAILED
        self.log(
            action=action,
            actor_ip=actor_ip,
            success=success,
            error_message=error_message
        )

    def log_admin_logout(self, actor_token: str, actor_ip: str):
        """Log admin logout"""
        self.log(
            action=AuditAction.ADMIN_LOGOUT,
            actor_token=actor_token,
            actor_ip=actor_ip,
            success=True
        )

    def log_resource_change(
        self,
        action: AuditAction,
        actor_token: str,
        actor_ip: str,
        resource_type: str,
        resource_id: str,
        details: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """Log a resource modification"""
        self.log(
            action=action,
            actor_token=actor_token,
            actor_ip=actor_ip,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            success=success,
            error_message=error_message
        )

    def log_bulk_operation(
        self,
        action: AuditAction,
        actor_token: str,
        actor_ip: str,
        resource_type: str,
        resource_ids: List[str],
        count: int,
        success: bool = True
    ):
        """Log a bulk operation"""
        self.log(
            action=action,
            actor_token=actor_token,
            actor_ip=actor_ip,
            resource_type=resource_type,
            details={
                "count": count,
                "resource_ids": resource_ids[:10],  # Limit to first 10
                "total_affected": len(resource_ids)
            },
            success=success
        )


# Global audit logger instance
audit_logger = AuditLogger()


# Helper function to get client IP from request
def get_client_ip(request) -> str:
    """Extract client IP from FastAPI request"""
    # Check X-Forwarded-For header (for proxied requests)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    # Fallback to direct client IP
    if request.client:
        return request.client.host

    return "unknown"


# Export
__all__ = [
    "AuditAction",
    "AuditEntry",
    "AuditLogger",
    "audit_logger",
    "get_client_ip",
]
