"""Add ai_forecasts table for ML-based hazard predictions

Revision ID: 013
Revises: 012
Create Date: 2025-11-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '013'
down_revision: Union[str, None] = '012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ai_forecasts table
    # Note: We reuse existing hazard_type and severity_level enums from migration 008
    op.create_table(
        'ai_forecasts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        # Forecast classification
        sa.Column('type', postgresql.ENUM(name='hazard_type', create_type=False), nullable=False),
        sa.Column('severity', postgresql.ENUM(name='severity_level', create_type=False), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),

        # Spatial data (PostGIS)
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('affected_area', geoalchemy2.Geography(geometry_type='POLYGON', srid=4326), nullable=True),
        sa.Column('radius_km', sa.Float(), nullable=True),

        # Lat/lon for convenience (auto-populated from location via trigger)
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),

        # Timing - when the forecast is for
        sa.Column('forecast_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=False),

        # AI Model metadata
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('model_version', sa.String(50), nullable=False),
        sa.Column('training_data_date', sa.DateTime(timezone=True), nullable=True),

        # Prediction details
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('predicted_intensity', sa.Float(), nullable=True),
        sa.Column('predicted_duration_hours', sa.Float(), nullable=True),
        sa.Column('risk_factors', postgresql.JSONB(), nullable=True),
        sa.Column('data_sources', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('raw_output', postgresql.JSONB(), nullable=True),

        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_event_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Source
        sa.Column('source', sa.String(100), nullable=False, server_default='AI_MODEL'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),

        # Constraints
        sa.CheckConstraint('confidence >= 0.0 AND confidence <= 1.0', name='check_forecast_confidence'),
        sa.CheckConstraint('radius_km IS NULL OR radius_km > 0', name='check_forecast_radius'),
        sa.CheckConstraint('predicted_duration_hours IS NULL OR predicted_duration_hours > 0', name='check_forecast_duration'),
    )

    # Create indexes for common queries
    # Spatial index for location (auto-created by GeoAlchemy2)

    # Time-based queries (active forecasts)
    op.create_index('idx_ai_forecasts_forecast_time', 'ai_forecasts', ['forecast_time'], postgresql_ops={'forecast_time': 'DESC'})
    op.create_index('idx_ai_forecasts_valid_until', 'ai_forecasts', ['valid_until'])
    op.create_index('idx_ai_forecasts_time_range', 'ai_forecasts', ['forecast_time', 'valid_until'])

    # Filtering by confidence and active status
    op.create_index('idx_ai_forecasts_confidence', 'ai_forecasts', ['confidence'])
    op.create_index('idx_ai_forecasts_is_active', 'ai_forecasts', ['is_active'])
    op.create_index('idx_ai_forecasts_active_confidence', 'ai_forecasts', ['is_active', 'confidence'])

    # Type and severity filtering
    op.create_index('idx_ai_forecasts_type_severity', 'ai_forecasts', ['type', 'severity'])

    # Model tracking
    op.create_index('idx_ai_forecasts_model', 'ai_forecasts', ['model_name', 'model_version'])

    # Verification tracking
    op.create_index('idx_ai_forecasts_actual_event', 'ai_forecasts', ['actual_event_id'])

    # Create trigger for auto-updating updated_at (reuse existing function)
    op.execute("""
        CREATE TRIGGER ai_forecasts_update_timestamp
        BEFORE UPDATE ON ai_forecasts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    # Create trigger to extract lat/lon from location geography
    op.execute("""
        CREATE OR REPLACE FUNCTION update_ai_forecast_lat_lon()
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
        CREATE TRIGGER ai_forecasts_update_lat_lon
        BEFORE INSERT OR UPDATE ON ai_forecasts
        FOR EACH ROW
        EXECUTE FUNCTION update_ai_forecast_lat_lon();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS ai_forecasts_update_lat_lon ON ai_forecasts")
    op.execute("DROP TRIGGER IF EXISTS ai_forecasts_update_timestamp ON ai_forecasts")

    # Drop trigger function
    op.execute("DROP FUNCTION IF EXISTS update_ai_forecast_lat_lon()")

    # Drop table (will automatically drop indexes)
    op.drop_table('ai_forecasts')
