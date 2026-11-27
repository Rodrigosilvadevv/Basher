import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Phone } from 'lucide-react';
import { useApp, toast } from '../store/useApp';
import Sheet from './Sheet';
import { SAFE_DATE_DURATIONS } from '../config/options';
import { scheduleLocal, cancelLocal } from '../services/notifications';

const NOTIF_ID = 4242;

// "Encontro seguro": antes de encontrar alguém, liga um cronômetro.
// Se você não confirmar que está bem, o app prepara uma mensagem para seu contato de confiança.
export function SafeDateSheet({ open, onClose, withId, withName }) {
  const trusted = useApp((s) => s.trustedContact);
  const setTrusted = useApp((s) => s.setTrustedContact);
  const start = useApp((s) => s.startSafeDate);
  const coords = useApp((s) => s.coords);
  const [mins, setMins] = useState(60);
  const [name, setName] = useState(trusted?.name || '');
  const [phone, setPhone] = useState(trusted?.phone || '');
  const [note, setNote] = useState('');

  const go = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return toast('Informe o celular do seu contato com DDD', 'error');
    setTrusted({ name: name.trim() || 'Contato', phone: digits });
    const endsAt = new Date(Date.now() + mins * 60000).toISOString();
    start({ endsAt, withId, withName, note: note.trim(), startedAt: new Date().toISOString(), coords });
    await scheduleLocal({ id: NOTIF_ID, title: 'Tudo certo?', body: 'Seu Encontro Seguro terminou. Toque para confirmar que está bem.', at: endsAt });
    toast(`Encontro seguro ativo por ${mins} min`, 'success');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Encontro seguro">
      <div className="col" style={{ gap: 18 }}>
        <p className="muted small">
          Se você não tocar em <b>“Estou bem”</b> até o fim do tempo, o Basher prepara uma mensagem com o nome de <b>{withName}</b> e
          sua localização aproximada para o seu contato de confiança. Nada é enviado a ele sem você confirmar.
        </p>
        <div className="field">
          <span>Duração</span>
          <div className="chips">
            {SAFE_DATE_DURATIONS.map((m) => (
              <button key={m} className={`chip ${mins === m ? 'on' : ''}`} onClick={() => setMins(m)}>
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </button>
            ))}
          </div>
        </div>
        <div className="input-row">
          <label className="field"><span>Contato</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ju" /></label>
          <label className="field"><span>Celular</span><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 99999-9999" /></label>
        </div>
        <label className="field"><span>Detalhes (opcional)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: apto 42, prédio azul" maxLength={120} /></label>
        <button className="btn btn-primary btn-block" onClick={go}><ShieldCheck size={18} /> Ativar</button>
        <p className="faint tiny">O contato fica salvo só neste aparelho.</p>
      </div>
    </Sheet>
  );
}

function helpMessage(sd) {
  const loc = sd.coords ? ` Localização aproximada: https://maps.google.com/?q=${sd.coords.lat.toFixed(4)},${sd.coords.lng.toFixed(4)}` : '';
  return `Oi, aqui é um alerta do meu Encontro Seguro (Basher). Fui encontrar ${sd.withName || 'alguém'} e não confirmei que estou bem.${sd.note ? ' Detalhes: ' + sd.note + '.' : ''}${loc} Pode me ligar?`;
}

export function SafeDateBanner() {
  const sd = useApp((s) => s.safeDate);
  const end = useApp((s) => s.endSafeDate);
  const trusted = useApp((s) => s.trustedContact);
  const [, force] = useState(0);
  useEffect(() => {
    if (!sd) return;
    const t = setInterval(() => force((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, [sd]);
  if (!sd) return null;
  const left = Math.ceil((new Date(sd.endsAt) - Date.now()) / 60000);
  const expired = left <= 0;
  const ok = () => { cancelLocal(NOTIF_ID); end(); toast('Que bom! Encontro seguro encerrado 💜', 'success'); };
  const msg = encodeURIComponent(helpMessage(sd));
  const phone = trusted?.phone ? `55${trusted.phone.replace(/^55/, '')}` : '';

  if (expired) {
    return (
      <div className="safedate-alert">
        <div className="safedate-card rise">
          <ShieldAlert size={38} color="#ff5c8a" />
          <h2>Tudo certo?</h2>
          <p className="muted">Seu Encontro Seguro com {sd.withName} terminou.</p>
          <button className="btn btn-primary btn-block" onClick={ok}>Estou bem</button>
          <a className="btn btn-danger btn-block" href={`https://wa.me/${phone}?text=${msg}`} target="_blank" rel="noreferrer">Pedir ajuda no WhatsApp</a>
          <a className="btn btn-glass btn-block" href={`sms:+${phone}?&body=${msg}`}>Enviar SMS</a>
          <a className="btn btn-ghost btn-block" href="tel:190"><Phone size={16} /> Ligar 190</a>
        </div>
      </div>
    );
  }
  return (
    <div className="safedate-banner">
      <ShieldCheck size={18} />
      <span className="grow ellipsis">Encontro seguro · {left} min</span>
      <button className="btn btn-sm btn-light" onClick={ok}>Estou bem</button>
    </div>
  );
}
