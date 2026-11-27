import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, ShieldCheck, ChevronLeft, Check } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { ageFrom, maxBirthdate } from '../lib/format';
import { env } from '../lib/env';
import { POSITIONS, LOOKING_FOR, MEET_AT, INTERESTS, TRIBES } from '../config/options';
import Chips from '../components/Chips';
import FilePick from '../components/FilePick';
import { getPosition, fallbackCoords } from '../services/location';
import { requestAgeSignal } from '../services/age';

const STEPS = 6;

export default function Onboarding({ onFinished }) {
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const setMe = useApp((s) => s.setMe);
  const setCoords = useApp((s) => s.setCoords);
  const ob = useApp((s) => s.onboarding);
  const setOb = useApp((s) => s.setOnboarding);
  const step = Math.min(ob.step || 0, STEPS - 1);

  const p = me?.profile || {};
  const pr = me?.private || {};
  const [name, setName] = useState(p.display_name || '');
  const [birth, setBirth] = useState(pr.birthdate || '');
  const [position, setPosition] = useState(p.sex_position || null);
  const [looking, setLooking] = useState(p.looking_for || []);
  const [meetAt, setMeetAt] = useState(p.meet_at || []);
  const [interests, setInterests] = useState(p.interests || []);
  const [tribes, setTribes] = useState(p.tribes || []);
  const [terms, setTerms] = useState(!!pr.accepted_terms_at);
  const [sensitive, setSensitive] = useState(!!pr.sensitive_consent_at);
  const [busy, setBusy] = useState(false);

  const refresh = async () => setMe(await api.getMe());
  const goto = (n) => setOb({ step: Math.max(0, Math.min(STEPS - 1, n)) });

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const age = ageFrom(birth);
  const steps = [
    {
      title: <>Como te <span className="serif grad-text">chamam?</span></>,
      text: 'Seu nome aparece no perfil. Pode ser apelido.',
      ok: name.trim().length > 0 && age >= 18,
      body: (
        <div className="col" style={{ gap: 18 }}>
          <label className="field"><span>Nome no perfil</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} placeholder="Ex.: Rafa" autoComplete="nickname" />
          </label>
          <label className="field"><span>Data de nascimento</span>
            <input className="input" type="date" value={birth} max={maxBirthdate()} onChange={(e) => setBirth(e.target.value)} />
          </label>
          {birth && age < 18 && <p className="small" style={{ color: 'var(--danger)' }}>O Basher é exclusivo para maiores de 18 anos.</p>}
          {birth && age >= 18 && <p className="small muted">Você tem {age} anos. Você pode esconder a idade depois.</p>}
        </div>
      ),
      next: () => run(async () => {
        await api.updateProfile({ display_name: name.trim() });
        await api.updatePrivate({ birthdate: birth });
        await refresh();
        goto(1);
      }),
    },
    {
      title: <>Qual é a sua <span className="serif grad-text">vibe?</span></>,
      text: 'Ajuda a mostrar quem combina mais com você.',
      ok: !!position,
      body: (
        <div className="col" style={{ gap: 22 }}>
          <div className="field"><span>Posição</span><Chips multi={false} options={POSITIONS} value={position} onChange={setPosition} /></div>
          <div className="field"><span>O que você procura</span><Chips options={LOOKING_FOR} value={looking} onChange={setLooking} max={8} /></div>
          <div className="field"><span>Onde</span><Chips options={MEET_AT} value={meetAt} onChange={setMeetAt} max={6} /></div>
        </div>
      ),
      next: () => run(async () => {
        await api.updateProfile({ sex_position: position, looking_for: looking, meet_at: meetAt });
        await refresh();
        goto(2);
      }),
    },
    {
      title: <>Sua melhor <span className="serif grad-text">foto</span></>,
      text: 'Perfis com foto recebem muito mais mensagens. Foto pública sem nudez: o picante fica nos álbuns privados 😉',
      ok: true,
      body: (
        <div className="col" style={{ alignItems: 'center', gap: 18 }}>
          <FilePick className="ob-photo" onFiles={(f) => run(async () => {
            const ph = await api.uploadPhoto(f, 0);
            await api.updateProfile({ avatar_url: ph.url });
            await refresh();
          })} ariaLabel="Escolher foto">
            {me?.profile?.avatar_url ? <img src={me.profile.avatar_url} alt="" /> : <><Camera size={34} /><span>Escolher foto</span></>}
            {busy && <span className="ob-photo-busy"><span className="spinner" /></span>}
          </FilePick>
          <p className="faint tiny" style={{ textAlign: 'center' }}>Removemos os dados de localização (EXIF) da foto antes de enviar.</p>
        </div>
      ),
      next: () => goto(3),
      skip: !me?.profile?.avatar_url,
    },
    {
      title: <>Do que você <span className="serif grad-text">curte?</span></>,
      text: 'Gostos em comum aumentam sua vibe com as pessoas.',
      ok: true,
      body: (
        <div className="col" style={{ gap: 22 }}>
          <div className="field"><span>Interesses <small className="faint">({interests.length}/20)</small></span><Chips options={INTERESTS} value={interests} onChange={setInterests} max={20} /></div>
          <div className="field"><span>Tribos <small className="faint">({tribes.length}/8)</small></span><Chips options={TRIBES} value={tribes} onChange={setTribes} max={8} /></div>
        </div>
      ),
      next: () => run(async () => {
        await api.updateProfile({ interests, tribes });
        await refresh();
        goto(4);
      }),
    },
    {
      title: <>Quem está <span className="serif grad-text">perto?</span></>,
      text: 'Usamos sua localização para mostrar quem está por perto.',
      ok: true,
      body: (
        <div className="col" style={{ gap: 16 }}>
          <div className="privacy-grid card">
            <div className="pg-visual" aria-hidden="true"><i /><b /></div>
            <div>
              <b>Sua posição exata nunca é salva.</b>
              <p className="small muted">Guardamos só um ponto aproximado numa grade de ~200 m. Assim ninguém consegue te triangular. Você também pode esconder a distância.</p>
            </div>
          </div>
        </div>
      ),
      nextLabel: <><MapPin size={18} /> Ativar localização</>,
      next: () => run(async () => {
        let c;
        try {
          c = await getPosition();
        } catch {
          c = fallbackCoords();
          toast('Não conseguimos sua localização. Você pode ativar depois nas configurações.', 'info');
        }
        setCoords(c);
        await api.updateLocation(c.lat, c.lng);
        goto(5);
      }),
    },
    {
      title: <>Só para <span className="serif grad-text">maiores</span></>,
      text: 'Pela lei (ECA Digital), confirmamos a idade com um método confiável — não basta declarar.',
      ok: terms && sensitive,
      body: (
        <div className="col" style={{ gap: 12 }}>
          <button className={`consent ${terms ? 'on' : ''}`} onClick={() => setTerms(!terms)}>
            <span className="box">{terms && <Check size={14} strokeWidth={3} />}</span>
            <span>Li e aceito os <a href={env.TERMS_URL} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Termos de Uso</a> e a <a href={env.PRIVACY_URL} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Política de Privacidade</a>.</span>
          </button>
          <button className={`consent ${sensitive ? 'on' : ''}`} onClick={() => setSensitive(!sensitive)}>
            <span className="box">{sensitive && <Check size={14} strokeWidth={3} />}</span>
            <span>Autorizo o tratamento de dados sensíveis (orientação sexual e, se eu informar, saúde) para o funcionamento do app, conforme a LGPD. Posso revogar quando quiser.</span>
          </button>
          <div className="age-card card">
            <ShieldCheck size={22} color="#c4a6ff" />
            <p className="small muted">Ao continuar, o iPhone pergunta se você quer compartilhar sua <b>faixa etária</b> com o Basher. Só recebemos “18+” — nunca sua data exata nem documentos.</p>
          </div>
        </div>
      ),
      nextLabel: <><ShieldCheck size={18} /> Confirmar e entrar</>,
      next: () => run(async () => {
        const now = new Date().toISOString();
        await api.updatePrivate({ accepted_terms_at: now, sensitive_consent_at: now });
        const sig = await requestAgeSignal();
        if (!sig.ok) {
          if (sig.reason === 'native_only') {
            // PWA/web: pula verificação de idade (autodeclaração via data de nascimento já foi validada)
            await api.recordAgeSignal(18, 'web_self_declaration').catch(() => {});
          } else if (sig.reason === 'DECLINED_SHARING') {
            throw new Error('Para entrar, permita compartilhar sua faixa etária (só “18+”) quando o iPhone perguntar.');
          } else if (sig.lower != null && sig.lower < 18) {
            await api.recordAgeSignal(sig.lower, sig.source).catch(() => {});
            throw new Error('UNDERAGE');
          } else {
            await api.recordAgeSignal(18, 'web_self_declaration').catch(() => {});
          }
        } else {
          await api.recordAgeSignal(sig.lower, sig.source);
        }
        await api.completeOnboarding();
        await refresh();
        setOb({ step: 0, done: true });
        onFinished?.();
        nav('/', { replace: true });
        toast(`Bem-vindo ao Basher, ${name.trim()} 💜`, 'success');
      }),
    },
  ];

  const s = steps[step];
  return (
    <div className="screen onboarding">
      <header className="ob-head">
        <button className="icon-btn" onClick={() => (step ? goto(step - 1) : api.auth.signOut())} aria-label="Voltar"><ChevronLeft size={26} /></button>
        <div className="progress grow"><i style={{ width: `${((step + 1) / STEPS) * 100}%` }} /></div>
        <span className="faint small num" style={{ width: 44, textAlign: 'right' }}>{step + 1}/{STEPS}</span>
      </header>
      <div className="scroll pad" key={step}>
        <div className="rise" style={{ paddingTop: 18 }}>
          <h1 className="ob-title">{s.title}</h1>
          <p className="muted" style={{ marginTop: 10 }}>{s.text}</p>
        </div>
        <div className="rise" style={{ marginTop: 28, animationDelay: '80ms', paddingBottom: 30 }}>{s.body}</div>
      </div>
      <footer className="ob-foot pad">
        {s.skip && <button className="btn btn-ghost" onClick={s.next}>Pular</button>}
        <button className="btn btn-primary grow" disabled={!s.ok || busy} onClick={s.next}>
          {busy ? <span className="spinner" /> : s.nextLabel || 'Continuar'}
        </button>
      </footer>
    </div>
  );
}