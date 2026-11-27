import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, Globe, MapPinOff, RefreshCw, Crown, X, Navigation2 } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { vibeScore } from '../lib/vibe';
import { LIMITS } from '../config/plans';
import { POSITIONS, TRIBES, LOOKING_FOR } from '../config/options';
import { EXPLORE_CITIES } from '../services/location';
import Logo from '../components/Logo';
import ProfileCard from '../components/ProfileCard';
import StoriesBar from '../components/StoriesBar';
import Sheet from '../components/Sheet';
import Chips from '../components/Chips';
import { SwitchRow } from '../components/Switch';
import Upsell, { useProGate } from '../components/Upsell';
import Empty from '../components/Empty';
import { tap } from '../lib/haptics';

const PAGE = 60;

export default function Nearby() {
  const me = useApp((s) => s.me);
  const status = useApp((s) => s.status);
  const filters = useApp((s) => s.filters);
  const setFilters = useApp((s) => s.setFilters);
  const resetFilters = useApp((s) => s.resetFilters);
  const explore = useApp((s) => s.explore);
  const setExplore = useApp((s) => s.setExplore);
  const cache = useApp((s) => s.nearbyCache);
  const setCache = useApp((s) => s.setNearbyCache);
  const coords = useApp((s) => s.coords);
  const settings = useApp((s) => s.settings);
  const setLocked = useApp((s) => s.setLocked);
  const gate = useProGate();
  const pro = !!status?.is_pro;

  const [list, setList] = useState(cache);
  const [loading, setLoading] = useState(!cache.length);
  const [more, setMore] = useState(true);
  const [tray, setTray] = useState([]);
  const [storyBusy, setStoryBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [sortVibe, setSortVibe] = useState(false);
  const [pull, setPull] = useState(0);
  const scroller = useRef(null);
  const sentinel = useRef(null);
  const touch = useRef(null);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    try {
      const offset = reset ? 0 : list.length;
      const rows = await api.nearby({ filters, explore, offset, limit: PAGE });
      const next = reset ? rows : [...list, ...rows];
      setList(next);
      setMore(rows.length === PAGE);
      if (reset && !explore) setCache(next);
    } catch (e) {
      if (e.code === 'PRO_REQUIRED') setExplore(null);
      toast(errorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, explore, list, setCache, setExplore]);

  const loadTray = useCallback(() => api.storiesTray().then(setTray).catch(() => {}), []);

  // recarrega quando filtros/exploração/posição mudam
  useEffect(() => {
    load(true);
    loadTray();
  }, [filters, explore, coords?.lat, coords?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // rolagem infinita
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((ents) => {
      if (ents[0].isIntersecting && more && !loading) load(false);
    }, { root: scroller.current, rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, loading, load]);

  const shown = useMemo(() => {
    const withVibe = list.map((p) => ({ p, vibe: vibeScore(me?.profile, p) }));
    if (sortVibe) withVibe.sort((a, b) => b.vibe - a.vibe);
    return withVibe;
  }, [list, me?.profile, sortVibe]);

  const advancedOn = filters.positions.length + filters.tribes.length + filters.looking_for.length > 0;
  const anyFilter = filters.online_only || filters.with_photo || advancedOn || filters.age_min > 18 || filters.age_max < 60 || filters.max_km;
  const hitFreeLimit = !pro && list.length >= LIMITS.freeGridLimit;

  const createStory = async (file) => {
    setStoryBusy(true);
    try {
      await api.createStory(file);
      toast('Story publicado por 24h', 'success');
      loadTray();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setStoryBusy(false);
    }
  };

  // puxar para atualizar
  const onTouchStart = (e) => {
    if (scroller.current.scrollTop <= 0) touch.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (touch.current == null) return;
    const d = e.touches[0].clientY - touch.current;
    setPull(d > 0 ? Math.min(90, d * 0.5) : 0);
  };
  const onTouchEnd = () => {
    if (pull > 60) { tap('Medium'); load(true); loadTray(); }
    touch.current = null;
    setPull(0);
  };

  return (
    <div className="screen">
      <header className="topbar">
        <Logo onDoubleClick={() => settings.pinHash && setLocked(true)} />
        <div className="grow" />
        <button className={`icon-btn ${explore ? 'active' : ''}`} onClick={() => (pro ? setSheet('explore') : gate('explorar'))} aria-label="Explorar cidades">
          <Globe size={22} />
        </button>
        <button className={`icon-btn ${anyFilter ? 'active' : ''}`} onClick={() => setSheet('filters')} aria-label="Filtros">
          <SlidersHorizontal size={22} />
        </button>
      </header>

      <div className="scroll with-tabbar" ref={scroller} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="pull" style={{ height: pull, opacity: pull / 60 }}>
          <RefreshCw size={18} style={{ transform: `rotate(${pull * 4}deg)` }} />
        </div>

        <StoriesBar tray={tray} me={me} onCreate={createStory} busy={storyBusy} />

        {explore && (
          <div className="pad" style={{ marginBottom: 10 }}>
            <div className="explore-banner">
              <Navigation2 size={16} />
              <span className="grow">Explorando <b>{explore.name}</b></span>
              <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setExplore(null)} aria-label="Voltar para minha localização"><X size={16} /></button>
            </div>
          </div>
        )}

        <div className="quick-filters hscroll pad">
          <button className={`chip ${filters.online_only ? 'on' : ''}`} onClick={() => setFilters({ online_only: !filters.online_only })}>
            <i className="dot-online" /> Online
          </button>
          <button className={`chip ${filters.with_photo ? 'on' : ''}`} onClick={() => setFilters({ with_photo: !filters.with_photo })}>Com foto</button>
          <button className={`chip ${sortVibe ? 'on' : ''}`} onClick={() => setSortVibe(!sortVibe)}>✨ Mais vibe</button>
          {POSITIONS.slice(0, 5).map((p) => (
            <button key={p.id} className={`chip ${filters.positions.includes(p.id) ? 'on' : ''} ${!pro ? 'locked' : ''}`}
              onClick={() => (pro ? setFilters({ positions: filters.positions.includes(p.id) ? filters.positions.filter((x) => x !== p.id) : [...filters.positions, p.id] }) : gate('filtros'))}>
              {p.label}{!pro && <Crown />}
            </button>
          ))}
        </div>

        {loading && !list.length ? (
          <div className="grid pad">
            {Array.from({ length: 12 }, (_, i) => <div key={i} className="pcard skeleton" />)}
          </div>
        ) : !list.length ? (
          <Empty
            icon={<MapPinOff />}
            title="Ninguém por aqui… ainda"
            text={anyFilter ? 'Tente afrouxar os filtros para ver mais gente.' : 'Volte mais tarde ou poste algo no Agora para chamar atenção.'}
            action={anyFilter && <button className="btn btn-glass" onClick={resetFilters}>Limpar filtros</button>}
          />
        ) : (
          <div className="grid pad">
            {shown.map(({ p, vibe }, i) => <ProfileCard key={p.id} p={p} vibe={vibe} index={i} />)}
          </div>
        )}

        <div ref={sentinel} style={{ height: 1 }} />
        {hitFreeLimit && (
          <div className="pad" style={{ marginTop: 16 }}>
            <Upsell title="Tem mais gente por perto" text={`No grátis você vê ${LIMITS.freeGridLimit} perfis. No Pro, todo mundo.`} reason="limite" />
          </div>
        )}
        {loading && list.length > 0 && <div className="center" style={{ padding: 20 }}><span className="spinner" /></div>}
      </div>

      <FilterSheet open={sheet === 'filters'} onClose={() => setSheet(null)} filters={filters} setFilters={setFilters} reset={resetFilters} pro={pro} gate={gate} />
      <Sheet open={sheet === 'explore'} onClose={() => setSheet(null)} title="Explorar cidades">
        <p className="muted small" style={{ marginBottom: 14 }}>Veja e converse com quem está em outra cidade antes de chegar lá.</p>
        <div className="list">
          {explore && (
            <button className="list-item" onClick={() => { setExplore(null); setSheet(null); }}>
              <Navigation2 size={20} /><span className="txt"><b>Minha localização</b></span>
            </button>
          )}
          {EXPLORE_CITIES.map((c) => (
            <button key={c.name} className="list-item" onClick={() => { setExplore(c); setSheet(null); }}>
              <Globe size={20} />
              <span className="txt">{c.name}</span>
              {explore?.name === c.name && <span className="end">ativo</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function FilterSheet({ open, onClose, filters, setFilters, reset, pro, gate }) {
  const [f, setF] = useState(filters);
  useEffect(() => { if (open) setF(filters); }, [open, filters]);
  const upd = (patch) => setF({ ...f, ...patch });
  const apply = () => { setFilters(f); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="Filtros" tall
      footer={<div className="row"><button className="btn btn-ghost" onClick={() => { reset(); onClose(); }}>Limpar</button><button className="btn btn-primary grow" onClick={apply}>Aplicar</button></div>}>
      <div className="col" style={{ gap: 22 }}>
        <div className="list" style={{ padding: '0 16px' }}>
          <SwitchRow title="Só quem está online" on={f.online_only} onChange={(v) => upd({ online_only: v })} />
          <SwitchRow title="Só com foto" on={f.with_photo} onChange={(v) => upd({ with_photo: v })} />
        </div>
        <div className="field">
          <span>Idade: {f.age_min} – {f.age_max >= 60 ? '60+' : f.age_max}</span>
          <div className="range-duo">
            <input type="range" min={18} max={60} value={f.age_min} onChange={(e) => upd({ age_min: Math.min(+e.target.value, f.age_max) })} aria-label="Idade mínima" />
            <input type="range" min={18} max={60} value={Math.min(f.age_max, 60)} onChange={(e) => upd({ age_max: +e.target.value >= 60 ? 99 : Math.max(+e.target.value, f.age_min) })} aria-label="Idade máxima" />
          </div>
        </div>
        <div className="field">
          <span>Distância máxima: {f.max_km ? `${f.max_km} km` : 'qualquer'}</span>
          <input type="range" min={1} max={51} value={f.max_km || 51} onChange={(e) => upd({ max_km: +e.target.value >= 51 ? null : +e.target.value })} aria-label="Distância máxima" />
        </div>
        <div className="divider" style={{ margin: 0 }} />
        <div className="row"><b className="grow">Filtros Pro</b>{!pro && <span className="badge pro"><Crown />PRO</span>}</div>
        <div className="field"><span>Posição</span><Chips options={POSITIONS} value={f.positions} onChange={(v) => upd({ positions: v })} locked={!pro} onLocked={() => { onClose(); gate('filtros'); }} /></div>
        <div className="field"><span>Procurando</span><Chips options={LOOKING_FOR} value={f.looking_for} onChange={(v) => upd({ looking_for: v })} locked={!pro} onLocked={() => { onClose(); gate('filtros'); }} /></div>
        <div className="field"><span>Tribos</span><Chips options={TRIBES} value={f.tribes} onChange={(v) => upd({ tribes: v })} locked={!pro} onLocked={() => { onClose(); gate('filtros'); }} /></div>
      </div>
    </Sheet>
  );
}
