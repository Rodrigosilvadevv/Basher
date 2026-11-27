import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, Infinity as InfinityIcon, SlidersHorizontal, Globe, EyeOff, Eye, LockKeyhole, UsersRound, Sparkles } from 'lucide-react';

const Icons = { Crown, Infinity: InfinityIcon, SlidersHorizontal, Globe, EyeOff, Eye, LockKeyhole, UsersRound, Sparkles };
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { env } from '../lib/env';
import { PRODUCTS, PRO_FEATURES } from '../config/plans';
import { buy, restore, loadPrices, manageSubscriptionsUrl } from '../services/purchases';
import TopBar from '../components/TopBar';
import { tap } from '../lib/haptics';

const REASONS = {
  filtros: 'Filtre por posição, tribos e o que cada um procura.',
  explorar: 'Explore outras cidades antes de viajar.',
  invisivel: 'Fique invisível e navegue no seu tempo.',
  visitas: 'Veja exatamente quem visitou seu perfil.',
  limite: 'Veja todo mundo por perto, sem limite.',
  albuns: 'Envie seus álbuns privados sem limite.',
  grupos: 'Crie grupos sem pagar por cada um.',
};

export default function Pro() {
  const [params] = useSearchParams();
  const reason = REASONS[params.get('motivo')];
  const me = useApp((s) => s.me);
  const status = useApp((s) => s.status);
  const setStatus = useApp((s) => s.setStatus);
  const [plan, setPlan] = useState('pro_yearly');
  const [prices, setPrices] = useState(() => Object.fromEntries(Object.entries(PRODUCTS).map(([k, p]) => [k, p.fallbackPrice])));
  const [busy, setBusy] = useState(null);
  const pro = !!status?.is_pro;

  useEffect(() => { loadPrices().then(setPrices); }, []);

  const purchase = async (key) => {
    setBusy(key);
    tap('Medium');
    try {
      const s = await buy(key, me.id);
      setStatus(s);
      toast(PRODUCTS[key].kind === 'pro' ? 'Bem-vindo ao Basher Pro 👑' : 'Compra concluída', 'success');
    } catch (e) {
      if (e.code !== 'IAP_CANCELLED') toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const doRestore = async () => {
    setBusy('restore');
    try {
      setStatus(await restore(me.id));
      toast('Compras restauradas', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="screen pro-screen">
      <TopBar clear />
      <div className="scroll" style={{ paddingBottom: 40 }}>
        <div className="pro-hero">
          <div className="pro-crown"><Icons.Crown size={38} /></div>
          <h1>basher <span className="serif grad-text">pro</span></h1>
          <p className="muted">{pro ? `Ativo até ${new Date(status.pro_until).toLocaleDateString('pt-BR')}. Aproveite tudo 💜` : reason || 'Tudo liberado. Sem limites, do seu jeito.'}</p>
        </div>

        <div className="pad">
          <div className="pro-features">
            {PRO_FEATURES.map((f, i) => {
              const Ico = Icons[f.icon] || Icons.Sparkles;
              return (
                <div key={f.title} className="pro-feat rise" style={{ animationDelay: `${i * 45}ms` }}>
                  <span className="pf-ico"><Ico size={19} /></span>
                  <div><b>{f.title}</b><small>{f.text}</small></div>
                </div>
              );
            })}
          </div>

          {!pro && (
            <>
              <div className="plans">
                {['pro_yearly', 'pro_monthly'].map((k) => (
                  <button key={k} className={`plan ${plan === k ? 'on' : ''}`} onClick={() => setPlan(k)}>
                    {PRODUCTS[k].note && <span className="plan-tag">{PRODUCTS[k].note}</span>}
                    <b>{PRODUCTS[k].title}</b>
                    <span className="plan-price num">{prices[k]}</span>
                    <small>por {PRODUCTS[k].period}</small>
                  </button>
                ))}
              </div>
              <button className="btn btn-primary btn-block pro-cta" disabled={!!busy} onClick={() => purchase(plan)}>
                {busy === plan ? <span className="spinner" /> : <Icons.Crown size={18} />} Assinar com a Apple
              </button>
              <p className="faint tiny legal">
                Assinatura com renovação automática de {prices[plan]} por {PRODUCTS[plan].period}, cobrada na sua conta Apple. Renova
                automaticamente, a menos que seja cancelada até 24 h antes do fim do período, em Ajustes › Assinaturas. Veja os{' '}
                <a href={env.TERMS_URL} target="_blank" rel="noreferrer">Termos</a> e a <a href={env.PRIVACY_URL} target="_blank" rel="noreferrer">Privacidade</a>.
              </p>
            </>
          )}
          {pro && !env.DEMO && <a className="btn btn-glass btn-block" href={manageSubscriptionsUrl} target="_blank" rel="noreferrer">Gerenciar assinatura</a>}

          <div className="section">
            <div className="section-title">Compras avulsas</div>
            <div className="list">
              <div className="list-item">
                <Icons.LockKeyhole />
                <span className="txt"><b>+10 envios de álbum</b><small>{pro ? 'Você já tem envios ilimitados' : `Você tem ${status?.album_credits || 0} extras · 20 grátis por mês`}</small></span>
                <button className="btn btn-glass btn-sm" disabled={pro || !!busy} onClick={() => purchase('album_pack')}>{busy === 'album_pack' ? <span className="spinner" /> : prices.album_pack}</button>
              </div>
              <div className="list-item">
                <Icons.UsersRound />
                <span className="txt"><b>Criar 1 grupo</b><small>{pro ? 'Grátis no seu Pro' : `Sem limite de pessoas · ${status?.group_credits || 0} créditos`}</small></span>
                <button className="btn btn-glass btn-sm" disabled={pro || !!busy} onClick={() => purchase('group')}>{busy === 'group' ? <span className="spinner" /> : prices.group}</button>
              </div>
            </div>
          </div>

          <button className="btn btn-ghost btn-block" style={{ marginTop: 18 }} onClick={doRestore} disabled={!!busy}>
            {busy === 'restore' ? <span className="spinner" /> : 'Restaurar compras'}
          </button>
          {env.DEMO && <p className="faint tiny" style={{ textAlign: 'center' }}>Demonstração: as compras são simuladas.</p>}
        </div>
      </div>
    </div>
  );
}
