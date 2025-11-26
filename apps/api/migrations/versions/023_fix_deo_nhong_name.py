"""Fix incorrect road name: Đèo Phù Mỹ -> Đèo Nhông

This migration fixes a critical data error where "Đèo Nhông" (a mountain pass
in Phù Mỹ district, Bình Định province) was incorrectly named "Đèo Phù Mỹ".

The pass is located at: 14.0847, 108.9203

Revision ID: 023_fix_deo_nhong_name
Revises: 022_migrate_road_data
Create Date: 2024-11-26
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers
revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None

# Correct coordinates for Đèo Nhông
DEO_NHONG_LAT = 14.0847
DEO_NHONG_LON = 108.9203


def upgrade():
    """
    Fix incorrect road names and coordinates:
    1. Rename "Đèo Phù Mỹ" to "Đèo Nhông"
    2. Update coordinates to correct location
    3. Update province to "Bình Định" if incorrectly set
    """

    # Fix in road_events table
    op.execute("""
        UPDATE road_events
        SET
            segment_name = 'Đèo Nhông',
            lat = 14.0847,
            lon = 108.9203,
            province = 'Bình Định',
            district = 'Phù Mỹ',
            updated_at = NOW()
        WHERE
            LOWER(segment_name) LIKE '%đèo phù mỹ%'
            OR LOWER(segment_name) LIKE '%deo phu my%'
    """)

    # Fix in road_segments table (new Routes 2.0 table)
    op.execute("""
        UPDATE road_segments
        SET
            segment_name = 'Đèo Nhông',
            start_lat = 14.0847,
            start_lon = 108.9203,
            province = 'Bình Định',
            district = 'Phù Mỹ',
            normalized_name = 'deo nhong',
            updated_at = NOW()
        WHERE
            LOWER(segment_name) LIKE '%đèo phù mỹ%'
            OR LOWER(segment_name) LIKE '%deo phu my%'
            OR LOWER(normalized_name) LIKE '%deo phu my%'
    """)

    # Also fix any traffic_disruptions that might have this error
    # Note: location column is geography type, use location_description instead
    op.execute("""
        UPDATE traffic_disruptions
        SET
            location_description = REPLACE(location_description, 'Đèo Phù Mỹ', 'Đèo Nhông'),
            updated_at = NOW()
        WHERE
            LOWER(location_description) LIKE '%đèo phù mỹ%'
            OR LOWER(location_description) LIKE '%deo phu my%'
    """)

    print("✅ Fixed 'Đèo Phù Mỹ' -> 'Đèo Nhông' in all tables")


def downgrade():
    """
    Revert the name change (not recommended - original data was incorrect)
    """
    # Note: This downgrade reverts to incorrect data
    # Only use if absolutely necessary

    op.execute("""
        UPDATE road_events
        SET
            segment_name = 'Đèo Phù Mỹ',
            updated_at = NOW()
        WHERE
            LOWER(segment_name) = 'đèo nhông'
    """)

    op.execute("""
        UPDATE road_segments
        SET
            segment_name = 'Đèo Phù Mỹ',
            normalized_name = 'deo phu my',
            updated_at = NOW()
        WHERE
            LOWER(segment_name) = 'đèo nhông'
    """)

    op.execute("""
        UPDATE traffic_disruptions
        SET
            location_description = REPLACE(location_description, 'Đèo Nhông', 'Đèo Phù Mỹ'),
            updated_at = NOW()
        WHERE
            LOWER(location_description) LIKE '%đèo nhông%'
    """)

    print("⚠️ Reverted 'Đèo Nhông' -> 'Đèo Phù Mỹ' (incorrect data restored)")
