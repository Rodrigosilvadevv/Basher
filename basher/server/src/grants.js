// Libera (ou retira) o que foi comprado, de forma idempotente.
import { admin } from './supabase.js';
import { cfg, PRODUCT_KIND } from './config.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

async function resolveUser(tx, hint) {
  if (tx.appAccountToken && UUID.test(tx.appAccountToken)) return tx.appAccountToken.toLowerCase();
  if (hint) return hint;
  if (tx.originalTransactionId) {
    const { data } = await admin.from('purchases').select('user_id')
      .eq('original_transaction_id', tx.originalTransactionId).not('user_id', 'is', null).limit(1).maybeSingle();
    if (data?.user_id) return data.user_id;
  }
  return null;
}

/**
 * @param tx       transação decodificada (JWSTransactionDecodedPayload)
 * @param opts     { userId?, environment?, reason?: 'purchase'|'renew'|'expire'|'revoke' }
 */
export async function applyTransaction(tx, { userId: hint, environment, reason = 'purchase' } = {}) {
  if (tx.bundleId !== cfg.APPLE_BUNDLE_ID) throw new Error('BUNDLE_MISMATCH');
  const kind = PRODUCT_KIND[tx.productId];
  if (!kind) throw new Error(`UNKNOWN_PRODUCT ${tx.productId}`);
  const userId = await resolveUser(tx, hint);
  if (!userId) throw new Error('USER_NOT_FOUND');
  if (hint && tx.appAccountToken && tx.appAccountToken.toLowerCase() !== hint) throw new Error('ACCOUNT_MISMATCH');

  const revoked = reason === 'revoke' || !!tx.revocationDate;
  const row = {
    user_id: userId,
    product_id: tx.productId,
    kind,
    transaction_id: String(tx.transactionId),
    original_transaction_id: tx.originalTransactionId ? String(tx.originalTransactionId) : null,
    environment: environment || tx.environment || null,
    quantity: tx.quantity || 1,
    purchased_at: iso(tx.purchaseDate),
    expires_at: iso(tx.expiresDate),
    revoked_at: revoked ? iso(tx.revocationDate) || new Date().toISOString() : null,
    raw: tx,
  };

  // idempotência: a mesma transação nunca libera crédito duas vezes
  const { data: existing } = await admin.from('purchases').select('id, revoked_at').eq('transaction_id', row.transaction_id).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('purchases').insert(row);
    if (error && !/duplicate/i.test(error.message)) throw error;
    if (error) return { userId, kind, duplicate: true };
  } else if (revoked && !existing.revoked_at) {
    await admin.from('purchases').update({ revoked_at: row.revoked_at, raw: tx }).eq('id', existing.id);
  }

  const isNew = !existing;
  const newlyRevoked = revoked && (!existing || !existing.revoked_at);

  if (kind === 'pro') {
    const until = revoked ? new Date().toISOString() : row.expires_at;
    const force = revoked || reason === 'expire';
    const { error } = await admin.rpc('grant_entitlement', {
      p_user: userId, p_kind: 'pro', p_qty: 1, p_pro_until: until,
      p_product: tx.productId, p_original_tx: row.original_transaction_id, p_force: force,
    });
    if (error) throw error;
  } else if (newlyRevoked && !isNew) {
    // reembolso de consumível: retira o crédito (sem ficar negativo)
    const { error } = await admin.rpc('grant_entitlement', { p_user: userId, p_kind: kind, p_qty: -(row.quantity || 1) });
    if (error) throw error;
  } else if (isNew && !revoked) {
    const { error } = await admin.rpc('grant_entitlement', { p_user: userId, p_kind: kind, p_qty: row.quantity || 1 });
    if (error) throw error;
  }
  return { userId, kind, duplicate: !isNew };
}
