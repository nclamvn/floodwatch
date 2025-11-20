# AI Forecast Layer - Deployment Guide

## Overview

This guide explains how to deploy the new **AI Forecast Layer** feature to production on Render.com.

## Feature Summary

The AI Forecast Layer adds ML-based hazard predictions to the FloodWatch map:

- **Purple markers** (🔮) distinguish forecasts from real events
- **Confidence scores** (0.0-1.0) for all predictions
- **Detailed popups** with AI summaries, confidence meters, data sources
- **Toggle control** in layer panel
- **Accuracy tracking** by linking forecasts to actual events

## Files Changed

### Backend (API)
- ✅ `apps/api/app/database/models.py` - AIForecast model
- ✅ `apps/api/migrations/versions/013_ai_forecasts.py` - Database migration
- ✅ `apps/api/app/services/ai_forecast_repo.py` - Repository service
- ✅ `apps/api/app/main.py` - API endpoints

### Frontend (Web)
- ✅ `apps/web/types/aiForecast.ts` - TypeScript types
- ✅ `apps/web/hooks/useAIForecasts.ts` - Data fetching hook
- ✅ `apps/web/components/AIForecastLayer.tsx` - Map layer component
- ✅ `apps/web/components/LayerControlPanel.tsx` - Added AI toggle
- ✅ `apps/web/components/DisasterLegend.tsx` - Added legend entry
- ✅ `apps/web/components/MapViewClustered.tsx` - Integrated layer

## Deployment Steps

### Step 1: Apply Database Migration

The migration creates the `ai_forecasts` table with spatial indexes and triggers.

**Option A: Via Render Dashboard (Recommended)**

1. Go to Render Dashboard → `floodwatch-api` service
2. Click **Shell** tab
3. Run:
   ```bash
   cd /app
   alembic upgrade head
   ```
4. Verify output shows: `Running upgrade 012 -> 013, create ai forecasts table`

**Option B: Via Local Connection**

1. Get database URL from Render:
   - Go to `floodwatch-db` → **Connect** → External Connection
   - Copy the connection string

2. Run migration locally:
   ```bash
   # Set DATABASE_URL temporarily
   export DATABASE_URL="postgresql://..."
   cd apps/api
   alembic upgrade head
   ```

### Step 2: Deploy Code Changes

**Automatic Deployment (Recommended)**

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "feat: add AI Forecast Layer with ML predictions

   - Add AIForecast model and migration
   - Implement AI forecast API endpoints
   - Create purple-themed forecast layer
   - Add confidence-based filtering
   - Integrate into map with toggle control"

   git push origin main
   ```

2. Render will automatically deploy both `floodwatch-api` and `floodwatch-web`

3. Monitor deployment:
   - Dashboard → Services → Check build logs
   - Wait for both services to show "Live"

**Manual Deployment**

1. Go to Render Dashboard
2. Trigger manual deploy for `floodwatch-api`
3. Trigger manual deploy for `floodwatch-web`

### Step 3: Verify Deployment

1. Check API health:
   ```bash
   curl https://api.thongtinmualu.live/health
   ```

2. Check new endpoint exists:
   ```bash
   curl "https://api.thongtinmualu.live/ai-forecasts?limit=10"
   ```
   Should return: `{"data": [], "pagination": {...}}`

3. Check frontend deployment:
   - Visit: https://thongtinmualu.live/map
   - Look for "🔮 Dự báo AI" in layer control panel

### Step 4: Test with Sample Data

Run the test script to create a sample AI forecast:

```bash
./test_ai_forecast.sh
```

This will:
- Create a flood forecast for Ho Chi Minh City
- Verify it appears in the API
- Test all endpoints (GET, POST, PATCH)
- Test confidence filtering

### Step 5: Verify on Map

1. Go to https://thongtinmualu.live/map
2. Open **Layer Control Panel** (top-left icon)
3. Enable **"🔮 Dự báo AI"** checkbox
4. Zoom to Ho Chi Minh City area
5. You should see a purple circular marker with confidence badge
6. Click marker to see detailed popup with:
   - AI summary
   - Confidence meter
   - Risk level badge
   - Data sources (collapsible)
   - Model metadata

## API Endpoints

### GET /ai-forecasts

Query AI forecasts with filters:

```bash
curl "https://api.thongtinmualu.live/ai-forecasts?lat=10.8231&lng=106.6297&radius_km=50&min_confidence=0.6&active_only=true"
```

**Parameters:**
- `lat`, `lng`, `radius_km` - Spatial filter
- `min_confidence` - Filter by confidence (0.0-1.0)
- `types` - Comma-separated hazard types
- `severity` - Comma-separated severity levels
- `active_only` - Only active forecasts (default: true)

### POST /ai-forecasts

Create new AI forecast (requires API key):

```bash
curl -X POST https://api.thongtinmualu.live/ai-forecasts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "flood",
    "severity": "high",
    "confidence": 0.85,
    "location": {"type": "Point", "coordinates": [106.6297, 10.8231]},
    "radius_km": 5.0,
    "forecast_time": "2025-11-21T04:00:00Z",
    "valid_until": "2025-11-21T10:00:00Z",
    "model_name": "FloodPredictorV2",
    "model_version": "2.1.0",
    "summary": "High flood risk forecast...",
    "data_sources": ["Weather stations", "River gauges"]
  }'
```

### PATCH /ai-forecasts/{id}

Update existing forecast:

```bash
curl -X PATCH https://api.thongtinmualu.live/ai-forecasts/{forecast_id} \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_ADMIN_TOKEN" \
  -d '{"confidence": 0.92}'
```

### POST /ai-forecasts/{id}/verify

Mark forecast as verified (link to actual event):

```bash
curl -X POST https://api.thongtinmualu.live/ai-forecasts/{forecast_id}/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_ADMIN_TOKEN" \
  -d '{"actual_event_id": "hazard-event-uuid"}'
```

### GET /ai-forecasts/stats/accuracy

Get model accuracy statistics:

```bash
curl "https://api.thongtinmualu.live/ai-forecasts/stats/accuracy?model_name=FloodPredictorV2"
```

## Integration with ML Models

ML models can submit forecasts via the POST endpoint:

```python
import requests
from datetime import datetime, timedelta

# Your ML model prediction
prediction = {
    "type": "flood",
    "severity": "high",
    "confidence": 0.87,
    "location": {
        "type": "Point",
        "coordinates": [lon, lat]
    },
    "radius_km": 10.0,
    "forecast_time": datetime.utcnow().isoformat() + "Z",
    "valid_until": (datetime.utcnow() + timedelta(hours=6)).isoformat() + "Z",
    "model_name": "YourModelName",
    "model_version": "1.0.0",
    "summary": "AI-generated forecast summary...",
    "predicted_duration_hours": 6,
    "risk_factors": ["Heavy rainfall", "River overflow"],
    "data_sources": ["Station A", "Station B"]
}

# Submit to API
response = requests.post(
    "https://api.thongtinmualu.live/ai-forecasts",
    headers={"X-API-Key": "YOUR_API_KEY"},
    json=prediction
)

forecast_id = response.json()["data"]["id"]
```

## Troubleshooting

### Migration fails with "relation already exists"

The table might already exist. Check with:
```bash
# In Render shell
psql $DATABASE_URL -c "SELECT * FROM ai_forecasts LIMIT 1;"
```

If exists, mark migration as applied:
```bash
alembic stamp 013
```

### Frontend doesn't show AI toggle

1. Check browser console for errors
2. Verify `NEXT_PUBLIC_API_URL` is set correctly
3. Clear browser cache and reload
4. Check Network tab for `/ai-forecasts` API calls

### No forecasts appearing on map

1. Verify forecasts exist:
   ```bash
   curl "https://api.thongtinmualu.live/ai-forecasts?limit=10"
   ```

2. Check if `aiForecast` layer is enabled in LayerControlPanel

3. Verify `min_confidence` threshold (default 0.6)

4. Check browser console for errors in AIForecastLayer

### CORS errors

Add frontend URL to `CORS_ORIGINS` in Render:
- Dashboard → `floodwatch-api` → Environment
- Add URL to `CORS_ORIGINS` (comma-separated)

## Monitoring

### Check forecast count

```bash
curl "https://api.thongtinmualu.live/ai-forecasts" | jq '.pagination.total'
```

### Check model accuracy

```bash
curl "https://api.thongtinmualu.live/ai-forecasts/stats/accuracy" | jq .
```

### Monitor API logs

- Render Dashboard → `floodwatch-api` → Logs
- Look for: `POST /ai-forecasts` (forecast creation)
- Look for: `GET /ai-forecasts` (frontend fetches)

## Next Steps

1. **Integrate ML models** - Connect your ML pipeline to POST endpoint
2. **Set up automated forecasts** - Schedule model runs via cron/Render
3. **Track accuracy** - Monitor true/false positives over time
4. **Add admin dashboard** - UI for managing forecasts (future feature)
5. **Implement notifications** - Alert users of high-confidence forecasts

## Support

For issues or questions:
- Check Render logs: Dashboard → Logs
- Test locally: `./test_ai_forecast.sh`
- Review migration: `apps/api/migrations/versions/013_ai_forecasts.py`
