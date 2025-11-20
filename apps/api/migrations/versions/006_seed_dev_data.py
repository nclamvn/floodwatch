"""Seed development data

Revision ID: 006
Revises: 005
Create Date: 2025-11-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed development data with demo reports and road events"""

    connection = op.get_bind()

    # Seed 8 sample reports (2 each type)
    connection.execute(text("""
        INSERT INTO reports (id, type, source, title, description, province, district, lat, lon, trust_score, status, created_at)
        VALUES
        -- ALERT reports (Quảng Nam, Thừa Thiên Huế)
        ('11111111-1111-1111-1111-111111111111', 'ALERT', 'KTTV', 'Cảnh báo mưa lớn Quảng Nam',
         'Dự báo mưa to đến rất to trong 12-24h tới, lượng mưa 100-200mm',
         'Quảng Nam', 'Đại Lộc', 15.5769, 108.0899, 0.85, 'new', NOW() - INTERVAL '2 hours'),

        ('11111111-1111-1111-1111-111111111112', 'ALERT', 'NCHMF', 'Cảnh báo lũ quét Thừa Thiên Huế',
         'Nguy cơ lũ quét, sạt lở đất khu vực miền núi, mưa lũ kéo dài',
         'Thừa Thiên Huế', 'Nam Đông', 16.2637, 107.6809, 0.90, 'verified', NOW() - INTERVAL '1 hour'),

        -- SOS reports (Quảng Bình, Đà Nẵng)
        ('22222222-2222-2222-2222-222222222221', 'SOS', 'COMMUNITY', 'Cần cứu trợ gấp - Gia đình 5 người bị cô lập',
         'Gia đình 5 người bị nước lũ bao vây, không thể di chuyển. Cần hỗ trợ gấp!',
         'Quảng Bình', 'Lệ Thủy', 17.4680, 106.6232, 0.55, 'new', NOW() - INTERVAL '30 minutes'),

        ('22222222-2222-2222-2222-222222222222', 'SOS', 'COMMUNITY', 'Kêu gọi cứu trợ khẩn cấp',
         'Hơn 20 hộ dân bị cô lập do nước lũ dâng cao. Lương thực sắp hết.',
         'Đà Nẵng', 'Hòa Vang', 16.1074, 108.0799, 0.60, 'new', NOW() - INTERVAL '45 minutes'),

        -- ROAD reports (Quảng Trị, Hà Tĩnh)
        ('33333333-3333-3333-3333-333333333331', 'ROAD', 'PRESS', 'QL1A bị sạt lở tại Quảng Trị',
         'Quốc lộ 1A đoạn qua Quảng Trị bị sạt lở nghiêm trọng, giao thông tê liệt',
         'Quảng Trị', 'Hải Lăng', 16.7463, 107.2303, 0.75, 'verified', NOW() - INTERVAL '3 hours'),

        ('33333333-3333-3333-3333-333333333332', 'ROAD', 'PRESS', 'Đường Hồ Chí Minh ngập sâu',
         'Đường Hồ Chí Minh đoạn qua Hà Tĩnh ngập sâu 0.5-1m, xe không thể lưu thông',
         'Hà Tĩnh', 'Hương Khê', 18.2740, 105.6892, 0.70, 'new', NOW() - INTERVAL '1 hour 30 minutes'),

        -- NEEDS reports (Quảng Nam, Thừa Thiên Huế)
        ('44444444-4444-4444-4444-444444444441', 'NEEDS', 'COMMUNITY', 'Cần lương thực, nước uống',
         'Khu vực bị cô lập 2 ngày, thiếu lương thực và nước sạch. Cần gấp mì tôm, nước đóng chai.',
         'Quảng Nam', 'Phước Sơn', 15.5400, 107.9200, 0.65, 'new', NOW() - INTERVAL '4 hours'),

        ('44444444-4444-4444-4444-444444444442', 'NEEDS', 'COMMUNITY', 'Cần thuốc men và quần áo',
         'Nhiều người bị ướt, cần quần áo khô và thuốc cảm cúm. Có người cao tuổi cần thuốc huyết áp.',
         'Thừa Thiên Huế', 'Phú Lộc', 16.2897, 107.8209, 0.60, 'new', NOW() - INTERVAL '2 hours 15 minutes')

        ON CONFLICT (id) DO NOTHING
    """))

    # Seed 4 sample road events
    connection.execute(text("""
        INSERT INTO road_events (id, segment_name, status, reason, province, district, lat, lon, last_verified, source, created_at)
        VALUES
        -- OPEN road
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'QL1A Đèo Hải Vân', 'OPEN', NULL,
         'Đà Nẵng', 'Liên Chiểu', 16.1974, 108.1253, NOW() - INTERVAL '30 minutes', 'PRESS', NOW() - INTERVAL '5 hours'),

        -- CLOSED roads
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'QL9 Lao Bảo', 'CLOSED', 'Sạt lở đá nghiêm trọng, giao thông tê liệt',
         'Quảng Trị', 'Hướng Hóa', 16.6463, 106.7303, NOW() - INTERVAL '1 hour', 'PRESS', NOW() - INTERVAL '6 hours'),

        -- RESTRICTED road
        ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Đường Hồ Chí Minh', 'RESTRICTED', 'Ngập nước cục bộ, chỉ xe cao có thể qua',
         'Quảng Nam', 'Nam Giang', 15.5400, 107.7200, NOW() - INTERVAL '45 minutes', 'PRESS', NOW() - INTERVAL '3 hours'),

        -- OPEN road
        ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'QL14B Kon Tum - Quảng Nam', 'OPEN', NULL,
         'Quảng Nam', 'Bắc Trà My', 15.2897, 108.0109, NOW() - INTERVAL '20 minutes', 'PRESS', NOW() - INTERVAL '4 hours')

        ON CONFLICT (id) DO NOTHING
    """))

    print("✅ Seeded 8 demo reports + 4 demo road events")


def downgrade() -> None:
    """Remove seeded development data"""

    connection = op.get_bind()

    # Delete seeded reports
    connection.execute(text("""
        DELETE FROM reports WHERE id IN (
            '11111111-1111-1111-1111-111111111111',
            '11111111-1111-1111-1111-111111111112',
            '22222222-2222-2222-2222-222222222221',
            '22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333331',
            '33333333-3333-3333-3333-333333333332',
            '44444444-4444-4444-4444-444444444441',
            '44444444-4444-4444-4444-444444444442'
        )
    """))

    # Delete seeded road events
    connection.execute(text("""
        DELETE FROM road_events WHERE id IN (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            'dddddddd-dddd-dddd-dddd-dddddddddddd'
        )
    """))

    print("✅ Removed seeded development data")
