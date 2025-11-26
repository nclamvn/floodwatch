"""
Ingestion Scheduler Service

Automatically runs data ingestion scrapers on a schedule using APScheduler.
Also runs cleanup jobs for dead URLs and old reports.
"""

import os
import sys
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import structlog

# Add scripts directory to path for imports
SCRIPTS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../scripts/ingest'))
sys.path.insert(0, SCRIPTS_PATH)

logger = structlog.get_logger(__name__)

# Import cleanup services
from app.services.url_health_checker import check_dead_urls
from app.services.report_cleanup import cleanup_old_reports
from app.services.routes_sync_service import RoutesSyncService

# Scheduler instance (singleton)
scheduler = None


def run_vnexpress_scraper():
    """Run VnExpress RSS scraper."""
    try:
        logger.info("ingestion_job_started", source="vnexpress")
        from scrape_vnexpress_rss import scrape_vnexpress_rss

        count = scrape_vnexpress_rss(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="vnexpress",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="vnexpress",
            error=str(e),
            exc_info=True
        )
        return 0


def run_kttv_scraper():
    """Run KTTV HTML scraper."""
    try:
        logger.info("ingestion_job_started", source="kttv")
        from scrape_kttv import scrape_kttv

        count = scrape_kttv(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="kttv",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="kttv",
            error=str(e),
            exc_info=True
        )
        return 0


def run_tuoitre_scraper():
    """Run Tuổi Trẻ RSS scraper."""
    try:
        logger.info("ingestion_job_started", source="tuoitre")
        from scrape_tuoitre_rss import scrape_tuoitre_rss

        count = scrape_tuoitre_rss(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="tuoitre",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="tuoitre",
            error=str(e),
            exc_info=True
        )
        return 0


def run_thanhnien_scraper():
    """Run Thanh Niên RSS scraper."""
    try:
        logger.info("ingestion_job_started", source="thanhnien")
        from scrape_thanhnien_rss import scrape_thanhnien_rss

        count = scrape_thanhnien_rss(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="thanhnien",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="thanhnien",
            error=str(e),
            exc_info=True
        )
        return 0


def run_pctt_scraper():
    """Run PCTT HTML scraper."""
    try:
        logger.info("ingestion_job_started", source="pctt")
        from scrape_pctt import scrape_pctt

        count = scrape_pctt(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="pctt",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="pctt",
            error=str(e),
            exc_info=True
        )
        return 0


def run_baomoi_scraper():
    """Run Baomoi HTML scraper."""
    try:
        logger.info("ingestion_job_started", source="baomoi")
        from scrape_baomoi import scrape_baomoi

        count = scrape_baomoi(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="baomoi",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="baomoi",
            error=str(e),
            exc_info=True
        )
        return 0


def run_vtc_scraper():
    """Run VTC RSS scraper."""
    try:
        logger.info("ingestion_job_started", source="vtc")
        from scrape_vtc import scrape_vtc_rss

        count = scrape_vtc_rss(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="vtc",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="vtc",
            error=str(e),
            exc_info=True
        )
        return 0


def run_chinhphu_scraper():
    """Run Chinhphu.vn government portal scraper."""
    try:
        logger.info("ingestion_job_started", source="chinhphu")
        from scrape_chinhphu import scrape_chinhphu

        count = scrape_chinhphu(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="chinhphu",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="chinhphu",
            error=str(e),
            exc_info=True
        )
        return 0


def run_dantri_scraper():
    """Run Dantri RSS scraper."""
    try:
        logger.info("ingestion_job_started", source="dantri")
        from scrape_dantri_rss import scrape_dantri_rss

        count = scrape_dantri_rss(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="dantri",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="dantri",
            error=str(e),
            exc_info=True
        )
        return 0


def run_vietnamnet_scraper():
    """Run VietnamNet RSS scraper."""
    try:
        logger.info("ingestion_job_started", source="vietnamnet")
        from scrape_vietnamnet_rss import scrape_vietnamnet_rss

        count = scrape_vietnamnet_rss(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="vietnamnet",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="vietnamnet",
            error=str(e),
            exc_info=True
        )
        return 0


def run_zing_scraper():
    """Run Zing News RSS scraper."""
    try:
        logger.info("ingestion_job_started", source="zing")
        from scrape_zing_rss import scrape_zing_rss

        count = scrape_zing_rss(dry_run=False)

        logger.info(
            "ingestion_job_completed",
            source="zing",
            reports_created=count,
            status="success"
        )

        return count

    except Exception as e:
        logger.error(
            "ingestion_job_failed",
            source="zing",
            error=str(e),
            exc_info=True
        )
        return 0


def run_routes_sync():
    """
    Run Routes sync - sync traffic-related Reports to RoadSegments.
    This ensures /routes has data with source_url for verification.
    """
    try:
        logger.info("routes_sync_job_started")

        # Import here to avoid circular imports
        from app.database import get_db

        # Get database session
        db = next(get_db())

        try:
            stats = RoutesSyncService.sync_reports_to_segments(
                db=db,
                hours=72,  # Last 3 days
                limit=500,
                dry_run=False
            )

            logger.info(
                "routes_sync_job_completed",
                reports_checked=stats['total_reports_checked'],
                road_related=stats['road_related_found'],
                segments_created=stats['segments_created'],
                segments_updated=stats['segments_updated'],
                status="success"
            )

            return stats

        finally:
            db.close()

    except Exception as e:
        logger.error(
            "routes_sync_job_failed",
            error=str(e),
            exc_info=True
        )
        return None


def run_ai_news_bulletin():
    """Run AI News Bulletin generation (summary + audio)."""
    try:
        logger.info("ai_news_bulletin_job_started")

        # Import here to avoid circular imports
        from app.database import get_db
        from app.services.news_summary_engine import get_news_summary_engine
        from app.services.audio_generator import get_audio_generator

        # Get database session
        db = next(get_db())

        try:
            # Get services
            summary_engine = get_news_summary_engine()
            audio_generator = get_audio_generator()

            # Generate summary from last 60 minutes of data
            # Note: Matches the data window used in API endpoint
            summary = summary_engine.generate_summary(db, minutes=60)

            if not summary:
                logger.warning("ai_news_bulletin_no_summary", message="No summary generated")
                return False

            # Generate and upload audio
            summary_text = summary.get('summary_text', '')
            audio_url, generated_at = audio_generator.generate_bulletin_audio(
                summary_text=summary_text,
                language='vi'
            )

            logger.info(
                "ai_news_bulletin_job_completed",
                audio_url=audio_url,
                priority=summary.get('priority_level'),
                status="success"
            )

            return True

        finally:
            db.close()

    except Exception as e:
        logger.error(
            "ai_news_bulletin_job_failed",
            error=str(e),
            exc_info=True
        )
        return False


def start_scheduler():
    """
    Start the APScheduler for automated ingestion.

    Schedule:
    - VnExpress RSS: Every 30 minutes
    - Tuổi Trẻ RSS: Every 30 minutes
    - Thanh Niên RSS: Every 30 minutes
    - VTC News RSS: Every 30 minutes
    - Dantri RSS: Every 30 minutes
    - VietnamNet RSS: Every 30 minutes
    - Zing News RSS: Every 30 minutes
    - Baomoi HTML: Every 45 minutes
    - KTTV HTML: Every 60 minutes
    - PCTT HTML: Every 120 minutes (2 hours - less frequent government updates)
    - AI News Bulletin: Every 15 minutes (only 5:00-23:59)
    """
    global scheduler

    if scheduler is not None:
        logger.warning("scheduler_already_running", message="Scheduler is already running")
        return scheduler

    # Create scheduler
    scheduler = AsyncIOScheduler(timezone='Asia/Ho_Chi_Minh')

    # Add jobs
    # VnExpress: Run every 30 minutes
    scheduler.add_job(
        run_vnexpress_scraper,
        trigger='interval',
        minutes=30,
        id='scraper_vnexpress',
        name='VnExpress RSS Scraper',
        replace_existing=True,
        max_instances=1,  # Prevent overlapping runs
        misfire_grace_time=300  # 5 minutes grace period
    )

    # Tuổi Trẻ: Run every 30 minutes (offset by 10 min to avoid collision)
    scheduler.add_job(
        run_tuoitre_scraper,
        trigger='interval',
        minutes=30,
        id='scraper_tuoitre',
        name='Tuổi Trẻ RSS Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300,
        next_run_time=datetime.now()  # Start offset
    )

    # Thanh Niên: Run every 30 minutes (offset by 20 min)
    scheduler.add_job(
        run_thanhnien_scraper,
        trigger='interval',
        minutes=30,
        id='scraper_thanhnien',
        name='Thanh Niên RSS Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # KTTV: Run every 60 minutes
    scheduler.add_job(
        run_kttv_scraper,
        trigger='interval',
        minutes=60,
        id='scraper_kttv',
        name='KTTV HTML Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # PCTT: Run every 120 minutes (government updates less frequent)
    scheduler.add_job(
        run_pctt_scraper,
        trigger='interval',
        minutes=120,
        id='scraper_pctt',
        name='PCTT HTML Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # VTC News: Run every 30 minutes (offset by 5 min)
    scheduler.add_job(
        run_vtc_scraper,
        trigger='interval',
        minutes=30,
        id='scraper_vtc',
        name='VTC News RSS Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # Baomoi: Run every 45 minutes (news aggregator)
    scheduler.add_job(
        run_baomoi_scraper,
        trigger='interval',
        minutes=45,
        id='scraper_baomoi',
        name='Baomoi HTML Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # Dantri: Run every 30 minutes (major news source)
    scheduler.add_job(
        run_dantri_scraper,
        trigger='interval',
        minutes=30,
        id='scraper_dantri',
        name='Dantri RSS Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # VietnamNet: Run every 30 minutes (major news source)
    scheduler.add_job(
        run_vietnamnet_scraper,
        trigger='interval',
        minutes=30,
        id='scraper_vietnamnet',
        name='VietnamNet RSS Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # Zing News: Run every 30 minutes (popular news source)
    scheduler.add_job(
        run_zing_scraper,
        trigger='interval',
        minutes=30,
        id='scraper_zing',
        name='Zing News RSS Scraper',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # AI News Bulletin: Run every 15 minutes, only between 5:00 AM and 11:59 PM
    scheduler.add_job(
        run_ai_news_bulletin,
        trigger=CronTrigger(
            minute='*/15',  # Every 15 minutes
            hour='5-23',    # Only between 5 AM and 11 PM
            timezone='Asia/Ho_Chi_Minh'
        ),
        id='ai_news_bulletin',
        name='AI News Bulletin Generator (5:00-23:59)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120  # 2 minutes grace period (bulletin is time-sensitive)
    )

    # Chinhphu.vn: Disabled (needs HTML selector improvements)
    # scheduler.add_job(
    #     run_chinhphu_scraper,
    #     trigger='interval',
    #     minutes=180,
    #     id='scraper_chinhphu',
    #     name='Chinhphu.vn Government Scraper',
    #     replace_existing=True,
    #     max_instances=1,
    #     misfire_grace_time=300
    # )

    # ============================================
    # CLEANUP JOBS
    # ============================================

    # URL Health Check - Every 2 hours
    # Checks if source URLs are still alive and removes dead reports
    scheduler.add_job(
        check_dead_urls,
        trigger='interval',
        hours=2,
        id='cleanup_url_health',
        name='URL Health Checker (Dead Link Removal)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600  # 10 minutes grace period
    )

    # Report Cleanup (TTL 7 days) - Every 6 hours
    # Deletes reports older than 7 days
    scheduler.add_job(
        cleanup_old_reports,
        trigger='interval',
        hours=6,
        id='cleanup_old_reports',
        name='Report Cleanup (TTL 7 days)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600  # 10 minutes grace period
    )

    # ============================================
    # ROUTES 2.5 - Sync Reports to RoadSegments
    # ============================================

    # Routes Sync - Every 30 minutes
    # Syncs traffic-related Reports to RoadSegments with source_url
    scheduler.add_job(
        run_routes_sync,
        trigger='interval',
        minutes=30,
        id='routes_sync',
        name='Routes Sync (Reports → RoadSegments)',
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    # Optional: Run immediately on startup (comment out if not desired)
    scheduler.add_job(
        run_vnexpress_scraper,
        trigger='date',
        run_date=datetime.now(),
        id='scraper_vnexpress_startup',
        name='VnExpress Initial Run'
    )

    # Start the scheduler
    scheduler.start()

    logger.info(
        "scheduler_started",
        jobs=[job.id for job in scheduler.get_jobs()],
        message="Ingestion scheduler started successfully"
    )

    return scheduler


def stop_scheduler():
    """Stop the scheduler gracefully."""
    global scheduler

    if scheduler is None:
        logger.warning("scheduler_not_running", message="Scheduler is not running")
        return

    scheduler.shutdown(wait=True)
    scheduler = None

    logger.info("scheduler_stopped", message="Ingestion scheduler stopped")


def get_scheduler_status():
    """
    Get current scheduler status and job information.

    Returns:
        dict: Scheduler status with job details
    """
    global scheduler

    if scheduler is None:
        return {
            "running": False,
            "jobs": []
        }

    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time.isoformat() if job.next_run_time else None

        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": next_run,
            "trigger": str(job.trigger)
        })

    return {
        "running": scheduler.running,
        "jobs": jobs
    }


# For manual testing
if __name__ == "__main__":
    import asyncio

    async def test_scheduler():
        """Test the scheduler with a short interval."""
        print("Starting test scheduler...")

        # Start scheduler
        start_scheduler()

        print("Scheduler running. Press Ctrl+C to stop...")

        try:
            # Keep running
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping scheduler...")
            stop_scheduler()
            print("Done.")

    asyncio.run(test_scheduler())
