"""
Audio Generator Service
Generates audio from text and uploads to Cloudinary
"""

import os
from typing import Optional
from datetime import datetime
import cloudinary
import cloudinary.uploader
import structlog
from app.services.tts_client import get_tts_client
from app.database.models import Report

logger = structlog.get_logger(__name__)

# Initialize Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)


class AudioGenerator:
    """Service to generate and upload audio for reports"""

    def __init__(self):
        self.tts_client = get_tts_client()
        logger.info("audio_generator_initialized")

    def generate_audio_text(self, report: Report) -> str:
        """
        Generate text for audio from report

        Args:
            report: Report model instance

        Returns:
            Formatted text for TTS
        """
        # Build audio script
        parts = []

        # Title (main announcement)
        if report.title:
            parts.append(report.title)

        # Description (if available and not too long)
        if report.description and len(report.description) <= 500:
            parts.append(report.description)

        # Location
        if report.province:
            parts.append(f"Khu vực: {report.province}")

        # Join with pauses
        text = ". ".join(parts)

        # Limit total length (TTS has character limits)
        max_length = 1000
        if len(text) > max_length:
            text = text[:max_length] + "..."

        logger.info(
            "audio_text_generated",
            report_id=str(report.id),
            text_length=len(text)
        )

        return text

    def generate_audio_file(self, text: str, language: str = 'vi') -> bytes:
        """
        Generate audio file from text using TTS

        Args:
            text: Text to convert to speech
            language: Language code

        Returns:
            Audio bytes (MP3 format)
        """
        return self.tts_client.text_to_speech(text, language)

    def upload_audio_to_cloudinary(
        self,
        audio_bytes: bytes,
        public_id: str
    ) -> str:
        """
        Upload audio to Cloudinary

        Args:
            audio_bytes: Audio file bytes
            public_id: Public ID for the audio file (e.g., "audio/report_123")

        Returns:
            Cloudinary secure URL
        """
        try:
            logger.info(
                "uploading_audio_to_cloudinary",
                public_id=public_id,
                size_bytes=len(audio_bytes)
            )

            # Upload to Cloudinary
            result = cloudinary.uploader.upload(
                audio_bytes,
                resource_type="video",  # Cloudinary uses "video" for audio files
                public_id=public_id,
                format="mp3",
                folder="floodwatch/audio",
                overwrite=True
            )

            audio_url = result.get('secure_url')

            logger.info(
                "audio_uploaded_to_cloudinary",
                public_id=public_id,
                url=audio_url
            )

            return audio_url

        except Exception as e:
            logger.error(
                "cloudinary_upload_failed",
                error=str(e),
                public_id=public_id
            )
            raise

    def generate_and_upload_audio(
        self,
        report: Report,
        language: str = 'vi'
    ) -> tuple[str, datetime]:
        """
        Complete pipeline: Generate audio from report and upload to Cloudinary

        Args:
            report: Report model instance
            language: Language code

        Returns:
            Tuple of (audio_url, generated_at timestamp)
        """
        try:
            logger.info("generating_audio_for_report", report_id=str(report.id))

            # Step 1: Generate text from report
            text = self.generate_audio_text(report)

            if not text or len(text) < 10:
                logger.warning(
                    "insufficient_text_for_audio",
                    report_id=str(report.id),
                    text_length=len(text)
                )
                raise ValueError("Insufficient text content for audio generation")

            # Step 2: Generate audio file
            audio_bytes = self.generate_audio_file(text, language)

            if not audio_bytes or len(audio_bytes) < 1000:
                raise ValueError("Generated audio file is too small or empty")

            # Step 3: Upload to Cloudinary
            public_id = f"report_{report.id}"
            audio_url = self.upload_audio_to_cloudinary(audio_bytes, public_id)

            generated_at = datetime.utcnow()

            logger.info(
                "audio_generation_complete",
                report_id=str(report.id),
                audio_url=audio_url,
                audio_size_bytes=len(audio_bytes)
            )

            return audio_url, generated_at

        except Exception as e:
            logger.error(
                "audio_generation_failed",
                report_id=str(report.id),
                error=str(e)
            )
            raise

    def generate_bulletin_audio(
        self,
        summary_text: str,
        language: str = 'vi'
    ) -> tuple[str, datetime]:
        """
        Generate audio for AI news bulletin (single file, overwrites previous)

        Args:
            summary_text: AI-generated summary text
            language: Language code

        Returns:
            Tuple of (audio_url, generated_at timestamp)
        """
        try:
            logger.info(
                "generating_bulletin_audio",
                text_length=len(summary_text)
            )

            # Step 1: Validate text
            if not summary_text or len(summary_text) < 50:
                raise ValueError("Insufficient text for bulletin audio")

            # Step 2: Generate audio
            audio_bytes = self.generate_audio_file(summary_text, language)

            if not audio_bytes or len(audio_bytes) < 1000:
                raise ValueError("Generated audio is too small")

            # Step 3: Upload with fixed public_id (overwrites previous)
            public_id = "ai_news_bulletin_latest"  # Single file, always same ID
            audio_url = self.upload_audio_to_cloudinary(audio_bytes, public_id)

            generated_at = datetime.utcnow()

            logger.info(
                "bulletin_audio_generated",
                audio_url=audio_url,
                audio_size_bytes=len(audio_bytes),
                text_length=len(summary_text)
            )

            return audio_url, generated_at

        except Exception as e:
            logger.error("bulletin_audio_generation_failed", error=str(e))
            raise


# Singleton instance
_audio_generator_instance: Optional[AudioGenerator] = None


def get_audio_generator() -> AudioGenerator:
    """Get or create AudioGenerator singleton instance"""
    global _audio_generator_instance
    if _audio_generator_instance is None:
        _audio_generator_instance = AudioGenerator()
    return _audio_generator_instance
