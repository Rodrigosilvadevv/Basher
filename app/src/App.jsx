import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { api } from './api';
import { env, DEFAULT_COORDS } from './lib/env';
import { useApp, toast } from './store/useApp';
import { getPosition } from './services/location';
import { listenTransactions } from './services/purchases';
import { registerWebPush, registerAPNs } from './services/notifications';
import Aurora from './components/Aurora';
import Logo from './components/Logo';
import TabBar from './components/TabBar';
import Toasts from './components/Toasts';
import PinLock from './components/PinLock';
import { SafeDateBanner } from './components/SafeDate';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Nearby from './pages/Nearby';
import MapPage from './pages/MapPage';
import Now from './pages/Now';
import Chats from './pages/Chats';
import ChatRoom from './pages/ChatRoom';
import NewGroup from './pages/NewGroup';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import EditProfile from './pages/EditProfile';
import { Albums, AlbumDetail } from './pages/Albums';
import Settings from './pages/Settings';
import Pro from './pages/Pro';
import Viewers from './pages/Viewers';
import Stories from './pages/Stories';

const TAB_ROUTES = ['/', '/mapa', '/agora', '/chats', '/perfil'];

function Router({ children }) {
  const last = useApp.getState().lastRoute;
  if (env.ROUTER === 'memory') {
    return <MemoryRouter initialEntries={[TAB_ROUTES.includes(last) ? last : '/']}>{children}</MemoryRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}

function Splash() {
  return (
    <div className="screen center splash">
      <Logo size={54} />
    </div>
  );
}

function TabsLayout() {
  const loc = useLocation();
  const setLastRoute = useApp((s) => s.setLastRoute);
  useEffect(() => { setLastRoute(loc.pathname); }, [loc.pathname, setLastRoute]);
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}

// Efeitos globais quando o usuário está dentro do app
function useLiveApp() {
  const loc = useLocation();
  const nav = useNavigate();
  const path = useRef(loc.pathname);
  path.current = loc.pathname;
  const setCoords = useApp((s) => s.setCoords);
  const setLocationDenied = useApp((s) => s.setLocationDenied);
  const setUnread = useApp((s) => s.setUnread);
  const setStatus = useApp((s) => s.setStatus);
  const setLocked = useApp((s) => s.setLocked);

  // localização a cada 5 min e ao voltar para o app
  useEffect(() => {
    const sync = async () => {
      try {
        const c = await getPosition();
        setCoords(c);
        await api.updateLocation(c.lat, c.lng);
      } catch {
        setLocationDenied(true);
        if (!useApp.getState().coords) setCoords({ ...DEFAULT_COORDS });
        api.updateLocation(useApp.getState().coords.lat, useApp.getState().coords.lng).catch(() => {});
      }
    };
    sync();
    const t = setInterval(sync, 5 * 60000);
    const onVis = () => document.visibilityState === 'visible' && sync();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [setCoords, setLocationDenied]);

  // não lidas + avisos de mensagens novas
  useEffect(() => {
    const count = () => api.conversations().then((c) => setUnread(c.reduce((s, x) => s + (x.muted ? 0 : x.unread), 0))).catch(() => {});
    count();
    const off = api.subscribeInbox((e) => {
      const me = useApp.getState().me;
      if (e.type === 'message' && e.row?.sender_id !== me?.id) {
        if (!path.current.startsWith(`/chat/${e.row.conversation_id}`)) toast('💬 Nova mensagem', 'info');
        count();
      }
      if (e.type === 'tap' && e.row?.to_id === me?.id) toast('⚡ Alguém te mandou uma faísca', 'info');
      if (e.type === 'album_request' && e.row?.owner_id === me?.id) toast('🔑 Novo pedido de álbum', 'info');
    });
    const t = setInterval(count, 60000);
    return () => { off(); clearInterval(t); };
  }, [setUnread]);

  // assinaturas renovadas com o app aberto
  useEffect(() => {
    let off = () => {};
    listenTransactions(setStatus).then((f) => (off = f));
    return () => off();
  }, [setStatus]);

  // bloqueio automático com PIN quando o app vai para segundo plano
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      const { settings } = useApp.getState();
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (settings.pinHash && hiddenAt && Date.now() - hiddenAt > (settings.autoLockSeconds || 30) * 1000) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [setLocked]);

  // restaura a última aba ao abrir o app
  useEffect(() => {
    const last = useApp.getState().lastRoute;
    if (loc.pathname === '/' && TAB_ROUTES.includes(last) && last !== '/') nav(last, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // registra Push (Web PWA ou APNs nativo iOS)
  useEffect(() => {
    const me = useApp.getState().me;
    if (me?.id) {
      registerWebPush(me.id).catch(() => {});
      registerAPNs(me.id).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Shell() {
  useLiveApp();
  return (
    <Routes>
      <Route element={<TabsLayout />}>
        <Route index element={<Nearby />} />
        <Route path="mapa" element={<MapPage />} />
        <Route path="agora" element={<Now />} />
        <Route path="chats" element={<Chats />} />
        <Route path="perfil" element={<Profile />} />
      </Route>
      <Route path="u/:id" element={<UserProfile />} />
      <Route path="chat/:id" element={<ChatRoom />} />
      <Route path="chats/novo-grupo" element={<NewGroup />} />
      <Route path="perfil/editar" element={<EditProfile />} />
      <Route path="perfil/albuns" element={<Albums />} />
      <Route path="perfil/albuns/:id" element={<AlbumDetail />} />
      <Route path="config" element={<Settings />} />
      <Route path="pro" element={<Pro />} />
      <Route path="visitas" element={<Viewers />} />
      <Route path="stories/:authorId" element={<Stories />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Gate() {
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const setMe = useApp((s) => s.setMe);
  const setStatus = useApp((s) => s.setStatus);
  const clearSession = useApp((s) => s.clearSession);
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    api.auth.getSession().then((s) => setSession(s || null));
    return api.auth.onChange((s) => setSession(s || null));
  }, []);

  // login no iPhone volta por deep link
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let h;
    import('@capacitor/app').then(({ App }) =>
      App.addListener('appUrlOpen', ({ url }) => api.auth.handleDeepLink(url).catch((e) => toast(String(e.message || e), 'error'))).then((x) => (h = x)),
    );
    return () => h?.remove();
  }, []);

  const uid = session?.user?.id;
  useEffect(() => {
    if (session === null) {
      clearSession();
      return;
    }
    if (!uid) return;
    api.getMe()
      .then((m) => { setMe(m); setStatus(m.status); })
      .catch((e) => {
        if (e.code === 'AUTH_REQUIRED') api.auth.signOut();
        else toast('Sem conexão: mostrando dados salvos.', 'info');
      });
    if (window.location.pathname.startsWith('/auth/callback')) nav('/', { replace: true });
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session === undefined) return <Splash />;
  if (!session) return <Login />;
  const cached = me && me.id === uid ? me : null;
  if (!cached) return <Splash />;
  if (cached.status?.suspended) {
    return (
      <div className="screen center pad" style={{ textAlign: 'center', gap: 14 }}>
        <Logo size={40} />
        <h2>Conta em análise</h2>
        <p className="muted">Recebemos denúncias sobre este perfil e a moderação está revisando. Fale com {env.SUPPORT_EMAIL}.</p>
        <button className="btn btn-glass" onClick={() => api.auth.signOut()}>Sair</button>
      </div>
    );
  }
  if (!cached.profile?.onboarded) return <Onboarding />;
  return <Shell />;
}

export default function App() {
  const locked = useApp((s) => s.locked);
  const discreet = useApp((s) => s.settings.discreet);

  useEffect(() => {
    document.documentElement.classList.toggle('discreet', !!discreet);
  }, [discreet]);

  // modo discreto: segure para revelar a foto
  useEffect(() => {
    const on = (e) => e.target.closest?.('.blurrable')?.classList.add('revealed');
    const off = () => setTimeout(() => document.querySelectorAll('.blurrable.revealed').forEach((x) => x.classList.remove('revealed')), 1200);
    document.addEventListener('pointerdown', on);
    document.addEventListener('pointerup', off);
    document.addEventListener('pointercancel', off);
    return () => {
      document.removeEventListener('pointerdown', on);
      document.removeEventListener('pointerup', off);
      document.removeEventListener('pointercancel', off);
    };
  }, []);

  return (
    <Router>
      <Aurora />
      <div className="app">
        <SafeDateBanner />
        <Gate />
        {locked && <div className="lock-layer"><PinLock mode="unlock" /></div>}
      </div>
      <Toasts />
    </Router>
  );
}
