import logging
import os
import json
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any

# Ensure logs directory exists
LOGS_DIR = os.path.join(os.getcwd(), "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

# File handler for security audit logs
audit_file = os.path.join(LOGS_DIR, "security_audit.log")
file_handler = logging.FileHandler(audit_file, encoding="utf-8")
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

logger = logging.getLogger("security_audit")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(file_handler)


def mask_email(email: str) -> str:
    """Mask email for PII compliance in audit logs."""
    if not email or "@" not in email:
        return "[ANONYMIZED]"
    parts = email.split("@")
    name = parts[0]
    domain = parts[1]
    masked_name = name[0] + "***" + (name[-1] if len(name) > 1 else "")
    return f"{masked_name}@{domain}"


def sanitize_details(details: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Remove or mask sensitive keys from audit log details."""
    if not details:
        return {}
    
    clean_details = {}
    sensitive_keys = {"password", "token", "credential", "secret", "hashed_password", "key"}
    
    for key, value in details.items():
        if key.lower() in sensitive_keys:
            clean_details[key] = "[REDACTED]"
        elif "email" in key.lower() and isinstance(value, str):
            clean_details[key] = mask_email(value)
        else:
            clean_details[key] = value
            
    return clean_details


async def log_security_event(
    event_type: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
):
    """
    Log a security-critical event to local audit file and MongoDB collection.
    """
    masked_user_email = mask_email(email) if email else None
    clean_details = sanitize_details(details)
    
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "user_id": user_id or "ANONYMOUS",
        "email": masked_user_email,
        "ip_address": ip_address or "UNKNOWN",
        "details": clean_details,
    }
    
    # Log to local file as JSON string
    logger.info(json.dumps(log_entry))
    
    # Asynchronously store in DB if connection available
    try:
        from app.db.database import get_database
        db = get_database()
        if db is not None:
            await db["audit_logs"].insert_one(log_entry)
    except Exception:
        # Prevent logging errors from crashing the main application thread
        pass
