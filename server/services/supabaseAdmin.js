import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

// Shared Supabase admin client (service role — full access)
// Note: Using native fetch with default Node.js SSL/TLS settings
export const supabaseAdmin = config.supabase.url && config.supabase.serviceRoleKey
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Extract authenticated user from a request's Authorization header.
 * @param {import('express').Request} req
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function getUserFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!supabaseAdmin) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
