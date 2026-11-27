import { Capacitor } from '@capacitor/core';

let mod = null;
export async function tap(style = 'Light') {
  try {
    if (Capacitor.isNativePlatform()) {
      mod = mod || (await import('@capacitor/haptics'));
      await mod.Haptics.impact({ style: mod.ImpactStyle[style] });
    } else if (navigator.vibrate) {
      navigator.vibrate(style === 'Heavy' ? 18 : 8);
    }
  } catch {
    /* sem vibração disponível */
  }
}
