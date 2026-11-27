import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, MapPin, EyeOff, LockKeyhole, Ban, ShieldCheck, LifeBuoy, FileText, LogOut, Trash2, ChevronRight,
  UserRound, Sparkles, RefreshCw, Smartphone, ScanEye, Undo2,
} from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { env } from '../lib/env';
import { getPosition } from '../services/location';
import { manageSubscriptionsUrl, restore } from '../services/purchases';
import TopBar from '../components/TopBar';
import Sheet from '../components/Sheet';
import Avatar from '../components/Avatar';
import PinLock from '../components/PinLock';
import { SwitchRow } from '../components/Switch';
import { useProGate } from '../components/Upsell';

export default function Settings() {
  const nav = useNavigate();
  const gate = useProGate();
  const me = useApp((s) => s.me);
  const setMe = useApp((s) => s.setMe);
  const status = useApp((s) => s.status);
  const setStatus = useApp((s) => s.setStatus);
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const setCoords = useApp((s) => s.setCoords);
  const trusted = useApp((s) => s.trustedContact);
  const setTrusted = useApp((s) => s.setTrustedContact);
  const clearSession = useApp((s) => s.clearSession);
  const [sheet, setSheet] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [tName, setTName] = useState(trusted?.name || '');
  const [tPhone, setTPhone] = useState(trusted?.phone || '');
  const pr = me?.private || {};
  const pro = !!status?.is_pro;

  const setPriv = async (patch) => {
    if (patch.incognito && !pro) return gate('invisivel');
    try {
      const next = await api.updatePrivate(patch);
      setMe({ ...me, private: { ...me.private, ...next } });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const refreshLocation = async () => {
    try {
      const c = await getPosition();
      setCoords(c);
      await api.updateLocation(c.lat, c.lng);
      toast('Localização atualizada', 'success');
    } catch {
      toast('Permita o acesso à localização nos ajustes do aparelho.', 'error');
    }
  };
  const openBlocked = async () => {
    setSheet('blocked');
    setBlocked(await api.blocked().catch(() => []));
  };
  const unblock = async (u) => {
    await api.unblock(u.id);
    setBlocked((x) => x.filter((y) => y.id !== u.id));
    toast(`${u.display_name || 'Perfil'} desbloqueado`);
  };
  const logout = async () => {
    await api.auth.signOut();
    clearSession();
  };
  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.auth.deleteAccount();
      clearSession();
      toast('Sua conta e seus dados foram apagados.', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const doRestore = async () => {
    try {
      setStatus(await restore(me.id));
      toast('Compras restauradas', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div className="screen">
      <TopBar title="Configurações" />
      <div className="scroll pad" style={{ paddingTop: 12, paddingBottom: 60 }}>
        <div className="list">
          <div className="list-item">
            <Avatar src={me?.profile?.avatar_url} name={me?.profile?.display_name} size={44} />
            <span className="txt"><b>{me?.profile?.display_name}</b><small>{me?.email} · {me?.provider === 'apple' ? 'Apple' : 'Google'}</small></span>
          </div>
          <button className="list-item" onClick={() => nav('/perfil/editar')}><UserRound /><span className="txt">Editar perfil e idade</span><ChevronRight size={18} className="faint" /></button>
        </div>

        <div className="section">
          <div className="section-title">Plano</div>
          <div className="list">
            <button className="list-item" onClick={() => nav('/pro')}>
              <Crown />
              <span className="txt"><b>{pro ? 'Basher Pro ativo' : 'Basher grátis'}</b><small>{pro && status?.pro_until ? `Renova em ${new Date(status.pro_until).toLocaleDateString('pt-BR')}` : 'Conheça o Pro'}</small></span>
              <ChevronRight size={18} className="faint" />
            </button>
            {pro && !env.DEMO && <a className="list-item" href={manageSubscriptionsUrl} target="_blank" rel="noreferrer"><Smartphone /><span className="txt">Gerenciar assinatura na Apple</span></a>}
            <button className="list-item" onClick={doRestore}><RefreshCw /><span className="txt">Restaurar compras</span></button>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Privacidade</div>
          <div className="list">
            <SwitchRow icon={<MapPin size={20} color="#c4a6ff" />} title="Esconder distância" text="Você some do mapa e sua distância não aparece." on={pr.hide_distance} onChange={(v) => setPriv({ hide_distance: v })} />
            <SwitchRow icon={<UserRound size={20} color="#c4a6ff" />} title="Esconder idade" on={pr.hide_age} onChange={(v) => setPriv({ hide_age: v })} />
            <SwitchRow icon={<EyeOff size={20} color="#c4a6ff" />} title="Modo invisível" text="Fora da grade e das visitas. Só quem você chamar te vê." pro on={pr.incognito} onChange={(v) => setPriv({ incognito: v })} />
            <SwitchRow icon={<ScanEye size={20} color="#c4a6ff" />} title="Modo discreto" text="Fotos desfocadas na tela até você tocar. Bom para lugares públicos." on={settings.discreet} onChange={(v) => updateSettings({ discreet: v })} />
            <SwitchRow icon={<LockKeyhole size={20} color="#c4a6ff" />} title="Bloqueio por PIN" text="Pede um PIN ao abrir o app. Toque duas vezes no logo para travar na hora." on={!!settings.pinHash} onChange={(v) => (v ? setSheet('pin') : updateSettings({ pinHash: null }))} />
            <button className="list-item" onClick={openBlocked}><Ban /><span className="txt">Perfis bloqueados</span><ChevronRight size={18} className="faint" /></button>
            <button className="list-item" onClick={refreshLocation}><MapPin /><span className="txt">Atualizar minha localização<small>Guardamos só um ponto aproximado (~200 m)</small></span></button>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Segurança</div>
          <div className="list">
            <button className="list-item" onClick={() => setSheet('trusted')}><ShieldCheck /><span className="txt">Contato de confiança<small>{trusted ? `${trusted.name} · ${trusted.phone}` : 'Usado no Encontro seguro'}</small></span><ChevronRight size={18} className="faint" /></button>
            <button className="list-item" onClick={() => setSheet('tips')}><Sparkles /><span className="txt">Dicas para encontros seguros</span><ChevronRight size={18} className="faint" /></button>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Ajuda</div>
          <div className="list">
            <a className="list-item" href={`mailto:${env.SUPPORT_EMAIL}`}><LifeBuoy /><span className="txt">Suporte<small>{env.SUPPORT_EMAIL}</small></span></a>
            <a className="list-item" href={env.TERMS_URL} target="_blank" rel="noreferrer"><FileText /><span className="txt">Termos de uso</span></a>
            <a className="list-item" href={env.PRIVACY_URL} target="_blank" rel="noreferrer"><FileText /><span className="txt">Política de privacidade</span></a>
          </div>
        </div>

        <div className="section">
          <div className="list">
            <button className="list-item" onClick={logout}><LogOut /><span className="txt">Sair</span></button>
            <button className="list-item danger" onClick={() => setSheet('delete')}><Trash2 /><span className="txt">Excluir conta</span></button>
          </div>
        </div>

        {env.DEMO && (
          <div className="section">
            <div className="section-title">Demonstração</div>
            <div className="list">
              {pro && <button className="list-item" onClick={async () => setStatus(await api.demoCancelPro())}><Undo2 /><span className="txt">Voltar para o plano grátis</span></button>}
              <button className="list-item" onClick={async () => { await api.auth.deleteAccount(); clearSession(); }}><RefreshCw /><span className="txt">Recomeçar demo do zero</span></button>
            </div>
          </div>
        )}
        <p className="faint tiny" style={{ textAlign: 'center', marginTop: 24 }}>Basher 1.0 · feito com 💜 no Brasil</p>
      </div>

      {sheet === 'pin' && (
        <div className="pin-modal">
          <PinLock mode="create" onCancel={() => setSheet(null)} onDone={(h) => { updateSettings({ pinHash: h }); setSheet(null); toast('PIN ativado', 'success'); }} />
        </div>
      )}

      <Sheet open={sheet === 'blocked'} onClose={() => setSheet(null)} title="Bloqueados">
        {!blocked.length ? <p className="muted">Ninguém bloqueado.</p> : (
          <div className="list">
            {blocked.map((u) => (
              <div key={u.id} className="list-item">
                <Avatar src={u.avatar_url} name={u.display_name} size={36} />
                <span className="txt">{u.display_name || 'Perfil'}</span>
                <button className="btn btn-glass btn-sm" onClick={() => unblock(u)}>Desbloquear</button>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'trusted'} onClose={() => setSheet(null)} title="Contato de confiança">
        <div className="col" style={{ gap: 14 }}>
          <p className="small muted">Fica salvo só neste aparelho. É para quem o Encontro seguro prepara a mensagem de ajuda.</p>
          <input className="input" placeholder="Nome" value={tName} onChange={(e) => setTName(e.target.value)} />
          <input className="input" placeholder="Celular com DDD" inputMode="tel" value={tPhone} onChange={(e) => setTPhone(e.target.value)} />
          <button className="btn btn-primary btn-block" onClick={() => { setTrusted(tPhone.replace(/\D/g, '').length >= 10 ? { name: tName || 'Contato', phone: tPhone.replace(/\D/g, '') } : null); setSheet(null); toast('Salvo', 'success'); }}>Salvar</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'tips'} onClose={() => setSheet(null)} title="Encontros mais seguros">
        <ol className="tips">
          <li>Na primeira vez, prefira um lugar público e movimentado.</li>
          <li>Ative o <b>Encontro seguro</b> no escudo da conversa antes de sair.</li>
          <li>Desconfie de quem pede dinheiro, Pix, códigos ou fotos de documentos.</li>
          <li>Não compartilhe sua localização exata antes de confiar na pessoa.</li>
          <li>Combine limites e cuidado com a saúde: PrEP, camisinha e testagem regular.</li>
          <li>Em perigo, ligue 190. Denuncie perfis suspeitos no menu do perfil.</li>
        </ol>
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet(null)} title="Excluir conta">
        <div className="col" style={{ gap: 14 }}>
          <p className="muted">Apagamos seu perfil, fotos, álbuns, conversas e posts. Isso não pode ser desfeito. Assinaturas da Apple precisam ser canceladas na App Store.</p>
          <input className="input" placeholder='Digite "EXCLUIR" para confirmar' value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" />
          <button className="btn btn-danger btn-block" disabled={confirm.trim().toUpperCase() !== 'EXCLUIR' || busy} onClick={deleteAccount}>{busy ? <span className="spinner" /> : <Trash2 size={17} />} Excluir para sempre</button>
        </div>
      </Sheet>
    </div>
  );
}
