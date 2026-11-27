import { useState } from 'react';
import { api } from '../api';
import { toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { env } from '../lib/env';
import Logo from '../components/Logo';

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.27-.87-2.29-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.07 1.96-.49 2.56-1.2z"/></svg>
);
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.1-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.1z"/><path fill="#EA4335" d="M12 4.76c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.76 12 4.76z"/></svg>
);

export default function Login() {
  const [busy, setBusy] = useState(null);
  const go = async (provider) => {
    setBusy(provider);
    try {
      await api.auth.signIn(provider);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="screen login">
      <div className="radar" aria-hidden="true">
        <span /><span /><span />
        {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--a': `${i * 40 + 12}deg`, '--d': (0.3 + ((i * 37) % 60) / 100).toFixed(2), animationDelay: `${i * 0.3}s` }} />)}
        <b />
      </div>
      <div className="login-body">
        <Logo size={56} />
        <h1 className="login-title rise">quem tá <span className="serif grad-text">perto,</span><br />agora.</h1>
        <p className="muted rise" style={{ animationDelay: '80ms' }}>Mapa ao vivo, álbuns privados com prazo, o modo <b>Agora</b> e encontros mais seguros. Feito para a gente.</p>
        <div className="col login-actions rise" style={{ animationDelay: '160ms' }}>
          <button className="btn btn-light btn-block" onClick={() => go('apple')} disabled={!!busy}>
            {busy === 'apple' ? <span className="spinner" /> : <AppleIcon />} Continuar com Apple
          </button>
          <button className="btn btn-glass btn-block" onClick={() => go('google')} disabled={!!busy}>
            {busy === 'google' ? <span className="spinner" /> : <GoogleIcon />} Continuar com Google
          </button>
        </div>
        <p className="faint tiny login-legal">
          Exclusivo para maiores de 18 anos. Ao continuar, você concorda com os{' '}
          <a href={env.TERMS_URL} target="_blank" rel="noreferrer">Termos</a> e a{' '}
          <a href={env.PRIVACY_URL} target="_blank" rel="noreferrer">Política de Privacidade</a>.
        </p>
        {env.DEMO && <span className="demo-pill">Modo demonstração · dados simulados</span>}
      </div>
    </div>
  );
}
