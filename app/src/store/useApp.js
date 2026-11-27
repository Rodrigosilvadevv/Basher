import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// localStorage com proteção (modo privado / ambientes sem storage não quebram o app)
const safeStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { /* cheio ou indisponível */ }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  },
};

export const DEFAULT_FILTERS = {
  online_only: false,
  with_photo: false,
  age_min: 18,
  age_max: 60,
  max_km: null,
  positions: [],
  tribes: [],
  looking_for: [],
};

let toastId = 0;

export const useApp = create(
  persist(
    (set, get) => ({
      // ---- sessão e perfil (persistidos para abrir instantâneo) ----
      me: null,
      status: null,
      setMe: (me) => set({ me }),
      patchMe: (patch) => set({ me: { ...get().me, ...patch } }),
      setStatus: (status) => set({ status }),
      clearSession: () =>
        set({ me: null, status: null, nearbyCache: [], convCache: [], drafts: {}, explore: null, safeDate: null }),

      // ---- localização ----
      coords: null,
      locationDenied: false,
      setCoords: (coords) => set({ coords, locationDenied: false }),
      setLocationDenied: (v) => set({ locationDenied: v }),

      // ---- preferências do aparelho ----
      settings: { discreet: false, pinHash: null, haptics: true, autoLockSeconds: 30 },
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

      // ---- grade ----
      filters: DEFAULT_FILTERS,
      setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      explore: null, // { name, lat, lng } — Pro
      setExplore: (explore) => set({ explore }),

      // ---- caches para abrir offline ----
      nearbyCache: [],
      setNearbyCache: (nearbyCache) => set({ nearbyCache: nearbyCache.slice(0, 120) }),
      convCache: [],
      setConvCache: (convCache) => set({ convCache }),
      drafts: {},
      setDraft: (id, text) => set({ drafts: { ...get().drafts, [id]: text } }),
      onboarding: { step: 0 },
      setOnboarding: (patch) => set({ onboarding: { ...get().onboarding, ...patch } }),
      feedTab: 'now',
      setFeedTab: (feedTab) => set({ feedTab }),
      chatsTab: 'messages',
      setChatsTab: (chatsTab) => set({ chatsTab }),
      lastRoute: '/',
      setLastRoute: (lastRoute) => set({ lastRoute }),

      // ---- Encontro seguro ----
      trustedContact: null, // { name, phone }
      setTrustedContact: (trustedContact) => set({ trustedContact }),
      safeDate: null, // { endsAt, withId, withName, note, startedAt }
      startSafeDate: (safeDate) => set({ safeDate }),
      endSafeDate: () => set({ safeDate: null }),

      // ---- efêmeros (não persistidos) ----
      locked: false,
      setLocked: (locked) => set({ locked }),
      unread: 0,
      setUnread: (unread) => set({ unread }),
      toasts: [],
      toast: (text, type = 'info', ms = 3200) => {
        const id = ++toastId;
        set({ toasts: [...get().toasts, { id, text, type }] });
        setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), ms);
      },
    }),
    {
      name: 'basher-store',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        me: s.me,
        status: s.status,
        coords: s.coords,
        settings: s.settings,
        filters: s.filters,
        explore: s.explore,
        nearbyCache: s.nearbyCache,
        convCache: s.convCache,
        drafts: s.drafts,
        onboarding: s.onboarding,
        feedTab: s.feedTab,
        chatsTab: s.chatsTab,
        lastRoute: s.lastRoute,
        trustedContact: s.trustedContact,
        safeDate: s.safeDate,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.settings?.pinHash) queueMicrotask(() => useApp.setState({ locked: true }));
      },
    },
  ),
);

export const toast = (...a) => useApp.getState().toast(...a);
export const isPro = (status) => !!status?.is_pro;
