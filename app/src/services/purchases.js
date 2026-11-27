// Compras pela App Store (StoreKit 2) com validação no servidor do Render.
// Fluxo: compra no iPhone → JWS assinado pela Apple → servidor verifica → libera no Supabase → finaliza.
import { Capacitor } from '@capacitor/core';
import { api } from '../api';
import { env } from '../lib/env';
import { AppError } from '../lib/errors';
import { PRODUCTS } from '../config/plans';

const native = () => Capacitor.isNativePlatform();
let plugin = null;
let configured = false;

async function getPlugin() {
  if (!plugin) plugin = await import('@capgo/native-purchases');
  if (!configured) {
    // finalizamos manualmente só depois que o servidor confirmar
    await plugin.NativePurchases.configure({ autoFinishTransactions: false });
    configured = true;
  }
  return plugin;
}

export async function loadPrices() {
  const prices = Object.fromEntries(Object.entries(PRODUCTS).map(([k, p]) => [k, p.fallbackPrice]));
  if (env.DEMO || !native()) return prices;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await getPlugin();
    const byId = {};
    for (const type of ['subs', 'inapp']) {
      const ids = Object.values(PRODUCTS).filter((p) => p.type === type).map((p) => p.id);
      const { products } = await NativePurchases.getProducts({
        productIdentifiers: ids,
        productType: type === 'subs' ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP,
      });
      products.forEach((p) => (byId[p.identifier] = p.priceString));
    }
    Object.entries(PRODUCTS).forEach(([k, p]) => byId[p.id] && (prices[k] = byId[p.id]));
  } catch (e) {
    console.warn('[iap] preços indisponíveis', e);
  }
  return prices;
}

async function verifyAndFinish(tx) {
  await api.verifyAppleTransaction({
    jws: tx.jwsRepresentation,
    transactionId: tx.transactionId,
    productId: tx.productIdentifier,
  });
  const { NativePurchases } = await getPlugin();
  await NativePurchases.finishTransaction({ transactionId: tx.transactionId });
  return api.myStatus();
}

export async function buy(productKey, userId) {
  if (env.DEMO) return api.demoPurchase(productKey);
  if (!native()) throw new AppError('IAP_NATIVE_ONLY');
  const product = PRODUCTS[productKey];
  const { NativePurchases, PURCHASE_TYPE } = await getPlugin();
  let tx;
  try {
    tx = await NativePurchases.purchaseProduct({
      productIdentifier: product.id,
      productType: product.type === 'subs' ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP,
      quantity: 1,
      appAccountToken: userId, // UUID do Supabase → a Apple devolve nas notificações
      isConsumable: !!product.consumable,
      autoAcknowledgePurchases: false,
    });
  } catch (e) {
    if (/cancel/i.test(String(e?.message || e))) throw new AppError('IAP_CANCELLED');
    throw e;
  }
  return verifyAndFinish(tx);
}

export async function restore(userId) {
  if (env.DEMO) return api.myStatus();
  if (!native()) throw new AppError('IAP_NATIVE_ONLY');
  const { NativePurchases } = await getPlugin();
  await NativePurchases.restorePurchases();
  const { purchases } = await NativePurchases.getPurchases({ appAccountToken: userId });
  for (const tx of purchases || []) {
    if (tx.jwsRepresentation) await verifyAndFinish(tx).catch(() => null);
  }
  return api.myStatus();
}

// Renovações e compras pendentes que chegam com o app aberto
export async function listenTransactions(onStatus) {
  if (env.DEMO || !native()) return () => {};
  const { NativePurchases } = await getPlugin();
  const h = await NativePurchases.addListener('transactionUpdated', async (tx) => {
    try {
      onStatus(await verifyAndFinish(tx));
    } catch (e) {
      console.warn('[iap] falha ao validar transação', e);
    }
  });
  return () => h.remove();
}

export const manageSubscriptionsUrl = 'https://apps.apple.com/account/subscriptions';
