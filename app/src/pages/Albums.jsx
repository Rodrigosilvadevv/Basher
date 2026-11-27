import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LockKeyhole, Plus, ImagePlus, Trash2, Pencil, X, Crown, UserRound } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { expiresLabel, timeAgo } from '../lib/format';
import { buy } from '../services/purchases';
import TopBar from '../components/TopBar';
import Sheet from '../components/Sheet';
import FilePick from '../components/FilePick';
import Empty from '../components/Empty';
import Avatar from '../components/Avatar';

function Quota() {
  const status = useApp((s) => s.status);
  const setStatus = useApp((s) => s.setStatus);
  const me = useApp((s) => s.me);
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!status) return null;
  if (status.is_pro) {
    return <div className="quota card row"><Crown size={18} color="#c4a6ff" /><span className="grow">Envios de álbum ilimitados no Pro</span></div>;
  }
  const used = status.album_used;
  const limit = status.album_free_limit;
  const pack = async () => {
    setBusy(true);
    try {
      setStatus(await buy('album_pack', me.id));
      toast('+10 envios liberados', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="quota card">
      <div className="row small"><span className="grow">Envios grátis em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}</span><b className="num">{Math.min(used, limit)}/{limit}</b></div>
      <div className="progress" style={{ margin: '10px 0' }}><i style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
      <div className="row">
        <span className="tiny muted grow">{status.album_credits > 0 ? `+${status.album_credits} envios extras` : 'Renova todo dia 1º'}</span>
        <button className="btn btn-glass btn-sm" onClick={pack} disabled={busy}>+10 por R$ 2,99</button>
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/pro?motivo=albuns')}><Crown size={14} /> ∞</button>
      </div>
    </div>
  );
}

export function Albums() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const setStatus = useApp((s) => s.setStatus);
  const [albums, setAlbums] = useState(null);
  const [creating, setCreating] = useState(params.get('novo') === '1');
  const [title, setTitle] = useState('');
  const load = () => api.myAlbums().then(setAlbums).catch(() => setAlbums([]));
  useEffect(() => {
    load();
    api.myStatus().then(setStatus).catch(() => {});
  }, [setStatus]);

  const create = async () => {
    try {
      const a = await api.createAlbum(title.trim() || 'Álbum privado');
      setCreating(false);
      setParams({});
      setTitle('');
      nav(`/perfil/albuns/${a.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div className="screen">
      <TopBar title="Álbuns privados" right={<button className="icon-btn" onClick={() => setCreating(true)} aria-label="Novo álbum"><Plus size={24} /></button>} />
      <div className="scroll pad" style={{ paddingTop: 16, paddingBottom: 40 }}>
        <Quota />
        <p className="small muted" style={{ margin: '16px 0' }}>
          Só quem você escolher vê seus álbuns, pelo tempo que você decidir. Quem recebe vê uma marca d'água com o próprio nome, e você revoga o acesso quando quiser.
        </p>
        {albums === null ? null : !albums.length ? (
          <Empty icon={<LockKeyhole />} title="Nenhum álbum ainda" text="Crie um álbum para guardar as fotos que você só manda para quem quiser." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={17} /> Criar álbum</button>} />
        ) : (
          <div className="albums-grid">
            {albums.map((a) => (
              <button key={a.id} className="album-tile big" onClick={() => nav(`/perfil/albuns/${a.id}`)}>
                {a.cover ? <img src={a.cover} alt="" /> : <span className="album-tile-empty"><LockKeyhole /></span>}
                <b className="ellipsis">{a.title}</b>
                <small>{a.count} {a.count === 1 ? 'item' : 'itens'}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <Sheet open={creating} onClose={() => { setCreating(false); setParams({}); }} title="Novo álbum">
        <div className="col" style={{ gap: 14 }}>
          <input className="input" autoFocus placeholder="Nome do álbum (ex.: Depois das 2h)" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="btn btn-primary btn-block" onClick={create}><LockKeyhole size={17} /> Criar</button>
        </div>
      </Sheet>
    </div>
  );
}

export function AlbumDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState(null);
  const [shares, setShares] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState(null);
  const [view, setView] = useState(null);

  const load = async () => {
    try {
      const [m, i, s] = await Promise.all([api.albumMeta(id), api.albumItems(id), api.albumShares(id)]);
      setMeta(m);
      setItems(i);
      setShares(s);
    } catch (e) {
      toast(errorMessage(e), 'error');
      nav(-1);
    }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (files) => {
    setBusy(true);
    try {
      for (const f of files) await api.addAlbumItem(id, f);
      setItems(await api.albumItems(id));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (it) => {
    await api.deleteAlbumItem(it).catch((e) => toast(errorMessage(e), 'error'));
    setItems((x) => x.filter((y) => y.id !== it.id));
    setView(null);
  };
  const revoke = async (s) => {
    await api.revokeShare(s.id).catch((e) => toast(errorMessage(e), 'error'));
    setShares((x) => x.filter((y) => y.id !== s.id));
    toast(`Acesso de ${s.recipient?.display_name} revogado`, 'success');
  };
  const del = async () => {
    await api.deleteAlbum(id);
    toast('Álbum apagado', 'success');
    nav(-1);
  };
  const doRename = async () => {
    await api.renameAlbum(id, rename.trim() || meta.title);
    setMeta({ ...meta, title: rename.trim() || meta.title });
    setRename(null);
  };

  return (
    <div className="screen">
      <TopBar
        title={meta?.title || ''}
        subtitle={items ? `${items.length} itens · privado` : ''}
        right={
          <>
            <button className="icon-btn" onClick={() => setRename(meta?.title || '')} aria-label="Renomear"><Pencil size={20} /></button>
            <button className="icon-btn" onClick={del} aria-label="Apagar álbum"><Trash2 size={20} /></button>
          </>
        }
      />
      <div className="scroll pad" style={{ paddingTop: 16, paddingBottom: 40 }}>
        <div className="photo-grid three">
          <FilePick className="photo-slot add" multiple accept="image/*,video/mp4,video/quicktime" onFiles={add} disabled={busy} ariaLabel="Adicionar">
            {busy ? <span className="spinner" /> : <ImagePlus size={24} />}
          </FilePick>
          {(items || []).map((it) => (
            <button key={it.id} className="photo-slot" onClick={() => setView(it)}>
              {it.media_type === 'video' ? <video src={it.url} muted playsInline /> : <img src={it.url} alt="" />}
            </button>
          ))}
        </div>

        <div className="section">
          <div className="section-title">Quem tem acesso <span className="faint small" style={{ fontWeight: 500 }}>· {shares.length}</span></div>
          {!shares.length ? (
            <p className="small faint">Ninguém ainda. Envie pelo chat (ícone de cadeado) ou aceitando um pedido.</p>
          ) : (
            <div className="list">
              {shares.map((s) => (
                <div key={s.id} className="list-item">
                  {s.recipient?.avatar_url ? <Avatar src={s.recipient.avatar_url} name={s.recipient.display_name} size={36} /> : <UserRound />}
                  <span className="txt"><b>{s.recipient?.display_name}</b><small>{expiresLabel(s.expires_at)} · enviado há {timeAgo(s.created_at)}</small></span>
                  <button className="btn btn-glass btn-sm" onClick={() => revoke(s)}>Revogar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={rename !== null} onClose={() => setRename(null)} title="Renomear álbum">
        <div className="col" style={{ gap: 14 }}>
          <input className="input" value={rename || ''} maxLength={40} onChange={(e) => setRename(e.target.value)} />
          <button className="btn btn-primary btn-block" onClick={doRename}>Salvar</button>
        </div>
      </Sheet>
      {view && (
        <div className="viewer">
          <header className="viewer-head">
            <div className="grow" />
            <button className="icon-btn glass" onClick={() => remove(view)} aria-label="Apagar"><Trash2 size={20} /></button>
            <button className="icon-btn glass" onClick={() => setView(null)} aria-label="Fechar"><X size={22} /></button>
          </header>
          <div className="viewer-slide">{view.media_type === 'video' ? <video src={view.url} controls playsInline /> : <img src={view.url} alt="" />}</div>
        </div>
      )}
    </div>
  );
}
