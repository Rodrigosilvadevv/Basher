import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LockKeyhole, ShieldCheck, Ellipsis, ImagePlus, Send, MapPin, KeyRound, UserRound, BellOff, Bell, Ban, Flag,
  Copy, LogOut, UsersRound, Trash2, X,
} from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { clockTime, expiresLabel, lastSeen } from '../lib/format';
import { QUICK_REPLIES } from '../config/options';
import TopBar from '../components/TopBar';
import Avatar from '../components/Avatar';
import Sheet from '../components/Sheet';
import FilePick from '../components/FilePick';
import ShareAlbumSheet from '../components/ShareAlbumSheet';
import AlbumViewer from '../components/AlbumViewer';
import ReportSheet from '../components/ReportSheet';
import { SafeDateSheet } from '../components/SafeDate';
import { tap } from '../lib/haptics';

const dayLabel = (d) => {
  const x = new Date(d);
  const t = new Date();
  const y = new Date(Date.now() - 86400000);
  if (x.toDateString() === t.toDateString()) return 'Hoje';
  if (x.toDateString() === y.toDateString()) return 'Ontem';
  return x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
};

export default function ChatRoom() {
  const { id } = useParams();
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const coords = useApp((s) => s.coords);
  const draft = useApp((s) => s.drafts[id] || '');
  const setDraft = useApp((s) => s.setDraft);
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [sending, setSending] = useState(false);
  const list = useRef(null);
  const sub = useRef(null);
  const lastTyping = useRef(0);
  const press = useRef(null);

  const myId = me?.id;
  const other = conv?.other;
  const members = useMemo(() => Object.fromEntries((conv?.members || []).map((m) => [m.user_id, m.profile])), [conv]);

  useEffect(() => {
    let alive = true;
    setMsgs(null);
    Promise.all([api.conversation(id), api.messages(id)])
      .then(([c, m]) => {
        if (!alive) return;
        setConv(c);
        setMsgs(m);
        api.markRead(id);
      })
      .catch((e) => {
        toast(errorMessage(e), 'error');
        nav('/chats', { replace: true });
      });
    sub.current = api.subscribeConversation(id, {
      onMessage: (m) => {
        setMsgs((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
        if (m.sender_id !== myId) { setTyping(false); api.markRead(id); tap(); }
      },
      onUpdate: (m) => setMsgs((prev) => prev?.map((x) => (x.id === m.id ? { ...x, ...m } : x))),
      onTyping: (p) => {
        if (p.user_id === myId) return;
        setTyping(p.typing);
        if (p.typing) setTimeout(() => setTyping(false), 5000);
      },
    });
    return () => { alive = false; sub.current?.close(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = list.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [msgs?.length, typing]);

  const send = async (text = draft) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft(id, '');
    try {
      const m = await api.send(id, { kind: 'text', body });
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      sub.current?.typing({ user_id: myId, typing: false });
    } catch (e) {
      setDraft(id, body);
      toast(errorMessage(e), 'error');
    } finally {
      setSending(false);
    }
  };
  const sendImage = async (file) => {
    setSending(true);
    try {
      const m = await api.sendImage(id, file);
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSending(false);
    }
  };
  const sendLocation = async () => {
    if (!coords) return toast('Ative a localização primeiro', 'error');
    // só a posição arredondada (~100 m), nunca a exata
    const m = await api.send(id, { kind: 'location', body: 'Localização aproximada', meta: { lat: +coords.lat.toFixed(3), lng: +coords.lng.toFixed(3) } }).catch((e) => toast(errorMessage(e), 'error'));
    if (m) setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  };
  const onInput = (v) => {
    setDraft(id, v);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      sub.current?.typing({ user_id: myId, typing: true });
    }
  };
  const unsend = async (m) => {
    setActionMsg(null);
    try {
      await api.unsend(m.id);
      setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), body: '', meta: {} } : x)));
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const startPress = (m) => {
    if (m.sender_id !== myId || m.deleted_at || m.kind === 'system') return;
    press.current = setTimeout(() => { tap('Medium'); setActionMsg(m); }, 450);
  };
  const endPress = () => clearTimeout(press.current);

  const block = async () => {
    await api.block(other.id).catch(() => {});
    toast(`${other.display_name} foi bloqueado`, 'success');
    nav('/chats', { replace: true });
  };
  const toggleMute = async () => {
    await api.setMuted(id, !conv.muted);
    setConv({ ...conv, muted: !conv.muted });
    setSheet(null);
  };
  const leave = async () => {
    await api.leaveConversation(id);
    nav('/chats', { replace: true });
  };

  if (!conv) {
    return (
      <div className="screen">
        <TopBar title="" />
        <div className="center grow"><span className="spinner" /></div>
      </div>
    );
  }

  const otherOnline = other && Date.now() - new Date(other.last_active).getTime() < 600000;
  const subtitle = conv.is_group ? `${conv.members.length} pessoas` : typing ? 'digitando…' : lastSeen(other?.last_active, otherOnline);

  return (
    <div className="screen chat">
      <TopBar
        right={
          <>
            {!conv.is_group && (
              <>
                <button className="icon-btn" onClick={() => setSheet('album')} aria-label="Enviar álbum"><LockKeyhole size={21} /></button>
                <button className="icon-btn" onClick={() => setSheet('safe')} aria-label="Encontro seguro"><ShieldCheck size={21} /></button>
              </>
            )}
            <button className="icon-btn" onClick={() => setSheet('menu')} aria-label="Mais opções"><Ellipsis size={22} /></button>
          </>
        }
      >
        <button className="row grow chat-who" onClick={() => (conv.is_group ? setSheet('group') : nav(`/u/${other.id}`))}>
          {conv.is_group ? <div className="group-avatar sm"><UsersRound size={18} /></div> : <Avatar src={other?.avatar_url} name={other?.display_name} size={38} online={otherOnline} />}
          <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
            <b className="ellipsis" style={{ display: 'block' }}>{conv.is_group ? conv.title : other?.display_name}</b>
            <small className={typing ? 'typing-text' : 'faint'}>{subtitle}</small>
          </span>
        </button>
      </TopBar>

      <div className="scroll msgs" ref={list}>
        {msgs === null ? (
          <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>
        ) : (
          <>
            {!conv.is_group && (
              <div className="chat-intro">
                <ShieldCheck size={16} />
                <span>Dica: marque o primeiro encontro em lugar público e ative o <b>Encontro seguro</b> no escudo acima.</span>
              </div>
            )}
            {msgs.map((m, i) => {
              const prev = msgs[i - 1];
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const mine = m.sender_id === myId;
              const sender = members[m.sender_id];
              const showName = conv.is_group && !mine && prev?.sender_id !== m.sender_id;
              return (
                <Fragment key={m.id}>
                  {newDay && <div className="day-sep"><span>{dayLabel(m.created_at)}</span></div>}
                  {m.kind === 'system' ? (
                    <div className="sys-msg">{m.body}</div>
                  ) : (
                    <div className={`msg-row ${mine ? 'mine' : ''}`}
                      onTouchStart={() => startPress(m)} onTouchEnd={endPress} onTouchMove={endPress}
                      onContextMenu={(e) => { if (mine && !m.deleted_at) { e.preventDefault(); setActionMsg(m); } }}>
                      {conv.is_group && !mine && (
                        <div style={{ width: 28 }}>{showName && <Avatar src={sender?.avatar_url} name={sender?.display_name} size={28} />}</div>
                      )}
                      <div className="msg-col">
                        {showName && <span className="msg-name">{sender?.display_name}</span>}
                        <MessageBody m={m} mine={mine} myId={myId} other={other}
                          onOpenAlbum={(x) => setViewer(x)} onZoom={setZoomImg} onShareAlbum={() => setSheet('album')} />
                        <span className="msg-time">{clockTime(m.created_at)}</span>
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
            {typing && <div className="msg-row"><div className="bubble typing"><i /><i /><i /></div></div>}
          </>
        )}
      </div>

      <footer className="composer">
        {!draft && !conv.is_group && (
          <div className="quick hscroll">
            {QUICK_REPLIES.map((q) => <button key={q} className="chip static" onClick={() => send(q)}>{q}</button>)}
          </div>
        )}
        <div className="composer-row">
          <FilePick className="icon-btn" onFiles={sendImage} ariaLabel="Enviar foto"><ImagePlus size={22} /></FilePick>
          {!conv.is_group && <button className="icon-btn" onClick={sendLocation} aria-label="Enviar localização aproximada"><MapPin size={21} /></button>}
          <textarea
            className="composer-input"
            rows={1}
            value={draft}
            placeholder="Mensagem"
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            maxLength={4000}
          />
          <button className="send-btn" onClick={() => send()} disabled={!draft.trim() || sending} aria-label="Enviar"><Send size={19} /></button>
        </div>
      </footer>

      {!conv.is_group && (
        <>
          <ShareAlbumSheet open={sheet === 'album'} onClose={() => setSheet(null)} toId={other?.id} toName={other?.display_name} />
          <SafeDateSheet open={sheet === 'safe'} onClose={() => setSheet(null)} withId={other?.id} withName={other?.display_name} />
          <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} userId={other?.id} name={other?.display_name} onDone={(b) => b && nav('/chats', { replace: true })} />
        </>
      )}

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)}>
        <div className="list">
          {!conv.is_group && <button className="list-item" onClick={() => nav(`/u/${other.id}`)}><UserRound /><span className="txt">Ver perfil</span></button>}
          {conv.is_group && <button className="list-item" onClick={() => setSheet('group')}><UsersRound /><span className="txt">Info do grupo</span></button>}
          <button className="list-item" onClick={toggleMute}>{conv.muted ? <Bell /> : <BellOff />}<span className="txt">{conv.muted ? 'Reativar notificações' : 'Silenciar'}</span></button>
          {!conv.is_group && <button className="list-item danger" onClick={block}><Ban /><span className="txt">Bloquear</span></button>}
          {!conv.is_group && <button className="list-item danger" onClick={() => setSheet('report')}><Flag /><span className="txt">Denunciar</span></button>}
          {conv.is_group && <button className="list-item danger" onClick={leave}><LogOut /><span className="txt">Sair do grupo</span></button>}
        </div>
      </Sheet>

      {conv.is_group && (
        <Sheet open={sheet === 'group'} onClose={() => setSheet(null)} title={conv.title} tall>
          {conv.description && <p className="muted" style={{ marginBottom: 16 }}>{conv.description}</p>}
          {conv.invite_code && (
            <div className="invite card">
              <div className="grow"><small className="faint">Código de convite</small><b className="num">{conv.invite_code}</b></div>
              <button className="btn btn-glass btn-sm" onClick={() => navigator.clipboard?.writeText(conv.invite_code).then(() => toast('Código copiado', 'success')).catch(() => toast(conv.invite_code))}><Copy size={15} /> Copiar</button>
            </div>
          )}
          <div className="section-title" style={{ marginTop: 20 }}>{conv.members.length} membros <span className="faint small" style={{ fontWeight: 500 }}>· sem limite</span></div>
          <div className="list">
            {conv.members.map((m) => (
              <div key={m.user_id} className="list-item">
                <Avatar src={m.profile?.avatar_url} name={m.profile?.display_name} size={36} />
                <span className="txt">{m.user_id === myId ? 'Você' : m.profile?.display_name}{m.role !== 'member' && <small>{m.role === 'owner' ? 'Criador' : 'Admin'}</small>}</span>
                {['owner', 'admin'].includes(conv.myRole) && m.user_id !== myId && m.role !== 'owner' && (
                  <button className="icon-btn" aria-label="Remover" onClick={async () => { await api.removeGroupMember(id, m.user_id); setConv(await api.conversation(id)); }}><X size={18} /></button>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-glass btn-block" style={{ marginTop: 18, color: 'var(--danger)' }} onClick={leave}><LogOut size={17} /> Sair do grupo</button>
        </Sheet>
      )}

      <Sheet open={!!actionMsg} onClose={() => setActionMsg(null)}>
        <div className="list">
          {actionMsg?.kind === 'text' && <button className="list-item" onClick={() => { navigator.clipboard?.writeText(actionMsg.body).catch(() => {}); setActionMsg(null); toast('Copiado'); }}><Copy /><span className="txt">Copiar</span></button>}
          <button className="list-item danger" onClick={() => unsend(actionMsg)}><Trash2 /><span className="txt">Apagar para todos</span></button>
        </div>
      </Sheet>

      {viewer && <AlbumViewer albumId={viewer.album_id} title={viewer.title} expiresAt={viewer.expires_at} onClose={() => setViewer(null)} />}
      {zoomImg && (
        <div className="viewer" onClick={() => setZoomImg(null)}>
          <div className="viewer-slide"><img src={zoomImg} alt="" /></div>
        </div>
      )}
    </div>
  );
}

function MessageBody({ m, mine, myId, other, onOpenAlbum, onZoom, onShareAlbum }) {
  if (m.deleted_at) return <div className="bubble deleted">Mensagem apagada</div>;
  switch (m.kind) {
    case 'image':
      return (
        <button className="bubble img" onClick={() => m.meta?.url && onZoom(m.meta.url)}>
          {m.meta?.url ? <img src={m.meta.url} alt="Foto" className="blurrable" /> : <span className="spinner" />}
        </button>
      );
    case 'album': {
      const expired = m.meta?.expires_at && new Date(m.meta.expires_at) < new Date();
      return (
        <div className={`bubble album-card ${expired ? 'expired' : ''}`}>
          <div className="row">
            <span className="album-ico"><LockKeyhole size={18} /></span>
            <div className="grow">
              <b>{m.body || 'Álbum privado'}</b>
              <small>{expired ? 'Acesso expirado' : expiresLabel(m.meta?.expires_at)}</small>
            </div>
          </div>
          {mine ? (
            <small className="faint">Você compartilhou este álbum</small>
          ) : (
            <button className="btn btn-sm btn-light btn-block" disabled={expired} onClick={() => onOpenAlbum({ album_id: m.meta.album_id, title: m.body, expires_at: m.meta?.expires_at })}>Abrir álbum</button>
          )}
        </div>
      );
    }
    case 'album_request':
      return (
        <div className="bubble album-card">
          <div className="row">
            <span className="album-ico"><KeyRound size={18} /></span>
            <div className="grow"><b>{mine ? 'Você pediu para ver os álbuns' : 'Quer ver seus álbuns'}</b><small>{mine ? `Aguardando ${other?.display_name || ''}` : 'Envie se quiser. Você escolhe o prazo.'}</small></div>
          </div>
          {!mine && m.sender_id !== myId && <button className="btn btn-sm btn-primary btn-block" onClick={onShareAlbum}>Enviar um álbum</button>}
        </div>
      );
    case 'location':
      return (
        <a className="bubble loc-card" href={`https://maps.google.com/?q=${m.meta?.lat},${m.meta?.lng}`} target="_blank" rel="noreferrer">
          <MapPin size={18} /><span><b>Localização aproximada</b><small>Abrir no mapa</small></span>
        </a>
      );
    case 'tap':
      return <div className="bubble">⚡ Faísca</div>;
    default:
      return <div className="bubble">{m.body}</div>;
  }
}
