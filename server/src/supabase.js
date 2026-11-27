import { createClient } from '@supabase/supabase-js';
import { cfg } from './config.js';

// Cliente com a service_role: ignora RLS. Nunca exponha essa chave no app.
export const admin = createClient(cfg.SUPABASE_URL || 'http://localhost', cfg.SUPABASE_SERVICE_ROLE_KEY || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function userFromRequest(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user;
}
