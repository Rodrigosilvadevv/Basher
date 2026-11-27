import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsersRound, MessageCircle, KeyRound, Link2, BellOff, Plus } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { timeAgo } from '../lib/format';
import { TAP_KINDS } from '../config/options';
import Segmented from '../components/Segmented';
import Avatar from '../components/Avatar';
import Empty from '../components/Empty';
import Sheet from '../components/Sheet';
import ShareAlbumSheet from '../components/ShareAlbumSheet';

export default function Chats() {
  const nav = useNavigate();
  const tab = useApp((s) => s.chatsTab);
  const setTab = useApp((s) => s.setChatsTab);
  const cache = useApp((s) => s.convCache);
  const setCache = useApp((s) => s.setConvCache);
  const [convs, setConvs] = useState(cache);
  const [taps, setTaps] = useState(null);
  const [reqs, setReqs] = useState(null);
  const [join, setJoin] = useState(false);
  const [code, setCode] = useState('');
  const [shareTo, setShareTo] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, t, r] = await Promise.all([api.conversations(), api.myTaps(), api.myAlbumRequests()]);
      setConvs(c);
      setCache(c);
      setTaps(t);
      setReqs(r);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }, [setCache]);

  useEffect(() => {
    load();
    const off = api.subscribeInbox(() => load());
    return off;
  }, [load]);

  useEffect(() => {
    if (tab === 'taps' && taps?.some((t) => !t.seen)) api.markTapsSeen();
  }, [tab, taps]);

  const openWith = async (userId) => {
    try {
      nav(`/chat/${await api.openDirect(userId)}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const doJoin = async () => {
    try {
      const id = await api.joinGroup(code);
      setJoin(false);
      nav(`/chat/${id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const decline = async (r) => {
    await api.declineAlbumRequest(r.id).catch(() => {});
    setReqs((x) => x.filter((y) => y.id !== r.id));
  };

  const newTaps = taps?.filter((t) => !t.seen).length || 0;

  return (
    <div className="screen">
      <header className="topbar">
        <div className="title">Conversas</div>
        <button className="icon-btn" onClick={() => setJoin(true)} aria-label="Entrar com código"><Link2 size={21} /></button>
        <button className="btn btn-primary btn-sm" onClick={() => nav('/chats/novo-grupo')}><UsersRound size={16} /> Grupo</button>
      </header>
      <div style={{ padding: '12px 16px 4px' }}>
        <Segmented value={tab} onChange={setTab} options={[
          { id: 'messages', label: 'Mensagens' },
          { id: 'taps', label: 'Faíscas', badge: newTaps },
          { id: 'requests', label: 'Pedidos', badge: reqs?.length || 0 },
        ]} />
      </div>
      <div className="scroll with-tabbar" style={{ paddingTop: 8 }}>
        {tab === 'messages' && (
          !convs.length ? (
            <Empty icon={<MessageCircle />} title="Nenhuma conversa ainda" text="Mande um oi para alguém da grade ou do mapa. Quem chama primeiro leva vantagem 😉" action={<button className="btn btn-primary" onClick={() => nav('/')}>Ver quem está perto</button>} />
          ) : (
            <div className="conv-list">
              {convs.map((c, i) => (
                <button key={c.id} className="conv rise" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} onClick={() => nav(`/chat/${c.id}`)}>
                  {c.is_group ? (
                    <div className="group-avatar"><UsersRound size={22} /></div>
                  ) : (
                    <Avatar src={c.avatar_url} name={c.title} size={54} online={c.other_online} blur />
                  )}
                  <div className="grow conv-mid">
                    <div className="row" style={{ gap: 6 }}>
                      <b className="ellipsis">{c.title || 'Conversa'}</b>
                      {c.is_group && <span className="faint tiny nowrap">· {c.member_count}</span>}
                      {c.muted && <BellOff size={13} className="faint" />}
                    </div>
                    <p className={`ellipsis small ${c.unread ? '' : 'faint'}`}>{c.last_message_preview}</p>
                  </div>
                  <div className="conv-end">
                    <span className="tiny faint nowrap">{timeAgo(c.last_message_at)}</span>
                    {c.unread > 0 && <span className="unread num">{c.unread}</span>}
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'taps' && (
          !taps ? null : !taps.length ? (
            <Empty icon={<span style={{ fontSize: 28 }}>⚡</span>} title="Sem faíscas por enquanto" text="Quando alguém te mandar uma faísca, ela aparece aqui por 7 dias." />
          ) : (
            <div className="conv-list">
              {taps.map((t) => (
                <div key={t.from_id} className="conv">
                  <button onClick={() => nav(`/u/${t.from_id}`)}><Avatar src={t.avatar_url} name={t.display_name} size={54} blur /></button>
                  <div className="grow conv-mid">
                    <b>{t.display_name} {!t.seen && <span className="badge vibe" style={{ marginLeft: 4 }}>nova</span>}</b>
                    <p className="small faint">te mandou {TAP_KINDS.find((k) => k.id === t.kind)?.emoji} · {timeAgo(t.created_at)}</p>
                  </div>
                  <button className="btn btn-glass btn-sm" onClick={() => openWith(t.from_id)}>Responder</button>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'requests' && (
          !reqs ? null : !reqs.length ? (
            <Empty icon={<KeyRound />} title="Nenhum pedido de álbum" text="Quem conversou com você ou está por perto pode pedir para ver seus álbuns privados." />
          ) : (
            <div className="conv-list">
              {reqs.map((r) => (
                <div key={r.id} className="conv">
                  <button onClick={() => nav(`/u/${r.requester_id}`)}><Avatar src={r.avatar_url} name={r.display_name} size={54} blur /></button>
                  <div className="grow conv-mid">
                    <b>{r.display_name}</b>
                    <p className="small faint">quer ver seus álbuns · {timeAgo(r.created_at)}</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => decline(r)}>Recusar</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShareTo(r)}>Enviar</button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <Sheet open={join} onClose={() => setJoin(false)} title="Entrar num grupo">
        <div className="col" style={{ gap: 14 }}>
          <p className="muted small">Cole o código de convite que alguém do grupo te mandou.</p>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: augusta23" autoCapitalize="off" />
          <button className="btn btn-primary btn-block" disabled={!code.trim()} onClick={doJoin}><Plus size={18} /> Entrar</button>
        </div>
      </Sheet>
      <ShareAlbumSheet open={!!shareTo} onClose={() => setShareTo(null)} toId={shareTo?.requester_id} toName={shareTo?.display_name} onShared={load} />
    </div>
  );
}
