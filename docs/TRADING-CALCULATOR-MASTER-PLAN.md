# Roblox Trading Calculator - Complete Implementation Plan

**Last Updated:** 2026-01-26  
**Status:** Clean slate with working APIs discovered

---

## 🎯 Goal

Build a trading calculator that calculates fair trade values for ALL Roblox tradeable items (Classic Limiteds + UGC Limiteds) using official Roblox APIs.

---

## ✅ What We Discovered

### Official Roblox APIs That Work:

**1. Classic Limiteds (~2,500 items)**
```
GET https://economy.roblox.com/v1/assets/{assetId}/resale-data
Returns: RAP, priceDataPoints[], volumeDataPoints[]
```

**2. UGC Limiteds (~100,000+ items)**  
```
GET https://apis.roblox.com/marketplace-sales/v1/item/{collectibleItemId}/resale-data
Returns: RAP, priceDataPoints[], volumeDataPoints[]
```

**3. Search/Discovery**
```
GET https://catalog.roblox.com/v1/search/items/details?salesTypeFilter=3
Returns: UGC Limiteds with collectibleItemId
```

---

## 📊 Complete Architecture

### Phase 1: Data Collection
1. **Collect Classic Limiteds** (use Rolimons list - 2,514 items)
2. **Collect UGC Limiteds** (use salesTypeFilter=3, paginate through all)
3. **Fetch RAP data** for both types
4. **Store in database** with proper structure

### Phase 2: Metrics Calculation
1. **Calculate adjusted value** (VWAP from price/volume history)
2. **Calculate trend** (linear regression on prices)
3. **Calculate demand** (sales velocity + consistency)
4. **Detect projected** (outlier detection)
5. **Store calculated metrics**

### Phase 3: Comparison & Validation
1. **Fetch Rolimons data** (for comparison only)
2. **Compare our calculations** vs Rolimons
3. **Track accuracy metrics**
4. **Flag discrepancies**

### Phase 4: API & Frontend
1. **Create API routes** to serve data
2. **Build calculator UI**
3. **Real-time trade analysis**

---

## 🗄️ Database Schema (Already Done)

```sql
-- Extended columns in roblox_catalog_items:
- rap (from Roblox API)
- rap_sales
- rap_price_points (JSONB - historical prices)
- rap_volume_points (JSONB - historical volumes)
- rap_last_fetched

-- Calculated metrics (we'll populate):
- trading_value (our VWAP calculation)
- trend_direction (rising/stable/falling)
- demand_level (amazing/popular/normal/terrible)
- is_projected (boolean - manipulation flag)
- metrics_last_calculated

-- Comparison data (optional):
- rolimons_value (for comparison)
- rolimons_demand
- rolimons_trend
```

---

## 📝 Scripts We Need

### 1. `scripts/collect-all-limiteds.ts`
**Purpose:** Collect ALL tradeable items (Classic + UGC)

**Logic:**
```typescript
// Part A: Classic Limiteds
- Fetch from Rolimons API (2,514 items with asset IDs)
- Insert into DB with is_limited=true, item_type='classic'

// Part B: UGC Limiteds  
- Search salesTypeFilter=3, paginate all pages
- Filter for hasResellers=true OR lowestResalePrice > 0
- Insert into DB with is_limited=true, item_type='ugc'
- Store collectibleItemId

Result: ~100K+ items in database
```

### 2. `scripts/fetch-rap-data.ts`
**Purpose:** Fetch RAP + price history for all Limiteds

**Logic:**
```typescript
// Get items needing RAP update
- WHERE is_limited=true AND (rap IS NULL OR rap_last_fetched < NOW() - 12 hours)
- LIMIT 100 per run

// For each item:
if (item.item_type === 'classic') {
  // Use economy API with assetId
  data = await fetch(`economy.roblox.com/v1/assets/${item.asset_id}/resale-data`)
} else if (item.item_type === 'ugc') {
  // Use marketplace-sales API with collectibleItemId
  data = await fetch(`apis.roblox.com/marketplace-sales/v1/item/${item.collectible_item_id}/resale-data`)
}

// Save: rap, rap_sales, rap_price_points, rap_volume_points
// Handle errors gracefully (some items may not have data yet)
```

### 3. `scripts/calculate-metrics.ts`
**Purpose:** Calculate trading metrics from RAP data

**Logic:**
```typescript
// Get items needing calculation
- WHERE rap IS NOT NULL AND rap_price_points IS NOT NULL
- AND (metrics_last_calculated IS NULL OR metrics_last_calculated < rap_last_fetched)

// For each item calculate:

1. Trading Value (VWAP):
   value = Σ(price[i] × volume[i]) / Σ(volume[i])

2. Trend (Linear Regression):
   slope = linearRegression(pricePoints)
   trend = slope > threshold ? 'rising' : slope < -threshold ? 'falling' : 'stable'

3. Demand (Sales Velocity):
   avgSalesPerDay = sum(volumes) / days
   consistency = stdDev(volumes)
   demand = categorize(avgSalesPerDay, consistency)

4. Projected Detection:
   if (RAP - VWAP) / VWAP > 0.30: is_projected = true
   (RAP 30%+ higher than true value = projected)

// Save all calculated metrics
```

### 4. `scripts/compare-rolimons.ts` (Optional)
**Purpose:** Fetch Rolimons data for comparison

**Logic:**
```typescript
// Fetch Rolimons item details
- GET https://www.rolimons.com/itemapi/itemdetails
- Parse value, demand, trend for each item

// Store in separate columns for comparison:
- rolimons_value, rolimons_demand, rolimons_trend
- rolimons_last_fetched

// Calculate accuracy:
- How close is our trading_value to rolimons_value?
- Do our trends match?
- Track metrics over time
```

---

## ⚙️ Automation Strategy

### Cron Jobs:

```bash
# Every 24 hours: Collect new UGC Limiteds
0 3 * * * npm run trading:collect-limiteds

# Every 12 hours: Fetch RAP data (in batches)
0 */12 * * * npm run trading:fetch-rap

# Every 1 hour: Calculate metrics for updated items
0 * * * * npm run trading:calculate-metrics

# Every 24 hours: Compare with Rolimons (optional)
0 4 * * * npm run trading:compare-rolimons
```

---

## 🎨 Frontend Calculator

### User Flow:
1. User adds items to "Give" list
2. User adds items to "Receive" list
3. Calculator shows:
   - Total value of each side
   - Win/Fair/Lose verdict
   - Value difference
   - Trend indicators
   - Demand levels
   - Projected warnings

### API Routes:
```typescript
GET /api/trading/search?q=clockwork
→ Search items by name

GET /api/trading/items/:id
→ Get full item details + metrics

POST /api/trading/calculate
→ Calculate trade verdict
Body: { giving: [ids], receiving: [ids] }
→ Returns: verdict, value_diff, warnings
```

---

## 📈 Data Quality & Accuracy

### Metrics to Track:
1. **Coverage:** % of items with RAP data
2. **Freshness:** Avg age of RAP data
3. **Accuracy:** Our value vs Rolimons value (RMSE)
4. **Trend accuracy:** % match with Rolimons trends

### Quality Checks:
- Flag items with <10 price points (unreliable)
- Flag outliers in price data
- Require minimum trade volume for demand calc

---

## 🚀 Implementation Order

**Week 1: Data Collection**
1. ✅ Database migration (DONE)
2. Create `collect-all-limiteds.ts`
3. Create `fetch-rap-data.ts`
4. Run collection (may take hours for 100K items)

**Week 2: Calculations**
1. Create `calculate-metrics.ts`
2. Implement VWAP, trend, demand algorithms
3. Test on sample items
4. Run on full dataset

**Week 3: Validation**
1. Create `compare-rolimons.ts`
2. Analyze accuracy
3. Tune algorithms if needed

**Week 4: Frontend**
1. Create API routes
2. Build calculator UI
3. Test with real trades
4. Deploy

---

## 📊 Expected Results

**Data Coverage:**
- Classic Limiteds: ~2,500 items, 90%+ with RAP
- UGC Limiteds: ~100,000 items, ~30-50% with RAP (newer items)
- Total: 100K+ items, varying data quality

**Calculation Accuracy:**
- Value: ±10% of Rolimons (goal)
- Trend: 80%+ match (goal)
- Demand: 70%+ match (goal)

**Update Frequency:**
- RAP data: Every 12 hours
- Calculations: Every 1 hour
- New items: Every 24 hours

---

## 🔑 Key Decisions

1. **Use official Roblox APIs only** ✅
2. **Support both Classic + UGC Limiteds** ✅
3. **Use Rolimons for comparison only** (not primary data)
4. **Calculate our own metrics** (don't copy Rolimons)
5. **Focus on accuracy over speed**

---

## 📋 Next Steps

**Right now, let's:**
1. Create `collect-all-limiteds.ts` (master collection script)
2. Create `fetch-rap-data.ts` (unified RAP fetcher)
3. Test on 100 items first
4. Then scale to full dataset

**Ready to start building?**
