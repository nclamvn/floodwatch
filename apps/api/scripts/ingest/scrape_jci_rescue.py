#!/usr/bin/env python3
"""
JCI Vietnam Rescue Coordination Scraper

Scrapes rescue requests and offers from cuutro.jci.vn via their AJAX API
- Help requests (TAKE - people needing assistance)
- Help offers (GIVE - volunteers offering help)
- Support centers (STATION - distribution points)

Source: https://cuutro.jci.vn/
API: SosHelper::onFilter handler
"""

import sys
import os
from datetime import datetime
from typing import Optional, List, Dict, Tuple
import requests
import re
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.database import SessionLocal
from app.database.models import HelpRequest, HelpOffer, NeedsType, ServiceType, HelpStatus, HelpUrgency
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
import uuid

# JCI API Configuration
BASE_URL = "https://cuutro.jci.vn/"
AJAX_HANDLER = "SosHelper::onFilter"

HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
    'X-OCTOBER-REQUEST-HANDLER': AJAX_HANDLER,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
}


def fetch_jci_data() -> Dict:
    """Fetch rescue data from JCI Vietnam API"""
    print(f"🌐 Fetching data from {BASE_URL}...")

    # Request all active data (TAKE, GIVE, STATION)
    data = {
        'mainFilter': '{"TAKE":true,"GIVE":true,"DONE":false,"STATION":true}',
        'filters': '{}'
    }

    try:
        response = requests.post(BASE_URL, headers=HEADERS, data=data, timeout=30)
        response.raise_for_status()

        result = response.json()

        if not result.get('success'):
            raise Exception(f"API returned success=false: {result}")

        # Log summary
        results = result.get('results', {})
        print(f"📊 API returned:")
        print(f"   TAKE (help requests): {len(results.get('TAKE', []))}")
        print(f"   GIVE (help offers): {len(results.get('GIVE', []))}")
        print(f"   STATION (support centers): {len(results.get('STATION', []))}")
        print(f"   Total cached requests: {len(result.get('requests', []))}")

        return result

    except Exception as e:
        print(f"❌ Error fetching JCI data: {e}")
        raise


def map_needs_type_from_items(request_items: List[Dict]) -> NeedsType:
    """Map Vietnamese item categories to NeedsType enum"""
    if not request_items:
        return NeedsType.OTHER

    # Get all item names and categories
    all_text = ""
    for item in request_items:
        item_data = item.get('item', {})
        all_text += f" {item_data.get('name', '')} "
        category = item_data.get('item_category', {})
        all_text += f" {category.get('name', '')} "

    all_text_lower = all_text.lower()

    # Map based on keywords
    if any(kw in all_text_lower for kw in ['nước', 'nuoc', 'nước uống', 'nuoc uong']):
        return NeedsType.WATER
    elif any(kw in all_text_lower for kw in ['thực phẩm', 'thuc pham', 'gạo', 'gao', 'mì', 'mi', 'ăn', 'an']):
        return NeedsType.FOOD
    elif any(kw in all_text_lower for kw in ['y tế', 'y te', 'thuốc', 'thuoc', 'khẩu trang', 'khau trang']):
        return NeedsType.MEDICAL
    elif any(kw in all_text_lower for kw in ['xe', 'vận chuyển', 'van chuyen', 'phương tiện', 'phuong tien']):
        return NeedsType.EVACUATION
    elif any(kw in all_text_lower for kw in ['quần áo', 'quan ao', 'áo', 'ao', 'quần', 'quan']):
        return NeedsType.CLOTHING
    elif any(kw in all_text_lower for kw in ['chỗ ở', 'cho o', 'tạm trú', 'tam tru']):
        return NeedsType.SHELTER
    else:
        return NeedsType.OTHER


def map_service_type_from_items(request_items: List[Dict], station_type: Optional[Dict]) -> ServiceType:
    """Map Vietnamese item categories and station type to ServiceType enum"""

    # Check station type first (more specific)
    if station_type:
        station_name = station_type.get('name', '').lower()
        if any(kw in station_name for kw in ['phân phối', 'phan phoi', 'phát', 'phat', 'thực phẩm', 'thuc pham']):
            return ServiceType.FOOD_DISTRIBUTION
        elif any(kw in station_name for kw in ['thu', 'tập kết', 'tap ket', 'kho']):
            return ServiceType.SUPPLIES
        elif any(kw in station_name for kw in ['trú', 'tru', 'tạm', 'tam', 'ở', 'o']):
            return ServiceType.SHELTER

    # Check items
    if request_items:
        all_text = ""
        for item in request_items:
            item_data = item.get('item', {})
            all_text += f" {item_data.get('name', '')} "
            category = item_data.get('item_category', {})
            all_text += f" {category.get('name', '')} "

        all_text_lower = all_text.lower()

        if any(kw in all_text_lower for kw in ['xe', 'vận chuyển', 'van chuyen', 'phương tiện', 'phuong tien']):
            return ServiceType.TRANSPORTATION
        elif any(kw in all_text_lower for kw in ['y tế', 'y te', 'thuốc', 'thuoc', 'cứu thương', 'cuu thuong']):
            return ServiceType.MEDICAL
        elif any(kw in all_text_lower for kw in ['thực phẩm', 'thuc pham', 'gạo', 'gao', 'ăn', 'an']):
            return ServiceType.FOOD_DISTRIBUTION
        elif any(kw in all_text_lower for kw in ['quần áo', 'quan ao', 'vật tư', 'vat tu']):
            return ServiceType.SUPPLIES

    # Default to volunteer
    return ServiceType.VOLUNTEER


def determine_urgency(households: int, title: str, note: str) -> HelpUrgency:
    """Determine urgency level based on households count and text"""
    all_text = f"{title} {note}".lower()

    # Critical keywords
    if any(kw in all_text for kw in ['khẩn cấp', 'khan cap', 'nguy hiểm', 'nguy hiem', 'cấp bách', 'cap bach', 'gấp lắm', 'gap lam']):
        return HelpUrgency.CRITICAL

    # High urgency: many households or urgent keywords
    if households >= 50 or any(kw in all_text for kw in ['gấp', 'gap', 'cần ngay', 'can ngay', 'khẩn', 'khan']):
        return HelpUrgency.HIGH

    # Medium urgency: moderate households
    if households >= 10:
        return HelpUrgency.MEDIUM

    # Low urgency: few households
    return HelpUrgency.LOW


def clean_phone_number(phone: str) -> str:
    """Clean phone number, handle masking"""
    if not phone:
        return "0000000000"  # Placeholder for masked numbers

    # If masked (contains asterisks), use placeholder
    if '*' in phone:
        return "0000000000"

    # Remove all non-digit characters
    cleaned = re.sub(r'[^\d]', '', phone)

    # Vietnamese phone numbers are 10 digits (starting with 0)
    if len(cleaned) == 10 and cleaned.startswith('0'):
        return cleaned
    elif len(cleaned) == 9:
        return '0' + cleaned

    # Return placeholder if invalid
    return "0000000000"


def parse_jci_requests(jci_data: Dict) -> Tuple[List[Dict], List[Dict]]:
    """Parse JCI API response into help requests and offers"""
    requests_list = jci_data.get('requests', [])

    help_requests_data = []
    help_offers_data = []

    for req in requests_list:
        try:
            req_type = req.get('type')
            req_id = req.get('id')

            # Parse coordinates
            lat = float(req.get('coordinate_lat', 0))
            lon = float(req.get('coordinate_long', 0))

            if lat == 0 or lon == 0:
                print(f"⚠️  Skipping record {req_id} - invalid coordinates")
                continue

            # Common fields
            title = req.get('title', '')
            full_name = req.get('full_name', 'Unknown')
            phone = req.get('phone', '')
            address = req.get('address', '')
            households = req.get('households', 0)
            note = req.get('note', '')
            created_at = req.get('created_at')
            images = req.get('images', [])
            request_items = req.get('request_items', [])
            organization = req.get('organization', {})
            org_name = organization.get('name') if organization else None

            if req_type == 'TAKE':
                # This is a help request (someone needs assistance)
                needs_type = map_needs_type_from_items(request_items)
                urgency = determine_urgency(households, title, note)

                help_requests_data.append({
                    'jci_id': req_id,
                    'title': title,
                    'full_name': full_name,
                    'phone': phone,
                    'lat': lat,
                    'lon': lon,
                    'address': address,
                    'households': households,
                    'note': note,
                    'created_at': created_at,
                    'images': images,
                    'needs_type': needs_type,
                    'urgency': urgency,
                    'request_items': request_items,
                })

            elif req_type in ['GIVE', 'STATION']:
                # This is a help offer or support center
                station_type = req.get('station_type')
                service_type = map_service_type_from_items(request_items, station_type)

                # Estimate capacity (use households as proxy, or default)
                capacity = max(households, 10)  # Minimum capacity of 10

                # Determine coverage radius (stations have larger coverage)
                coverage_radius = 20 if req_type == 'STATION' else 10

                help_offers_data.append({
                    'jci_id': req_id,
                    'title': title,
                    'full_name': full_name,
                    'phone': phone,
                    'lat': lat,
                    'lon': lon,
                    'address': address,
                    'note': note,
                    'created_at': created_at,
                    'images': images,
                    'service_type': service_type,
                    'capacity': capacity,
                    'coverage_radius_km': coverage_radius,
                    'organization': org_name,
                    'request_items': request_items,
                    'station_type': station_type,
                    'is_station': req_type == 'STATION',
                })

        except Exception as e:
            print(f"⚠️  Error parsing request {req.get('id')} ({req_type}): {e}")
            import traceback
            if '--verbose' in sys.argv:
                traceback.print_exc()
            continue

    return help_requests_data, help_offers_data


def insert_help_requests(db, requests_data: List[Dict], dry_run: bool = False) -> Tuple[int, int]:
    """Insert help requests into database"""
    inserted = 0
    skipped = 0

    for data in requests_data:
        try:
            jci_id = data['jci_id']

            # Check if already exists by JCI ID
            existing = db.query(HelpRequest).filter(
                HelpRequest.description.contains(f"JCI ID: {jci_id}")
            ).first()

            if existing:
                skipped += 1
                continue

            # Create description from title and note
            description = data['title']
            if data['note']:
                description += f"\n\n{data['note']}"
            description += f"\n\n[JCI ID: {jci_id}]"

            # Create request object
            request = HelpRequest(
                id=uuid.uuid4(),
                needs_type=data['needs_type'],
                urgency=data['urgency'],
                status=HelpStatus.ACTIVE,
                lat=data['lat'],
                lon=data['lon'],
                location=from_shape(Point(data['lon'], data['lat']), srid=4326),
                address=data['address'],
                description=description,
                people_count=max(data['households'], 1),  # At least 1 person
                contact_name=data['full_name'],
                contact_phone=clean_phone_number(data['phone']),
                contact_method='phone',
                images=data['images'] if data['images'] else None,
                is_verified=False,
                created_at=datetime.fromisoformat(data['created_at'].replace('Z', '+00:00')) if data.get('created_at') else datetime.now(),
            )

            if not dry_run:
                db.add(request)
                db.commit()

            inserted += 1
            print(f"  ✅ {data['full_name']} - {data['needs_type'].value} ({data['urgency'].value}) - {data['households']} households")

        except Exception as e:
            print(f"  ❌ Error inserting request {data.get('jci_id')}: {e}")
            if not dry_run:
                db.rollback()
            continue

    return inserted, skipped


def insert_help_offers(db, offers_data: List[Dict], dry_run: bool = False) -> Tuple[int, int]:
    """Insert help offers into database"""
    inserted = 0
    skipped = 0

    for data in offers_data:
        try:
            jci_id = data['jci_id']

            # Check if already exists by JCI ID
            existing = db.query(HelpOffer).filter(
                HelpOffer.description.contains(f"JCI ID: {jci_id}")
            ).first()

            if existing:
                skipped += 1
                continue

            # Create description from title and note
            description = data['title']
            if data['note']:
                description += f"\n\n{data['note']}"
            if data['is_station']:
                description = f"[STATION] {description}"
            description += f"\n\n[JCI ID: {jci_id}]"

            # Create offer object
            offer = HelpOffer(
                id=uuid.uuid4(),
                service_type=data['service_type'],
                status=HelpStatus.ACTIVE,
                lat=data['lat'],
                lon=data['lon'],
                location=from_shape(Point(data['lon'], data['lat']), srid=4326),
                address=data['address'],
                description=description,
                capacity=data['capacity'],
                coverage_radius_km=data['coverage_radius_km'],
                contact_name=data['full_name'],
                contact_phone=clean_phone_number(data['phone']),
                contact_method='phone',
                organization=data['organization'],
                is_verified=False,
                created_at=datetime.fromisoformat(data['created_at'].replace('Z', '+00:00')) if data.get('created_at') else datetime.now(),
            )

            if not dry_run:
                db.add(offer)
                db.commit()

            inserted += 1
            offer_type = "STATION" if data['is_station'] else "OFFER"
            print(f"  ✅ [{offer_type}] {data['full_name']} - {data['service_type'].value} (capacity: {data['capacity']})")

        except Exception as e:
            print(f"  ❌ Error inserting offer {data.get('jci_id')}: {e}")
            if not dry_run:
                db.rollback()
            continue

    return inserted, skipped


def main(dry_run: bool = False, limit: Optional[int] = None):
    """Main scraper function"""
    print("=" * 80)
    print("🚁 JCI Vietnam Rescue Coordination Scraper")
    print("=" * 80)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE IMPORT'}")
    print(f"Source: {BASE_URL}")
    print()

    db = SessionLocal()

    try:
        # Fetch data from JCI API
        jci_data = fetch_jci_data()

        # Parse into help requests and offers
        print("\n🔄 Parsing JCI data...")
        requests_data, offers_data = parse_jci_requests(jci_data)

        # Apply limit if specified
        if limit:
            requests_data = requests_data[:limit]
            offers_data = offers_data[:limit]

        print(f"\n📊 Parsed data:")
        print(f"   Help requests: {len(requests_data)}")
        print(f"   Help offers: {len(offers_data)}")
        print()

        # Insert help requests
        if requests_data:
            print("📥 Inserting help requests...")
            req_inserted, req_skipped = insert_help_requests(db, requests_data, dry_run)
            print(f"\n📊 Help requests - Inserted: {req_inserted}, Skipped: {req_skipped}")

        # Insert help offers
        if offers_data:
            print("\n📥 Inserting help offers...")
            off_inserted, off_skipped = insert_help_offers(db, offers_data, dry_run)
            print(f"\n📊 Help offers - Inserted: {off_inserted}, Skipped: {off_skipped}")

        print("\n" + "=" * 80)
        if dry_run:
            print("🔄 DRY RUN complete - no data was actually inserted")
        else:
            print("✅ Import complete!")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Scrape JCI rescue coordination data')
    parser.add_argument('--dry-run', action='store_true', help='Run without inserting to database')
    parser.add_argument('--limit', type=int, help='Limit number of records to import (for testing)')

    args = parser.parse_args()

    main(dry_run=args.dry_run, limit=args.limit)
