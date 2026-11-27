import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { maxBirthdate } from '../lib/format';
import { POSITIONS, LOOKING_FOR, MEET_AT, TRIBES, INTERESTS, BODY_TYPES, RELATIONSHIPS, PRONOUNS } from '../config/options';
import TopBar from '../components/TopBar';
import Chips from '../components/Chips';
import { SwitchRow } from '../components/Switch';

export default function EditProfile() {
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const setMe = useApp((s) => s.setMe);
  const p = me?.profile || {};
  const pr = me?.private || {};
  const [f, setF] = useState({
    display_name: p.display_name || '',
    status_text: p.status_text || '',
    bio: p.bio || '',
    sex_position: p.sex_position || null,
    height_cm: p.height_cm || '',
    weight_kg: p.weight_kg || '',
    body_type: p.body_type || '',
    relationship: p.relationship || '',
    pronouns: p.pronouns || '',
    tribes: p.tribes || [],
    looking_for: p.looking_for || [],
    meet_at: p.meet_at || [],
    interests: p.interests || [],
  });
  const [h, setH] = useState({
    birthdate: pr.birthdate || '',
    on_prep: pr.on_prep ?? null,
    last_tested: pr.last_tested ? pr.last_tested.slice(0, 7) : '',
    show_health: !!pr.show_health,
  });
  const [busy, setBusy] = useState(false);
  const upd = (patch) => setF({ ...f, ...patch });
  const verified = !!pr.age_verified_at;

  const save = async () => {
    if (!f.display_name.trim()) return toast('Escolha um nome', 'error');
    setBusy(true);
    try {
      await api.updateProfile({
        ...f,
        display_name: f.display_name.trim(),
        height_cm: f.height_cm ? +f.height_cm : null,
        weight_kg: f.weight_kg ? +f.weight_kg : null,
        body_type: f.body_type || null,
        relationship: f.relationship || null,
        pronouns: f.pronouns || null,
      });
      const privPatch = { on_prep: h.on_prep, last_tested: h.last_tested ? `${h.last_tested}-01` : null, show_health: h.show_health };
      if (!verified && h.birthdate !== pr.birthdate) privPatch.birthdate = h.birthdate;
      await api.updatePrivate(privPatch);
      setMe(await api.getMe());
      toast('Perfil salvo', 'success');
      nav(-1);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Editar perfil" right={<button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : 'Salvar'}</button>} />
      <div className="scroll pad" style={{ paddingTop: 18, paddingBottom: 60 }}>
        <div className="col" style={{ gap: 18 }}>
          <label className="field"><span>Nome</span><input className="input" value={f.display_name} maxLength={30} onChange={(e) => upd({ display_name: e.target.value })} /></label>
          <label className="field"><span>Status rápido</span><input className="input" value={f.status_text} maxLength={60} placeholder="Ex.: Na Augusta até tarde 🌙" onChange={(e) => upd({ status_text: e.target.value })} /></label>
          <label className="field"><span>Bio</span>
            <textarea className="textarea" value={f.bio} maxLength={500} placeholder="Conte um pouco sobre você" onChange={(e) => upd({ bio: e.target.value })} />
            <span className="counter num">{f.bio.length}/500</span>
          </label>
          <label className="field">
            <span>Data de nascimento {verified && <LockKeyhole size={12} style={{ verticalAlign: -1 }} />}</span>
            <input className="input" type="date" value={h.birthdate} max={maxBirthdate()} disabled={verified} onChange={(e) => setH({ ...h, birthdate: e.target.value })} />
            {verified && <small className="faint tiny">Idade verificada. Para corrigir, fale com o suporte.</small>}
          </label>
        </div>

        <div className="section">
          <div className="section-title">Posição</div>
          <Chips multi={false} options={POSITIONS} value={f.sex_position} onChange={(v) => upd({ sex_position: v })} />
        </div>

        <div className="section">
          <div className="section-title">Sobre o corpo</div>
          <div className="input-row">
            <label className="field"><span>Altura (cm)</span><input className="input" inputMode="numeric" value={f.height_cm} onChange={(e) => upd({ height_cm: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="178" /></label>
            <label className="field"><span>Peso (kg)</span><input className="input" inputMode="numeric" value={f.weight_kg} onChange={(e) => upd({ weight_kg: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="75" /></label>
          </div>
          <div style={{ marginTop: 14 }}><Chips multi={false} options={BODY_TYPES} value={f.body_type} onChange={(v) => upd({ body_type: v })} /></div>
        </div>

        <div className="section">
          <div className="section-title">Relacionamento e pronomes</div>
          <Chips multi={false} options={RELATIONSHIPS} value={f.relationship} onChange={(v) => upd({ relationship: v })} />
          <div style={{ marginTop: 12 }}><Chips multi={false} options={PRONOUNS} value={f.pronouns} onChange={(v) => upd({ pronouns: v })} /></div>
        </div>

        <div className="section"><div className="section-title">Procurando</div><Chips options={LOOKING_FOR} value={f.looking_for} onChange={(v) => upd({ looking_for: v })} max={8} /></div>
        <div className="section"><div className="section-title">Onde</div><Chips options={MEET_AT} value={f.meet_at} onChange={(v) => upd({ meet_at: v })} max={6} /></div>
        <div className="section"><div className="section-title">Tribos <span className="faint small" style={{ fontWeight: 500 }}>{f.tribes.length}/8</span></div><Chips options={TRIBES} value={f.tribes} onChange={(v) => upd({ tribes: v })} max={8} /></div>
        <div className="section"><div className="section-title">Do que você curte <span className="faint small" style={{ fontWeight: 500 }}>{f.interests.length}/20</span></div><Chips options={INTERESTS} value={f.interests} onChange={(v) => upd({ interests: v })} max={20} /></div>

        <div className="section">
          <div className="section-title">Saúde sexual <span className="faint small" style={{ fontWeight: 500 }}>· opcional</span></div>
          <div className="list" style={{ padding: '0 16px' }}>
            <SwitchRow title="Mostrar no perfil" text="Desligado, ninguém vê essas informações." on={h.show_health} onChange={(v) => setH({ ...h, show_health: v })} />
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            {[[true, 'Uso PrEP'], [false, 'Não uso PrEP']].map(([v, l]) => (
              <button key={l} className={`chip ${h.on_prep === v ? 'on' : ''}`} onClick={() => setH({ ...h, on_prep: h.on_prep === v ? null : v })}>{l}</button>
            ))}
          </div>
          <label className="field" style={{ marginTop: 12 }}><span>Último teste</span><input className="input" type="month" value={h.last_tested} max={new Date().toISOString().slice(0, 7)} onChange={(e) => setH({ ...h, last_tested: e.target.value })} /></label>
          <p className="faint tiny" style={{ marginTop: 8 }}>Dado sensível protegido pela LGPD. Nunca compartilhamos com terceiros.</p>
        </div>
      </div>
    </div>
  );
}
