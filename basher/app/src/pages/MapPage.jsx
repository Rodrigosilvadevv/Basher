import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, ShieldCheck, Flame, X } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { env, DEFAULT_COORDS } from '../lib/env';
import { errorMessage } from '../lib/errors';
import { formatDistance } from '../lib/format';
import { positionShort } from '../config/options';
import Segmented from '../components/Segmented';
import Avatar from '../components/Avatar';
import { tap } from '../lib/haptics';

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19.5 21 12 16.8 4.5 21Z"/></svg>';
const CLUSTER_PX = 40;

// ângulo estável por pessoa, para as setinhas não ficarem todas iguais
const angleOf = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

function clusterize(map, people) {
  const pts = people.map((p) => ({ p, pt: map.latLngToLayerPoint([p.approx_lat, p.approx_lng]) }));
  const used = new Set();
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    const group = [pts[i]];
    used.add(i);
    for (let j = i + 1; j < pts.length; j++) {
      if (!used.has(j) && pts[i].pt.distanceTo(pts[j].pt) < CLUSTER_PX) {
        group.push(pts[j]);
        used.add(j);
      }
    }
    const lat = group.reduce((s, g) => s + g.p.approx_lat, 0) / group.length;
    const lng = group.reduce((s, g) => s + g.p.approx_lng, 0) / group.length;
    out.push({ lat, lng, people: group.map((g) => g.p) });
  }
  return out;
}

function iconFor(c) {
  const n = c.people.length;
  if (n === 1) {
    const p = c.people[0];
    return L.divIcon({
      className: '',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<div class="mk-one ${p.online ? 'on' : ''} ${p.is_pro ? 'pro' : ''}" style="--r:${angleOf(p.id)}deg">${ARROW}</div>`,
    });
  }
  const shown = Math.min(n, 5);
  const arrows = Array.from({ length: shown }, (_, i) => {
    const spread = (i - (shown - 1) / 2) * 26;
    return `<span style="--r:${spread}deg;--d:${i * 60}ms">${ARROW}</span>`;
  }).join('');
  const hot = n >= 3;
  return L.divIcon({
    className: '',
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    html: `<div class="mk-cluster ${hot ? 'hot' : ''} ${c.people.some((p) => p.online) ? 'on' : ''}">${hot ? '<i class="mk-pulse"></i>' : ''}<div class="mk-arrows">${arrows}</div><b class="mk-count">${n}</b></div>`,
  });
}

export default function MapPage() {
  const nav = useNavigate();
  const coords = useApp((s) => s.coords);
  const explore = useApp((s) => s.explore);
  const center = explore || coords || DEFAULT_COORDS;
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const meMarker = useRef(null);
  const [people, setPeople] = useState([]);
  const [mode, setMode] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tilesOk, setTilesOk] = useState(true);
  const [zoomTick, setZoomTick] = useState(0);

  // cria o mapa uma vez
  useEffect(() => {
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      center: [center.lat, center.lng],
      zoom: 15,
      minZoom: 11,
      maxZoom: 18,
      zoomSnap: 0.5,
    });
    const tiles = L.tileLayer(env.MAP_TILES, { subdomains: 'abcd', maxZoom: 19, attribution: env.MAP_ATTRIBUTION, detectRetina: true }).addTo(m);
    let errs = 0;
    tiles.on('tileerror', () => { if (++errs > 6) setTilesOk(false); });
    tiles.on('tileload', () => { errs = 0; setTilesOk(true); });
    m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    layer.current = L.layerGroup().addTo(m);
    meMarker.current = L.marker([center.lat, center.lng], {
      icon: L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13], html: '<div class="mk-me"><i></i><b></b></div>' }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(m);
    m.on('zoomend', () => setZoomTick((t) => t + 1));
    m.on('click', () => setSelected(null));
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => m.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // recentra quando muda a posição ou a cidade explorada
  useEffect(() => {
    if (!map.current) return;
    map.current.setView([center.lat, center.lng], map.current.getZoom());
    meMarker.current?.setLatLng([center.lat, center.lng]);
    meMarker.current?.setOpacity(explore ? 0 : 1);
  }, [center.lat, center.lng, explore]);

  // carrega pessoas
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.nearby({ filters: { online_only: mode === 'online' }, explore, limit: 100 })
      .then((rows) => alive && setPeople(rows.filter((p) => p.approx_lat != null)))
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [mode, explore, coords?.lat, coords?.lng]);

  const clusters = useMemo(() => (map.current ? clusterize(map.current, people) : []), [people, zoomTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // desenha marcadores
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    clusters.forEach((c) => {
      const mk = L.marker([c.lat, c.lng], { icon: iconFor(c), riseOnHover: true });
      mk.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        tap();
        setSelected(c);
      });
      g.addLayer(mk);
    });
  }, [clusters]);

  const hotspots = clusters.filter((c) => c.people.length >= 3).length;
  const onlineCount = people.filter((p) => p.online).length;

  return (
    <div className="screen map-screen">
      {/* a classe do container do Leaflet não pode ser controlada pelo React */}
      <div className={`map-wrap ${tilesOk ? '' : 'no-tiles'}`}>
        <div ref={el} className="map" />
      </div>

      <div className="map-top">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[{ id: 'all', label: 'Todos' }, { id: 'online', label: 'Online' }]}
        />
        <div className="map-stats card">
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (
            <>
              <span><b className="num">{people.length}</b> por perto</span>
              <span className="sep" />
              <i className="dot-online" /> <span className="num">{onlineCount}</span>
              {hotspots > 0 && (<><span className="sep" /><Flame size={14} color="#f0abfc" /> <span className="num">{hotspots}</span></>)}
            </>
          )}
        </div>
      </div>

      <div className="map-privacy"><ShieldCheck size={13} /> Posições aproximadas (~200 m)</div>

      <button className="icon-btn glass map-locate" aria-label="Centralizar" onClick={() => map.current?.flyTo([center.lat, center.lng], 15, { duration: 0.6 })}>
        <LocateFixed size={22} />
      </button>

      {selected && (
        <div className="map-panel rise">
          <div className="row" style={{ padding: '0 4px 10px' }}>
            {selected.people.length >= 3 && <Flame size={16} color="#f0abfc" />}
            <b className="grow">
              {selected.people.length === 1 ? 'Por aqui' : `${selected.people.length} pessoas ${selected.people.length >= 3 ? 'neste hotspot' : 'juntas'}`}
            </b>
            <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setSelected(null)} aria-label="Fechar"><X size={18} /></button>
          </div>
          <div className="map-people hscroll">
            {selected.people.map((p) => (
              <button key={p.id} className="map-person" onClick={() => nav(`/u/${p.id}`)}>
                <Avatar src={p.avatar_url} name={p.display_name} size={58} online={p.online} ring={p.has_story} blur />
                <b className="ellipsis">{p.display_name}{p.age ? `, ${p.age}` : ''}</b>
                <small className="num">{[positionShort(p.sex_position), formatDistance(p.distance_m)].filter(Boolean).join(' · ')}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
