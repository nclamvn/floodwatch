"""
AI News Summary Engine
Synthesizes disaster news from multiple sources into coherent 1-minute bulletin
Uses OpenAI GPT to generate professional news summary
"""

import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import pytz
import openai
import structlog
from sqlalchemy.orm import Session
from app.database.models import Report, ReportType

logger = structlog.get_logger(__name__)

# Initialize OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')


def format_vietnamese_time() -> str:
    """Format current time in Vietnamese style (sáng/trưa/chiều/tối/khuya)"""
    vn_tz = pytz.timezone('Asia/Ho_Chi_Minh')
    now = datetime.now(vn_tz)
    hour = now.hour

    # Determine period based on Vietnamese time conventions
    if 5 <= hour < 11:
        period = "sáng"
    elif 11 <= hour < 13:
        period = "trưa"
    elif 13 <= hour < 18:
        period = "chiều"
    elif 18 <= hour < 22:
        period = "tối"
    else:
        period = "khuya"

    # Convert to 12-hour format
    display_hour = hour % 12 or 12
    return f"{display_hour} giờ {period}"


class AINewsSummaryEngine:
    """AI-powered news summarization engine for disaster information"""

    def __init__(self, model: str = "gpt-4o-mini"):
        """
        Initialize AI News Summary Engine

        Args:
            model: OpenAI model to use (gpt-4o-mini, gpt-4o, gpt-4-turbo)
        """
        self.model = model or os.getenv('AI_NEWS_MODEL', 'gpt-4o-mini')
        self.max_tokens = 800  # For ~200 words output
        logger.info("ai_news_summary_engine_initialized", model=self.model)

    def collect_recent_data(
        self,
        db: Session,
        minutes: int = 10
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Collect recent disaster data from database

        Args:
            db: Database session
            minutes: Time window in minutes

        Returns:
            Dictionary with reports, forecasts, hazards
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)

            # Get recent high-priority reports (disaster types only)
            reports = db.query(Report).filter(
                Report.created_at >= cutoff_time,
                Report.type.in_([ReportType.ALERT, ReportType.SOS, ReportType.RAIN]),
                Report.trust_score >= 0.6
            ).order_by(
                Report.trust_score.desc(),
                Report.created_at.desc()
            ).limit(30).all()

            # Convert to dict for JSON serialization
            reports_data = [
                {
                    'type': r.type.value,
                    'title': r.title,
                    'description': r.description[:200] if r.description else None,
                    'province': r.province,
                    'trust_score': r.trust_score,
                    'created_at': r.created_at.isoformat()
                }
                for r in reports
            ]

            logger.info(
                "data_collected",
                reports_count=len(reports_data),
                time_window_minutes=minutes
            )

            return {
                'reports': reports_data,
                'timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error("data_collection_failed", error=str(e))
            return {'reports': [], 'timestamp': datetime.utcnow().isoformat()}

    def build_summary_prompt(self, data: Dict[str, Any]) -> str:
        """
        Build prompt for OpenAI to generate news summary

        Args:
            data: Collected data dictionary

        Returns:
            Formatted prompt string
        """
        reports = data.get('reports', [])
        reports_count = len(reports)

        # Group by province for better context
        provinces = {}
        for r in reports:
            prov = r.get('province', 'Unknown')
            if prov not in provinces:
                provinces[prov] = []
            provinces[prov].append(r)

        # Build prompt
        prompt = f"""Bạn là hệ thống AI tạo bản tin thiên tai cho người dân Việt Nam.
Nhiệm vụ: Tạo bản tin âm thanh ĐẦY ĐỦ 1 PHÚT (60 giây) từ dữ liệu thời gian thực.

⚠️ YÊU CẦU BẮT BUỘC VỀ ĐỘ DÀI:
- TUYỆT ĐỐI: Bản tin PHẢI có từ 200-250 TỪ để đủ 60 giây khi đọc
- KHÔNG được viết ngắn hơn 200 từ dù cho dữ liệu ít
- Nếu thiếu tin thiên tai: mở rộng phần khuyến nghị, dự báo thời tiết, lời nhắc an toàn

NGUYÊN TẮC QUAN TRỌNG:
- Giọng điệu: Bình tĩnh, rõ ràng, không gây hoảng loạn
- Ngôn ngữ: Tiếng Việt đơn giản, dễ hiểu
- Cấu trúc: Mở đầu → Tình hình → Khuyến nghị → Kết thúc
- QUAN TRỌNG: BẮT ĐẦU bản tin bằng "Bản tin lúc {{current_time}}"
- CHỈ BÁO CÁO THIÊN TAI: Bỏ qua tin về bạo lực, tai nạn giao thông, chính trị, kinh tế

DỮ LIỆU ĐẦU VÀO (60 phút gần nhất):
Số lượng báo cáo: {reports_count}

"""

        # Add reports by province
        if provinces:
            prompt += "TÌNH HÌNH THEO KHU VỰC:\n"
            for prov, prov_reports in list(provinces.items())[:5]:  # Top 5 provinces
                prompt += f"\n{prov}: {len(prov_reports)} báo cáo\n"
                for r in prov_reports[:2]:  # Top 2 per province
                    prompt += f"  - {r.get('type')}: {r.get('title')[:100]}\n"

        prompt += """

YÊU CẦU BẢN TIN (TỔNG 200-250 TỪ - BẮT BUỘC):

1. MỞ ĐẦU (15-20 từ):
   - BẮT ĐẦU BẰNG: "Bản tin lúc {{current_time}}"
   - Sau đó: Tình hình tổng quan

2. CHI TIẾT (120-150 từ):
   - CHỈ báo cáo THIÊN TAI: mưa, lũ, bão, sạt lở, ngập lụt, hạn hán
   - BỎ QUA: tai nạn giao thông, bạo lực, chính trị, kinh tế, logistics
   - Khu vực đang có tình huống thiên tai
   - Mức độ nghiêm trọng, số liệu cụ thể (lượng mưa, mực nước, diện tích ngập)
   - Dự báo thời tiết, xu hướng diễn biến
   - Nếu thiếu tin: mở rộng dự báo thời tiết, lịch sử thiên tai gần đây

3. KHUYẾN NGHỊ (50-60 từ):
   - Hành động cụ thể cho người dân
   - Lưu ý an toàn chi tiết
   - Chuẩn bị đồ dùng thiết yếu
   - Theo dõi cập nhật từ cơ quan chức năng
   - Số điện thoại khẩn cấp nếu cần

4. KẾT THÚC (15-20 từ):
   - Lời kết chuyên nghiệp, trấn an
   - Nhắc nhở cập nhật lần sau
   - Chúc an toàn

ĐỊNH DẠNG OUTPUT:
Trả về JSON với cấu trúc sau:
```json
{{
  "title": "Bản tin cập nhật mới nhất",
  "summary_text": "Văn bản bản tin đầy đủ 200-250 TỪ (BẮT BUỘC)...",
  "priority_level": "low/medium/high/critical",
  "regions_affected": ["Miền Bắc", "Miền Trung", "Miền Nam"],
  "key_points": [
    "Điểm chính 1 về thiên tai",
    "Điểm chính 2 về thiên tai",
    "Điểm chính 3 về thiên tai"
  ],
  "recommended_actions": [
    "Khuyến nghị an toàn chi tiết 1",
    "Khuyến nghị an toàn chi tiết 2",
    "Khuyến nghị an toàn chi tiết 3"
  ]
}}
```

⚠️ LƯU Ý BẮT BUỘC:
- summary_text PHẢI có ít nhất 200 từ, tốt nhất 220-250 từ để đủ 60 giây
- CHỈ báo cáo thiên tai thực sự (mưa, lũ, bão, sạt lở, ngập, hạn hán)
- BỎ QUA hoàn toàn: tai nạn giao thông, bạo lực gia đình, chính trị, kinh tế
- Nếu ít tin nghiêm trọng: mở rộng dự báo thời tiết, khuyến nghị phòng tránh chi tiết
- Luôn kết thúc bằng lời trấn an và khuyên an toàn
- Tránh thuật ngữ kỹ thuật phức tạp

Hãy tạo bản tin ĐẦY ĐỦ 200-250 từ bây giờ."""

        # Inject current time into prompt
        current_time = format_vietnamese_time()
        return prompt.format(current_time=current_time)

    def generate_summary(
        self,
        db: Session,
        minutes: int = 10
    ) -> Optional[Dict[str, Any]]:
        """
        Generate AI news summary from recent data

        Args:
            db: Database session
            minutes: Time window for data collection

        Returns:
            Summary dictionary with text, metadata, etc.
        """
        try:
            logger.info("generating_ai_summary", time_window_minutes=minutes)

            # Step 1: Collect data
            data = self.collect_recent_data(db, minutes)

            if not data['reports']:
                logger.warning("no_recent_data_for_summary")
                # Generate "stable situation" bulletin
                return self._generate_stable_situation_bulletin()

            # Step 2: Build prompt
            prompt = self.build_summary_prompt(data)

            # Step 3: Call OpenAI
            response = openai.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn là AI chuyên viên tin thiên tai cho người dân Việt Nam. Nhiệm vụ: tạo bản tin âm thanh chuyên nghiệp, bình tĩnh, dễ hiểu."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=self.max_tokens,
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            # Step 4: Parse response
            content = response.choices[0].message.content
            summary = json.loads(content)

            logger.info(
                "ai_summary_generated",
                title=summary.get('title'),
                text_length=len(summary.get('summary_text', '')),
                priority=summary.get('priority_level')
            )

            return summary

        except json.JSONDecodeError as e:
            logger.error("ai_summary_json_parse_failed", error=str(e))
            return None
        except Exception as e:
            logger.error("ai_summary_generation_failed", error=str(e))
            return None

    def generate_article_summary(
        self,
        title: str,
        source_url: str
    ) -> Optional[str]:
        """
        Generate AI summary for an article that has no description.
        Uses title and attempts to generate context-aware summary.

        Args:
            title: Article title
            source_url: Source URL of the article

        Returns:
            Generated summary text or None if failed
        """
        try:
            logger.info("generating_article_summary", title=title[:50])

            prompt = f"""Dựa trên tiêu đề tin tức này, hãy tạo một đoạn tóm tắt ngắn gọn (2-3 câu) về nội dung có thể của bài báo:

Tiêu đề: {title}
Nguồn: {source_url}

YÊU CẦU:
- Viết 2-3 câu tóm tắt nội dung chính dựa trên tiêu đề
- Sử dụng ngôn ngữ tự nhiên, dễ hiểu
- Nếu liên quan đến thiên tai: nêu rõ khu vực, mức độ nghiêm trọng
- Tránh thông tin sai lệch, chỉ suy luận hợp lý từ tiêu đề
- KHÔNG viết "Bài báo này...", chỉ viết nội dung trực tiếp

Hãy tạo tóm tắt bây giờ (CHỈ trả về text tóm tắt, không format)."""

            response = openai.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn là AI trợ lý tóm tắt tin tức thiên tai cho người dân Việt Nam. Viết ngắn gọn, chính xác, dễ hiểu."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=200,  # Short summary
                temperature=0.7
            )

            summary = response.choices[0].message.content.strip()

            logger.info("article_summary_generated", summary_length=len(summary))
            return summary

        except Exception as e:
            logger.error("article_summary_generation_failed", error=str(e), title=title[:50])
            return None

    def _generate_stable_situation_bulletin(self) -> Dict[str, Any]:
        """
        Generate bulletin for when no significant events are happening

        Returns:
            Stable situation bulletin dictionary
        """
        current_time = format_vietnamese_time()
        return {
            "title": "Bản tin cập nhật mới nhất",
            "summary_text": (
                f"Bản tin lúc {current_time}. "
                "Hiện tại tình hình cả nước đang ổn định, không có cảnh báo thiên tai nghiêm trọng. "
                "Một số khu vực có mưa nhẹ đến vừa, không ảnh hưởng đến giao thông và sinh hoạt. "
                "Người dân vui lòng theo dõi các bản tin cập nhật tiếp theo. "
                "Mọi thông tin chi tiết có thể theo dõi qua hệ thống cảnh báo. "
                "Chúc quý vị một ngày an toàn."
            ),
            "priority_level": "low",
            "regions_affected": [],
            "key_points": [
                "Tình hình ổn định",
                "Không có cảnh báo nghiêm trọng",
                "Theo dõi cập nhật thường xuyên"
            ],
            "recommended_actions": [
                "Tiếp tục theo dõi tin tức",
                "Chuẩn bị sẵn sàng cho mọi tình huống"
            ]
        }


# Singleton instance
_engine_instance: Optional[AINewsSummaryEngine] = None


def get_news_summary_engine() -> AINewsSummaryEngine:
    """Get or create AINewsSummaryEngine singleton instance"""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = AINewsSummaryEngine()
    return _engine_instance
