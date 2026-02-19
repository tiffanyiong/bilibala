# Traffic Analytics Queries

This document contains SQL queries to analyze your app's traffic using the `browser_fingerprints` table.

## Prerequisites

1. Apply migration 026: Fix RLS policies for anonymous access
2. Apply migration 027: Add page visit tracking columns

## Key Metrics

### Total Unique Visitors (All Time)

```sql
SELECT COUNT(*) as total_unique_visitors
FROM browser_fingerprints;
```

### Anonymous vs Authenticated Visitors

```sql
SELECT
  COUNT(*) FILTER (WHERE user_id IS NULL) as anonymous_visitors,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) as authenticated_visitors,
  COUNT(*) as total_visitors
FROM browser_fingerprints;
```

### New Visitors (Last 7 Days)

```sql
SELECT
  DATE(first_page_visit_at) as date,
  COUNT(*) as new_visitors
FROM browser_fingerprints
WHERE first_page_visit_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(first_page_visit_at)
ORDER BY date DESC;
```

### Active Visitors (Last 30 Days)

```sql
SELECT COUNT(*) as active_visitors
FROM browser_fingerprints
WHERE last_page_visit_at > NOW() - INTERVAL '30 days';
```

### Total Page Visits (All Sessions)

```sql
SELECT SUM(page_visit_count) as total_visits
FROM browser_fingerprints;
```

### Average Visits Per Device

```sql
SELECT AVG(page_visit_count)::NUMERIC(10,2) as avg_visits_per_device
FROM browser_fingerprints;
```

## Conversion Funnel

### Landing → Video Analysis → Sign Up

```sql
SELECT
  COUNT(*) as landed,
  COUNT(*) FILTER (WHERE monthly_usage_count > 0) as analyzed_video,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) as signed_up,

  -- Conversion rates
  ROUND(COUNT(*) FILTER (WHERE monthly_usage_count > 0) * 100.0 / COUNT(*), 2) as analyze_rate_pct,
  ROUND(COUNT(*) FILTER (WHERE user_id IS NOT NULL) * 100.0 / COUNT(*), 2) as signup_rate_pct
FROM browser_fingerprints;
```

### Video Analysis to Sign Up Conversion

```sql
SELECT
  COUNT(*) FILTER (WHERE monthly_usage_count > 0) as users_who_analyzed,
  COUNT(*) FILTER (WHERE monthly_usage_count > 0 AND user_id IS NOT NULL) as analyzed_and_signed_up,
  ROUND(
    COUNT(*) FILTER (WHERE monthly_usage_count > 0 AND user_id IS NOT NULL) * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE monthly_usage_count > 0), 0),
    2
  ) as conversion_rate_pct
FROM browser_fingerprints;
```

## User Engagement

### Return Visitor Rate

```sql
SELECT
  COUNT(*) FILTER (WHERE page_visit_count = 1) as one_time_visitors,
  COUNT(*) FILTER (WHERE page_visit_count > 1) as returning_visitors,
  ROUND(
    COUNT(*) FILTER (WHERE page_visit_count > 1) * 100.0 / COUNT(*),
    2
  ) as return_rate_pct
FROM browser_fingerprints;
```

### Most Engaged Devices (Top 10)

```sql
SELECT
  fingerprint_hash,
  page_visit_count,
  monthly_usage_count,
  practice_session_count,
  first_page_visit_at,
  last_page_visit_at,
  user_id IS NOT NULL as is_member
FROM browser_fingerprints
ORDER BY page_visit_count DESC
LIMIT 10;
```

### User Journey Timeline

```sql
SELECT
  fingerprint_hash,
  first_page_visit_at as first_visit,
  (SELECT MIN(created_at) FROM usage_history WHERE user_id = bf.user_id) as first_video_analysis,
  (SELECT created_at FROM auth.users WHERE id = bf.user_id) as signup_date,
  page_visit_count as total_visits
FROM browser_fingerprints bf
WHERE user_id IS NOT NULL
ORDER BY first_page_visit_at DESC
LIMIT 20;
```

## Growth Metrics

### Daily Active Visitors (Last 30 Days)

```sql
SELECT
  DATE(last_page_visit_at) as date,
  COUNT(DISTINCT fingerprint_hash) as daily_active_visitors
FROM browser_fingerprints
WHERE last_page_visit_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(last_page_visit_at)
ORDER BY date DESC;
```

### Weekly Growth Rate

```sql
WITH weekly_visitors AS (
  SELECT
    DATE_TRUNC('week', first_page_visit_at) as week,
    COUNT(*) as new_visitors
  FROM browser_fingerprints
  WHERE first_page_visit_at > NOW() - INTERVAL '8 weeks'
  GROUP BY DATE_TRUNC('week', first_page_visit_at)
)
SELECT
  week,
  new_visitors,
  LAG(new_visitors) OVER (ORDER BY week) as previous_week,
  ROUND(
    (new_visitors - LAG(new_visitors) OVER (ORDER BY week)) * 100.0 /
    NULLIF(LAG(new_visitors) OVER (ORDER BY week), 0),
    2
  ) as growth_rate_pct
FROM weekly_visitors
ORDER BY week DESC;
```

### Monthly Retention

```sql
-- Visitors who came back in the following month
WITH monthly_cohorts AS (
  SELECT
    DATE_TRUNC('month', first_page_visit_at) as cohort_month,
    fingerprint_hash
  FROM browser_fingerprints
),
retention AS (
  SELECT
    cohort_month,
    COUNT(*) as cohort_size,
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM browser_fingerprints bf2
        WHERE bf2.fingerprint_hash = monthly_cohorts.fingerprint_hash
        AND DATE_TRUNC('month', bf2.last_page_visit_at) > cohort_month
      )
    ) as returned_next_month
  FROM monthly_cohorts
  GROUP BY cohort_month
)
SELECT
  cohort_month,
  cohort_size,
  returned_next_month,
  ROUND(returned_next_month * 100.0 / cohort_size, 2) as retention_rate_pct
FROM retention
ORDER BY cohort_month DESC;
```

## Device & Usage Analysis

### Devices by Video Analysis Activity

```sql
SELECT
  CASE
    WHEN monthly_usage_count = 0 THEN '0 - Just browsed'
    WHEN monthly_usage_count = 1 THEN '1 - Tried once'
    WHEN monthly_usage_count BETWEEN 2 AND 5 THEN '2-5 - Light user'
    WHEN monthly_usage_count > 5 THEN '5+ - Power user'
  END as usage_segment,
  COUNT(*) as device_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM browser_fingerprints
GROUP BY usage_segment
ORDER BY MIN(monthly_usage_count);
```

### Average Time Between Visits

```sql
SELECT
  fingerprint_hash,
  page_visit_count,
  first_page_visit_at,
  last_page_visit_at,
  EXTRACT(EPOCH FROM (last_page_visit_at - first_page_visit_at)) / 86400 as days_between_first_last,
  CASE
    WHEN page_visit_count > 1 THEN
      EXTRACT(EPOCH FROM (last_page_visit_at - first_page_visit_at)) / 86400 / (page_visit_count - 1)
    ELSE NULL
  END as avg_days_between_visits
FROM browser_fingerprints
WHERE page_visit_count > 1
ORDER BY page_visit_count DESC
LIMIT 20;
```

## Usage by Time

### Visits by Hour of Day (Last 7 Days)

```sql
SELECT
  EXTRACT(HOUR FROM last_page_visit_at) as hour_of_day,
  COUNT(*) as visits
FROM browser_fingerprints
WHERE last_page_visit_at > NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM last_page_visit_at)
ORDER BY hour_of_day;
```

### Visits by Day of Week (Last 30 Days)

```sql
SELECT
  TO_CHAR(last_page_visit_at, 'Day') as day_of_week,
  COUNT(*) as visits
FROM browser_fingerprints
WHERE last_page_visit_at > NOW() - INTERVAL '30 days'
GROUP BY TO_CHAR(last_page_visit_at, 'Day'), EXTRACT(DOW FROM last_page_visit_at)
ORDER BY EXTRACT(DOW FROM last_page_visit_at);
```

## Combined Analytics Dashboard Query

```sql
WITH stats AS (
  SELECT
    COUNT(*) as total_visitors,
    COUNT(*) FILTER (WHERE user_id IS NULL) as anonymous,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as members,
    SUM(page_visit_count) as total_visits,
    SUM(monthly_usage_count) as total_video_analyses,
    COUNT(*) FILTER (WHERE last_page_visit_at > NOW() - INTERVAL '30 days') as active_last_30d,
    COUNT(*) FILTER (WHERE first_page_visit_at > NOW() - INTERVAL '7 days') as new_last_7d,
    COUNT(*) FILTER (WHERE page_visit_count > 1) as returning_visitors
  FROM browser_fingerprints
)
SELECT
  total_visitors,
  anonymous,
  members,
  total_visits,
  total_video_analyses,
  active_last_30d,
  new_last_7d,
  returning_visitors,
  ROUND(members * 100.0 / total_visitors, 2) as signup_rate_pct,
  ROUND(returning_visitors * 100.0 / total_visitors, 2) as return_rate_pct,
  ROUND(total_visits::NUMERIC / total_visitors, 2) as avg_visits_per_visitor,
  ROUND(total_video_analyses * 100.0 / total_visitors, 2) as analyze_rate_pct
FROM stats;
```

---

## How to Use These Queries

1. **In Supabase Dashboard:**
   - Go to SQL Editor
   - Copy/paste any query
   - Click "Run"

2. **In your app (future feature):**
   - Create an admin dashboard
   - Use Supabase client to fetch these metrics
   - Visualize with charts

3. **Via API:**
   - Create a protected admin route
   - Execute queries server-side
   - Return JSON for dashboard

---

## Notes

- All queries assume migrations 026 and 027 have been applied
- `page_visit_count` = number of sessions (not page refreshes)
- Anonymous users have `user_id = NULL`
- Timestamps are in UTC
