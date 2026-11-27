import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, LockKeyhole } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { expiresLabel } from '../lib/format';

// Visualizador de álbum privado com marca d'água do destinatário (desencoraja vazamento).
export default function AlbumViewer({ albumId, title, expiresAt, onClose }) {
  const me = useApp((s) => s.me);
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const [idx, setIdx] = useState(0);
  const track = useRef(null);

  useEffect(() => {
    api.albumItems(albumId).then(setItems).catch((e) => setErr(errorMessage(e)));
  }, [albumId]);

  const onScroll = () => {
    const el = track.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const mark = `${me?.profile?.display_name || 'basher'} · ${new Date().toLocaleDateString('pt-BR')}`;

  return createPortal(
    <div className="viewer" onContextMenu={(e) => e.preventDefault()}>
      <header className="viewer-head">
        <LockKeyhole size={16} />
        <div className="grow">
          <b>{title}</b>
          <small>{expiresAt !== undefined ? expiresLabel(expiresAt) : ''}{items ? ` · ${idx + 1}/${items.length}` : ''}</small>
        </div>
        <button className="icon-btn glass" onClick={onClose} aria-label="Fechar"><X size={22} /></button>
      </header>
      {err ? (
        <div className="center grow muted">{err}</div>
      ) : !items ? (
        <div className="center grow"><span className="spinner" /></div>
      ) : (
        <div className="viewer-track" ref={track} onScroll={onScroll}>
          {items.map((it) => (
            <div key={it.id} className="viewer-slide">
              {it.media_type === 'video' ? (
                <video src={it.url} controls playsInline controlsList="nodownload" />
              ) : (
                <img src={it.url} alt="" draggable={false} />
              )}
              <div className="watermark" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i}>{mark}</span>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
