"""
AI News Summary Engine
Synthesizes disaster news from multiple sources into coherent 1-minute bulletin
Uses OpenAI GPT to generate professional news summary
"""

import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import openai
import structlog
from sqlalchemy.orm import Session
from app.database.models import Report, ReportType

logger = structlog.get_logger(__name__)

# Initialize OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')


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
Nhiệm vụ: Tạo bản tin âm thanh 1 phút (45-60 giây) từ dữ liệu thời gian thực.

NGUYÊN TẮC QUAN TRỌNG:
- Giọng điệu: Bình tĩnh, rõ ràng, không gây hoảng loạn
- Ngôn ngữ: Tiếng Việt đơn giản, dễ hiểu
- Độ dài: 150-200 từ (khi đọc mất 45-60 giây)
- Cấu trúc: Mở đầu → Tình hình → Khuyến nghị

DỮ LIỆU ĐẦU VÀO (10 phút gần nhất):
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

YÊU CẦU BẢN TIN:

1. MỞ ĐẦU (10-15 từ):
   - Thời điểm hiện tại
   - Tình hình tổng quan

2. CHI TIẾT (80-100 từ):
   - Khu vực nào đang có tình huống đáng chú ý
   - Mức độ nghiêm trọng (nếu có)
   - Số liệu cụ thể (nếu có: lượng mưa, mực nước, diện tích ngập)

3. KHUYẾN NGHỊ (30-40 từ):
   - Hành động cụ thể cho người dân
   - Lưu ý an toàn
   - Theo dõi cập nhật

4. KẾT THÚC (10-15 từ):
   - Lời kết chuyên nghiệp
   - Cập nhật lần sau

ĐỊNH DẠNG OUTPUT:
Trả về JSON với cấu trúc sau:
```json
{
  "title": "Bản tin 1 phút - [Thời gian]",
  "summary_text": "Văn bản bản tin đầy đủ 150-200 từ...",
  "priority_level": "low/medium/high/critical",
  "regions_affected": ["Miền Bắc", "Miền Trung", "Miền Nam"],
  "key_points": [
    "Điểm chính 1",
    "Điểm chính 2",
    "Điểm chính 3"
  ],
  "recommended_actions": [
    "Khuyến nghị 1",
    "Khuyến nghị 2"
  ]
}
```

LƯU Ý QUAN TRỌNG:
- Nếu KHÔNG có tin nghiêm trọng → Báo cáo "Tình hình ổn định"
- Nếu có cảnh báo → Nhấn mạnh khu vực và thời gian
- Luôn kết thúc bằng lời khuyên an toàn
- Tránh thuật ngữ kỹ thuật phức tạp

Hãy tạo bản tin bây giờ."""

        return prompt

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

    def _generate_stable_situation_bulletin(self) -> Dict[str, Any]:
        """
        Generate bulletin for when no significant events are happening

        Returns:
            Stable situation bulletin dictionary
        """
        current_time = datetime.utcnow()
        time_str = current_time.strftime("%H:%M")

        return {
            "title": f"Bản tin 1 phút - {time_str}",
            "summary_text": (
                f"Đây là bản tin cảnh báo thiên tai lúc {time_str}. "
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
