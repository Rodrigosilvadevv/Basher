const list = (v, d) => (v || d).split(',').map((s) => s.trim()).filter(Boolean);

export const cfg = {
  PORT: Number(process.env.PORT || 3000),
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID || 'br.com.basher.app',
  // ID numérico do app no App Store Connect (obrigatório para validar em produção)
  APPLE_APP_ID: process.env.APPLE_APP_ID ? Number(process.env.APPLE_APP_ID) : undefined,
  APPLE_ROOT_CERTS_DIR: process.env.APPLE_ROOT_CERTS_DIR || '',
  CORS_ORIGINS: list(process.env.CORS_ORIGINS, 'capacitor://localhost,ionic://localhost,https://basher.com.br,https://www.basher.com.br,http://localhost:5173'),
  AGE_WEBHOOK_SECRET: process.env.AGE_WEBHOOK_SECRET || '',
};

// Mesmos IDs de app/src/config/plans.js
export const PRODUCT_KIND = {
  'br.com.basher.app.pro.monthly': 'pro',
  'br.com.basher.app.pro.yearly': 'pro',
  'br.com.basher.app.albums10': 'album_pack',
  'br.com.basher.app.group': 'group',
};

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!cfg[k]) console.warn(`[config] variável ${k} não definida`);
}
