import { useEffect, useState } from 'react';
import { LockKeyhole, Plus, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sheet from './Sheet';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { ALBUM_DURATIONS } from '../config/options';
import { buy } from '../services/purchases';

export default function ShareAlbumSheet({ open, onClose, toId, toName, onShared }) {
  const nav = useNavigate();
  const status = useApp((s) => s.status);
  const setStatus = useApp((s) => s.setStatus);
  const me = useApp((s) => s.me);
  const [albums, setAlbums] = useState(null);
  const [album, setAlbum] = useState(null);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.myAlbums().then((a) => { setAlbums(a); setAlbum(a[0]?.id || null); }).catch(() => setAlbums([]));
    api.myStatus().then(setStatus).catch(() => {});
  }, [open, setStatus]);

  const used = status?.album_used || 0;
  const limit = status?.album_free_limit || 20;
  const credits = status?.album_credits || 0;
  const pro = status?.is_pro;
  const out = !pro && used >= limit && credits <= 0;

  const share = async () => {
    setBusy(true);
    try {
      await api.shareAlbum(album, toId, hours);
      setStatus(await api.myStatus());
      toast(`Álbum enviado para ${toName}`, 'success');
      onShared?.();
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const buyPack = async () => {
    setBusy(true);
    try {
      setStatus(await buy('album_pack', me.id));
      toast('+10 envios de álbum liberados', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Enviar álbum privado">
      {albums === null ? (
        <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>
      ) : albums.length === 0 ? (
        <div className="col" style={{ gap: 14, alignItems: 'flex-start' }}>
          <p className="muted">Você ainda não tem álbuns privados.</p>
          <button className="btn btn-primary" onClick={() => { onClose(); nav('/perfil/albuns'); }}><Plus size={18} /> Criar álbum</button>
        </div>
      ) : (
        <div className="col" style={{ gap: 18 }}>
          <div className="album-pick hscroll">
            {albums.map((a) => (
              <button key={a.id} className={`album-tile ${album === a.id ? 'on' : ''}`} onClick={() => setAlbum(a.id)}>
                {a.cover ? <img src={a.cover} alt="" /> : <span className="album-tile-empty"><LockKeyhole /></span>}
                <b className="ellipsis">{a.title}</b>
                <small>{a.count} {a.count === 1 ? 'item' : 'itens'}</small>
              </button>
            ))}
          </div>
          <div className="field">
            <span>Acesso por</span>
            <div className="chips">
              {ALBUM_DURATIONS.map((d) => (
                <button key={d.label} className={`chip ${hours === d.hours ? 'on' : ''}`} onClick={() => setHours(d.hours)}>{d.label}</button>
              ))}
            </div>
          </div>
          <div className="quota card">
            {pro ? (
              <div className="row"><Crown size={18} color="#c4a6ff" /><span>Envios ilimitados no Pro</span></div>
            ) : (
              <>
                <div className="row small"><span className="grow">Envios grátis este mês</span><b className="num">{Math.min(used, limit)}/{limit}</b></div>
                <div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
                {credits > 0 && <p className="tiny muted" style={{ marginTop: 8 }}>+{credits} envios extras disponíveis</p>}
              </>
            )}
          </div>
          {out ? (
            <div className="col">
              <button className="btn btn-primary btn-block" onClick={buyPack} disabled={busy}>Comprar +10 envios · R$ 2,99</button>
              <button className="btn btn-glass btn-block" onClick={() => { onClose(); nav('/pro?motivo=albuns'); }}><Crown size={16} /> Ilimitado com o Pro</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" onClick={share} disabled={!album || busy}>
              {busy ? <span className="spinner" /> : <LockKeyhole size={18} />} Enviar para {toName}
            </button>
          )}
          <p className="faint tiny">Você pode revogar o acesso quando quiser em Perfil → Álbuns.</p>
        </div>
      )}
    </Sheet>
  );
}
