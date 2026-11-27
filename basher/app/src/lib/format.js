export function formatDistance(m) {
  if (m == null) return null;
  if (m < 50) return 'aqui perto';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(m / 1000)} km`;
}

export function timeAgo(date) {
  if (!date) return '';
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function lastSeen(date, online) {
  if (online) return 'Online agora';
  if (!date) return '';
  return `Visto há ${timeAgo(date)}`;
}

export function clockTime(date) {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function minutesLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

export function expiresLabel(expiresAt) {
  if (!expiresAt) return 'Sem expiração';
  const min = minutesLeft(expiresAt);
  if (min <= 0) return 'Expirado';
  if (min < 60) return `Expira em ${min} min`;
  if (min < 1440) return `Expira em ${Math.round(min / 60)} h`;
  return `Expira em ${Math.round(min / 1440)} d`;
}

export function ageFrom(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate + 'T12:00:00');
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

export function maxBirthdate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
