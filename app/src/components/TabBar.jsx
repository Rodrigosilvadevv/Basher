import { NavLink } from 'react-router-dom';
import { Grid2x2, Radar, Zap, MessageCircle } from 'lucide-react';
import { useApp } from '../store/useApp';
import Avatar from './Avatar';
import { tap } from '../lib/haptics';

export default function TabBar() {
  const me = useApp((s) => s.me);
  const unread = useApp((s) => s.unread);
  const tabs = [
    { to: '/', icon: <Grid2x2 />, label: 'Perto', end: true },
    { to: '/mapa', icon: <Radar />, label: 'Mapa' },
    { to: '/agora', icon: <Zap />, label: 'Agora' },
    { to: '/chats', icon: <MessageCircle />, label: 'Conversas', badge: unread },
  ];
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} aria-label={t.label} onClick={() => tap()} replace>
          {t.icon}
          {t.badge > 0 && <span className="tab-badge">{t.badge > 99 ? '99+' : t.badge}</span>}
        </NavLink>
      ))}
      <NavLink to="/perfil" aria-label="Perfil" onClick={() => tap()} replace>
        <span className="tab-avatar">
          <Avatar src={me?.profile?.avatar_url} name={me?.profile?.display_name} size={24} />
        </span>
      </NavLink>
    </nav>
  );
}
