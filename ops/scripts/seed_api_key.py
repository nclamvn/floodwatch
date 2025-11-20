#!/usr/bin/env python3
"""
Seed script to create a test API key
Run after migration 003 is applied
"""
import os
import sys
import uuid
import hashlib

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../apps/api'))

from app.database import get_db_context, ApiKey
from app.services.apikey_repo import ApiKeyRepository


def seed_test_key():
    """Create a test API key"""
    # Generate a random API key
    key_plain = f"demo_{uuid.uuid4().hex}"

    print("=" * 60)
    print("Creating test API key...")
    print("=" * 60)

    try:
        with get_db_context() as db:
            # Create key
            api_key = ApiKeyRepository.create(
                db=db,
                name="Demo Test Key",
                key_plain=key_plain,
                scopes=["read:public"],
                rate_limit=120
            )

            print(f"\n✅ API Key created successfully!")
            print(f"\nKey ID: {api_key.id}")
            print(f"Name: {api_key.name}")
            print(f"Scopes: {api_key.scopes}")
            print(f"Rate Limit: {api_key.rate_limit} requests/minute")
            print(f"\n🔑 X-API-Key: {key_plain}")
            print(f"\n⚠️  Save this key securely - it won't be shown again!")
            print("=" * 60)

            # Test curl command
            print(f"\n📝 Test with curl:")
            print(f'curl -H "X-API-Key: {key_plain}" "http://localhost:8000/api/v1/reports?limit=5"')
            print()

    except Exception as e:
        print(f"❌ Error creating API key: {e}")
        sys.exit(1)


if __name__ == "__main__":
    seed_test_key()
