import express from 'express';
import { supabaseAdmin } from '../services/supabaseAdmin.js';

const router = express.Router();

/**
 * GET /api/config
 * Fetch all app configuration
 * Public endpoint - no auth required
 */
router.get('/config', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('key, value');

    if (error) {
      console.error('Error fetching app config:', error);
      return res.status(500).json({ error: 'Failed to fetch app configuration' });
    }

    // Convert to key-value map
    const config = (data || []).reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});

    res.json(config);
  } catch (err) {
    console.error('Error in /api/config:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/config/:key
 * Fetch a specific app configuration value
 * Public endpoint - no auth required
 */
router.get('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: `Config key '${key}' not found` });
      }
      console.error(`Error fetching app config for key '${key}':`, error);
      return res.status(500).json({ error: 'Failed to fetch app configuration' });
    }

    // Parse config value based on key
    let parsedValue = data.value;

    if (key === 'enabled_target_languages' || key === 'enabled_native_languages') {
      // Convert comma-separated string to array
      parsedValue = data.value
        .split(',')
        .map(lang => lang.trim())
        .filter(lang => lang.length > 0);
    }

    res.json(parsedValue);
  } catch (err) {
    console.error('Error in /api/config/:key:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
