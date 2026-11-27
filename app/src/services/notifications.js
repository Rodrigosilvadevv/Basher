import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase.js';

// ── Web Push (PWA) ────────────────────────────────────────────────────────────
function urlB64ToUint8(base64String) {
  const pad = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function registerWebPush(userId) {
  if (Capacitor.isNativePlatform()) return   // iOS usa APNs
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8(vapidKey)
    })

    // Salva no banco
    const subJson = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: subJson,
      endpoint: subJson.endpoint
    }, { onConflict: 'user_id,endpoint' })

    console.log('[push] subscription registrada')
  } catch (e) {
    console.warn('[push]', e)
  }
}

export async function sendPushToUser(userId, { title, body, url, data } = {}) {
  try {
    await supabase.functions.invoke('push-notify', {
      body: { user_id: userId, title, body, url, data }
    })
  } catch (e) {
    console.warn('[push] erro ao enviar', e)
  }
}

// ── Notificação local (Encontro Seguro) ───────────────────────────────────────
export async function scheduleLocal({ id, title, body, at }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.requestPermissions();
    if (p.display !== 'granted') return;
    await LocalNotifications.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(at) } }] });
  } catch (e) {
    console.warn('[notif]', e);
  }
}

export async function cancelLocal(id) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch { /* noop */ }
}