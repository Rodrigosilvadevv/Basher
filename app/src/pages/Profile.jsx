import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, Pencil, LockKeyhole, Eye, Crown, ChevronRight, ImagePlus, X, Plus, CirclePlay } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { positionLabel, LOOKING_FOR } from '../config/options';
import { ageFrom } from '../lib/format';
import Avatar from '../components/Avatar';
import FilePick from '../components/FilePick';
import Upsell from '../components/Upsell';
import { StaticChips } from '../components/Chips';

export default function Profile() {
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const setMe = useApp((s) => s.setMe);
  const status = useApp((s) => s.status);
  const setStatus = useApp((s) => s.setStatus);
  const [viewers, setViewers] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hasStory, setHasStory] = useState(false);
  const p = me?.profile || {};
  const age = ageFrom(me?.private?.birthdate);

  useEffect(() => {
    api.getMe().then(setMe).catch(() => {});
    api.myStatus().then(setStatus).catch(() => {});
    api.myViewers().then(setViewers).catch(() => {});
    api.myAlbums().then(setAlbums).catch(() => {});
    api.storiesTray().then((t) => setHasStory(t.some((x) => x.is_me))).catch(() => {});
  }, [setMe, setStatus]);

  const addPhoto = async (file) => {
    setBusy(true);
    try {
      const ph = await api.uploadPhoto(file, me.photos?.length || 0);
      if (!p.avatar_url) await api.updateProfile({ avatar_url: ph.url });
      setMe(await api.getMe());
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const removePhoto = async (ph) => {
    try {
      await api.deletePhoto(ph);
      if (p.avatar_url === ph.url) {
        const next = me.photos.find((x) => x.id !== ph.id);
        await api.updateProfile({ avatar_url: next?.url || null });
      }
      setMe(await api.getMe());
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const makeMain = async (ph) => {
    await api.updateProfile({ avatar_url: ph.url });
    setMe(await api.getMe());
    toast('Foto principal atualizada', 'success');
  };

  const photos = me?.photos || [];
  return (
    <div className="screen">
      <header className="topbar">
        <div className="title">{p.display_name || 'Perfil'}</div>
        <button className="icon-btn" onClick={() => nav('/config')} aria-label="Configurações"><Settings2 size={22} /></button>
      </header>
      <div className="scroll with-tabbar pad">
        <div className="me-head rise">
          <button className="me-avatar" onClick={() => hasStory && nav(`/stories/${me.id}`)}>
            <Avatar src={p.avatar_url} name={p.display_name} size={104} ring={hasStory || status?.is_pro} />
            {hasStory && <span className="me-story"><CirclePlay size={14} /></span>}
          </button>
          <h1>{p.display_name}{age ? <span className="age">{age}</span> : null}</h1>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
            {positionLabel(p.sex_position) && <span className="badge glass">{positionLabel(p.sex_position)}</span>}
            {status?.is_pro && <span className="badge pro"><Crown />PRO</span>}
          </div>
          {p.status_text && <p className="muted small" style={{ marginTop: 8 }}>“{p.status_text}”</p>}
          <button className="btn btn-glass btn-sm" style={{ marginTop: 14 }} onClick={() => nav('/perfil/editar')}><Pencil size={15} /> Editar perfil</button>
        </div>

        <div className="me-stats">
          <button onClick={() => nav('/visitas')}>
            <b className="num">{viewers?.count ?? '–'}</b><span><Eye size={13} /> Visitas</span>
          </button>
          <button onClick={() => nav('/perfil/albuns')}>
            <b className="num">{albums.length}</b><span><LockKeyhole size={13} /> Álbuns</span>
          </button>
          <button onClick={() => nav('/perfil/albuns')}>
            <b className="num">{status?.is_pro ? '∞' : Math.max(0, (status?.album_free_limit || 20) - (status?.album_used || 0)) + (status?.album_credits || 0)}</b><span>Envios restantes</span>
          </button>
        </div>

        {!status?.is_pro && <div style={{ marginTop: 18 }}><Upsell reason="perfil" /></div>}

        <div className="section">
          <div className="section-title"><span className="grow">Fotos públicas</span><span className="faint small" style={{ fontWeight: 500 }}>{photos.length}/6</span></div>
          <div className="photo-grid">
            {photos.map((ph) => (
              <div key={ph.id} className={`photo-slot ${p.avatar_url === ph.url ? 'main' : ''}`}>
                <img src={ph.url} alt="" onClick={() => makeMain(ph)} />
                {p.avatar_url === ph.url && <span className="main-tag">Principal</span>}
                <button className="photo-x" onClick={() => removePhoto(ph)} aria-label="Remover foto"><X size={14} /></button>
              </div>
            ))}
            {photos.length < 6 && (
              <FilePick className="photo-slot add" onFiles={addPhoto} disabled={busy} ariaLabel="Adicionar foto">
                {busy ? <span className="spinner" /> : <ImagePlus size={24} />}
              </FilePick>
            )}
          </div>
          <p className="faint tiny" style={{ marginTop: 8 }}>Toque numa foto para torná-la principal. Sem nudez nas fotos públicas.</p>
        </div>

        <div className="section">
          <div className="section-title"><span className="grow">Álbuns privados</span>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/perfil/albuns')}>Gerenciar <ChevronRight size={15} /></button>
          </div>
          <div className="album-strip hscroll">
            {albums.map((a) => (
              <button key={a.id} className="album-tile" onClick={() => nav(`/perfil/albuns/${a.id}`)}>
                {a.cover ? <img src={a.cover} alt="" /> : <span className="album-tile-empty"><LockKeyhole /></span>}
                <b className="ellipsis">{a.title}</b>
                <small>{a.count} itens</small>
              </button>
            ))}
            <button className="album-tile new" onClick={() => nav('/perfil/albuns?novo=1')}>
              <span className="album-tile-empty"><Plus /></span>
              <b>Novo álbum</b>
            </button>
          </div>
        </div>

        {p.bio && (
          <div className="section">
            <div className="section-title">Bio</div>
            <p className="bio">{p.bio}</p>
          </div>
        )}
        {p.looking_for?.length > 0 && (
          <div className="section">
            <div className="section-title">Procurando</div>
            <StaticChips items={p.looking_for.map((x) => LOOKING_FOR.find((l) => l.id === x)?.label || x)} />
          </div>
        )}
        {p.interests?.length > 0 && (
          <div className="section">
            <div className="section-title">Curto</div>
            <StaticChips items={p.interests} />
          </div>
        )}
        {p.tribes?.length > 0 && (
          <div className="section">
            <div className="section-title">Tribos</div>
            <StaticChips items={p.tribes} />
          </div>
        )}
      </div>
    </div>
  );
}
