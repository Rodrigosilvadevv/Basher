import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, LockKeyhole, KeyRound, Ellipsis, Ban, Flag, Sparkles, Ruler, Weight, HeartHandshake, MapPin, Clock, CirclePlay, Crown, ShieldPlus } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { formatDistance, lastSeen, expiresLabel, timeAgo } from '../lib/format';
import { positionLabel, LOOKING_FOR, MEET_AT, TAP_KINDS } from '../config/options';
import { vibeScore, sharedInterests } from '../lib/vibe';
import TopBar from '../components/TopBar';
import Sheet from '../components/Sheet';
import ReportSheet from '../components/ReportSheet';
import AlbumViewer from '../components/AlbumViewer';
import { StaticChips } from '../components/Chips';
import { tap } from '../lib/haptics';

const labelOf = (list, id) => list.find((x) => x.id === id)?.label || id;

export default function UserProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const [p, setP] = useState(null);
  const [idx, setIdx] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [busy, setBusy] = useState(null);
  const track = useRef(null);

  const load = () => api.getProfile(id).then(setP).catch((e) => { toast(errorMessage(e), 'error'); nav(-1); });
  useEffect(() => { if (id === me?.id) nav('/perfil', { replace: true }); else load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) {
    return (
      <div className="screen">
        <TopBar clear />
        <div className="uprof-hero skeleton" />
      </div>
    );
  }

  const photos = p.photos?.length ? p.photos : p.avatar_url ? [{ id: 'a', url: p.avatar_url }] : [];
  const vibe = vibeScore(me?.profile, p);
  const shared = sharedInterests(me?.profile, p);
  const onScroll = () => {
    const el = track.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  const chat = async () => {
    setBusy('chat');
    try {
      nav(`/chat/${await api.openDirect(p.id)}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const sendTap = async (kind) => {
    tap('Medium');
    setSheet(null);
    try {
      await api.sendTap(p.id, kind);
      setP({ ...p, tapped_at: new Date().toISOString() });
      toast(`${TAP_KINDS.find((k) => k.id === kind).emoji} Faísca enviada para ${p.display_name}`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const requestAlbum = async () => {
    setBusy('album');
    try {
      await api.requestAlbum(p.id);
      setP({ ...p, pending_request: true });
      toast('Pedido enviado. Você será avisado quando liberar 🔑', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const block = async () => {
    await api.block(p.id).catch(() => {});
    toast(`${p.display_name} foi bloqueado`, 'success');
    nav(-1);
  };

  const stats = [
    p.height_cm && { icon: <Ruler size={15} />, t: `${p.height_cm} cm` },
    p.weight_kg && { icon: <Weight size={15} />, t: `${p.weight_kg} kg` },
    p.body_type && { icon: null, t: p.body_type },
    p.relationship && { icon: <HeartHandshake size={15} />, t: p.relationship },
    p.pronouns && { icon: null, t: p.pronouns },
  ].filter(Boolean);

  return (
    <div className="screen uprof">
      <TopBar clear right={<button className="icon-btn glass" onClick={() => setSheet('menu')} aria-label="Mais opções"><Ellipsis size={22} /></button>} />
      <div className="scroll" style={{ paddingBottom: 130 }}>
        <div className={`uprof-hero ${p.is_pro ? 'pro' : ''}`}>
          <div className="uprof-track" ref={track} onScroll={onScroll}>
            {photos.length ? photos.map((ph) => (
              <div key={ph.id} className="uprof-slide"><img src={ph.url} alt="" className="blurrable" draggable={false} /></div>
            )) : <div className="uprof-slide uprof-noimg">{p.display_name?.[0]}</div>}
          </div>
          {photos.length > 1 && (
            <div className="uprof-dots">{photos.map((ph, i) => <i key={ph.id} className={i === idx ? 'on' : ''} />)}</div>
          )}
          <div className="uprof-info">
            {p.has_story && (
              <button className="story-pill" onClick={() => nav(`/stories/${p.id}`)}><CirclePlay size={15} /> Ver story</button>
            )}
            <h1>{p.display_name}{p.age ? <span className="age">{p.age}</span> : null}</h1>
            <div className="row wrap-row">
              <span className={`badge ${p.online ? 'online' : 'glass'}`}>{p.online && <i className="dot-online" />}{lastSeen(p.last_active, p.online)}</span>
              {p.distance_m != null && <span className="badge glass"><MapPin />{formatDistance(p.distance_m)}</span>}
              {vibe && <span className="badge vibe"><Sparkles />{vibe}% de vibe</span>}
              {p.is_pro && <span className="badge pro"><Crown />PRO</span>}
            </div>
            {p.status_text && <p className="uprof-status">“{p.status_text}”</p>}
          </div>
        </div>

        <div className="pad">
          {(positionLabel(p.sex_position) || stats.length > 0) && (
            <div className="section">
              <div className="chips">
                {positionLabel(p.sex_position) && <span className="chip static on">{positionLabel(p.sex_position)}</span>}
                {stats.map((s) => <span key={s.t} className="chip static">{s.icon}{s.t}</span>)}
              </div>
            </div>
          )}
          {p.bio && (
            <div className="section">
              <div className="section-title">Sobre</div>
              <p className="bio">{p.bio}</p>
            </div>
          )}
          {p.looking_for?.length > 0 && (
            <div className="section">
              <div className="section-title">Procurando</div>
              <StaticChips items={p.looking_for.map((x) => labelOf(LOOKING_FOR, x))} />
            </div>
          )}
          {p.meet_at?.length > 0 && (
            <div className="section">
              <div className="section-title">Onde</div>
              <StaticChips items={p.meet_at.map((x) => labelOf(MEET_AT, x))} />
            </div>
          )}
          {p.interests?.length > 0 && (
            <div className="section">
              <div className="section-title">Curte {shared.length > 0 && <span className="faint small" style={{ fontWeight: 500 }}>· {shared.length} em comum</span>}</div>
              <StaticChips items={p.interests} highlight={shared} />
            </div>
          )}
          {p.tribes?.length > 0 && (
            <div className="section">
              <div className="section-title">Tribos</div>
              <StaticChips items={p.tribes} />
            </div>
          )}
          {p.health && (
            <div className="section">
              <div className="section-title"><ShieldPlus size={17} color="#5cffb0" /> Saúde sexual</div>
              <div className="chips">
                {p.health.on_prep != null && <span className="chip static">{p.health.on_prep ? 'Usa PrEP' : 'Não usa PrEP'}</span>}
                {p.health.last_tested && <span className="chip static"><Clock size={14} /> Testou em {new Date(p.health.last_tested + 'T12:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>}
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-title"><LockKeyhole size={17} /> Álbuns privados <span className="faint small" style={{ fontWeight: 500 }}>· {p.albums_count}</span></div>
            {p.shared_albums?.length > 0 ? (
              <div className="list">
                {p.shared_albums.map((a) => (
                  <button key={a.share_id} className="list-item" onClick={() => setViewer(a)}>
                    <LockKeyhole />
                    <span className="txt"><b>{a.title}</b><small>Compartilhado com você · {expiresLabel(a.expires_at)}</small></span>
                    <span className="end">Abrir</span>
                  </button>
                ))}
              </div>
            ) : p.albums_count > 0 ? (
              <p className="small muted">
                {p.pending_request ? 'Pedido enviado. Aguardando a liberação.' : p.can_request_album ? 'Peça acesso. Ele escolhe se libera e por quanto tempo.' : 'Converse com ele ou chegue mais perto para poder pedir acesso.'}
              </p>
            ) : (
              <p className="small faint">Nenhum álbum privado.</p>
            )}
          </div>
          {p.tapped_at && <p className="tiny faint" style={{ marginTop: 18 }}>Você mandou uma faísca há {timeAgo(p.tapped_at)}.</p>}
        </div>
      </div>

      <div className="uprof-actions">
        <button className="act-round" onClick={() => setSheet('tap')} aria-label="Mandar faísca"><span style={{ fontSize: 22 }}>⚡</span></button>
        {p.albums_count > 0 && !p.shared_albums?.length && (
          <button className="act-round" disabled={!p.can_request_album || p.pending_request || busy === 'album'} onClick={requestAlbum} aria-label="Pedir álbum">
            <KeyRound size={22} />
          </button>
        )}
        <button className="btn btn-primary grow" onClick={chat} disabled={busy === 'chat'}>
          {busy === 'chat' ? <span className="spinner" /> : <MessageCircle size={19} />} Conversar
        </button>
      </div>

      <Sheet open={sheet === 'tap'} onClose={() => setSheet(null)} title="Mandar faísca">
        <div className="tap-grid">
          {TAP_KINDS.map((k) => (
            <button key={k.id} className="tap-opt" onClick={() => sendTap(k.id)}>
              <span>{k.emoji}</span><b>{k.label}</b>
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)}>
        <div className="list">
          <button className="list-item danger" onClick={block}><Ban /><span className="txt">Bloquear {p.display_name}</span></button>
          <button className="list-item danger" onClick={() => setSheet('report')}><Flag /><span className="txt">Denunciar</span></button>
        </div>
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} userId={p.id} name={p.display_name} onDone={(b) => b && nav(-1)} />
      {viewer && <AlbumViewer albumId={viewer.album_id} title={viewer.title} expiresAt={viewer.expires_at} onClose={() => setViewer(null)} />}
    </div>
  );
}
