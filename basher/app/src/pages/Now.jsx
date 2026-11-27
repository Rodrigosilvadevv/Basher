import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Newspaper, Heart, MessageCircle, Plus, ImagePlus, Trash2, Send, X, Timer } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { formatDistance, timeAgo, minutesLeft } from '../lib/format';
import { positionShort } from '../config/options';
import { LIMITS } from '../config/plans';
import Segmented from '../components/Segmented';
import Avatar from '../components/Avatar';
import Sheet from '../components/Sheet';
import FilePick from '../components/FilePick';
import Empty from '../components/Empty';
import { tap } from '../lib/haptics';

export default function Now() {
  const tab = useApp((s) => s.feedTab);
  const setTab = useApp((s) => s.setFeedTab);
  const me = useApp((s) => s.me);
  const [posts, setPosts] = useState(null);
  const [compose, setCompose] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);

  const load = useCallback(() => {
    setPosts(null);
    api.posts(tab).then(setPosts).catch((e) => { setPosts([]); toast(errorMessage(e), 'error'); });
  }, [tab]);
  useEffect(load, [load]);

  // atualiza contagem regressiva do Agora
  const [, tick] = useState(0);
  useEffect(() => {
    if (tab !== 'now') return;
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, [tab]);

  const mineNow = tab === 'now' && posts?.find((p) => p.author_id === me?.id);

  return (
    <div className="screen">
      <header className="topbar">
        <div className="title">
          {tab === 'now' ? <>Agora <span className="serif faint" style={{ fontSize: 15 }}>· some em 60 min</span></> : 'Feed'}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCompose(true)}><Plus size={16} />{tab === 'now' ? 'Postar' : 'Novo post'}</button>
      </header>
      <div className="pad" style={{ padding: '12px 16px 4px' }}>
        <Segmented value={tab} onChange={setTab} options={[
          { id: 'now', label: 'Agora', icon: <Zap size={15} /> },
          { id: 'feed', label: 'Feed', icon: <Newspaper size={15} /> },
        ]} />
      </div>
      <div className="scroll with-tabbar pad" style={{ paddingTop: 12 }}>
        {tab === 'now' && !mineNow && (
          <button className="now-prompt rise" onClick={() => setCompose(true)}>
            <Avatar src={me?.profile?.avatar_url} name={me?.profile?.display_name} size={40} />
            <span className="grow">O que você quer <span className="serif">agora</span>?</span>
            <Zap size={18} color="#f0abfc" />
          </button>
        )}
        {posts === null ? (
          <div className="col">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 18 }} />)}</div>
        ) : !posts.length ? (
          <Empty
            icon={tab === 'now' ? <Zap /> : <Newspaper />}
            title={tab === 'now' ? 'Ninguém postou agora' : 'O feed está quieto'}
            text={tab === 'now' ? 'Seja o primeiro: diga onde você está e o que procura. O post some sozinho em 60 minutos.' : 'Compartilhe uma foto ou um momento com quem está por perto.'}
            action={<button className="btn btn-primary" onClick={() => setCompose(true)}><Plus size={16} /> Postar</button>}
          />
        ) : (
          <div className="col" style={{ gap: 14 }}>
            {posts.map((p, i) =>
              tab === 'now'
                ? <NowCard key={p.id} p={p} me={me} i={i} onDelete={load} />
                : <PostCard key={p.id} p={p} me={me} i={i} onComments={() => setCommentsFor(p)} onDelete={load} />,
            )}
          </div>
        )}
      </div>
      <Composer open={compose} onClose={() => setCompose(false)} kind={tab} onPosted={load} />
      <CommentsSheet post={commentsFor} onClose={() => { setCommentsFor(null); load(); }} />
    </div>
  );
}

function NowCard({ p, me, i, onDelete }) {
  const nav = useNavigate();
  const left = minutesLeft(p.expires_at) ?? 0;
  const pct = Math.max(0, Math.min(1, left / LIMITS.nowPostMinutes));
  const mine = p.author_id === me?.id;
  const chat = async () => {
    try {
      const id = await api.openDirect(p.author_id);
      useApp.getState().setDraft(id, `Vi seu post no Agora: “${p.body.slice(0, 40)}” 👀 `);
      nav(`/chat/${id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <article className="now-card rise" style={{ animationDelay: `${i * 40}ms` }}>
      <div className="row">
        <button onClick={() => !mine && nav(`/u/${p.author_id}`)}>
          <Avatar src={p.author_avatar} name={p.author_name} size={46} online={p.author_online} blur />
        </button>
        <div className="grow">
          <b>{mine ? 'Você' : p.author_name}{p.author_age ? `, ${p.author_age}` : ''}</b>
          <div className="faint tiny num">{[positionShort(p.author_position), formatDistance(p.distance_m), timeAgo(p.created_at)].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="countdown" style={{ '--p': pct }} title={`${left} min restantes`}>
          <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" /><circle cx="18" cy="18" r="15.5" className="v" /></svg>
          <span className="num">{left}</span>
        </div>
      </div>
      <p className="now-body">{p.body}</p>
      {p.media_url && <img className="now-media blurrable" src={p.media_url} alt="" loading="lazy" />}
      <div className="row" style={{ marginTop: 12 }}>
        {mine ? (
          <button className="btn btn-glass btn-sm" onClick={async () => { await api.deletePost(p); onDelete(); }}><Trash2 size={15} /> Apagar</button>
        ) : (
          <>
            <button className="btn btn-primary btn-sm grow" onClick={chat}><MessageCircle size={16} /> Chamar</button>
            <button className="btn btn-glass btn-sm" onClick={() => { tap('Medium'); api.sendTap(p.author_id, 'fire').then(() => toast('Faísca enviada 🔥', 'success')).catch((e) => toast(errorMessage(e), 'error')); }}>⚡ Faísca</button>
          </>
        )}
      </div>
    </article>
  );
}

function PostCard({ p, me, i, onComments, onDelete }) {
  const nav = useNavigate();
  const [liked, setLiked] = useState(p.liked);
  const [likes, setLikes] = useState(p.likes);
  const [burst, setBurst] = useState(false);
  const mine = p.author_id === me?.id;
  const toggle = async (force) => {
    const on = force ?? !liked;
    if (on === liked) return;
    tap();
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    if (on) { setBurst(true); setTimeout(() => setBurst(false), 700); }
    try { await api.like(p.id, on); } catch { setLiked(!on); setLikes((n) => n + (on ? -1 : 1)); }
  };
  return (
    <article className="post rise" style={{ animationDelay: `${i * 40}ms` }}>
      <header className="row post-head">
        <button onClick={() => !mine && nav(`/u/${p.author_id}`)} className="row grow" style={{ textAlign: 'left' }}>
          <Avatar src={p.author_avatar} name={p.author_name} size={38} online={p.author_online} blur />
          <span className="grow">
            <b>{mine ? 'Você' : p.author_name}</b>
            <span className="faint tiny num" style={{ display: 'block' }}>{[formatDistance(p.distance_m), timeAgo(p.created_at)].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
        {mine && <button className="icon-btn" aria-label="Apagar post" onClick={async () => { await api.deletePost(p); onDelete(); }}><Trash2 size={18} /></button>}
      </header>
      {p.media_url && (
        <div className="post-media" onDoubleClick={() => toggle(true)}>
          <img src={p.media_url} alt="" className="blurrable" loading="lazy" />
          {burst && <Heart className="heart-burst" fill="#fff" />}
        </div>
      )}
      <div className="post-actions row">
        <button className={`act ${liked ? 'liked' : ''}`} onClick={() => toggle()} aria-label="Curtir"><Heart size={22} fill={liked ? 'currentColor' : 'none'} /> <span className="num">{likes}</span></button>
        <button className="act" onClick={onComments} aria-label="Comentários"><MessageCircle size={22} /> <span className="num">{p.comments}</span></button>
      </div>
      {p.body && <p className="post-body">{!p.media_url ? <span className="post-text-only">{p.body}</span> : <><b>{mine ? 'Você' : p.author_name}</b> {p.body}</>}</p>}
    </article>
  );
}

function Composer({ open, onClose, kind, onPosted }) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const post = async () => {
    setBusy(true);
    try {
      await api.createPost({ kind, body: body.trim(), file });
      toast(kind === 'now' ? 'No ar por 60 minutos ⚡' : 'Post publicado', 'success');
      setBody(''); setFile(null);
      onClose(); onPosted();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const max = kind === 'now' ? 160 : 600;
  return (
    <Sheet open={open} onClose={onClose} title={kind === 'now' ? 'Postar no Agora' : 'Novo post'}>
      <div className="col" style={{ gap: 14 }}>
        {kind === 'now' && <p className="small muted row"><Timer size={15} /> Some sozinho em 60 min. Só aparece para quem está a até 50 km.</p>}
        <textarea className="textarea" autoFocus placeholder={kind === 'now' ? 'Ex.: Na Augusta agora, alguém pra um drink?' : 'Escreva algo…'} value={body} maxLength={max} onChange={(e) => setBody(e.target.value)} />
        <span className="counter num">{body.length}/{max}</span>
        {preview && (
          <div className="compose-preview">
            <img src={preview} alt="" />
            <button className="icon-btn glass" onClick={() => setFile(null)} aria-label="Remover foto"><X size={18} /></button>
          </div>
        )}
        <div className="row">
          <FilePick className="btn btn-glass" onFiles={setFile}><ImagePlus size={18} /> Foto</FilePick>
          <button className="btn btn-primary grow" disabled={busy || (!body.trim() && !file)} onClick={post}>{busy ? <span className="spinner" /> : <Send size={17} />} Publicar</button>
        </div>
        <p className="faint tiny">Sem nudez em posts públicos. Isso fica para os álbuns privados.</p>
      </div>
    </Sheet>
  );
}

function CommentsSheet({ post, onClose }) {
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  useEffect(() => {
    if (post) api.comments(post.id).then(setItems).catch(() => setItems([]));
    else setItems(null);
  }, [post]);
  const send = async () => {
    if (!text.trim()) return;
    await api.addComment(post.id, text.trim()).catch((e) => toast(errorMessage(e), 'error'));
    setText('');
    setItems(await api.comments(post.id));
  };
  return (
    <Sheet open={!!post} onClose={onClose} title="Comentários"
      footer={<div className="row"><input className="input grow" placeholder="Comente algo legal…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} maxLength={500} /><button className="icon-btn" style={{ background: 'var(--grad-violet)' }} onClick={send} aria-label="Enviar"><Send size={18} /></button></div>}>
      {items === null ? <div className="center" style={{ padding: 30 }}><span className="spinner" /></div> : !items.length ? (
        <p className="muted" style={{ padding: '20px 0' }}>Nenhum comentário ainda.</p>
      ) : (
        <div className="col" style={{ gap: 16 }}>
          {items.map((c) => (
            <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
              <Avatar src={c.author_avatar} name={c.author_name} size={34} />
              <div className="grow"><b className="small">{c.author_name}</b> <span className="faint tiny">{timeAgo(c.created_at)}</span><p className="small">{c.body}</p></div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
