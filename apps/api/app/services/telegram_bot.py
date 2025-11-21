"""
Telegram Bot Service for FloodWatch
Handles user subscriptions and sends flood alerts via Telegram
"""
import os
import logging
from typing import List, Optional, Dict
import requests
from datetime import datetime

logger = logging.getLogger(__name__)


class TelegramBot:
    """Telegram bot for sending flood alerts"""

    def __init__(self):
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        if not self.token:
            logger.warning("TELEGRAM_BOT_TOKEN not set - bot will not work")
        self.base_url = f"https://api.telegram.org/bot{self.token}"

    def send_message(
        self,
        chat_id: int,
        text: str,
        parse_mode: str = "HTML",
        disable_web_page_preview: bool = False
    ) -> bool:
        """Send a message to a Telegram chat"""
        if not self.token:
            logger.error("Cannot send message - bot token not configured")
            return False

        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": disable_web_page_preview
        }

        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"✅ Message sent to chat {chat_id}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to send message to {chat_id}: {e}")
            return False

    def send_alert(self, chat_id: int, report: Dict) -> bool:
        """
        Send formatted flood alert to user

        Args:
            chat_id: Telegram chat ID
            report: Report dictionary with keys: type, title, description,
                   province, district, trust_score, created_at, lat, lon
        """
        # Emoji mapping
        emoji_map = {
            "ALERT": "⚠️",
            "SOS": "🆘",
            "ROAD": "🚧",
            "NEEDS": "📦",
        }

        # Severity level
        trust = report.get("trust_score", 0)
        if trust >= 0.8:
            severity = "🔴 CẤP ĐỘ CAO"
        elif trust >= 0.5:
            severity = "🟡 CẤP ĐỘ TRUNG BÌNH"
        else:
            severity = "🟢 CẤP ĐỘ THẤP"

        emoji = emoji_map.get(report["type"], "📍")

        # Format message
        message = f"{emoji} <b>{report['type']}</b> {severity}\n\n"
        message += f"<b>{report['title']}</b>\n\n"

        if report.get("description"):
            desc = report["description"][:200]
            if len(report["description"]) > 200:
                desc += "..."
            message += f"{desc}\n\n"

        # Location info
        message += f"📍 <b>Vị trí:</b> {report.get('province', 'Không rõ')}"
        if report.get("district"):
            message += f", {report['district']}"
        message += "\n"

        # Trust score
        message += f"🔍 <b>Độ tin cậy:</b> {int(trust * 100)}%\n"

        # Source
        source = report.get("source", "UNKNOWN")
        source_name = {
            "KTTV": "Trung tâm Khí tượng Thủy văn",
            "NCHMF": "Trung tâm Khí tượng Thủy văn",
            "COMMUNITY": "Người dân",
            "PRESS": "Báo chí"
        }.get(source, source)
        message += f"📰 <b>Nguồn:</b> {source_name}\n"

        # Time
        created_at = report.get("created_at")
        if isinstance(created_at, str):
            time_str = created_at[:19]  # Remove timezone
        else:
            time_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        message += f"🕒 <b>Thời gian:</b> {time_str}\n"

        # Map link
        if report.get("lat") and report.get("lon"):
            map_url = f"https://nclam.site/map?lat={report['lat']}&lon={report['lon']}"
            message += f"\n🗺️ <a href='{map_url}'>Xem trên bản đồ</a>"

        return self.send_message(chat_id, message)

    def send_welcome(self, chat_id: int) -> bool:
        """Send welcome message to new user"""
        message = """
👋 <b>Chào mừng đến với Hệ thống Cảnh báo Thiên tai!</b>

🌊 Bot cảnh báo mưa lũ tự động cho Việt Nam

<b>Cách sử dụng:</b>
• Chọn tỉnh/thành muốn theo dõi
• Nhận cảnh báo tự động khi có mưa lớn, lũ lụt, sạt lở
• Xem bản đồ thời gian thực

<b>Độ tin cậy:</b>
🔴 Cao (>80%) - Từ cơ quan khí tượng
🟡 Trung bình (50-80%) - Từ báo chí
🟢 Thấp (<50%) - Từ người dân (cần xác minh)

Gõ /subscribe để đăng ký nhận cảnh báo!
        """
        return self.send_message(chat_id, message.strip())

    def send_provinces_list(self, chat_id: int) -> bool:
        """Send list of available provinces with usage examples"""
        provinces = [
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

        message = "<b>📍 Danh sách tỉnh/thành có thể đăng ký:</b>\n\n"
        for i, prov in enumerate(provinces, 1):
            message += f"{i}. {prov}\n"

        message += "\n<b>💡 Cách đăng ký:</b>\n"
        message += "Gõ: <code>/subscribe [Tên tỉnh]</code>\n\n"
        message += "<b>Ví dụ:</b>\n"
        message += "• <code>/subscribe Quảng Trị</code>\n"
        message += "• <code>/subscribe Da Nang</code> (không cần dấu)\n"
        message += "• <code>/subscribe Hue</code> (viết tắt cũng được)\n"

        return self.send_message(chat_id, message)

    def send_subscription_success(self, chat_id: int, province: str) -> bool:
        """Confirm subscription"""
        message = f"""
✅ <b>Đăng ký thành công!</b>

Bạn sẽ nhận cảnh báo tự động cho:
📍 <b>{province}</b>

Các loại cảnh báo:
• ⚠️ Mưa lớn, lũ lụt
• 🆘 Kêu gọi cứu trợ khẩn cấp
• 🚧 Đường bị ngập, sạt lở
• 📦 Thiếu thực phẩm, nhu yếu phẩm

Gõ /unsubscribe để hủy đăng ký
Gõ /status để xem trạng thái đăng ký
        """
        return self.send_message(chat_id, message.strip())

    def get_webhook_info(self) -> Optional[Dict]:
        """Get current webhook configuration"""
        if not self.token:
            return None

        url = f"{self.base_url}/getWebhookInfo"
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get webhook info: {e}")
            return None

    def set_webhook(self, webhook_url: str) -> bool:
        """Set webhook URL for bot"""
        if not self.token:
            logger.error("Cannot set webhook - bot token not configured")
            return False

        url = f"{self.base_url}/setWebhook"
        payload = {"url": webhook_url}

        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"✅ Webhook set to: {webhook_url}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to set webhook: {e}")
            return False

    def delete_webhook(self) -> bool:
        """Remove webhook (use for polling mode)"""
        if not self.token:
            return False

        url = f"{self.base_url}/deleteWebhook"
        try:
            response = requests.post(url, timeout=5)
            response.raise_for_status()
            logger.info("✅ Webhook deleted")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to delete webhook: {e}")
            return False


# Singleton instance
telegram_bot = TelegramBot()
