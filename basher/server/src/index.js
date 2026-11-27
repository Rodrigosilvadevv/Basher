import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { cfg } from './config.js';
import { admin, userFromRequest } from './supabase.js';
import { decodeTransaction, decodeNotification } from './apple.js';
import { applyTransaction } from './grants.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || cfg.CORS_ORIGINS.includes(origin)),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// limite simples por IP
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const h = hits.get(key) || { n: 0, t: now };
    if (now - h.t > windowMs) { h.n = 0; h.t = now; }
    h.n++;
    hits.set(key, h);
    if (h.n > max) return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > 600000) hits.delete(k); }, 300000).unref();

const auth = async (req, res, next) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  req.user = user;
  next();
};

app.get('/health', (_req, res) => res.json({ ok: true, service: 'basher-api', time: new Date().toISOString() }));

// 1) O app manda o JWS da compra (StoreKit 2). Validamos a assinatura da Apple e liberamos.
app.post('/iap/apple/verify', rateLimit(30, 60000), auth, async (req, res) => {
  const { jws } = req.body || {};
  if (!jws || typeof jws !== 'string') return res.status(400).json({ error: 'JWS_REQUIRED' });
  try {
    const { env, data: tx } = await decodeTransaction(jws);
    const result = await applyTransaction(tx, { userId: req.user.id, environment: env, reason: 'purchase' });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[iap/verify]', e?.message || e);
    res.status(400).json({ error: String(e?.message || 'VERIFY_FAILED') });
  }
});

// 2) App Store Server Notifications V2 (renovação, expiração, reembolso...).
//    Configure a URL https://api.basher.com.br/iap/apple/notifications no App Store Connect.
const RENEW = new Set(['SUBSCRIBED', 'DID_RENEW', 'OFFER_REDEEMED', 'RENEWAL_EXTENDED', 'REFUND_REVERSED', 'ONE_TIME_CHARGE']);
const EXPIRE = new Set(['EXPIRED', 'GRACE_PERIOD_EXPIRED']);
const REVOKE = new Set(['REFUND', 'REVOKE']);

app.post('/iap/apple/notifications', rateLimit(300, 60000), async (req, res) => {
  const { signedPayload } = req.body || {};
  if (!signedPayload) return res.status(400).json({ error: 'PAYLOAD_REQUIRED' });
  try {
    const { env, data: n } = await decodeNotification(signedPayload);
    const type = n.notificationType;
    if (type === 'TEST') return res.json({ ok: true, test: true });
    const signedTx = n.data?.signedTransactionInfo;
    if (!signedTx) return res.json({ ok: true, ignored: type });
    const { data: tx } = await decodeTransaction(signedTx);
    const reason = REVOKE.has(type) ? 'revoke' : EXPIRE.has(type) ? 'expire' : RENEW.has(type) ? 'renew' : null;
    if (!reason) return res.json({ ok: true, ignored: type });
    const result = await applyTransaction(tx, { environment: env, reason });
    console.log('[iap/notification]', type, n.subtype || '', result);
    res.json({ ok: true });
  } catch (e) {
    console.error('[iap/notification]', e?.message || e);
    // 500 faz a Apple tentar de novo mais tarde
    res.status(500).json({ error: 'NOTIFICATION_FAILED' });
  }
});

// 3) Exclusão de conta (exigência da App Store e da LGPD): apaga arquivos e o usuário.
async function listAll(bucket, prefix) {
  const out = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) return out;
  for (const item of data) {
    const full = `${prefix}/${item.name}`;
    if (item.id === null) out.push(...(await listAll(bucket, full)));
    else out.push(full);
  }
  return out;
}

app.post('/account/delete', rateLimit(5, 60000), auth, async (req, res) => {
  const uid = req.user.id;
  try {
    for (const bucket of ['photos', 'posts', 'albums']) {
      const files = await listAll(bucket, uid);
      for (let i = 0; i < files.length; i += 100) await admin.storage.from(bucket).remove(files.slice(i, i + 100));
    }
    const { data: imgs } = await admin.from('messages').select('meta').eq('sender_id', uid).eq('kind', 'image');
    const chatPaths = (imgs || []).map((m) => m.meta?.path).filter(Boolean);
    for (let i = 0; i < chatPaths.length; i += 100) await admin.storage.from('chat').remove(chatPaths.slice(i, i + 100));
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('[account/delete]', e?.message || e);
    res.status(500).json({ error: 'DELETE_FAILED' });
  }
});

// 4) (Opcional) Webhook de um provedor de verificação de idade (ex.: selfie/documento).
//    Assinatura: header x-basher-signature = HMAC-SHA256(corpo, AGE_WEBHOOK_SECRET) em hex.
app.post('/age/webhook', rateLimit(120, 60000), async (req, res) => {
  if (!cfg.AGE_WEBHOOK_SECRET) return res.status(404).end();
  const sig = String(req.headers['x-basher-signature'] || '');
  const expected = crypto.createHmac('sha256', cfg.AGE_WEBHOOK_SECRET).update(req.rawBody || '').digest('hex');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).json({ error: 'BAD_SIGNATURE' });
  }
  const { user_id, verified, min_age, method } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'USER_REQUIRED' });
  if (verified && Number(min_age) >= 18) {
    await admin.from('profile_private').update({ age_verified_at: new Date().toISOString(), age_verification_method: String(method || 'provider').slice(0, 60) }).eq('id', user_id);
  } else {
    await admin.from('profiles').update({ suspended_at: new Date().toISOString(), onboarded: false }).eq('id', user_id);
  }
  res.json({ ok: true });
});

app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

app.listen(cfg.PORT, () => console.log(`basher-api ouvindo na porta ${cfg.PORT}`));
