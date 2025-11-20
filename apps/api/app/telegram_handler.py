"""
Telegram Bot Message Handler
Processes user commands and manages subscriptions
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Optional
import logging

from app.database import get_db, TelegramSubscription
from app.services.telegram_bot import telegram_bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram"])


# Available provinces
PROVINCES = [
    "Quảng Bình",
    "Quảng Trị",
    "Thừa Thiên Huế",
    "Đà Nẵng",
    "Quảng Nam",
    "Quảng Ngãi",
    "Bình Định",
    "Phú Yên",
    "Khánh Hòa"
]


def normalize_province_name(text: str) -> Optional[str]:
    """
    Normalize user input to match province name

    Examples:
        "da nang" -> "Đà Nẵng"
        "quang tri" -> "Quảng Trị"
    """
    text_lower = text.lower().strip()

    # Direct mapping
    mapping = {
        "quang binh": "Quảng Bình",
        "quảng bình": "Quảng Bình",
        "quang tri": "Quảng Trị",
        "quảng trị": "Quảng Trị",
        "thua thien hue": "Thừa Thiên Huế",
        "thừa thiên huế": "Thừa Thiên Huế",
        "hue": "Thừa Thiên Huế",
        "huế": "Thừa Thiên Huế",
        "da nang": "Đà Nẵng",
        "đà nẵng": "Đà Nẵng",
        "danang": "Đà Nẵng",
        "quang nam": "Quảng Nam",
        "quảng nam": "Quảng Nam",
        "quang ngai": "Quảng Ngãi",
        "quảng ngãi": "Quảng Ngãi",
        "binh dinh": "Bình Định",
        "bình định": "Bình Định",
        "phu yen": "Phú Yên",
        "phú yên": "Phú Yên",
        "khanh hoa": "Khánh Hòa",
        "khánh hòa": "Khánh Hòa",
        "nha trang": "Khánh Hòa"
    }

    return mapping.get(text_lower)


def handle_start_command(chat_id: int, db: Session) -> None:
    """Handle /start command"""
    telegram_bot.send_welcome(chat_id)

    # Create or update user record
    user = db.query(TelegramSubscription).filter(
        TelegramSubscription.chat_id == chat_id
    ).first()

    if not user:
        user = TelegramSubscription(
            chat_id=chat_id,
            username=None,
            is_active=False,
            provinces=[]
        )
        db.add(user)
        db.commit()
        logger.info(f"✅ New user registered: {chat_id}")


def handle_subscribe_command(chat_id: int, province_text: Optional[str], db: Session) -> None:
    """
    Handle /subscribe command

    Usage:
        /subscribe -> Show list of provinces
        /subscribe Quảng Trị -> Subscribe to Quảng Trị
    """
    if not province_text:
        # No province specified, show list
        telegram_bot.send_provinces_list(chat_id)
        return

    # Try to normalize the province name
    province = normalize_province_name(province_text)

    if not province:
        telegram_bot.send_message(
            chat_id,
            f"❌ Không tìm thấy tỉnh '{province_text}'.\n\n"
            "Gõ /subscribe để xem danh sách tỉnh có thể đăng ký."
        )
        return

    # Subscribe to the province
    handle_province_subscription(chat_id, province, db)


def handle_unsubscribe_command(chat_id: int, db: Session) -> None:
    """Handle /unsubscribe command"""
    user = db.query(TelegramSubscription).filter(
        TelegramSubscription.chat_id == chat_id
    ).first()

    if user:
        user.is_active = False
        user.provinces = []
        db.commit()

        telegram_bot.send_message(
            chat_id,
            "✅ Đã hủy tất cả đăng ký.\n\nGõ /subscribe để đăng ký lại."
        )
        logger.info(f"User {chat_id} unsubscribed")
    else:
        telegram_bot.send_message(
            chat_id,
            "Bạn chưa đăng ký. Gõ /subscribe để bắt đầu."
        )


def handle_status_command(chat_id: int, db: Session) -> None:
    """Handle /status command"""
    user = db.query(TelegramSubscription).filter(
        TelegramSubscription.chat_id == chat_id
    ).first()

    if not user or not user.is_active or not user.provinces:
        telegram_bot.send_message(
            chat_id,
            "Bạn chưa đăng ký nhận cảnh báo.\n\nGõ /subscribe để bắt đầu."
        )
        return

    provinces_str = "\n".join([f"• {p}" for p in user.provinces])
    message = f"""
📊 <b>Trạng thái đăng ký:</b>

✅ Đang hoạt động

<b>Tỉnh/thành đã đăng ký:</b>
{provinces_str}

Gõ /subscribe để thêm tỉnh mới
Gõ /unsubscribe để hủy tất cả
    """
    telegram_bot.send_message(chat_id, message.strip())


def handle_province_subscription(
    chat_id: int,
    province: str,
    db: Session
) -> None:
    """Subscribe user to a province"""
    user = db.query(TelegramSubscription).filter(
        TelegramSubscription.chat_id == chat_id
    ).first()

    if not user:
        # Create new user
        user = TelegramSubscription(
            chat_id=chat_id,
            username=None,
            is_active=True,
            provinces=[province]
        )
        db.add(user)
    else:
        # Update existing user
        if province not in user.provinces:
            user.provinces.append(province)
        user.is_active = True

    db.commit()

    telegram_bot.send_subscription_success(chat_id, province)
    logger.info(f"User {chat_id} subscribed to {province}")


def process_message(message: Dict, db: Session) -> None:
    """
    Process incoming Telegram message

    Args:
        message: Telegram message object
        db: Database session
    """
    chat_id = message["chat"]["id"]
    text = message.get("text", "").strip()

    logger.info(f"📩 Message from {chat_id}: {text}")

    # Handle commands
    if text.startswith("/"):
        parts = text.split(maxsplit=1)
        command = parts[0].lower()
        args = parts[1] if len(parts) > 1 else None

        if command == "/start":
            handle_start_command(chat_id, db)
        elif command == "/subscribe":
            handle_subscribe_command(chat_id, args, db)
        elif command == "/unsubscribe":
            handle_unsubscribe_command(chat_id, db)
        elif command == "/status":
            handle_status_command(chat_id, db)
        elif command == "/help":
            telegram_bot.send_welcome(chat_id)
        else:
            telegram_bot.send_message(
                chat_id,
                "Lệnh không hợp lệ. Gõ /help để xem hướng dẫn."
            )
        return

    # Try to parse as province name
    province = normalize_province_name(text)

    if province:
        handle_province_subscription(chat_id, province, db)
    else:
        # Unknown input
        telegram_bot.send_message(
            chat_id,
            f"Không tìm thấy tỉnh '{text}'.\n\n"
            "Gõ /subscribe để xem danh sách tỉnh có thể đăng ký."
        )


@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Telegram webhook endpoint

    Receives updates from Telegram when users send messages to bot
    """
    try:
        data = await request.json()

        # Extract message
        message = data.get("message")
        if not message:
            return {"ok": True}

        # Process message
        process_message(message, db)

        return {"ok": True}

    except Exception as e:
        logger.error(f"❌ Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/webhook/info")
async def webhook_info():
    """Get current webhook configuration"""
    info = telegram_bot.get_webhook_info()
    if info:
        return info
    else:
        raise HTTPException(status_code=500, detail="Failed to get webhook info")


@router.post("/webhook/set")
async def set_webhook(webhook_url: str):
    """
    Set webhook URL for Telegram bot

    Example:
        POST /telegram/webhook/set?webhook_url=https://nclam.site/telegram/webhook
    """
    success = telegram_bot.set_webhook(webhook_url)
    if success:
        return {"status": "success", "webhook_url": webhook_url}
    else:
        raise HTTPException(status_code=500, detail="Failed to set webhook")


@router.post("/webhook/delete")
async def delete_webhook():
    """Delete webhook (switch to polling mode)"""
    success = telegram_bot.delete_webhook()
    if success:
        return {"status": "success", "message": "Webhook deleted"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete webhook")
