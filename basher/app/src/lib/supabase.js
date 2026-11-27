import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Sessão persistida no localStorage do usuário (padrão do supabase-js).
export const supabase = env.DEMO
  ? null
  : createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'basher-auth',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
