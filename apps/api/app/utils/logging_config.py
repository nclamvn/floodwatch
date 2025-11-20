"""
Structured logging configuration using structlog
Provides JSON-formatted logs for production environments
"""
import structlog
import logging
import sys


def configure_logging(json_logs: bool = True):
    """
    Configure structured logging

    Args:
        json_logs: If True, output JSON format. If False, use console format.
    """
    if json_logs:
        # JSON format for production
        processors = [
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ]
    else:
        # Console format for development
        processors = [
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer()
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )


def get_logger(name: str):
    """
    Get a structured logger

    Usage:
        logger = get_logger(__name__)
        logger.info("event_name", key1="value1", key2="value2")
    """
    return structlog.get_logger(name)


# Example usage:
# from app.utils.logging_config import get_logger
# logger = get_logger(__name__)
# logger.info("alert_ingested", source="KTTV", province="Quảng Nam", trust_score=0.8)
