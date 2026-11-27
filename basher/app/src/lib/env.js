const url = import.meta.env.VITE_SUPABASE_URL;

export const env = {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  API_URL: (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''),
  APP_URL: (import.meta.env.VITE_APP_URL || 'https://basher.com.br').replace(/\/$/, ''),
  // Sem Supabase configurado o app roda sozinho com dados simulados.
  DEMO: import.meta.env.VITE_DEMO === 'true' || !url,
  ROUTER: import.meta.env.VITE_ROUTER || 'browser',
  DEEP_LINK: 'basher://auth/callback',
  MAP_TILES: import.meta.env.VITE_MAP_TILES || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  MAP_ATTRIBUTION: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; OpenStreetMap &copy; CARTO',
  TERMS_URL: (import.meta.env.VITE_APP_URL || 'https://basher.com.br') + '/legal/termos.html',
  PRIVACY_URL: (import.meta.env.VITE_APP_URL || 'https://basher.com.br') + '/legal/privacidade.html',
  SUPPORT_EMAIL: 'suporte@basher.com.br',
};

// Centro padrão (Frei Caneca/Augusta, SP) quando a localização não está disponível.
export const DEFAULT_COORDS = { lat: -23.5535, lng: -46.6528 };
