import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import FilePick from './FilePick';

export default function StoriesBar({ tray, me, onCreate, busy }) {
  const nav = useNavigate();
  const mine = tray.find((t) => t.is_me);
  const others = tray.filter((t) => !t.is_me);
  return (
    <div className="stories hscroll" role="list">
      <div className="story-item" role="listitem">
        <div className="story-me">
          <button onClick={() => (mine ? nav(`/stories/${mine.author_id}`) : null)} aria-label="Seu story" disabled={!mine}>
            <Avatar src={me?.profile?.avatar_url} name={me?.profile?.display_name} size={64} ring={!!mine} seen={mine && !mine.unseen} />
          </button>
          <FilePick className="story-add" onFiles={onCreate} disabled={busy} ariaLabel="Criar story">
            {busy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Plus size={14} strokeWidth={3} />}
          </FilePick>
        </div>
        <span>Seu story</span>
      </div>
      {others.map((s) => (
        <button key={s.author_id} className="story-item" role="listitem" onClick={() => nav(`/stories/${s.author_id}`)}>
          <Avatar src={s.avatar_url} name={s.display_name} size={64} ring seen={!s.unseen} blur />
          <span className="ellipsis">{s.display_name}</span>
        </button>
      ))}
    </div>
  );
}
