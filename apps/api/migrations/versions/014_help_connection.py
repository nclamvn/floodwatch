"""Add help_connection tables for disaster relief coordination

Revision ID: 014
Revises: 013
Create Date: 2025-11-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '014'
down_revision: Union[str, None] = '013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create needs_type enum
    needs_type_enum = postgresql.ENUM(
        'food',
        'water',
        'shelter',
        'medical',
        'clothing',
        'transport',
        'other',
        name='needs_type',
        create_type=True
    )
    needs_type_enum.create(op.get_bind(), checkfirst=True)

    # Create service_type enum
    service_type_enum = postgresql.ENUM(
        'rescue',
        'transportation',
        'medical',
        'shelter',
        'food_water',
        'supplies',
        'volunteer',
        'donation',
        'other',
        name='service_type',
        create_type=True
    )
    service_type_enum.create(op.get_bind(), checkfirst=True)

    # Create help_status enum
    help_status_enum = postgresql.ENUM(
        'active',
        'in_progress',
        'fulfilled',
        'expired',
        'cancelled',
        name='help_status',
        create_type=True
    )
    help_status_enum.create(op.get_bind(), checkfirst=True)

    # Create help_urgency enum
    help_urgency_enum = postgresql.ENUM(
        'critical',
        'high',
        'medium',
        'low',
        name='help_urgency',
        create_type=True
    )
    help_urgency_enum.create(op.get_bind(), checkfirst=True)

    # Create help_requests table
    op.create_table(
        'help_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        # Request details
        sa.Column('needs_type', postgresql.ENUM('food', 'water', 'shelter', 'medical', 'clothing', 'transport', 'other', name='needs_type', create_type=False), nullable=False),
        sa.Column('urgency', postgresql.ENUM('critical', 'high', 'medium', 'low', name='help_urgency', create_type=False), nullable=False),
        sa.Column('status', postgresql.ENUM('active', 'in_progress', 'fulfilled', 'expired', 'cancelled', name='help_status', create_type=False), nullable=False, server_default='active'),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('people_count', sa.Integer(), nullable=True),

        # Spatial data (PostGIS)
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),

        # Contact information
        sa.Column('contact_name', sa.String(255), nullable=False),
        sa.Column('contact_phone', sa.String(50), nullable=False),
        sa.Column('contact_method', sa.String(50), nullable=True),  # phone, sms, zalo, etc.

        # Verification
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verified_by', postgresql.UUID(as_uuid=True), nullable=True),

        # Expiration
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),

        # Metadata
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('images', postgresql.JSONB(), nullable=True),  # Array of image URLs

        # Constraints
        sa.CheckConstraint('people_count IS NULL OR people_count > 0', name='check_positive_people_count'),
    )

    # Create help_offers table
    op.create_table(
        'help_offers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        # Offer details
        sa.Column('service_type', postgresql.ENUM('rescue', 'transportation', 'medical', 'shelter', 'food_water', 'supplies', 'volunteer', 'donation', 'other', name='service_type', create_type=False), nullable=False),
        sa.Column('status', postgresql.ENUM('active', 'in_progress', 'fulfilled', 'expired', 'cancelled', name='help_status', create_type=False), nullable=False, server_default='active'),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=True),  # How many people can be helped
        sa.Column('availability', sa.String(500), nullable=True),  # Time availability

        # Spatial data (PostGIS)
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('coverage_radius_km', sa.Float(), nullable=True),  # Service coverage area

        # Contact information
        sa.Column('contact_name', sa.String(255), nullable=False),
        sa.Column('contact_phone', sa.String(50), nullable=False),
        sa.Column('contact_method', sa.String(50), nullable=True),
        sa.Column('organization', sa.String(255), nullable=True),  # For NGOs/organizations

        # Verification
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verified_by', postgresql.UUID(as_uuid=True), nullable=True),

        # Expiration
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),

        # Metadata
        sa.Column('notes', sa.Text(), nullable=True),

        # Constraints
        sa.CheckConstraint('capacity IS NULL OR capacity > 0', name='check_positive_capacity'),
        sa.CheckConstraint('coverage_radius_km IS NULL OR coverage_radius_km > 0', name='check_positive_coverage_radius'),
    )

    # Create indexes for help_requests
    # Spatial index is auto-created by GeoAlchemy2 for location column

    # Status and urgency filtering
    op.create_index('idx_help_requests_status', 'help_requests', ['status'])
    op.create_index('idx_help_requests_urgency', 'help_requests', ['urgency'])
    op.create_index('idx_help_requests_status_urgency', 'help_requests', ['status', 'urgency'])

    # Type filtering
    op.create_index('idx_help_requests_needs_type', 'help_requests', ['needs_type'])

    # Verification status
    op.create_index('idx_help_requests_is_verified', 'help_requests', ['is_verified'])

    # Time-based queries
    op.create_index('idx_help_requests_created_at', 'help_requests', ['created_at'], postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_help_requests_expires_at', 'help_requests', ['expires_at'])

    # Partial index for active verified requests (most common query)
    op.execute("""
        CREATE INDEX idx_help_requests_active_verified
        ON help_requests (created_at DESC)
        WHERE status = 'active' AND is_verified = true
    """)

    # Create indexes for help_offers
    # Spatial index is auto-created by GeoAlchemy2 for location column

    # Status filtering
    op.create_index('idx_help_offers_status', 'help_offers', ['status'])

    # Type filtering
    op.create_index('idx_help_offers_service_type', 'help_offers', ['service_type'])

    # Verification status
    op.create_index('idx_help_offers_is_verified', 'help_offers', ['is_verified'])

    # Time-based queries
    op.create_index('idx_help_offers_created_at', 'help_offers', ['created_at'], postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_help_offers_expires_at', 'help_offers', ['expires_at'])

    # Partial index for active verified offers
    op.execute("""
        CREATE INDEX idx_help_offers_active_verified
        ON help_offers (created_at DESC)
        WHERE status = 'active' AND is_verified = true
    """)

    # Create triggers for auto-updating updated_at (reuse existing function)
    op.execute("""
        CREATE TRIGGER help_requests_update_timestamp
        BEFORE UPDATE ON help_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    op.execute("""
        CREATE TRIGGER help_offers_update_timestamp
        BEFORE UPDATE ON help_offers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    # Create trigger functions to extract lat/lon from location geography
    op.execute("""
        CREATE OR REPLACE FUNCTION update_help_request_lat_lon()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.location IS NOT NULL THEN
                NEW.lat := ST_Y(NEW.location::geometry);
                NEW.lon := ST_X(NEW.location::geometry);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION update_help_offer_lat_lon()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.location IS NOT NULL THEN
                NEW.lat := ST_Y(NEW.location::geometry);
                NEW.lon := ST_X(NEW.location::geometry);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER help_requests_update_lat_lon
        BEFORE INSERT OR UPDATE ON help_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_help_request_lat_lon();
    """)

    op.execute("""
        CREATE TRIGGER help_offers_update_lat_lon
        BEFORE INSERT OR UPDATE ON help_offers
        FOR EACH ROW
        EXECUTE FUNCTION update_help_offer_lat_lon();
    """)

    # Create auto-expire trigger (marks as expired after 7 days if not updated)
    op.execute("""
        CREATE OR REPLACE FUNCTION auto_expire_help_items()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.expires_at IS NULL THEN
                NEW.expires_at := NEW.created_at + INTERVAL '7 days';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER help_requests_auto_expire
        BEFORE INSERT ON help_requests
        FOR EACH ROW
        EXECUTE FUNCTION auto_expire_help_items();
    """)

    op.execute("""
        CREATE TRIGGER help_offers_auto_expire
        BEFORE INSERT ON help_offers
        FOR EACH ROW
        EXECUTE FUNCTION auto_expire_help_items();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS help_requests_auto_expire ON help_requests")
    op.execute("DROP TRIGGER IF EXISTS help_offers_auto_expire ON help_offers")
    op.execute("DROP TRIGGER IF EXISTS help_requests_update_lat_lon ON help_requests")
    op.execute("DROP TRIGGER IF EXISTS help_offers_update_lat_lon ON help_offers")
    op.execute("DROP TRIGGER IF EXISTS help_requests_update_timestamp ON help_requests")
    op.execute("DROP TRIGGER IF EXISTS help_offers_update_timestamp ON help_offers")

    # Drop trigger functions
    op.execute("DROP FUNCTION IF EXISTS auto_expire_help_items()")
    op.execute("DROP FUNCTION IF EXISTS update_help_request_lat_lon()")
    op.execute("DROP FUNCTION IF EXISTS update_help_offer_lat_lon()")

    # Drop tables (will automatically drop indexes)
    op.drop_table('help_offers')
    op.drop_table('help_requests')

    # Drop enums
    sa.Enum(name='help_urgency').drop(op.get_bind())
    sa.Enum(name='help_status').drop(op.get_bind())
    sa.Enum(name='service_type').drop(op.get_bind())
    sa.Enum(name='needs_type').drop(op.get_bind())
