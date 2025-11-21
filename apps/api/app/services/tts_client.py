"""
Text-to-Speech Client Service
Converts text to audio using OpenAI TTS (primary) with gTTS fallback
Supports alternating male/female voices for variety
"""

import os
import json
from pathlib import Path
from typing import Optional
import openai
import structlog

logger = structlog.get_logger(__name__)

# Voice alternation config
MALE_VOICE = "onyx"  # Deep, authoritative, trustworthy
FEMALE_VOICE = "nova"  # Clear, energetic, professional
STATE_FILE = Path("/tmp/floodwatch_tts_state.json")


def get_next_voice() -> str:
    """
    Get next voice for alternating male/female narration

    Returns:
        Voice name (onyx or nova)
    """
    try:
        # Read last used voice
        if STATE_FILE.exists():
            with open(STATE_FILE, 'r') as f:
                state = json.load(f)
                last_voice = state.get('last_voice', FEMALE_VOICE)
        else:
            last_voice = FEMALE_VOICE  # Default to female first

        # Alternate
        next_voice = MALE_VOICE if last_voice == FEMALE_VOICE else FEMALE_VOICE

        # Save new state
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(STATE_FILE, 'w') as f:
            json.dump({'last_voice': next_voice}, f)

        logger.info(
            "voice_alternated",
            previous=last_voice,
            next=next_voice,
            gender="male" if next_voice == MALE_VOICE else "female"
        )

        return next_voice

    except Exception as e:
        logger.warning("voice_alternation_failed", error=str(e), fallback=MALE_VOICE)
        return MALE_VOICE  # Fallback to male voice


class TTSClient:
    """Base TTS Client interface"""

    def text_to_speech(self, text: str, language: str = 'vi') -> bytes:
        """Convert text to speech audio bytes"""
        raise NotImplementedError


class OpenAITTSClient(TTSClient):
    """OpenAI Text-to-Speech (recommended for FloodWatch)"""

    def __init__(self, voice: str = 'alloy', use_alternating_voices: bool = False):
        """
        Initialize OpenAI TTS client

        Args:
            voice: Fixed voice to use (if use_alternating_voices=False)
                   Options: alloy, echo, fable, onyx, nova, shimmer
            use_alternating_voices: If True, alternates between male (onyx) and female (nova)
                                   for variety in news bulletins
        """
        self.fixed_voice = voice
        self.use_alternating_voices = use_alternating_voices
        self.model = "tts-1"  # or "tts-1-hd" for higher quality

        mode = "alternating (male/female)" if use_alternating_voices else f"fixed ({voice})"
        logger.info("openai_tts_initialized", mode=mode, model=self.model)

    def text_to_speech(self, text: str, language: str = 'vi') -> bytes:
        """
        Convert text to speech using OpenAI TTS

        Args:
            text: Text to convert to speech
            language: Language code (not used, OpenAI auto-detects)

        Returns:
            Audio bytes (MP3 format)
        """
        try:
            # Determine which voice to use
            if self.use_alternating_voices:
                voice = get_next_voice()  # Alternates between male/female
            else:
                voice = self.fixed_voice

            logger.info(
                "generating_openai_tts_audio",
                text_length=len(text),
                voice=voice,
                mode="alternating" if self.use_alternating_voices else "fixed"
            )

            # Call OpenAI TTS API
            response = openai.audio.speech.create(
                model=self.model,
                voice=voice,
                input=text,
                response_format="mp3"
            )

            # Get audio bytes
            audio_bytes = response.read()

            logger.info(
                "openai_tts_audio_generated",
                audio_size_bytes=len(audio_bytes),
                text_length=len(text),
                voice_used=voice
            )

            return audio_bytes

        except Exception as e:
            logger.error("openai_tts_generation_failed", error=str(e), text_preview=text[:50])
            raise


class GttsTTSClient(TTSClient):
    """Google Text-to-Speech using gTTS (free fallback, lower quality)"""

    def __init__(self):
        self.language = 'vi'  # Vietnamese
        logger.info("gtts_fallback_client_initialized", language=self.language)

    def text_to_speech(self, text: str, language: str = 'vi') -> bytes:
        """
        Convert text to speech using gTTS (fallback only)

        Args:
            text: Text to convert to speech
            language: Language code (vi, en, etc.)

        Returns:
            Audio bytes (MP3 format)
        """
        try:
            import tempfile
            from gtts import gTTS

            logger.info("generating_gtts_audio_fallback", text_length=len(text))

            # Create gTTS object
            tts = gTTS(text=text, lang=language, slow=False)

            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
                tts.save(tmp_file.name)
                tmp_file_path = tmp_file.name

            # Read audio bytes
            with open(tmp_file_path, 'rb') as audio_file:
                audio_bytes = audio_file.read()

            # Clean up
            os.unlink(tmp_file_path)

            logger.info(
                "gtts_audio_generated",
                audio_size_bytes=len(audio_bytes)
            )

            return audio_bytes

        except Exception as e:
            logger.error("gtts_generation_failed", error=str(e))
            raise


def get_tts_client() -> TTSClient:
    """
    Get TTS client based on environment configuration

    Priority:
    1. OpenAI TTS (if OPENAI_API_KEY available) - RECOMMENDED
       - By default: alternates between male (onyx) and female (nova) voices
       - Set TTS_ALTERNATING_VOICES=false to use fixed voice
    2. gTTS (free fallback)

    Returns:
        TTSClient instance
    """
    # Check if OpenAI API key is available
    openai_key = os.getenv('OPENAI_API_KEY')

    if openai_key:
        try:
            # Check if alternating voices is enabled (default: True)
            use_alternating = os.getenv('TTS_ALTERNATING_VOICES', 'true').lower() == 'true'

            logger.info(
                "using_openai_tts",
                alternating_voices=use_alternating
            )

            if use_alternating:
                # Alternate between male (onyx) and female (nova)
                return OpenAITTSClient(use_alternating_voices=True)
            else:
                # Use fixed voice from env or default to 'alloy'
                fixed_voice = os.getenv('TTS_VOICE', 'alloy')
                return OpenAITTSClient(voice=fixed_voice, use_alternating_voices=False)

        except Exception as e:
            logger.warning(
                "openai_tts_failed_fallback_to_gtts",
                error=str(e)
            )

    # Fallback to gTTS (free but lower quality)
    logger.warning("using_gtts_fallback", message="OpenAI API key not found, using free gTTS (lower quality)")
    return GttsTTSClient()
