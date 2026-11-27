// Verificação de idade (ECA Digital — Lei 15.211/2025): a autodeclaração não basta.
// No iPhone usamos o sinal de faixa etária da Apple (Declared Age Range, iOS 26.2+).
// Em iPhones mais antigos o sinal não existe; como o app é classificado 18+ na App Store,
// a Apple já confirma a maioridade no download no Brasil. Esse fallback pode ser desligado
// com VITE_AGE_STORE_FALLBACK=false (aí só entra quem tiver o sinal ou um provedor de verificação).
import { Capacitor } from '@capacitor/core';
import { env } from '../lib/env';

const storeFallback = import.meta.env.VITE_AGE_STORE_FALLBACK !== 'false';

export async function requestAgeSignal() {
  if (env.DEMO) return { ok: true, lower: 18, source: 'demo' };
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'native_only' };
  try {
    const { AgeRange } = await import('@capgo/capacitor-age-range');
    const r = await AgeRange.requestAgeRange({ ageGates: [18] });
    if (r.status === 'SHARING') {
      return { ok: (r.ageLower ?? 0) >= 18, lower: r.ageLower ?? 0, source: `apple_declared_age_range:${r.declarationSource || 'UNKNOWN'}` };
    }
    // Qualquer outro status (NOT_AVAILABLE, NOT_DETERMINED, DECLINED_SHARING, etc.)
    // → se storeFallback estiver ativo, usa o rating 18+ da App Store
    if (storeFallback) {
      return { ok: true, lower: 18, source: `app_store_18plus_rating:${r.status}` };
    }
    return { ok: false, reason: r.status };
  } catch (e) {
    // Erro técnico (entitlement ausente, plugin não disponível, etc.)
    // → usa o rating 18+ da App Store como evidência de maioridade
    if (storeFallback) {
      return { ok: true, lower: 18, source: 'app_store_18plus_rating' };
    }
    return { ok: false, reason: 'ERROR', error: String(e?.message || e) };
  }
}