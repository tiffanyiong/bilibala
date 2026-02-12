import express from 'express';
import { supabaseAdmin, getUserFromToken } from '../services/supabaseAdmin.js';

const router = express.Router();

// ============================================
// POST /api/sessions/register
// Register a new session and handle auto-logout of old sessions
// ============================================
router.post('/sessions/register', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      sessionId,
      deviceFingerprint,
      userAgent,
      ipAddress,
      deviceInfo,
      expiresAt,
    } = req.body;

    if (!sessionId || !deviceFingerprint) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, deviceFingerprint' });
    }

    // Call database function to register session
    const { data, error } = await supabaseAdmin.rpc('register_session', {
      p_user_id: user.id,
      p_session_id: sessionId,
      p_device_fingerprint: deviceFingerprint,
      p_user_agent: userAgent || null,
      p_ip_address: ipAddress || null,
      p_device_info: deviceInfo || {},
      p_expires_at: expiresAt || null,
    });

    if (error) {
      console.error('[Session] Error registering session:', error);
      return res.status(500).json({ error: 'Failed to register session' });
    }

    // Response includes sessions that were auto-logged out
    console.log('[Session] Registered session for user:', user.id, {
      sessionId,
      deviceFingerprint,
      loggedOutCount: data?.logged_out_count || 0,
      sessionLimit: data?.session_limit,
    });

    res.json({
      success: true,
      sessionLimit: data.session_limit,
      loggedOutSessions: data.logged_out_sessions || [],
      loggedOutCount: data.logged_out_count || 0,
    });
  } catch (error) {
    console.error('[Session] Error in /sessions/register:', error);
    res.status(500).json({ error: 'Failed to register session' });
  }
});

// ============================================
// POST /api/sessions/heartbeat
// Update session activity timestamp
// ============================================
router.post('/sessions/heartbeat', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const { data, error } = await supabaseAdmin.rpc('update_session_activity', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('[Session] Error updating heartbeat:', error);
      return res.status(500).json({ error: 'Failed to update session activity' });
    }

    res.json({ success: data });
  } catch (error) {
    console.error('[Session] Error in /sessions/heartbeat:', error);
    res.status(500).json({ error: 'Failed to update session activity' });
  }
});

// ============================================
// POST /api/sessions/remove
// Remove a session (on logout)
// ============================================
router.post('/sessions/remove', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const { data, error } = await supabaseAdmin.rpc('remove_session', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('[Session] Error removing session:', error);
      return res.status(500).json({ error: 'Failed to remove session' });
    }

    console.log('[Session] Removed session:', sessionId, 'for user:', user.id);

    res.json({ success: data });
  } catch (error) {
    console.error('[Session] Error in /sessions/remove:', error);
    res.status(500).json({ error: 'Failed to remove session' });
  }
});

// ============================================
// GET /api/sessions/active
// Get all active sessions for current user
// ============================================
router.get('/sessions/active', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current session count and limit
    const { data: sessionLimit } = await supabaseAdmin.rpc('get_session_limit', {
      p_user_id: user.id,
    });

    const { data: sessionCount } = await supabaseAdmin.rpc('get_active_session_count', {
      p_user_id: user.id,
    });

    // Get all active sessions
    const { data: sessions, error } = await supabaseAdmin
      .from('active_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_active_at', { ascending: false });

    if (error) {
      console.error('[Session] Error fetching active sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }

    res.json({
      sessions: sessions || [],
      count: sessionCount || 0,
      limit: sessionLimit || 1,
    });
  } catch (error) {
    console.error('[Session] Error in /sessions/active:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// ============================================
// POST /api/sessions/check
// Check if current session is still valid (hasn't been logged out)
// ============================================
router.post('/sessions/check', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Check if session exists in active_sessions table
    const { data: session, error } = await supabaseAdmin
      .from('active_sessions')
      .select('id, expires_at')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (not an error, just means logged out)
      console.error('[Session] Error checking session:', error);
      return res.status(500).json({ error: 'Failed to check session' });
    }

    const isValid = !!session && (!session.expires_at || new Date(session.expires_at) > new Date());

    res.json({ valid: isValid });
  } catch (error) {
    console.error('[Session] Error in /sessions/check:', error);
    res.status(500).json({ error: 'Failed to check session' });
  }
});

export default router;
