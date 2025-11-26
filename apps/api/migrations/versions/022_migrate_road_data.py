"""Migrate existing road data to road_segments

Revision ID: 022
Revises: 021
Create Date: 2025-11-26

Migrates data from:
- road_events table (3-status: OPEN/CLOSED/RESTRICTED)
- traffic_disruptions table (4-severity: IMPASSABLE/DANGEROUS/SLOW/WARNING)

Status mapping:
- RoadEvent.OPEN -> RoadSegment.OPEN
- RoadEvent.RESTRICTED -> RoadSegment.LIMITED
- RoadEvent.CLOSED -> RoadSegment.CLOSED
- TrafficDisruption.WARNING -> RoadSegment.LIMITED
- TrafficDisruption.SLOW -> RoadSegment.LIMITED
- TrafficDisruption.DANGEROUS -> RoadSegment.DANGEROUS
- TrafficDisruption.IMPASSABLE -> RoadSegment.CLOSED
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '022'
down_revision: Union[str, None] = '021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate data from road_events and traffic_disruptions to road_segments"""

    # Step 1: Migrate from road_events table
    # Map status: OPEN -> OPEN, RESTRICTED -> LIMITED, CLOSED -> CLOSED
    op.execute("""
        INSERT INTO road_segments (
            segment_name,
            province,
            district,
            start_lat,
            start_lon,
            location,
            status,
            status_reason,
            risk_score,
            source,
            verified_at,
            created_at,
            updated_at,
            legacy_road_event_id
        )
        SELECT
            segment_name,
            province,
            district,
            lat AS start_lat,
            lon AS start_lon,
            location,
            CASE
                WHEN status = 'OPEN' THEN 'OPEN'::road_segment_status
                WHEN status = 'RESTRICTED' THEN 'LIMITED'::road_segment_status
                WHEN status = 'CLOSED' THEN 'CLOSED'::road_segment_status
                ELSE 'OPEN'::road_segment_status
            END AS status,
            reason AS status_reason,
            CASE
                WHEN status = 'CLOSED' THEN 0.9
                WHEN status = 'RESTRICTED' THEN 0.5
                ELSE 0.1
            END AS risk_score,
            source,
            last_verified AS verified_at,
            created_at,
            updated_at,
            id AS legacy_road_event_id
        FROM road_events
        WHERE id IS NOT NULL;
    """)

    # Step 2: Migrate from traffic_disruptions table
    # Map severity: IMPASSABLE -> CLOSED, DANGEROUS -> DANGEROUS, SLOW/WARNING -> LIMITED
    op.execute("""
        INSERT INTO road_segments (
            segment_name,
            road_name,
            province,
            district,
            start_lat,
            start_lon,
            location,
            geometry,
            status,
            status_reason,
            risk_score,
            hazard_event_id,
            source,
            created_at,
            updated_at,
            legacy_disruption_id
        )
        SELECT
            COALESCE(road_name, location_description) AS segment_name,
            road_name,
            NULL AS province,  -- traffic_disruptions doesn't have province
            NULL AS district,
            lat AS start_lat,
            lon AS start_lon,
            location,
            road_geometry AS geometry,
            CASE
                WHEN severity = 'impassable' THEN 'CLOSED'::road_segment_status
                WHEN severity = 'dangerous' THEN 'DANGEROUS'::road_segment_status
                WHEN severity = 'slow' THEN 'LIMITED'::road_segment_status
                WHEN severity = 'warning' THEN 'LIMITED'::road_segment_status
                ELSE 'LIMITED'::road_segment_status
            END AS status,
            COALESCE(description, location_description) AS status_reason,
            CASE
                WHEN severity = 'impassable' THEN 0.95
                WHEN severity = 'dangerous' THEN 0.75
                WHEN severity = 'slow' THEN 0.4
                WHEN severity = 'warning' THEN 0.3
                ELSE 0.5
            END AS risk_score,
            hazard_event_id,
            source,
            created_at,
            updated_at,
            id AS legacy_disruption_id
        FROM traffic_disruptions
        WHERE is_active = true
          AND id IS NOT NULL;
    """)

    # Step 3: Generate normalized_name for deduplication
    # Simple lowercase, remove diacritics approximation using translate
    op.execute("""
        UPDATE road_segments
        SET normalized_name = LOWER(
            TRANSLATE(
                segment_name,
                'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',
                'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD'
            )
        )
        WHERE normalized_name IS NULL;
    """)

    # Step 4: Log migration stats
    op.execute("""
        DO $$
        DECLARE
            total_migrated INTEGER;
            from_road_events INTEGER;
            from_disruptions INTEGER;
        BEGIN
            SELECT COUNT(*) INTO total_migrated FROM road_segments;
            SELECT COUNT(*) INTO from_road_events FROM road_segments WHERE legacy_road_event_id IS NOT NULL;
            SELECT COUNT(*) INTO from_disruptions FROM road_segments WHERE legacy_disruption_id IS NOT NULL;

            RAISE NOTICE 'Migration complete: % total road_segments', total_migrated;
            RAISE NOTICE '  - From road_events: %', from_road_events;
            RAISE NOTICE '  - From traffic_disruptions: %', from_disruptions;
        END
        $$;
    """)


def downgrade() -> None:
    """Remove migrated data from road_segments"""

    # Only delete rows that were migrated (have legacy IDs)
    op.execute("""
        DELETE FROM road_segments
        WHERE legacy_road_event_id IS NOT NULL
           OR legacy_disruption_id IS NOT NULL;
    """)
