import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, Send, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { timeAgo } from '../lib/format';
import Avatar from '../components/Avatar';

const DURATION = 5000;

export default function Stories() {
  const { authorId } = useParams();
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const [data, setData] = useState(null);
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const raf = useRef(null);
  const prog = useRef(0);
  const mine = authorId === me?.id;

  useEffect(() => {
    api.storiesOf(authorId).then((d) => {
      if (!d.stories.length) return nav(-1);
      setData(d);
    }).catch((e) => { toast(errorMessage(e), 'error'); nav(-1); });
  }, [authorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const story = data?.stories[i];
  useEffect(() => {
    if (!story) return;
    api.viewStory(story.id).catch(() => {});
    prog.current = 0;
    setProgress(0);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!story || paused) return;
    let last = performance.now();
    const step = (t) => {
      prog.current += (t - last) / DURATION;
      last = t;
      if (prog.current >= 1) {
        prog.current = 0;
        setProgress(0);
        next();
        return;
      }
      setProgress(prog.current);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [story?.id, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (!data) return;
    if (i < data.stories.length - 1) setI((x) => x + 1);
    else nav(-1);
  };
  const prev = () => setI((x) => Math.max(0, x - 1));

  const sendReply = async () => {
    if (!reply.trim()) return;
    try {
      const conv = await api.openDirect(authorId);
      await api.send(conv, { kind: 'text', body: `Respondeu ao seu story: ${reply.trim()}` });
      setReply('');
      toast('Resposta enviada', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const remove = async () => {
    await api.deleteStory(story.id).catch(() => {});
    const rest = data.stories.filter((s) => s.id !== story.id);
    if (!rest.length) return nav(-1);
    setData({ ...data, stories: rest });
    setI((x) => Math.min(x, rest.length - 1));
  };

  if (!data || !story) return <div className="story-view"><div className="center grow"><span className="spinner" /></div></div>;

  return (
    <div className="story-view">
      <div className="story-bars">
        {data.stories.map((s, k) => (
          <i key={s.id}><b style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} /></i>
        ))}
      </div>
      <header className="story-head">
        <Avatar src={data.author.avatar_url} name={data.author.display_name} size={34} />
        <b>{mine ? 'Seu story' : data.author.display_name}</b>
        <span className="faint small">{timeAgo(story.created_at)}</span>
        <div className="grow" />
        {mine && <button className="icon-btn" onClick={remove} aria-label="Apagar story"><Trash2 size={20} /></button>}
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Fechar"><X size={24} /></button>
      </header>
      <div
        className="story-media"
        onPointerDown={() => setPaused(true)}
        onPointerUp={(e) => {
          setPaused(false);
          const x = e.clientX / e.currentTarget.clientWidth;
          if (x < 0.33) prev(); else next();
        }}
        onPointerLeave={() => setPaused(false)}
      >
        <img src={story.media_url} alt="" draggable={false} />
        {story.caption && <p className="story-caption">{story.caption}</p>}
      </div>
      {!mine && (
        <footer className="story-reply">
          <input className="input" placeholder={`Responder ${data.author.display_name}…`} value={reply}
            onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
            onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} />
          <button className="send-btn" onClick={sendReply} aria-label="Enviar"><Send size={18} /></button>
        </footer>
      )}
    </div>
  );
}
