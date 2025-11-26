#!/usr/bin/env python3
"""
Seed help_requests and help_offers data to production database.
Run this script on Render after deployment.
"""
import os
import sys
from datetime import datetime, timedelta
from uuid import uuid4

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

# Fix postgres:// to postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# Sample help offers data
HELP_OFFERS = [
    {
        "service_type": "rescue",
        "description": "Đội cứu hộ chuyên nghiệp, có thuyền và phao cứu sinh",
        "capacity": 20,
        "lat": 16.0678,
        "lon": 108.22,
        "address": "Số 123 Trần Phú, Hải Châu, Đà Nẵng",
        "coverage_radius_km": 30,
        "contact_name": "Đội cứu hộ Đà Nẵng",
        "contact_phone": "0905111222",
        "organization": "Hội Chữ thập đỏ Đà Nẵng"
    },
    {
        "service_type": "shelter",
        "description": "Điểm tập kết cứu trợ, có chỗ ở tạm, phát thực phẩm",
        "capacity": 100,
        "lat": 16.0123,
        "lon": 108.0567,
        "address": "UBND xã Hòa Vang, Đà Nẵng",
        "coverage_radius_km": 15,
        "contact_name": "Điểm hỗ trợ Hòa Vang",
        "contact_phone": "0927333444",
        "organization": "UBND xã Hòa Vang"
    },
    {
        "service_type": "transportation",
        "description": "Có xe bán tải, có thể vận chuyển người và hàng cứu trợ",
        "capacity": 5,
        "lat": 16.0456,
        "lon": 108.189,
        "address": "Hòa Xuân, Cẩm Lệ, Đà Nẵng",
        "coverage_radius_km": 20,
        "contact_name": "Nguyễn Văn Hùng",
        "contact_phone": "0916222333",
        "organization": None
    },
    {
        "service_type": "supplies",
        "description": "Trụ sở Ủy ban MTTQ Việt Nam TP.HCM - Nhận tiền và hàng hóa cứu trợ",
        "capacity": 1000,
        "lat": 10.7865124,
        "lon": 106.6973045,
        "address": "55 Mạc Đĩnh Chi, Tân Định, Quận 1, TP.HCM",
        "coverage_radius_km": 50,
        "contact_name": "Kỳ Nam",
        "contact_phone": "0939268468",
        "organization": "UB MTTQ Việt Nam TP.HCM"
    },
    {
        "service_type": "rescue",
        "description": "Tôi có thuyền nhỏ, có thể giúp đỡ di chuyển người trong khu vực ngập lụt",
        "capacity": 8,
        "lat": 10.7769,
        "lon": 106.7009,
        "address": "Quận 7, TP.HCM",
        "coverage_radius_km": 15,
        "contact_name": "Trần Văn B",
        "contact_phone": "0912345678",
        "organization": "Đội cứu hộ tình nguyện Quận 7"
    },
]

# Sample help requests data
HELP_REQUESTS = [
    {
        "needs_type": "shelter",
        "urgency": "critical",
        "description": "Gia đình 6 người bị cô lập, nước đang dâng cao, cần di chuyển khẩn cấp",
        "people_count": 6,
        "lat": 16.0544,
        "lon": 108.2022,
        "address": "Thôn 3, Hòa Phú, Hòa Vang, Đà Nẵng",
        "contact_name": "Nguyễn Văn An",
        "contact_phone": "0901234567",
        "has_children": True,
        "has_elderly": True,
        "water_level_cm": 150
    },
    {
        "needs_type": "food",
        "urgency": "high",
        "description": "Gia đình 5 người bị cô lập do nước lũ, cần thực phẩm và nước uống khẩn cấp",
        "people_count": 5,
        "lat": 16.0544,
        "lon": 108.2022,
        "address": "Thôn 3, Hòa Phú, Hòa Vang, Đà Nẵng",
        "contact_name": "Nguyễn Văn An",
        "contact_phone": "0901234567",
        "has_children": False,
        "has_elderly": False,
        "water_level_cm": None
    },
    {
        "needs_type": "medical",
        "urgency": "critical",
        "description": "Cần cứu hộ khẩn cấp, nhà đang bị ngập nặng, có người bị thương",
        "people_count": 4,
        "lat": 10.785,
        "lon": 106.695,
        "address": "Quận Bình Thạnh, TP.HCM",
        "contact_name": "Lê Văn C",
        "contact_phone": "0923456789",
        "has_children": True,
        "has_elderly": True,
        "water_level_cm": 180
    },
    {
        "needs_type": "shelter",
        "urgency": "high",
        "description": "Nhà bị sập một phần do sạt lở, cần nơi tạm trú",
        "people_count": 3,
        "lat": 15.9876,
        "lon": 108.1234,
        "address": "Thôn 5, Hòa Phong, Hòa Vang, Đà Nẵng",
        "contact_name": "Trần Thị D",
        "contact_phone": "0934567890",
        "has_children": True,
        "has_elderly": False,
        "water_level_cm": None
    },
    {
        "needs_type": "food",
        "urgency": "medium",
        "description": "Cần thực phẩm cho 8 người trong 3 ngày, đường vào bị ngập",
        "people_count": 8,
        "lat": 16.1234,
        "lon": 108.0567,
        "address": "Xã Hòa Liên, Hòa Vang, Đà Nẵng",
        "contact_name": "Phạm Văn E",
        "contact_phone": "0945678901",
        "has_children": True,
        "has_elderly": True,
        "water_level_cm": 50
    },
]


def seed_data():
    session = Session()
    try:
        # Check if data already exists
        result = session.execute(text("SELECT COUNT(*) FROM help_offers"))
        offers_count = result.scalar()

        result = session.execute(text("SELECT COUNT(*) FROM help_requests"))
        requests_count = result.scalar()

        if offers_count > 0 or requests_count > 0:
            print(f"Data already exists: {offers_count} offers, {requests_count} requests")
            print("Skipping seed to avoid duplicates.")
            return

        now = datetime.utcnow()
        expires_at = now + timedelta(days=7)

        # Insert help offers
        for offer in HELP_OFFERS:
            offer_id = str(uuid4())
            location_wkt = f"SRID=4326;POINT({offer['lon']} {offer['lat']})"

            session.execute(text("""
                INSERT INTO help_offers (
                    id, created_at, updated_at, service_type, status, description,
                    capacity, lat, lon, address, coverage_radius_km,
                    contact_name, contact_phone, contact_method, organization,
                    is_verified, expires_at, available_capacity, location
                ) VALUES (
                    :id, :now, :now, :service_type, 'active', :description,
                    :capacity, :lat, :lon, :address, :coverage_radius_km,
                    :contact_name, :contact_phone, 'phone', :organization,
                    false, :expires_at, :capacity, ST_GeomFromEWKT(:location)
                )
            """), {
                "id": offer_id,
                "now": now,
                "service_type": offer["service_type"],
                "description": offer["description"],
                "capacity": offer["capacity"],
                "lat": offer["lat"],
                "lon": offer["lon"],
                "address": offer["address"],
                "coverage_radius_km": offer["coverage_radius_km"],
                "contact_name": offer["contact_name"],
                "contact_phone": offer["contact_phone"],
                "organization": offer["organization"],
                "expires_at": expires_at,
                "location": location_wkt
            })

        print(f"Inserted {len(HELP_OFFERS)} help offers")

        # Insert help requests
        for req in HELP_REQUESTS:
            req_id = str(uuid4())
            location_wkt = f"SRID=4326;POINT({req['lon']} {req['lat']})"
            priority = 80 if req["urgency"] == "critical" else (50 if req["urgency"] == "high" else 30)

            session.execute(text("""
                INSERT INTO help_requests (
                    id, created_at, updated_at, needs_type, urgency, status, description,
                    people_count, lat, lon, address, contact_name, contact_phone,
                    contact_method, has_children, has_elderly, has_disabilities,
                    water_level_cm, is_verified, expires_at, priority_score, location
                ) VALUES (
                    :id, :now, :now, :needs_type, :urgency, 'active', :description,
                    :people_count, :lat, :lon, :address, :contact_name, :contact_phone,
                    'phone', :has_children, :has_elderly, false,
                    :water_level_cm, false, :expires_at, :priority, ST_GeomFromEWKT(:location)
                )
            """), {
                "id": req_id,
                "now": now,
                "needs_type": req["needs_type"],
                "urgency": req["urgency"],
                "description": req["description"],
                "people_count": req["people_count"],
                "lat": req["lat"],
                "lon": req["lon"],
                "address": req["address"],
                "contact_name": req["contact_name"],
                "contact_phone": req["contact_phone"],
                "has_children": req["has_children"],
                "has_elderly": req["has_elderly"],
                "water_level_cm": req["water_level_cm"],
                "expires_at": expires_at,
                "priority": priority,
                "location": location_wkt
            })

        print(f"Inserted {len(HELP_REQUESTS)} help requests")

        session.commit()
        print("Seed completed successfully!")

    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_data()
