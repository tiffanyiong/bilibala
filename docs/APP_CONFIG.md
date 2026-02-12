# App Configuration Management

The app uses a database-driven configuration system that allows enabling/disabling features without code deployments.

## Configuration Table

All app configuration is stored in the `app_config` table:
- **key**: Configuration key (e.g., `enabled_target_languages`)
- **value**: JSONB value
- **description**: Human-readable description
- **updated_at**: Last update timestamp

## Managing Enabled Languages

### View Current Configuration

```sql
SELECT * FROM app_config WHERE key = 'enabled_target_languages';
```

### Enable/Disable Languages

**Method 1: Using the helper function (Recommended)**
```sql
-- Enable English only
SELECT update_app_config(
  'enabled_target_languages',
  'English'
);

-- Enable English and Chinese
SELECT update_app_config(
  'enabled_target_languages',
  'English,Chinese'
);

-- Enable English, Chinese, and Japanese
SELECT update_app_config(
  'enabled_target_languages',
  'English,Chinese,Japanese'
);
```

**Method 2: Direct UPDATE**
```sql
UPDATE app_config
SET value = 'English',
    updated_at = NOW()
WHERE key = 'enabled_target_languages';
```

**Note:** Use comma-separated values (no spaces needed, they'll be trimmed automatically).

### Available Languages

The language codes must match the `code` field in the `LANGUAGES` constant:
- `English`
- `Spanish`
- `French`
- `German`
- `Portuguese`
- `Japanese`
- `Korean`
- `Chinese`
- `Hindi`
- `Italian`
- `Russian`
- `Arabic`
- `Indonesian`
- `Turkish`
- `Vietnamese`

**Note:** The language code is case-sensitive and must match exactly.

## Applying the Migration

### Production (Supabase)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/015_app_config.sql`
4. Click **Run**

### Verifying the Migration

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'app_config'
);

-- View all config
SELECT * FROM app_config;
```

## Frontend Usage

The frontend automatically fetches enabled languages from the backend API on app load:

```typescript
import { useAppConfig } from '@/shared/hooks/useAppConfig';

function MyComponent() {
  const { enabledLanguages, isLoading } = useAppConfig();

  // enabledLanguages is an array of language objects
  // filtered based on the database config
}
```

## API Endpoints

- `GET /api/config` - Fetch all app configuration
- `GET /api/config/:key` - Fetch specific config value (e.g., `/api/config/enabled_target_languages`)

Both endpoints are public (no authentication required).

## Troubleshooting

### Changes not reflecting in frontend

1. **Clear browser cache**: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. **Check backend logs**: Ensure the API endpoint is returning the updated value
3. **Verify database**: Run `SELECT * FROM app_config WHERE key = 'enabled_target_languages'`
4. **Check network tab**: Look for the API call to `/api/config/enabled_target_languages`

### Frontend showing old values after database update

The frontend caches the config in memory. To force a refresh:
- Reload the page (the config is fetched fresh on each page load)
- Or clear browser cache and reload

### Migration not applied

If you see errors about missing table/function:
1. Ensure migration 015 was run successfully
2. Check Supabase logs for any migration errors
3. Re-run the migration SQL if needed

## Future Configurations

You can add more configuration keys to the `app_config` table:

```sql
-- Example: Feature flags
SELECT update_app_config(
  'feature_flags',
  '{"ai_tutor_enabled": true, "video_download_enabled": false}'::jsonb,
  'Feature flags for toggling features on/off'
);

-- Example: Rate limits
SELECT update_app_config(
  'rate_limits',
  '{"api_calls_per_minute": 60, "video_analyses_per_day": 10}'::jsonb,
  'Rate limiting configuration'
);
```
