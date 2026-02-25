import express from 'express';
import { getUserFromToken, supabaseAdmin } from '../services/supabaseAdmin.js';

const router = express.Router();

/**
 * POST /api/analytics/page-visit
 * Records page visit with browser fingerprint and IP address
 * ✅ ALLOWS ANONYMOUS - used for tracking landing page visits
 */
router.post('/analytics/page-visit', async (req, res) => {
  try {
    const { fingerprintHash } = req.body;

    if (!fingerprintHash) {
      return res.status(400).json({ error: 'Missing fingerprintHash' });
    }

    // Extract IP address from request (server-side only)
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim()
                   || req.headers['x-real-ip']
                   || req.socket.remoteAddress
                   || req.ip
                   || null;

    // Try to get user ID if authenticated (optional)
    const user = await getUserFromToken(req);
    const userId = user?.id || null;

    const now = new Date().toISOString();

    // Check if fingerprint exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('browser_fingerprints')
      .select('id, page_visit_count, user_id, ip_address')
      .eq('fingerprint_hash', fingerprintHash)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Analytics] Error fetching fingerprint:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch fingerprint' });
    }

    if (existing) {
      // Update existing fingerprint
      const updateData = {
        page_visit_count: (existing.page_visit_count || 0) + 1,
        last_page_visit_at: now,
        last_seen_at: now,
        ip_address: ipAddress,
        last_ip_at: now
      };

      // Link to user if signed in and not already linked
      if (userId && !existing.user_id) {
        updateData.user_id = userId;
      }

      const { error } = await supabaseAdmin
        .from('browser_fingerprints')
        .update(updateData)
        .eq('id', existing.id);

      if (error) {
        console.error('[Analytics] Error updating page visit:', error);
        return res.status(500).json({ error: 'Failed to update page visit' });
      }
    } else {
      // New visitor - insert fingerprint with IP
      const { error } = await supabaseAdmin
        .from('browser_fingerprints')
        .insert({
          fingerprint_hash: fingerprintHash,
          user_id: userId,
          page_visit_count: 1,
          first_page_visit_at: now,
          last_page_visit_at: now,
          first_seen_at: now,
          last_seen_at: now,
          ip_address: ipAddress,
          last_ip_at: now,
          monthly_usage_count: 0,
          usage_reset_month: new Date().toISOString().slice(0, 7) // YYYY-MM
        });

      if (error) {
        console.error('[Analytics] Error inserting page visit:', error);
        return res.status(500).json({ error: 'Failed to insert page visit' });
      }
    }

    res.json({
      success: true,
      ip_address: ipAddress,
      user_linked: !!userId
    });
  } catch (error) {
    console.error('[Analytics] Error in /analytics/page-visit:', error);
    res.status(500).json({ error: 'Failed to track page visit' });
  }
});

export default router;
