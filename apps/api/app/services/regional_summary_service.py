"""
Regional Summary Service
Generates AI-powered summaries of disaster situations for specific provinces/regions
Uses OpenAI GPT to create comprehensive regional reports
"""

import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from difflib import SequenceMatcher
import openai
import structlog
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.models import Report, ReportType
from app.services.province_extractor import PROVINCES

logger = structlog.get_logger(__name__)

# Initialize OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')


class RegionalSummaryService:
    """AI-powered regional disaster summary service"""

    def __init__(self, model: str = "gpt-4o-mini"):
        """
        Initialize Regional Summary Service

        Args:
            model: OpenAI model to use (gpt-4o-mini, gpt-4o, gpt-4-turbo)
        """
        self.model = model or os.getenv('AI_SUMMARY_MODEL', 'gpt-4o-mini')
        self.max_tokens = 1000  # For detailed regional summaries
        logger.info("regional_summary_service_initialized", model=self.model)

    def normalize_province_name(self, query: str) -> Optional[str]:
        """
        Normalize province query to canonical name

        Args:
            query: User input (e.g., "da nang", "Đà Nẵng", "danang")

        Returns:
            Canonical province name or None if not found
        """
        query_lower = query.lower().strip()

        # Direct match on canonical names
        for province_name in PROVINCES.keys():
            if province_name.lower() == query_lower:
                return province_name

        # Match on variations
        for province_name, data in PROVINCES.items():
            for variation in data.get('variations', []):
                if variation.lower() == query_lower:
                    return province_name

        # Fuzzy match (similarity > 0.8)
        best_match = None
        best_score = 0.0

        for province_name in PROVINCES.keys():
            # Check canonical name
            score = SequenceMatcher(None, query_lower, province_name.lower()).ratio()
            if score > best_score:
                best_score = score
                best_match = province_name

            # Check variations
            for variation in PROVINCES[province_name].get('variations', []):
                score = SequenceMatcher(None, query_lower, variation.lower()).ratio()
                if score > best_score:
                    best_score = score
                    best_match = province_name

        if best_score >= 0.8:
            logger.info(
                "fuzzy_province_match",
                query=query,
                matched=best_match,
                score=best_score
            )
            return best_match

        logger.warning("province_not_found", query=query, best_score=best_score)
        return None

    def collect_regional_data(
        self,
        db: Session,
        province: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """
        Collect disaster data for specific province

        Args:
            db: Database session
            province: Canonical province name
            hours: Time window in hours

        Returns:
            Dictionary with reports, statistics, and metadata
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)

            # Get reports for this province
            reports = db.query(Report).filter(
                Report.province == province,
                Report.created_at >= cutoff_time
            ).order_by(
                Report.trust_score.desc(),
                Report.created_at.desc()
            ).all()

            # Calculate statistics
            total_reports = len(reports)

            stats_by_type = {}
            for report_type in ReportType:
                count = sum(1 for r in reports if r.type == report_type)
                if count > 0:
                    stats_by_type[report_type.value] = count

            # Calculate average trust score
            avg_trust = (
                sum(r.trust_score for r in reports) / total_reports
                if total_reports > 0
                else 0.0
            )

            # Get top 5 reports (high trust score, recent, varied types)
            top_reports = sorted(
                reports,
                key=lambda r: (r.trust_score, r.created_at),
                reverse=True
            )[:5]

            # Convert to serializable format
            top_reports_data = [
                {
                    'id': str(r.id),
                    'type': r.type.value,
                    'title': r.title,
                    'description': r.description[:200] if r.description else None,
                    'trust_score': r.trust_score,
                    'created_at': r.created_at.isoformat(),
                    'source': r.source
                }
                for r in top_reports
            ]

            logger.info(
                "regional_data_collected",
                province=province,
                reports_count=total_reports,
                time_window_hours=hours
            )

            return {
                'province': province,
                'total_reports': total_reports,
                'stats_by_type': stats_by_type,
                'avg_trust_score': avg_trust,
                'top_reports': top_reports_data,
                'time_range_hours': hours,
                'timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error("regional_data_collection_failed", error=str(e), province=province)
            return {
                'province': province,
                'total_reports': 0,
                'stats_by_type': {},
                'avg_trust_score': 0.0,
                'top_reports': [],
                'time_range_hours': hours,
                'timestamp': datetime.utcnow().isoformat()
            }

    def build_summary_prompt(self, data: Dict[str, Any]) -> str:
        """
        Build prompt for OpenAI to generate regional summary

        Args:
            data: Collected regional data

        Returns:
            Formatted prompt string
        """
        province = data['province']
        total = data['total_reports']
        stats = data['stats_by_type']
        hours = data['time_range_hours']
        top_reports = data['top_reports']

        # Build stats summary
        stats_text = "\n".join([f"- {type_}: {count}" for type_, count in stats.items()])

        # Build top incidents list
        incidents_text = "\n".join([
            f"{i+1}. [{r['type']}] {r['title']} "
            f"(Trust: {r['trust_score']:.0%}, {r['created_at'][:16]})"
            for i, r in enumerate(top_reports)
        ])

        prompt = f"""Bạn là hệ thống cảnh báo thiên tai FloodWatch cho người dân Việt Nam.

THÔNG TIN KHU VỰC:
Tỉnh/Thành phố: {province}
Thời gian: {hours} giờ qua (từ {hours}h trước đến hiện tại)

THỐNG KÊ:
Tổng số báo cáo: {total}
Phân loại theo loại:
{stats_text if stats_text else "Không có báo cáo"}

CÁC SỰ KIỆN CHÍNH:
{incidents_text if incidents_text else "Không có sự kiện đáng chú ý"}

NHIỆM VỤ:
Viết một bản tóm tắt tình hình thiên tai tại {province} trong {hours} giờ qua.

YÊU CẦU:
1. Độ dài: 3-6 đoạn văn (hoặc 6-8 bullet points)
2. Nội dung bao gồm:
   - Tình hình mưa/lũ/ngập (nếu có)
   - Nguy cơ hiện tại: thấp/trung bình/cao/rất cao
   - Khu vực cụ thể bị ảnh hưởng (quận/huyện/xã nếu có trong dữ liệu)
   - Khuyến nghị cho người dân (nếu tình hình nghiêm trọng)
3. Giọng điệu: Bình tĩnh, chuyên nghiệp, không giật gân
4. Nếu KHÔNG có báo cáo hoặc tình hình ổn định:
   - Nói rõ "FloodWatch chưa ghi nhận cảnh báo đáng kể"
   - Khuyên người dân vẫn theo dõi thông tin chính thức
5. Tránh thuật ngữ kỹ thuật phức tạp
6. Trả về JSON với cấu trúc:
   {{
     "summary_text": "Bản tóm tắt chính (markdown format)",
     "severity_level": "low/moderate/high/critical",
     "key_points": ["Điểm 1", "Điểm 2", ...],
     "recommendations": ["Khuyến nghị 1", "Khuyến nghị 2", ...]
   }}

Hãy tạo bản tóm tắt bây giờ."""

        return prompt

    def generate_summary(
        self,
        db: Session,
        province_query: str,
        hours: int = 24
    ) -> Optional[Dict[str, Any]]:
        """
        Generate AI regional summary for a province

        Args:
            db: Database session
            province_query: Province name (will be normalized)
            hours: Time window in hours (1-168)

        Returns:
            Summary dictionary with text, stats, top reports, etc.
        """
        try:
            logger.info(
                "generating_regional_summary",
                province_query=province_query,
                hours=hours
            )

            # Step 1: Normalize province name
            province = self.normalize_province_name(province_query)
            if not province:
                logger.warning("invalid_province_query", query=province_query)
                return None

            # Step 2: Collect regional data
            data = self.collect_regional_data(db, province, hours)

            # Step 3: If no data, return stable situation message
            if data['total_reports'] == 0:
                return self._generate_no_data_response(province, hours)

            # Step 4: Build prompt
            prompt = self.build_summary_prompt(data)

            # Step 5: Call OpenAI
            response = openai.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Bạn là AI chuyên viên cảnh báo thiên tai cho người dân Việt Nam. "
                            "Nhiệm vụ: tạo bản tóm tắt tình hình khu vực, "
                            "chuyên nghiệp, bình tĩnh, dễ hiểu."
                        )
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

            # Step 6: Parse AI response
            content = response.choices[0].message.content
            ai_summary = json.loads(content)

            # Step 7: Build final response
            result = {
                'province': province,
                'summary_text': ai_summary.get('summary_text', ''),
                'severity_level': ai_summary.get('severity_level', 'unknown'),
                'key_points': ai_summary.get('key_points', []),
                'recommendations': ai_summary.get('recommendations', []),
                'time_range': f"{hours} hours",
                'statistics': {
                    'total_reports': data['total_reports'],
                    'by_type': data['stats_by_type'],
                    'avg_trust_score': round(data['avg_trust_score'], 2)
                },
                'top_reports': data['top_reports'],
                'generated_at': datetime.utcnow().isoformat()
            }

            logger.info(
                "regional_summary_generated",
                province=province,
                severity=result['severity_level'],
                reports_count=data['total_reports']
            )

            return result

        except json.JSONDecodeError as e:
            logger.error("ai_summary_json_parse_failed", error=str(e))
            # Fallback to template response
            return self._generate_fallback_response(data, province, hours)
        except Exception as e:
            logger.error("regional_summary_generation_failed", error=str(e))
            return None

    def _generate_no_data_response(
        self,
        province: str,
        hours: int
    ) -> Dict[str, Any]:
        """
        Generate response when no reports are available

        Args:
            province: Province name
            hours: Time window

        Returns:
            Standard response dictionary
        """
        return {
            'province': province,
            'summary_text': (
                f"Trong {hours} giờ qua, FloodWatch chưa ghi nhận cảnh báo mưa lũ "
                f"hoặc ngập lụt đáng kể tại **{province}** từ các nguồn chính thống "
                f"(KTTV, PCTT, báo chí).\n\n"
                f"Tuy nhiên, bạn vẫn nên:\n"
                f"- Theo dõi dự báo thời tiết địa phương\n"
                f"- Kiểm tra các kênh thông tin chính thức tại tỉnh\n"
                f"- Chuẩn bị sẵn sàng ứng phó nếu tình hình thay đổi"
            ),
            'severity_level': 'low',
            'key_points': [
                f"Không có cảnh báo đáng kể trong {hours}h qua",
                "Tình hình ổn định",
                "Tiếp tục theo dõi thông tin"
            ],
            'recommendations': [
                "Theo dõi dự báo thời tiết",
                "Chuẩn bị ứng phó phòng ngừa"
            ],
            'time_range': f"{hours} hours",
            'statistics': {
                'total_reports': 0,
                'by_type': {},
                'avg_trust_score': 0.0
            },
            'top_reports': [],
            'generated_at': datetime.utcnow().isoformat()
        }

    def _generate_fallback_response(
        self,
        data: Dict[str, Any],
        province: str,
        hours: int
    ) -> Dict[str, Any]:
        """
        Generate fallback response when AI fails

        Args:
            data: Collected regional data
            province: Province name
            hours: Time window

        Returns:
            Template-based response dictionary
        """
        total = data['total_reports']
        stats = data['stats_by_type']

        # Build simple template
        stats_text = ", ".join([f"{count} {type_}" for type_, count in stats.items()])

        summary = (
            f"Trong {hours} giờ qua, FloodWatch ghi nhận **{total} báo cáo** "
            f"về tình hình thiên tai tại {province}.\n\n"
            f"**Phân loại:** {stats_text if stats_text else 'Đa dạng'}.\n\n"
            f"Vui lòng xem danh sách chi tiết các báo cáo bên dưới để cập nhật "
            f"tình hình cụ thể."
        )

        return {
            'province': province,
            'summary_text': summary,
            'severity_level': 'moderate' if total > 5 else 'low',
            'key_points': [f"{total} báo cáo được ghi nhận"],
            'recommendations': ["Xem chi tiết các báo cáo"],
            'time_range': f"{hours} hours",
            'statistics': {
                'total_reports': total,
                'by_type': stats,
                'avg_trust_score': round(data['avg_trust_score'], 2)
            },
            'top_reports': data['top_reports'],
            'generated_at': datetime.utcnow().isoformat()
        }


# Singleton instance
_service_instance = None


def get_regional_summary_service() -> RegionalSummaryService:
    """Get singleton instance of RegionalSummaryService"""
    global _service_instance
    if _service_instance is None:
        _service_instance = RegionalSummaryService()
    return _service_instance
